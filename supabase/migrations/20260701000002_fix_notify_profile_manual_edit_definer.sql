-- Fix: notify_profile_manual_edit() perdeu o SECURITY DEFINER na migration
-- 20260526000001_fix_meal_plan_assignments_updated_at.sql. Sem isso, o INSERT
-- em ai_feedback_vectors roda com os privilégios de quem disparou o UPDATE em
-- profiles (RLS: apenas tenant.owner_id pode inserir). Isso quebra qualquer
-- update feito pela própria paciente (ex.: onboarding, que altera
-- primary_goal/current_weight) com "new row violates row-level security
-- policy for table ai_feedback_vectors", retornando 403 no PATCH de profiles.

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
