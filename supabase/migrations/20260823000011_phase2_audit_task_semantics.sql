-- Phase 2 audit hardening: task semantics, editable risk score and role parity.

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
  'checkin',jsonb_build_object('overdue_days',8),
  'plan',jsonb_build_object('expiring_days',15,'urgent_days',7),
  'protocol',jsonb_build_object('ending_days',7,'urgent_days',3),
  'tasks',jsonb_build_object('critical_time','09:00','today_time','12:00','this_week_delay_days',2,'this_week_time','09:00','gentle_time','10:00','phase_review_time','15:00','urgent_expiry_hours',24,'routine_expiry_hours',72,'phase_review_expiry_days',3),
  'feedback',jsonb_build_object('enabled',true,'due_hours',24,'expiry_hours',72,'dismiss_counts_as_resolved',true),
  'exit',jsonb_build_object('completed_cooldown_days',1,'dismissed_cooldown_days',3),
  'lifecycle',jsonb_build_object('enabled',true,'return_overdue_days',45,'reactivation_after_days',30,'protocol_completed_window_days',7,'plan_expired_grace_days',0),
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

DROP POLICY IF EXISTS "Admins can view risk scores" ON public.patient_risk_scores;
DROP POLICY IF EXISTS "Staff can view risk scores" ON public.patient_risk_scores;
CREATE POLICY "Staff can view risk scores"
ON public.patient_risk_scores FOR SELECT TO authenticated
USING (tenant_id IN (
  SELECT p.tenant_id FROM public.profiles p
  WHERE p.user_id=auth.uid() AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
));

CREATE OR REPLACE FUNCTION public.sync_patient_followup_tasks(p_tenant_id uuid, p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $function$
DECLARE
  v_created integer:=0; v_updated integer:=0; v_closed integer:=0; v_rules jsonb;
  v_critical_time time; v_today_time time; v_week_delay integer; v_week_time time; v_gentle_time time;
  v_urgent_expiry integer; v_routine_expiry integer; v_completed_days integer; v_dismissed_days integer;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;
  v_rules:=public.get_followup_engine_rules(p_tenant_id);
  v_critical_time:=COALESCE((v_rules#>>'{tasks,critical_time}')::time,time '09:00');
  v_today_time:=COALESCE((v_rules#>>'{tasks,today_time}')::time,time '12:00');
  v_week_delay:=COALESCE((v_rules#>>'{tasks,this_week_delay_days}')::int,2);
  v_week_time:=COALESCE((v_rules#>>'{tasks,this_week_time}')::time,time '09:00');
  v_gentle_time:=COALESCE((v_rules#>>'{tasks,gentle_time}')::time,time '10:00');
  v_urgent_expiry:=COALESCE((v_rules#>>'{tasks,urgent_expiry_hours}')::int,24);
  v_routine_expiry:=COALESCE((v_rules#>>'{tasks,routine_expiry_hours}')::int,72);
  v_completed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,completed_cooldown_days}')::int,1));
  v_dismissed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,dismissed_cooldown_days}')::int,3));

  WITH raw AS (
    SELECT prs.user_id, CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END action_type
    FROM public.patient_risk_scores prs
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
  ), desired AS (
    SELECT r.* FROM raw r WHERE NOT EXISTS (
      SELECT 1 FROM public.agent_pending_actions h
      WHERE h.tenant_id=p_tenant_id AND h.agent_name='followup_engine' AND h.target_user_id=r.user_id AND h.action_type=r.action_type
        AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days))
          OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days)))
    )
  ), stale AS (
    UPDATE public.agent_pending_actions a SET status='cancelled',updated_at=now(),execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','signal_no_longer_current_or_cooldown','reference_date',p_reference_date)
    WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.status='pending' AND a.action_type IN ('human_followup','gentle_reengagement_candidate')
      AND NOT EXISTS (SELECT 1 FROM desired d WHERE d.user_id=a.target_user_id AND d.action_type=a.action_type)
    RETURNING id
  ) SELECT count(*) INTO v_closed FROM stale;

  WITH current_rows AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') patient_name,
      CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END desired_action_type,
      CASE prs.attention_bucket WHEN 'critical' THEN 'Intervenção humana prioritária' WHEN 'today' THEN 'Acompanhamento prioritário hoje' WHEN 'this_week' THEN 'Acompanhamento nesta semana' ELSE 'Candidata a retomada leve' END task_title,
      CASE prs.attention_bucket WHEN 'critical' THEN (p_reference_date::timestamp+v_critical_time) AT TIME ZONE 'America/Sao_Paulo' WHEN 'today' THEN (p_reference_date::timestamp+v_today_time) AT TIME ZONE 'America/Sao_Paulo' WHEN 'this_week' THEN ((p_reference_date+v_week_delay)::timestamp+v_week_time) AT TIME ZONE 'America/Sao_Paulo' ELSE (p_reference_date::timestamp+v_gentle_time) AT TIME ZONE 'America/Sao_Paulo' END due_at
    FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
      AND NOT EXISTS (SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.agent_name='followup_engine' AND h.target_user_id=prs.user_id AND h.action_type=(CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END)
        AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days)) OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days))))
  ), changed AS (
    UPDATE public.agent_pending_actions a SET target_patient_name=c.patient_name,title=c.task_title,content=COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),content_preview=COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),
      reasoning=CASE c.attention_bucket WHEN 'critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.' WHEN 'today' THEN 'Sinal que merece prioridade hoje.' WHEN 'this_week' THEN 'Sinal que merece revisão nesta semana.' ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.' END,
      context_data=jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'risk_score_id',c.id,'attention_bucket',c.attention_bucket,'operational_status',c.operational_status,'overall_risk',c.overall_risk,'days_since_activity',c.days_since_activity,'adherence_7d',c.adherence_7d,'reasons',COALESCE(c.reasons,'[]'::jsonb)),
      scheduled_for=CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE c.due_at END,
      expires_at=(CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE c.due_at END)+CASE WHEN c.attention_bucket IN ('critical','today') THEN make_interval(hours=>v_urgent_expiry) ELSE make_interval(hours=>v_routine_expiry) END,
      updated_at=now()
    FROM current_rows c WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.status='pending' AND a.target_user_id=c.user_id AND a.action_type=c.desired_action_type RETURNING a.id
  ) SELECT count(*) INTO v_updated FROM changed;

  WITH current_rows AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') patient_name,
      CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END desired_action_type,
      CASE prs.attention_bucket WHEN 'critical' THEN 'Intervenção humana prioritária' WHEN 'today' THEN 'Acompanhamento prioritário hoje' WHEN 'this_week' THEN 'Acompanhamento nesta semana' ELSE 'Candidata a retomada leve' END task_title,
      CASE prs.attention_bucket WHEN 'critical' THEN (p_reference_date::timestamp+v_critical_time) AT TIME ZONE 'America/Sao_Paulo' WHEN 'today' THEN (p_reference_date::timestamp+v_today_time) AT TIME ZONE 'America/Sao_Paulo' WHEN 'this_week' THEN ((p_reference_date+v_week_delay)::timestamp+v_week_time) AT TIME ZONE 'America/Sao_Paulo' ELSE (p_reference_date::timestamp+v_gentle_time) AT TIME ZONE 'America/Sao_Paulo' END due_at
    FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
      AND NOT EXISTS (SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.agent_name='followup_engine' AND h.target_user_id=prs.user_id AND h.action_type=(CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END)
        AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days)) OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days))))
  ), inserted AS (
    INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at)
    SELECT c.tenant_id,'followup_engine',c.desired_action_type,'patient',c.user_id,c.patient_name,c.task_title,COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),
      CASE c.attention_bucket WHEN 'critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.' WHEN 'today' THEN 'Sinal que merece prioridade hoje.' WHEN 'this_week' THEN 'Sinal que merece revisão nesta semana.' ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.' END,
      jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'risk_score_id',c.id,'attention_bucket',c.attention_bucket,'operational_status',c.operational_status,'overall_risk',c.overall_risk,'days_since_activity',c.days_since_activity,'adherence_7d',c.adherence_7d,'reasons',COALESCE(c.reasons,'[]'::jsonb)),c.due_at,'pending',c.due_at+CASE WHEN c.attention_bucket IN ('critical','today') THEN make_interval(hours=>v_urgent_expiry) ELSE make_interval(hours=>v_routine_expiry) END
    FROM current_rows c WHERE NOT EXISTS (SELECT 1 FROM public.agent_pending_actions a WHERE a.tenant_id=c.tenant_id AND a.target_user_id=c.user_id AND a.agent_name='followup_engine' AND a.action_type=c.desired_action_type AND a.status='pending')
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;$function$;

CREATE OR REPLACE FUNCTION public.sync_phase_review_tasks(p_tenant_id uuid, p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $function$
DECLARE v_evaluated int:=0;v_created int:=0;v_updated int:=0;v_closed int:=0;v_rules jsonb;v_review_time time;v_review_expiry int;v_completed_days int;v_dismissed_days int;
BEGIN
  v_rules:=public.get_followup_engine_rules(p_tenant_id);v_review_time:=COALESCE((v_rules#>>'{tasks,phase_review_time}')::time,time '15:00');v_review_expiry:=COALESCE((v_rules#>>'{tasks,phase_review_expiry_days}')::int,3);v_completed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,completed_cooldown_days}')::int,1));v_dismissed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,dismissed_cooldown_days}')::int,3));
  v_evaluated:=public.refresh_phase_advancement_eligibility(p_tenant_id,p_reference_date);
  WITH eligible AS (SELECT prs.user_id FROM public.patient_risk_scores prs WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true AND NOT EXISTS (SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.target_user_id=prs.user_id AND h.agent_name='followup_engine' AND h.action_type='phase_advancement_review' AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days)) OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days))))), stale AS (UPDATE public.agent_pending_actions a SET status='cancelled',updated_at=now(),execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','phase_no_longer_eligible_or_cooldown','reference_date',p_reference_date) WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='phase_advancement_review' AND a.status='pending' AND NOT EXISTS(SELECT 1 FROM eligible e WHERE e.user_id=a.target_user_id) RETURNING id) SELECT count(*) INTO v_closed FROM stale;
  WITH eligible AS (SELECT prs.*,COALESCE(p.name,'Paciente') patient_name FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true AND NOT EXISTS (SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.target_user_id=prs.user_id AND h.agent_name='followup_engine' AND h.action_type='phase_advancement_review' AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days)) OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days))))), changed AS (UPDATE public.agent_pending_actions a SET target_patient_name=e.patient_name,title='Revisar avanço de fase',content='Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.',content_preview='Paciente elegível para revisão de fase.',reasoning='Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',context_data=jsonb_build_object('source','phase_advancement_criteria','snapshot_date',p_reference_date,'risk_score_id',e.id,'current_method_phase_id',e.current_method_phase_id,'phase_review_details',e.phase_review_details),scheduled_for=CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE ((p_reference_date::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo') END,expires_at=(CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE ((p_reference_date::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo') END)+make_interval(days=>v_review_expiry),updated_at=now() FROM eligible e WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='phase_advancement_review' AND a.status='pending' AND a.target_user_id=e.user_id RETURNING id) SELECT count(*) INTO v_updated FROM changed;
  WITH eligible AS (SELECT prs.*,COALESCE(p.name,'Paciente') patient_name FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true AND NOT EXISTS (SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.target_user_id=prs.user_id AND h.agent_name='followup_engine' AND h.action_type='phase_advancement_review' AND ((h.status='completed' AND v_completed_days>0 AND h.updated_at>=now()-make_interval(days=>v_completed_days)) OR (h.status='dismissed' AND v_dismissed_days>0 AND h.updated_at>=now()-make_interval(days=>v_dismissed_days))))), inserted AS (INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at) SELECT e.tenant_id,'followup_engine','phase_advancement_review','patient',e.user_id,e.patient_name,'Revisar avanço de fase','Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.','Paciente elegível para revisão de fase.','Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',jsonb_build_object('source','phase_advancement_criteria','snapshot_date',p_reference_date,'risk_score_id',e.id,'current_method_phase_id',e.current_method_phase_id,'phase_review_details',e.phase_review_details),((p_reference_date::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo'),'pending',(((p_reference_date+v_review_expiry)::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo') FROM eligible e WHERE NOT EXISTS(SELECT 1 FROM public.agent_pending_actions a WHERE a.tenant_id=e.tenant_id AND a.target_user_id=e.user_id AND a.agent_name='followup_engine' AND a.action_type='phase_advancement_review' AND a.status='pending') ON CONFLICT DO NOTHING RETURNING id) SELECT count(*) INTO v_created FROM inserted;
  RETURN jsonb_build_object('evaluated',v_evaluated,'created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;$function$;

CREATE OR REPLACE FUNCTION public.sync_lifecycle_followup_tasks(p_tenant_id uuid,p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $function$
DECLARE cfg jsonb:=public.get_followup_engine_rules(p_tenant_id)->'lifecycle_tasks';exit_cfg jsonb:=public.get_followup_engine_rules(p_tenant_id)->'exit';v_created int:=0;v_updated int:=0;v_closed int:=0;r record;v_action_type text;v_title text;v_due timestamptz;v_expiry timestamptz;v_enabled boolean;v_recent_handled boolean;
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean,true) THEN
    UPDATE public.agent_pending_actions SET status='cancelled',updated_at=now(),execution_result=COALESCE(execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','lifecycle_tasks_disabled') WHERE tenant_id=p_tenant_id AND agent_name='followup_engine' AND status='pending' AND action_type LIKE 'lifecycle_%';GET DIAGNOSTICS v_closed=ROW_COUNT;
    RETURN jsonb_build_object('created',0,'updated',0,'closed',v_closed,'disabled',true);
  END IF;
  UPDATE public.agent_pending_actions a SET status='cancelled',updated_at=now(),execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','lifecycle_signal_no_longer_current_or_disabled')
  WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.status='pending' AND a.action_type LIKE 'lifecycle_%' AND NOT EXISTS(SELECT 1 FROM public.patient_risk_scores s WHERE s.tenant_id=p_tenant_id AND s.user_id=a.target_user_id AND s.calculated_date=p_reference_date AND a.action_type='lifecycle_'||COALESCE(s.lifecycle_status,'') AND CASE s.lifecycle_status WHEN 'awaiting_consultation' THEN COALESCE((cfg->>'awaiting_consultation')::boolean,false) WHEN 'return_overdue' THEN COALESCE((cfg->>'return_overdue')::boolean,true) WHEN 'plan_expiring' THEN COALESCE((cfg->>'plan_expiring')::boolean,true) WHEN 'plan_expired' THEN COALESCE((cfg->>'plan_expired')::boolean,true) WHEN 'protocol_completed' THEN COALESCE((cfg->>'protocol_completed')::boolean,true) WHEN 'reactivation' THEN COALESCE((cfg->>'reactivation')::boolean,true) ELSE false END);GET DIAGNOSTICS v_closed=ROW_COUNT;
  FOR r IN SELECT s.*,p.name patient_name FROM public.patient_risk_scores s LEFT JOIN public.profiles p ON p.user_id=s.user_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=p_tenant_id AND s.calculated_date=p_reference_date AND s.lifecycle_status IS NOT NULL LOOP
    v_enabled:=CASE r.lifecycle_status WHEN 'awaiting_consultation' THEN COALESCE((cfg->>'awaiting_consultation')::boolean,false) WHEN 'return_overdue' THEN COALESCE((cfg->>'return_overdue')::boolean,true) WHEN 'plan_expiring' THEN COALESCE((cfg->>'plan_expiring')::boolean,true) WHEN 'plan_expired' THEN COALESCE((cfg->>'plan_expired')::boolean,true) WHEN 'protocol_completed' THEN COALESCE((cfg->>'protocol_completed')::boolean,true) WHEN 'reactivation' THEN COALESCE((cfg->>'reactivation')::boolean,true) ELSE false END;IF NOT v_enabled THEN CONTINUE;END IF;
    v_action_type:='lifecycle_'||r.lifecycle_status;v_title:=CASE r.lifecycle_status WHEN 'awaiting_consultation' THEN 'Acompanhar consulta agendada' WHEN 'return_overdue' THEN 'Retorno atrasado' WHEN 'plan_expiring' THEN 'Plano próximo do vencimento' WHEN 'plan_expired' THEN 'Plano vencido' WHEN 'protocol_completed' THEN 'Protocolo concluído' WHEN 'reactivation' THEN 'Revisar reativação' ELSE 'Revisar jornada da paciente' END;v_due:=((p_reference_date::text||' '||COALESCE(cfg->>'task_time','09:30')||':00 America/Sao_Paulo')::timestamptz);
    SELECT EXISTS(SELECT 1 FROM public.agent_pending_actions h WHERE h.tenant_id=p_tenant_id AND h.target_user_id=r.user_id AND h.action_type=v_action_type AND h.agent_name='followup_engine' AND h.status IN('completed','dismissed') AND h.updated_at>=now()-make_interval(days=>CASE WHEN h.status='completed' THEN COALESCE((exit_cfg->>'completed_cooldown_days')::int,1) ELSE COALESCE((exit_cfg->>'dismissed_cooldown_days')::int,3) END)) INTO v_recent_handled;IF v_recent_handled THEN CONTINUE;END IF;
    UPDATE public.agent_pending_actions a SET title=v_title,content=COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),reasoning='Estado atual da jornada: '||r.lifecycle_status,context_data=jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'lifecycle_status',r.lifecycle_status,'lifecycle_details',COALESCE(r.lifecycle_details,'{}'::jsonb)),scheduled_for=CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE v_due END,expires_at=(CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE v_due END)+make_interval(hours=>COALESCE((cfg->>'expiry_hours')::int,72)),updated_at=now() WHERE a.tenant_id=p_tenant_id AND a.target_user_id=r.user_id AND a.action_type=v_action_type AND a.agent_name='followup_engine' AND a.status='pending';IF FOUND THEN v_updated:=v_updated+1;ELSE v_expiry:=v_due+make_interval(hours=>COALESCE((cfg->>'expiry_hours')::int,72));INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at) VALUES(p_tenant_id,'followup_engine',v_action_type,'patient',r.user_id,r.patient_name,v_title,COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),COALESCE(r.lifecycle_next_action,'Revisar o próximo passo desta paciente.'),'Estado atual da jornada: '||r.lifecycle_status,jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'lifecycle_status',r.lifecycle_status,'lifecycle_details',COALESCE(r.lifecycle_details,'{}'::jsonb)),v_due,'pending',v_expiry);v_created:=v_created+1;END IF;
  END LOOP;RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;$function$;

-- Feedback already resolves per source; preserve a manual snooze on refresh.
CREATE OR REPLACE FUNCTION public.sync_checkin_feedback_tasks(p_tenant_id uuid,p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $function$
DECLARE v_rules jsonb;v_enabled boolean;v_due_hours int;v_expiry_hours int;v_dismiss_resolves boolean;v_created int:=0;v_updated int:=0;v_closed int:=0;v_completed_days int;v_dismissed_days int;
BEGIN
  v_rules:=public.get_followup_engine_rules(p_tenant_id);v_enabled:=COALESCE((v_rules#>>'{feedback,enabled}')::boolean,true);v_due_hours:=GREATEST(0,COALESCE((v_rules#>>'{feedback,due_hours}')::int,24));v_expiry_hours:=GREATEST(1,COALESCE((v_rules#>>'{feedback,expiry_hours}')::int,72));v_dismiss_resolves:=COALESCE((v_rules#>>'{feedback,dismiss_counts_as_resolved}')::boolean,true);v_completed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,completed_cooldown_days}')::int,1));v_dismissed_days:=GREATEST(0,COALESCE((v_rules#>>'{exit,dismissed_cooldown_days}')::int,3));
  IF NOT v_enabled THEN UPDATE public.agent_pending_actions SET status='cancelled',updated_at=now(),execution_result=COALESCE(execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','feedback_rule_disabled') WHERE tenant_id=p_tenant_id AND agent_name='followup_engine' AND action_type='weekly_checkin_feedback' AND status='pending';GET DIAGNOSTICS v_closed=ROW_COUNT;RETURN jsonb_build_object('created',0,'updated',0,'closed',v_closed,'enabled',false);END IF;
  WITH latest AS (SELECT DISTINCT ON(w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,COALESCE(p.name,'Paciente') patient_name FROM public.weekly_checkin_responses w JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id WHERE w.tenant_id=p_tenant_id ORDER BY w.user_id,w.created_at DESC), src AS (SELECT l.* FROM latest l WHERE l.created_at<=now()-make_interval(hours=>v_due_hours) AND NOT EXISTS(SELECT 1 FROM public.agent_pending_actions old WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback' AND old.created_at>=l.created_at AND (old.status='completed' OR (v_dismiss_resolves AND old.status='dismissed') OR (old.status='dismissed' AND v_dismissed_days>0 AND old.updated_at>=now()-make_interval(days=>v_dismissed_days))))), stale AS (UPDATE public.agent_pending_actions a SET status='cancelled',updated_at=now(),execution_result=COALESCE(a.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','feedback_source_resolved_or_replaced') WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending' AND NOT EXISTS(SELECT 1 FROM src s WHERE s.user_id=a.target_user_id AND (a.context_data->>'weekly_checkin_id')::uuid=s.id) RETURNING id) SELECT count(*) INTO v_closed FROM stale;
  WITH latest AS (SELECT DISTINCT ON(w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,COALESCE(p.name,'Paciente') patient_name FROM public.weekly_checkin_responses w JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id WHERE w.tenant_id=p_tenant_id ORDER BY w.user_id,w.created_at DESC), src AS (SELECT l.* FROM latest l WHERE l.created_at<=now()-make_interval(hours=>v_due_hours) AND NOT EXISTS(SELECT 1 FROM public.agent_pending_actions old WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback' AND old.created_at>=l.created_at AND (old.status='completed' OR (v_dismiss_resolves AND old.status='dismissed') OR (old.status='dismissed' AND v_dismissed_days>0 AND old.updated_at>=now()-make_interval(days=>v_dismissed_days))))), changed AS (UPDATE public.agent_pending_actions a SET target_patient_name=s.patient_name,title='Feedback de check-in pendente',content='Revisar o check-in semanal e registrar o retorno clínico da paciente.',content_preview='Check-in semanal aguardando feedback.',reasoning='O último check-in ultrapassou o prazo configurado para feedback.',context_data=jsonb_build_object('source','weekly_checkin_responses','weekly_checkin_id',s.id,'week_start',s.week_start,'submitted_at',s.created_at,'diet_score',s.diet_score,'main_difficulty',s.main_difficulty,'bowel',s.bowel,'had_binge',s.had_binge,'mood',s.mood,'extra_notes',s.extra_notes),scheduled_for=CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE s.created_at+make_interval(hours=>v_due_hours) END,expires_at=(CASE WHEN a.execution_result->>'outcome'='snoozed' AND a.scheduled_for>now() THEN a.scheduled_for ELSE s.created_at+make_interval(hours=>v_due_hours) END)+make_interval(hours=>v_expiry_hours),updated_at=now() FROM src s WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending' AND a.target_user_id=s.user_id AND (a.context_data->>'weekly_checkin_id')::uuid=s.id RETURNING id) SELECT count(*) INTO v_updated FROM changed;
  WITH latest AS (SELECT DISTINCT ON(w.user_id) w.id,w.user_id,w.created_at,w.week_start,w.diet_score,w.main_difficulty,w.bowel,w.had_binge,w.mood,w.extra_notes,COALESCE(p.name,'Paciente') patient_name FROM public.weekly_checkin_responses w JOIN public.profiles p ON p.user_id=w.user_id AND p.tenant_id=p_tenant_id WHERE w.tenant_id=p_tenant_id ORDER BY w.user_id,w.created_at DESC), src AS (SELECT l.* FROM latest l WHERE l.created_at<=now()-make_interval(hours=>v_due_hours) AND NOT EXISTS(SELECT 1 FROM public.agent_pending_actions old WHERE old.tenant_id=p_tenant_id AND old.target_user_id=l.user_id AND old.agent_name='followup_engine' AND old.action_type='weekly_checkin_feedback' AND old.created_at>=l.created_at AND (old.status='completed' OR (v_dismiss_resolves AND old.status='dismissed') OR (old.status='dismissed' AND v_dismissed_days>0 AND old.updated_at>=now()-make_interval(days=>v_dismissed_days))))), inserted AS (INSERT INTO public.agent_pending_actions(tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at) SELECT p_tenant_id,'followup_engine','weekly_checkin_feedback','patient',s.user_id,s.patient_name,'Feedback de check-in pendente','Revisar o check-in semanal e registrar o retorno clínico da paciente.','Check-in semanal aguardando feedback.','O último check-in ultrapassou o prazo configurado para feedback.',jsonb_build_object('source','weekly_checkin_responses','weekly_checkin_id',s.id,'week_start',s.week_start,'submitted_at',s.created_at,'diet_score',s.diet_score,'main_difficulty',s.main_difficulty,'bowel',s.bowel,'had_binge',s.had_binge,'mood',s.mood,'extra_notes',s.extra_notes),s.created_at+make_interval(hours=>v_due_hours),'pending',s.created_at+make_interval(hours=>v_due_hours+v_expiry_hours) FROM src s WHERE NOT EXISTS(SELECT 1 FROM public.agent_pending_actions a WHERE a.tenant_id=p_tenant_id AND a.agent_name='followup_engine' AND a.action_type='weekly_checkin_feedback' AND a.status='pending' AND a.target_user_id=s.user_id) ON CONFLICT DO NOTHING RETURNING id) SELECT count(*) INTO v_created FROM inserted;
  RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'enabled',true,'reference_date',p_reference_date);
END;$function$;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_patient_followup_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_phase_review_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_lifecycle_followup_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_patient_followup_tasks(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_phase_review_tasks(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_lifecycle_followup_tasks(uuid,date) TO service_role;
