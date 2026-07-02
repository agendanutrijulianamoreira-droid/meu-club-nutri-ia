-- Fix: meal_plan_assignments missing updated_at column
-- The trigger notify_profile_manual_edit references updated_at on this table,
-- causing patient registration to fail when the profile upsert fires the trigger.
ALTER TABLE public.meal_plan_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix: subscriptions missing updated_at column
-- The create-patient API inserts subscriptions with updated_at field.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-maintain updated_at on meal_plan_assignments
DROP TRIGGER IF EXISTS update_meal_plan_assignments_updated_at ON public.meal_plan_assignments;
CREATE TRIGGER update_meal_plan_assignments_updated_at
  BEFORE UPDATE ON public.meal_plan_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-maintain updated_at on subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fix notify_profile_manual_edit: WHERE user_id = NEW.id was referencing
-- profiles.id (auto-generated PK UUID) instead of profiles.user_id (auth FK).
-- This caused the UPDATE on meal_plan_assignments to never match any row,
-- and also blocked on the missing updated_at column above.
--
-- ⚡ BUGFIX: esta função PRECISA de SECURITY DEFINER (ver migration
-- 20260701000002_fix_notify_profile_manual_edit_definer.sql). Sem isso o
-- INSERT em ai_feedback_vectors roda com os privilégios de quem disparou o
-- UPDATE em profiles — e a RLS dessa tabela só permite o owner do tenant.
-- Isso já causou uma regressão em produção: esta migration (mais antiga por
-- nome, 26/mai) acabou sendo aplicada DEPOIS da correção de 01/jul num push
-- fora de ordem, e o CREATE OR REPLACE sem SECURITY DEFINER sobrescreveu o
-- fix, voltando a quebrar o onboarding da paciente com "Erro ao salvar seus
-- dados". Mantendo SECURITY DEFINER aqui também garante que a função nunca
-- fique num estado inseguro, independente da ordem em que as migrations
-- forem (re)aplicadas.
CREATE OR REPLACE FUNCTION public.notify_profile_manual_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (
    OLD.dietary_restrictions IS DISTINCT FROM NEW.dietary_restrictions OR
    OLD.primary_goal        IS DISTINCT FROM NEW.primary_goal OR
    OLD.current_weight      IS DISTINCT FROM NEW.current_weight OR
    OLD.current_plan        IS DISTINCT FROM NEW.current_plan
  ) THEN
    UPDATE meal_plan_assignments
    SET status     = 'needs_review',
        updated_at = NOW()
    WHERE user_id  = NEW.user_id
      AND status   = 'active';

    INSERT INTO ai_feedback_vectors (
      tenant_id, agent_type, original_content, approved_content,
      delta_summary, context_patient_profile
    ) VALUES (
      NEW.tenant_id,
      'profile_override',
      'admin_manual_edit',
      'recalculate_required',
      'Admin editou campos clínicos — planos marcados para revisão',
      jsonb_build_object('patient_id', NEW.user_id, 'changed_at', NOW())
    );
  END IF;
  RETURN NEW;
END;
$$;
