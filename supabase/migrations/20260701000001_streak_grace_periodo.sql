-- ============================================================
-- Migration: Grace period + histórico de streak de adesão
-- Fase 1 (adaptada) — Gamificação: Streaks de Adesão
-- 2026-07-01
--
-- NÃO cria um sistema de streak paralelo: estende o streak que já
-- existe (profiles.current_streak / longest_streak / last_checkin_date,
-- mantido pela trigger update_gamification_after_log() em daily_logs).
-- ============================================================

-- Mês (YYYY-MM) em que a paciente já usou seu dia de tolerância do streak
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_grace_usado_mes TEXT;

-- Auditoria diária do streak: dado clínico (quando manteve, quando quebrou,
-- quando usou o grace period) + fonte para a timeline de 7 dias no app
CREATE TABLE IF NOT EXISTS historico_streak (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data          date NOT NULL,
  streak_valor  integer NOT NULL DEFAULT 0,
  manteve       boolean NOT NULL,             -- streak seguiu vivo nesse dia?
  usou_grace    boolean NOT NULL DEFAULT false,
  origem        text NOT NULL DEFAULT 'daily_log' CHECK (origem IN ('daily_log', 'reset_diario')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(paciente_id, data)
);

CREATE INDEX IF NOT EXISTS idx_historico_streak_paciente_data
  ON historico_streak(paciente_id, data DESC);

ALTER TABLE historico_streak ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_ve_proprio_historico_streak" ON historico_streak
  FOR SELECT USING (auth.uid() = paciente_id);

CREATE POLICY "nutri_ve_historico_streak" ON historico_streak
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.role IN ('nutritionist', 'admin')
        AND paciente_id IN (
          SELECT user_id FROM profiles WHERE tenant_id = t.id
        )
    )
  );

CREATE POLICY "service_role_historico_streak" ON historico_streak
  FOR ALL TO service_role USING (true);

-- ============================================================
-- Substitui a trigger function existente para acrescentar:
-- 1) grace period (1 dia de tolerância por mês, streak >= 3 dias)
-- 2) registro em historico_streak a cada dia processado
-- Mantém 100% do comportamento de moedas/XP/nível já existente.
-- ============================================================
CREATE OR REPLACE FUNCTION update_gamification_after_log()
RETURNS TRIGGER AS $$
DECLARE
  v_new_coins INTEGER;
  v_old_coins INTEGER;
  v_delta INTEGER;
  v_prev_last_checkin DATE;
  v_prev_streak INTEGER;
  v_grace_usado_mes TEXT;
  v_tenant_id UUID;
  v_mes_atual TEXT := to_char(NEW.log_date, 'YYYY-MM');
  v_novo_streak INTEGER;
  v_usou_grace BOOLEAN := false;
BEGIN
  -- Calcular moedas do estado novo
  v_new_coins := (
    CASE WHEN NEW.water_check THEN 10 ELSE 0 END +
    CASE WHEN NEW.workout_check THEN 20 ELSE 0 END +
    CASE WHEN NEW.sleep_check THEN 10 ELSE 0 END +
    CASE WHEN NEW.meal_plan_check THEN 30 ELSE 0 END +
    CASE WHEN NEW.daily_victory IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN NEW.proof_photo_url IS NOT NULL THEN 10 ELSE 0 END
  );

  -- Calcular moedas do estado antigo (se existir)
  v_old_coins := 0;
  IF (TG_OP = 'UPDATE') THEN
    v_old_coins := (
      CASE WHEN OLD.water_check THEN 10 ELSE 0 END +
      CASE WHEN OLD.workout_check THEN 20 ELSE 0 END +
      CASE WHEN OLD.sleep_check THEN 10 ELSE 0 END +
      CASE WHEN OLD.meal_plan_check THEN 30 ELSE 0 END +
      CASE WHEN OLD.daily_victory IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN OLD.proof_photo_url IS NOT NULL THEN 10 ELSE 0 END
    );
  END IF;

  -- Delta a ser aplicado
  v_delta := v_new_coins - v_old_coins;

  -- Sincronizar campos de bônus no próprio log
  NEW.coins_earned := v_new_coins;
  NEW.xp_earned := v_new_coins;

  -- Atualizar perfil do usuário apenas se houver mudança
  IF (v_delta != 0 OR TG_OP = 'INSERT') THEN
    SELECT last_checkin_date, current_streak, streak_grace_usado_mes, tenant_id
      INTO v_prev_last_checkin, v_prev_streak, v_grace_usado_mes, v_tenant_id
      FROM profiles WHERE user_id = NEW.user_id;

    IF v_prev_last_checkin = NEW.log_date - INTERVAL '1 day' THEN
      -- Dia seguinte ao último check-in: streak continua normalmente
      v_novo_streak := COALESCE(v_prev_streak, 0) + 1;
      v_usou_grace := false;
    ELSIF v_prev_last_checkin = NEW.log_date - INTERVAL '2 days'
          AND COALESCE(v_prev_streak, 0) >= 3
          AND (v_grace_usado_mes IS DISTINCT FROM v_mes_atual) THEN
      -- Faltou exatamente 1 dia e ainda há grace period disponível no mês
      v_novo_streak := v_prev_streak + 1;
      v_usou_grace := true;
    ELSIF v_prev_last_checkin >= NEW.log_date - INTERVAL '1 day' THEN
      -- Mesmo dia ou data futura (proteção contra edição retroativa)
      v_novo_streak := COALESCE(v_prev_streak, 0);
      v_usou_grace := false;
    ELSE
      -- Quebrou o streak (faltaram 2+ dias sem grace disponível)
      v_novo_streak := 1;
      v_usou_grace := false;
    END IF;

    UPDATE profiles
    SET
      nutri_coins = GREATEST(0, nutri_coins + v_delta),
      total_xp = GREATEST(0, total_xp + v_delta),
      current_level = calculate_level(GREATEST(0, total_xp + v_delta)),
      last_checkin_date = NEW.log_date,
      current_streak = v_novo_streak,
      longest_streak = GREATEST(longest_streak, v_novo_streak),
      streak_grace_usado_mes = CASE WHEN v_usou_grace THEN v_mes_atual ELSE streak_grace_usado_mes END
    WHERE user_id = NEW.user_id;

    IF v_tenant_id IS NOT NULL THEN
      INSERT INTO historico_streak (paciente_id, tenant_id, data, streak_valor, manteve, usou_grace, origem)
      VALUES (NEW.user_id, v_tenant_id, NEW.log_date, v_novo_streak, true, v_usou_grace, 'daily_log')
      ON CONFLICT (paciente_id, data) DO UPDATE SET
        streak_valor = EXCLUDED.streak_valor,
        manteve = EXCLUDED.manteve,
        usou_grace = EXCLUDED.usou_grace;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
-- SECURITY DEFINER necessário: o INSERT em historico_streak roda no contexto
-- da paciente autenticada (que não tem policy de INSERT nessa tabela — é só
-- leitura para ela). Mesmo padrão já usado em auto_post_daily_victory() e
-- auto_post_streak_milestone() (20260313000002_feed_auto_posts.sql).

-- ============================================================
-- Zera streaks não completados (chamada 1x/dia por pg_cron às 00:05 BRT).
-- Aplica o mesmo grace period da trigger para quem faltou só 1 dia.
-- ============================================================
CREATE OR REPLACE FUNCTION reset_stale_streaks(p_reference_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(pacientes_processadas INTEGER, streaks_zerados INTEGER, grace_aplicados INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mes_atual TEXT := to_char(p_reference_date, 'YYYY-MM');
  v_ontem DATE := p_reference_date - INTERVAL '1 day';
  v_total INTEGER := 0;
  v_zerados INTEGER := 0;
  v_grace INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, tenant_id, current_streak, streak_grace_usado_mes
    FROM profiles
    WHERE current_streak > 0
      AND (last_checkin_date IS NULL OR last_checkin_date < v_ontem)
  LOOP
    v_total := v_total + 1;

    IF r.current_streak >= 3 AND (r.streak_grace_usado_mes IS DISTINCT FROM v_mes_atual) THEN
      UPDATE profiles SET streak_grace_usado_mes = v_mes_atual WHERE user_id = r.user_id;
      INSERT INTO historico_streak (paciente_id, tenant_id, data, streak_valor, manteve, usou_grace, origem)
      VALUES (r.user_id, r.tenant_id, v_ontem, r.current_streak, true, true, 'reset_diario')
      ON CONFLICT (paciente_id, data) DO UPDATE SET manteve = true, usou_grace = true;
      v_grace := v_grace + 1;
    ELSE
      UPDATE profiles SET current_streak = 0 WHERE user_id = r.user_id;
      INSERT INTO historico_streak (paciente_id, tenant_id, data, streak_valor, manteve, usou_grace, origem)
      VALUES (r.user_id, r.tenant_id, v_ontem, 0, false, false, 'reset_diario')
      ON CONFLICT (paciente_id, data) DO UPDATE SET streak_valor = 0, manteve = false;
      v_zerados := v_zerados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_zerados, v_grace;
END;
$$;

-- Agendar cron via pg_cron (00:05 BRT = 03:05 UTC)
-- IMPORTANTE: Execute este bloco manualmente no SQL Editor do Supabase
-- após habilitar pg_cron em Database > Extensions (mesmo padrão do
-- cron de daily-engagement em 20260312000002_daily_engagement_cron.sql)
--
-- SELECT cron.schedule(
--   'reset-stale-streaks',
--   '5 3 * * *',
--   $$ SELECT reset_stale_streaks(); $$
-- );
