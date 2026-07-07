-- Regressão detectada em produção: 20260526000001_fix_meal_plan_assignments_updated_at.sql
-- foi aplicada DEPOIS de 20260701000002_fix_notify_profile_manual_edit_definer.sql
-- (fora da ordem cronológica sugerida pelo nome do arquivo) e recriou
-- notify_profile_manual_edit() sem SECURITY DEFINER, reintroduzindo o 403
-- em ai_feedback_vectors (RLS: apenas tenant.owner_id pode inserir) sempre
-- que a própria paciente atualiza primary_goal/current_weight — como no
-- onboarding, que voltou a mostrar "Erro ao salvar seus dados. Tente novamente.".
--
-- Já aplicada diretamente em produção (antszuxeairmbctwuafo) via MCP em
-- 2026-07-02. Este arquivo só sincroniza o histórico de migrations do repo
-- com o estado real do banco.
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
