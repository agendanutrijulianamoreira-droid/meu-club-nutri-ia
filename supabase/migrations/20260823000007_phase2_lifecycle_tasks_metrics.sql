CREATE OR REPLACE FUNCTION public.default_followup_engine_rules()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'inactivity',jsonb_build_object('gentle_days',2,'oscillating_days',4,'risk_days',7,'critical_days',10,'inactive_days',14),
  'adherence',jsonb_build_object('at_risk_below',40,'oscillating_below',60),
  'checkin',jsonb_build_object('overdue_days',8),
  'plan',jsonb_build_object('expiring_days',15,'urgent_days',7),
  'protocol',jsonb_build_object('ending_days',7,'urgent_days',3),
  'tasks',jsonb_build_object('critical_time','09:00','today_time','12:00','this_week_delay_days',2,'this_week_time','09:00','gentle_time','10:00','phase_review_time','15:00','urgent_expiry_hours',24,'routine_expiry_hours',72,'phase_review_expiry_days',3),
  'feedback',jsonb_build_object('enabled',true,'due_hours',24,'expiry_hours',72,'dismiss_counts_as_resolved',true),
  'exit',jsonb_build_object('completed_cooldown_days',1,'dismissed_cooldown_days',3),
  'lifecycle',jsonb_build_object('enabled',true,'return_overdue_days',45,'reactivation_after_days',30,'protocol_completed_window_days',7,'plan_expired_grace_days',0,'manual_completed_only',true),
  'lifecycle_tasks',jsonb_build_object(
    'enabled',true,
    'awaiting_consultation',false,
    'return_overdue',true,
    'plan_expiring',true,
    'plan_expired',true,
    'protocol_completed',true,
    'reactivation',true,
    'task_time','09:30',
    'expiry_hours',72
  ),
  'metrics',jsonb_build_object('window_days',30),
  'automation',jsonb_build_object('automatic_contact_enabled',false)
);
$function$;

CREATE OR REPLACE FUNCTION public.get_followup_engine_rules(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH d AS (SELECT public.default_followup_engine_rules() AS rules),
s AS (SELECT COALESCE((SELECT t.rules FROM public.tenant_followup_settings t WHERE t.tenant_id=p_tenant_id),'{}'::jsonb) AS rules)
SELECT jsonb_build_object(
  'inactivity',(d.rules->'inactivity')||COALESCE(s.rules->'inactivity','{}'::jsonb),
  'adherence',(d.rules->'adherence')||COALESCE(s.rules->'adherence','{}'::jsonb),
  'checkin',(d.rules->'checkin')||COALESCE(s.rules->'checkin','{}'::jsonb),
  'plan',(d.rules->'plan')||COALESCE(s.rules->'plan','{}'::jsonb),
  'protocol',(d.rules->'protocol')||COALESCE(s.rules->'protocol','{}'::jsonb),
  'tasks',(d.rules->'tasks')||COALESCE(s.rules->'tasks','{}'::jsonb),
  'feedback',(d.rules->'feedback')||COALESCE(s.rules->'feedback','{}'::jsonb),
  'exit',(d.rules->'exit')||COALESCE(s.rules->'exit','{}'::jsonb),
  'lifecycle',(d.rules->'lifecycle')||COALESCE(s.rules->'lifecycle','{}'::jsonb),
  'lifecycle_tasks',(d.rules->'lifecycle_tasks')||COALESCE(s.rules->'lifecycle_tasks','{}'::jsonb),
  'metrics',(d.rules->'metrics')||COALESCE(s.rules->'metrics','{}'::jsonb),
  'automation',(d.rules->'automation')||COALESCE(s.rules->'automation','{}'::jsonb)
) FROM d,s;
$function$;

CREATE OR REPLACE FUNCTION public.sync_lifecycle_followup_tasks(p_tenant_id uuid, p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date))
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg jsonb := public.get_followup_engine_rules(p_tenant_id)->'lifecycle_tasks';
  exit_cfg jsonb := public.get_followup_engine_rules(p_tenant_id)->'exit';
  v_created int := 0;
  v_updated int := 0;
  v_closed int := 0;
  r record;
  v_action_type text;
  v_title text;
  v_due timestamptz;
  v_expiry timestamptz;
  v_enabled boolean;
  v_recent_handled boolean;
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean,true) THEN
    RETURN jsonb_build_object('created',0,'updated',0,'closed',0,'disabled',true);
  END IF;

  UPDATE public.agent_pending_actions a
  SET status='cancelled', updated_at=now(), execution_result=jsonb_build_object('reason','lifecycle_signal_no_longer_current')
  WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.status='pending'
    AND a.action_type LIKE 'lifecycle_%'
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_risk_scores s
      WHERE s.tenant_id=p_tenant_id AND s.user_id=a.target_user_id AND s.calculated_date=p_reference_date
        AND a.action_type='lifecycle_'||COALESCE(s.lifecycle_status,'')
    );
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  FOR r IN
    SELECT s.*, p.name AS patient_name
    FROM public.patient_risk_scores s
    LEFT JOIN public.profiles p ON p.user_id=s.user_id AND p.tenant_id=s.tenant_id
    WHERE s.tenant_id=p_tenant_id AND s.calculated_date=p_reference_date AND s.lifecycle_status IS NOT NULL
  LOOP
    v_enabled := CASE r.lifecycle_status
      WHEN 'awaiting_consultation' THEN COALESCE((cfg->>'awaiting_consultation')::boolean,false)
      WHEN 'return_overdue' THEN COALESCE((cfg->>'return_overdue')::boolean,true)
      WHEN 'plan_expiring' THEN COALESCE((cfg->>'plan_expiring')::boolean,true)
      WHEN 'plan_expired' THEN COALESCE((cfg->>'plan_expired')::boolean,true)
      WHEN 'protocol_completed' THEN COALESCE((cfg->>'protocol_completed')::boolean,true)
      WHEN 'reactivation' THEN COALESCE((cfg->>'reactivation')::boolean,true)
      ELSE false END;
    IF NOT v_enabled THEN CONTINUE; END IF;

    v_action_type := 'lifecycle_'||r.lifecycle_status;
    v_title := CASE r.lifecycle_status
      WHEN 'awaiting_consultation' THEN 'Acompanhar consulta agendada'
      WHEN 'return_overdue' THEN 'Retorno atrasado'
      WHEN 'plan_expiring' THEN 'Plano próximo do vencimento'
      WHEN 'plan_expired' THEN 'Plano vencido'
      WHEN 'protocol_completed' THEN 'Protocolo concluído'
      WHEN 'reactivation' THEN 'Revisar reativação'
      ELSE 'Revisar jornada da paciente' END;
    v_due := ((p_reference_date::text||' '||COALESCE(cfg->>'task_time','09:30')||':00 America/Sao_Paulo')::timestamptz);
    v_expiry := v_due + make_interval(hours=>COALESCE((cfg->>'expiry_hours')::int,72));

    SELECT EXISTS(
      SELECT 1 FROM public.agent_pending_actions h
      WHERE h.tenant_id=p_tenant_id AND h.target_user_id=r.user_id AND h.action_type=v_action_type
        AND h.agent_name='followup_engine' AND h.status IN ('completed','dismissed')
        AND h.updated_at >= now() - make_interval(days=>CASE WHEN h.status='completed' THEN COALESCE((exit_cfg->>'completed_cooldown_days')::int,1) ELSE COALESCE((exit_cfg->>'dismissed_cooldown_days')::int,3) END)
    ) INTO v_recent_handled;
    IF v_recent_handled THEN CONTINUE; END IF;

    UPDATE public.agent_pending_actions a
    SET title=v_title,
        content=COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),
        reasoning='Estado atual da jornada: '||r.lifecycle_status,
        context_data=jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'lifecycle_status',r.lifecycle_status,'lifecycle_details',COALESCE(r.lifecycle_details,'{}'::jsonb)),
        expires_at=v_expiry,
        updated_at=now()
    WHERE a.tenant_id=p_tenant_id AND a.target_user_id=r.user_id AND a.action_type=v_action_type AND a.agent_name='followup_engine' AND a.status='pending';
    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at)
      VALUES(p_tenant_id,'followup_engine',v_action_type,'patient',r.user_id,r.patient_name,v_title,COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),'Estado atual da jornada: '||r.lifecycle_status,jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'lifecycle_status',r.lifecycle_status,'lifecycle_details',COALESCE(r.lifecycle_details,'{}'::jsonb)),v_due,'pending',v_expiry);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_lifecycle_followup_tasks(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_lifecycle_followup_tasks(uuid,date) TO service_role;
