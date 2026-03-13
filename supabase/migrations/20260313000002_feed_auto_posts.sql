-- ============================================
-- Auto-posts no community feed via triggers
-- ============================================

-- Trigger 1: Vitória diária quando todos os 4 checks estão completos
CREATE OR REPLACE FUNCTION auto_post_daily_victory()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_name TEXT;
    v_streak INTEGER;
    v_all_done BOOLEAN;
    v_already_posted BOOLEAN;
    v_body TEXT;
BEGIN
    -- Verifica se todos os 4 checks estão marcados agora
    v_all_done := (
        COALESCE(NEW.water_check, false) AND
        COALESCE(NEW.workout_check, false) AND
        COALESCE(NEW.sleep_check, false) AND
        COALESCE(NEW.meal_plan_check, false)
    );

    -- Só age quando completa (e não estava completo antes)
    IF NOT v_all_done THEN
        RETURN NEW;
    END IF;

    -- Se é UPDATE, checar se já estava completo antes (evitar duplicata)
    IF TG_OP = 'UPDATE' THEN
        DECLARE
            v_was_done BOOLEAN;
        BEGIN
            v_was_done := (
                COALESCE(OLD.water_check, false) AND
                COALESCE(OLD.workout_check, false) AND
                COALESCE(OLD.sleep_check, false) AND
                COALESCE(OLD.meal_plan_check, false)
            );
            IF v_was_done THEN
                RETURN NEW; -- Já estava completo, não postar de novo
            END IF;
        END;
    END IF;

    -- Buscar dados do perfil
    SELECT p.tenant_id, p.name, COALESCE(p.current_streak, 0)
    INTO v_tenant_id, v_name, v_streak
    FROM profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Verificar se já postou vitória hoje
    SELECT EXISTS(
        SELECT 1 FROM community_posts
        WHERE user_id = NEW.user_id
          AND type = 'victory'
          AND created_at::date = CURRENT_DATE
    ) INTO v_already_posted;

    IF v_already_posted THEN
        RETURN NEW;
    END IF;

    -- Montar mensagem
    IF v_streak >= 30 THEN
        v_body := '🏆 Missão completa! Água ✅ Treino ✅ Sono ✅ Alimentação ✅ — ' || v_streak || ' dias seguidos de consistência. Imparável!';
    ELSIF v_streak >= 7 THEN
        v_body := '🔥 Dia completo! 4/4 checks marcados e ' || v_streak || ' dias de streak. Isso é disciplina!';
    ELSE
        v_body := '✅ Dia completo! Água, treino, sono e alimentação — tudo marcado hoje. Cada dia conta!';
    END IF;

    -- Inserir post no feed
    INSERT INTO community_posts (tenant_id, user_id, type, body, meta)
    VALUES (
        v_tenant_id,
        NEW.user_id,
        'victory',
        v_body,
        jsonb_build_object(
            'streak_days', v_streak,
            'log_date', NEW.log_date::text,
            'goal', 'Dia completo 4/4'
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_post_daily_victory ON daily_logs;
CREATE TRIGGER trg_auto_post_daily_victory
    AFTER INSERT OR UPDATE ON daily_logs
    FOR EACH ROW
    EXECUTE FUNCTION auto_post_daily_victory();

-- -------------------------------------------------------

-- Trigger 2: Marco de streak quando atinge 7, 14, 21, 30, 60, 100
CREATE OR REPLACE FUNCTION auto_post_streak_milestone()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_name TEXT;
    v_milestones INTEGER[] := ARRAY[7, 14, 21, 30, 60, 100];
    v_body TEXT;
    v_already_posted BOOLEAN;
BEGIN
    -- Só executa quando streak muda para um valor milestone
    IF NEW.current_streak = OLD.current_streak THEN
        RETURN NEW;
    END IF;

    IF NOT (NEW.current_streak = ANY(v_milestones)) THEN
        RETURN NEW;
    END IF;

    SELECT tenant_id, name INTO v_tenant_id, v_name
    FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

    IF v_tenant_id IS NULL THEN RETURN NEW; END IF;

    -- Evitar duplicata no mesmo dia
    SELECT EXISTS(
        SELECT 1 FROM community_posts
        WHERE user_id = NEW.user_id
          AND type = 'streak'
          AND (meta->>'streak_days')::int = NEW.current_streak
          AND created_at > NOW() - INTERVAL '1 day'
    ) INTO v_already_posted;

    IF v_already_posted THEN RETURN NEW; END IF;

    -- Mensagem por milestone
    v_body := CASE NEW.current_streak
        WHEN 7   THEN '🔥 7 dias de streak! Uma semana inteira sem parar. Isso não é sorte — é escolha!'
        WHEN 14  THEN '🔥🔥 14 dias! Duas semanas de consistência. O hábito está se formando!'
        WHEN 21  THEN '💪 21 dias! Dizem que 21 dias formam um hábito. Você comprovou!'
        WHEN 30  THEN '🏆 30 dias de streak! Um mês inteiro. Você é uma rainha de verdade!'
        WHEN 60  THEN '👑 60 DIAS! Dois meses de constância. Isso é transformação de verdade!'
        WHEN 100 THEN '🌟 100 DIAS!!! Você é lendária! 100 dias de comprometimento com você mesma!'
        ELSE '🔥 Marco de streak atingido!'
    END;

    INSERT INTO community_posts (tenant_id, user_id, type, body, meta)
    VALUES (
        v_tenant_id,
        NEW.user_id,
        'streak',
        v_body,
        jsonb_build_object('streak_days', NEW.current_streak)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_post_streak_milestone ON profiles;
CREATE TRIGGER trg_auto_post_streak_milestone
    AFTER UPDATE OF current_streak ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_post_streak_milestone();

-- -------------------------------------------------------

-- Permissão: triggers rodam como SECURITY DEFINER (service role)
-- RLS já cobre leitura — não é necessário ajuste adicional
