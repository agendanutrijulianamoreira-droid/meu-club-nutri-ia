-- Fase 2 — feedback pendente + regras de saída configuráveis.
-- Nenhuma ação envia mensagem automaticamente.

CREATE OR REPLACE FUNCTION public.default_followup_engine_rules()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'inactivity', jsonb_build_object('gentle_days',2,'oscillating_days',4,'risk_days',7,'critical_days',10,'inactive_days',14),
    'adherence', jsonb_build_object('at_risk_below',40,'oscillating_below',60),
    'checkin', jsonb_build_object('overdue_days',8),
    'plan', jsonb_build_object('expiring_days',15,'urgent_days',7),
    'protocol', jsonb_build_object('ending_days',7,'urgent_days',3),
    'tasks', jsonb_build_object(
      'critical_time','09:00','today_time','12:00','this_week_delay_days',2,'this_week_time','09:00','gentle_time','10:00',
      'phase_review_time','15:00','urgent_expiry_hours',24,'routine_expiry_hours',72,'phase_review_expiry_days',3
    ),
    'feedback', jsonb_build_object(
      'enabled',true,
      'due_hours',24,
      'expiry_hours',72,
      'dismiss_counts_as_resolved',true
    ),
    'exit', jsonb_build_object(
      'completed_cooldown_days',1,
      'dismissed_cooldown_days',3
    ),
    'automation', jsonb_build_object('automatic_contact_enabled',false)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_followup_engine_rules(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (SELECT public.default_followup_engine_rules() AS rules),
       s AS (SELECT COALESCE((SELECT t.rules FROM public.tenant_followup_settings t WHERE t.tenant_id=p_tenant_id),'{}'::jsonb) AS rules)
  SELECT jsonb_build_object(
    'inactivity', (d.rules->'inactivity') || COALESCE(s.rules->'inactivity','{}'::jsonb),
    'adherence', (d.rules->'adherence') || COALESCE(s.rules->'adherence','{}'::jsonb),
    'checkin', (d.rules->'checkin') || COALESCE(s.rules->'checkin','{}'::jsonb),
    'plan', (d.rules->'plan') || COALESCE(s.rules->'plan','{}'::jsonb),
    'protocol', (d.rules->'protocol') || COALESCE(s.rules->'protocol','{}'::jsonb),
    'tasks', (d.rules->'tasks') || COALESCE(s.rules->'tasks','{}'::jsonb),
    'feedback', (d.rules->'feedback') || COALESCE(s.rules->'feedback','{}'::jsonb),
    'exit', (d.rules->'exit') || COALESCE(s.rules->'exit','{}'::jsonb),
    'automation', (d.rules->'automation') || COALESCE(s.rules->'automation','{}'::jsonb)
  ) FROM d,s;
$$;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;
REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_checkin_feedback_tasks(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_enabled boolean;
  v_due_hours integer;
  v_expiry_hours integer;
  v_dismiss_resolves boolean;
  v_created integer := 0;
  v_updated integer := 0;
  v_closed integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;
  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_enabled := COALESCE((v_rules#>>'{feedback,enabled}')::boolean,true);
  v_due_hours := GREATEST(0,COALESCE((v_rules#>>'{feedback,due_hours}')::integer,24));
  v_expiry_hours := GREATEST(1,COALESCE((v_rules#>>'{feedback,expiry_hours}')::integer,72));
  v_dismiss_resolves := COALESCE((v_rules#>>'{feedback,dismiss_counts_as_resolved}')::boolean,true);

  IF NOT v_enabled THEN
    WITH closed AS (
      UPDATE public.agent_pending_actions a
      SET status='cancelled', updated_at=now(),
          execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','feedback_rule_disabled')
      WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending'
      RETURNING id
    ) SELECT count(*) INTO v_closed FROM closed;
    RETURN jsonb_build_object('created',0,'updated',0,'closed',v_closed,'enabled',false);
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,
      COALESCE(p.name,'Paciente') patient_name
    FROM public.weekly_checkin_responses w
    JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id
    WHERE w.tenant_id=p_tenant_id
    ORDER BY w.user_id,w.created_at DESC
  ), pending_source AS (
    SELECT l.* FROM latest l
    WHERE l.created_at <= now() - make_interval(hours=>v_due_hours)
      AND NOT EXISTS (
        SELECT 1 FROM public.agent_pending_actions old
        WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id
          AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback'
          AND old.created_at >= l.created_at
          AND (
            old.status='completed'
            OR (v_dismiss_resolves AND old.status='dismissed')
          )
      )
  ), stale AS (
    UPDATE public.agent_pending_actions a
    SET status='cancelled',updated_at=now(),
        execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','feedback_source_resolved_or_replaced')
    WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending'
      AND NOT EXISTS (SELECT 1 FROM pending_source s WHERE s.user_id=a.target_user_id AND (a.context_data->>'weekly_checkin_id')::uuid=s.id)
    RETURNING id
  ) SELECT count(*) INTO v_closed FROM stale;

  WITH latest AS (
    SELECT DISTINCT ON (w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,
      COALESCE(p.name,'Paciente') patient_name
    FROM public.weekly_checkin_responses w
    JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id
    WHERE w.tenant_id=p_tenant_id
    ORDER BY w.user_id,w.created_at DESC
  ), pending_source AS (
    SELECT l.* FROM latest l
    WHERE l.created_at <= now() - make_interval(hours=>v_due_hours)
      AND NOT EXISTS (
        SELECT 1 FROM public.agent_pending_actions old
        WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback'
          AND old.created_at >= l.created_at AND (old.status='completed' OR (v_dismiss_resolves AND old.status='dismissed'))
      )
  ), changed AS (
    UPDATE public.agent_pending_actions a
    SET target_patient_name=s.patient_name,
        title='Feedback de check-in pendente',
        content='Revisar o check-in semanal e registrar o retorno clínico da paciente.',
        content_preview='Check-in semanal aguardando feedback.',
        reasoning='O último check-in ultrapassou o prazo configurado para feedback.',
        context_data=jsonb_build_object('source','weekly_checkin_responses','weekly_checkin_id',s.id,'week_start',s.week_start,'submitted_at',s.created_at,'diet_score',s.diet_score,'main_difficulty',s.main_difficulty,'bowel',s.bowel,'had_binge',s.had_binge,'mood',s.mood,'extra_notes',s.extra_notes),
        scheduled_for=s.created_at + make_interval(hours=>v_due_hours),
        expires_at=s.created_at + make_interval(hours=>v_due_hours+v_expiry_hours),
        updated_at=now()
    FROM pending_source s
    WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending'
      AND a.target_user_id=s.user_id AND (a.context_data->>'weekly_checkin_id')::uuid=s.id
    RETURNING a.id
  ) SELECT count(*) INTO v_updated FROM changed;

  WITH latest AS (
    SELECT DISTINCT ON (w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,
      COALESCE(p.name,'Paciente') patient_name
    FROM public.weekly_checkin_responses w
    JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id
    WHERE w.tenant_id=p_tenant_id
    ORDER BY w.user_id,w.created_at DESC
  ), pending_source AS (
    SELECT l.* FROM latest l
    WHERE l.created_at <= now() - make_interval(hours=>v_due_hours)
      AND NOT EXISTS (
        SELECT 1 FROM public.agent_pending_actions old
        WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback'
          AND old.created_at >= l.created_at AND (old.status='completed' OR (v_dismiss_resolves AND old.status='dismissed'))
      )
  ), inserted AS (
    INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at)
    SELECT p_tenant_id,'followup_engine','weekly_checkin_feedback','patient',s.user_id,s.patient_name,
      'Feedback de check-in pendente','Revisar o check-in semanal e registrar o retorno clínico da paciente.','Check-in semanal aguardando feedback.',
      'O último check-in ultrapassou o prazo configurado para feedback.',
      jsonb_build_object('source','weekly_checkin_responses','weekly_checkin_id',s.id,'week_start',s.week_start,'submitted_at',s.created_at,'diet_score',s.diet_score,'main_difficulty',s.main_difficulty,'bowel',s.bowel,'had_binge',s.had_binge,'mood',s.mood,'extra_notes',s.extra_notes),
      s.created_at + make_interval(hours=>v_due_hours),'pending',s.created_at + make_interval(hours=>v_due_hours+v_expiry_hours)
    FROM pending_source s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.agent_pending_actions a WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending' AND a.target_user_id=s.user_id
    )
    RETURNING id
  ) SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'enabled',true,'reference_date',p_reference_date);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_followup_exit_rules(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_completed_days integer;
  v_dismissed_days integer;
  v_closed integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;
  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_completed_days := GREATEST(0,COALESCE((v_rules#>>'{exit,completed_cooldown_days}')::integer,1));
  v_dismissed_days := GREATEST(0,COALESCE((v_rules#>>'{exit,dismissed_cooldown_days}')::integer,3));

  WITH suppressed AS (
    UPDATE public.agent_pending_actions current
    SET status='cancelled',updated_at=now(),
        execution_result=COALESCE(current.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','cooldown_after_terminal_action')
    WHERE current.tenant_id=p_tenant_id AND current.agent_name='followup_engine' AND current.status='pending'
      AND EXISTS (
        SELECT 1 FROM public.agent_pending_actions prior
        WHERE prior.tenant_id=current.tenant_id AND prior.agent_name=current.agent_name
          AND prior.target_user_id=current.target_user_id AND prior.action_type=current.action_type
          AND prior.id<>current.id AND prior.updated_at < current.created_at
          AND (
            (prior.status='completed' AND v_completed_days>0 AND prior.updated_at >= now()-make_interval(days=>v_completed_days))
            OR (prior.status='dismissed' AND v_dismissed_days>0 AND prior.updated_at >= now()-make_interval(days=>v_dismissed_days))
          )
      )
    RETURNING id
  ) SELECT count(*) INTO v_closed FROM suppressed;
  RETURN jsonb_build_object('closed',v_closed,'completed_cooldown_days',v_completed_days,'dismissed_cooldown_days',v_dismissed_days);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_followup_exit_rules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_followup_exit_rules(uuid) TO service_role;
