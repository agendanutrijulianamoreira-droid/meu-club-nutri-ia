-- Phase 2 final gate: lifecycle precedence and attention composition are tenant-editable.

CREATE OR REPLACE FUNCTION public.default_followup_engine_rules()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'inactivity',jsonb_build_object('gentle_days',2,'oscillating_days',4,'risk_days',7,'critical_days',10,'inactive_days',14),
  'adherence',jsonb_build_object('at_risk_below',40,'oscillating_below',60),
  'risk_scoring',jsonb_build_object('inactivity_weight',60,'adherence_weight',40,'critical_min',75,'high_min',55,'medium_min',30),
  'attention',jsonb_build_object(
    'critical_on_inactivity',true,'critical_on_consultation_overdue',true,
    'today_on_risk_inactivity',true,'today_on_plan_urgent',true,'today_on_protocol_urgent',true,
    'this_week_on_oscillating',true,'this_week_on_checkin_overdue',true,'this_week_on_plan_expiring',true,'this_week_on_protocol_ending',true,
    'automatic_on_gentle_inactivity',true
  ),
  'checkin',jsonb_build_object('overdue_days',8),
  'plan',jsonb_build_object('expiring_days',15,'urgent_days',7),
  'protocol',jsonb_build_object('ending_days',7,'urgent_days',3),
  'tasks',jsonb_build_object('critical_time','09:00','today_time','12:00','this_week_delay_days',2,'this_week_time','09:00','gentle_time','10:00','phase_review_time','15:00','urgent_expiry_hours',24,'routine_expiry_hours',72,'phase_review_expiry_days',3),
  'feedback',jsonb_build_object('enabled',true,'due_hours',24,'expiry_hours',72,'dismiss_counts_as_resolved',true),
  'exit',jsonb_build_object('completed_cooldown_days',1,'dismissed_cooldown_days',3),
  'lifecycle',jsonb_build_object(
    'enabled',true,'return_overdue_days',45,'reactivation_after_days',30,'protocol_completed_window_days',7,'plan_expired_grace_days',0,
    'priority',jsonb_build_object('onboarding',10,'return_overdue',20,'plan_expired',30,'plan_expiring',40,'awaiting_consultation',50,'protocol_completed',60,'reactivation',70)
  ),
  'lifecycle_tasks',jsonb_build_object('enabled',true,'awaiting_consultation',false,'return_overdue',true,'plan_expiring',true,'plan_expired',true,'protocol_completed',true,'reactivation',true,'task_time','09:30','expiry_hours',72),
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
  'risk_scoring',(d.rules->'risk_scoring')||COALESCE(s.rules->'risk_scoring','{}'::jsonb),
  'attention',(d.rules->'attention')||COALESCE(s.rules->'attention','{}'::jsonb),
  'checkin',(d.rules->'checkin')||COALESCE(s.rules->'checkin','{}'::jsonb),
  'plan',(d.rules->'plan')||COALESCE(s.rules->'plan','{}'::jsonb),
  'protocol',(d.rules->'protocol')||COALESCE(s.rules->'protocol','{}'::jsonb),
  'tasks',(d.rules->'tasks')||COALESCE(s.rules->'tasks','{}'::jsonb),
  'feedback',(d.rules->'feedback')||COALESCE(s.rules->'feedback','{}'::jsonb),
  'exit',(d.rules->'exit')||COALESCE(s.rules->'exit','{}'::jsonb),
  'lifecycle',jsonb_set(
    (d.rules->'lifecycle')||COALESCE(s.rules->'lifecycle','{}'::jsonb),
    '{priority}',
    (d.rules#>'{lifecycle,priority}')||COALESCE(s.rules#>'{lifecycle,priority}','{}'::jsonb),
    true
  ),
  'lifecycle_tasks',(d.rules->'lifecycle_tasks')||COALESCE(s.rules->'lifecycle_tasks','{}'::jsonb),
  'metrics',(d.rules->'metrics')||COALESCE(s.rules->'metrics','{}'::jsonb),
  'automation',(d.rules->'automation')||COALESCE(s.rules->'automation','{}'::jsonb)
) FROM d,s;
$function$;

DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='refresh_patient_operational_snapshot';
  v_old := 'CASE WHEN s.days_inactive>=v_critical OR s.consultation_overdue THEN ''critical'' WHEN s.days_inactive>=v_risk OR (s.plan_expiring_calc AND (s.plan_expires_at AT TIME ZONE ''America/Sao_Paulo'')::date<=p_reference_date+v_plan_urgent) OR (s.protocol_ending_calc AND s.active_protocol_end_date<=p_reference_date+v_protocol_urgent) THEN ''today'' WHEN s.days_inactive>=v_oscillating OR s.checkin_overdue_calc OR s.plan_expiring_calc OR s.protocol_ending_calc THEN ''this_week'' WHEN s.days_inactive>=v_gentle AND s.days_inactive<v_oscillating THEN ''automatic'' ELSE ''none'' END attention_bucket_calc';
  v_new := 'CASE WHEN (COALESCE((v_rules#>>''{attention,critical_on_inactivity}'')::boolean,true) AND s.days_inactive>=v_critical) OR (COALESCE((v_rules#>>''{attention,critical_on_consultation_overdue}'')::boolean,true) AND s.consultation_overdue) THEN ''critical'' WHEN (COALESCE((v_rules#>>''{attention,today_on_risk_inactivity}'')::boolean,true) AND s.days_inactive>=v_risk) OR (COALESCE((v_rules#>>''{attention,today_on_plan_urgent}'')::boolean,true) AND s.plan_expiring_calc AND (s.plan_expires_at AT TIME ZONE ''America/Sao_Paulo'')::date<=p_reference_date+v_plan_urgent) OR (COALESCE((v_rules#>>''{attention,today_on_protocol_urgent}'')::boolean,true) AND s.protocol_ending_calc AND s.active_protocol_end_date<=p_reference_date+v_protocol_urgent) THEN ''today'' WHEN (COALESCE((v_rules#>>''{attention,this_week_on_oscillating}'')::boolean,true) AND s.days_inactive>=v_oscillating) OR (COALESCE((v_rules#>>''{attention,this_week_on_checkin_overdue}'')::boolean,true) AND s.checkin_overdue_calc) OR (COALESCE((v_rules#>>''{attention,this_week_on_plan_expiring}'')::boolean,true) AND s.plan_expiring_calc) OR (COALESCE((v_rules#>>''{attention,this_week_on_protocol_ending}'')::boolean,true) AND s.protocol_ending_calc) THEN ''this_week'' WHEN COALESCE((v_rules#>>''{attention,automatic_on_gentle_inactivity}'')::boolean,true) AND s.days_inactive>=v_gentle AND s.days_inactive<v_oscillating THEN ''automatic'' ELSE ''none'' END attention_bucket_calc';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Trecho esperado de attention_bucket não encontrado'; END IF;
  v_def := replace(v_def,v_old,v_new); EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='refresh_patient_lifecycle_states';
  v_old := 'CASE WHEN b.override_status IS NOT NULL THEN b.override_status WHEN NOT COALESCE(b.onboarding_completed,false) THEN ''onboarding'' WHEN b.consultation_overdue THEN ''return_overdue'' WHEN b.plan_expires_at IS NOT NULL AND (b.plan_expires_at AT TIME ZONE ''America/Sao_Paulo'')::date < p_reference_date-v_plan_grace THEN ''plan_expired'' WHEN b.plan_expiring THEN ''plan_expiring'' WHEN b.next_appointment_at IS NOT NULL THEN ''awaiting_consultation'' WHEN b.completion_date IS NOT NULL AND b.completion_date BETWEEN p_reference_date-v_protocol_window AND p_reference_date THEN ''protocol_completed'' WHEN b.last_appointment_at IS NOT NULL AND (p_reference_date-(b.last_appointment_at AT TIME ZONE ''America/Sao_Paulo'')::date)>=v_return_days THEN ''return_overdue'' WHEN COALESCE(b.days_since_activity,0)>=v_reactivation_days THEN ''reactivation'' ELSE ''active_followup'' END status_calc';
  v_new := 'CASE WHEN b.override_status IS NOT NULL THEN b.override_status ELSE COALESCE((SELECT candidate.status FROM (VALUES (''onboarding'',NOT COALESCE(b.onboarding_completed,false),COALESCE((v_rules#>>''{lifecycle,priority,onboarding}'')::int,10)),(''return_overdue'',b.consultation_overdue OR (b.last_appointment_at IS NOT NULL AND (p_reference_date-(b.last_appointment_at AT TIME ZONE ''America/Sao_Paulo'')::date)>=v_return_days),COALESCE((v_rules#>>''{lifecycle,priority,return_overdue}'')::int,20)),(''plan_expired'',b.plan_expires_at IS NOT NULL AND (b.plan_expires_at AT TIME ZONE ''America/Sao_Paulo'')::date < p_reference_date-v_plan_grace,COALESCE((v_rules#>>''{lifecycle,priority,plan_expired}'')::int,30)),(''plan_expiring'',b.plan_expiring,COALESCE((v_rules#>>''{lifecycle,priority,plan_expiring}'')::int,40)),(''awaiting_consultation'',b.next_appointment_at IS NOT NULL,COALESCE((v_rules#>>''{lifecycle,priority,awaiting_consultation}'')::int,50)),(''protocol_completed'',b.completion_date IS NOT NULL AND b.completion_date BETWEEN p_reference_date-v_protocol_window AND p_reference_date,COALESCE((v_rules#>>''{lifecycle,priority,protocol_completed}'')::int,60)),(''reactivation'',COALESCE(b.days_since_activity,0)>=v_reactivation_days,COALESCE((v_rules#>>''{lifecycle,priority,reactivation}'')::int,70))) AS candidate(status,matched,priority) WHERE candidate.matched ORDER BY candidate.priority,candidate.status LIMIT 1),''active_followup'') END status_calc';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Trecho esperado de lifecycle não encontrado'; END IF;
  v_def := replace(v_def,v_old,v_new); EXECUTE v_def;
END $$;

UPDATE public.tenant_followup_settings SET schema_version=3 WHERE schema_version<3;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refresh_patient_operational_snapshot(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refresh_patient_lifecycle_states(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_patient_operational_snapshot(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_patient_lifecycle_states(uuid,date) TO service_role;
