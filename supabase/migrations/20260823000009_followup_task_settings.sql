-- Fase 2 — merge profundo dos defaults e uso das regras editáveis nas tarefas.

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
    'automation', (d.rules->'automation') || COALESCE(s.rules->'automation','{}'::jsonb)
  ) FROM d,s;
$$;

REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_patient_followup_tasks(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer:=0;
  v_updated integer:=0;
  v_closed integer:=0;
  v_rules jsonb;
  v_critical_time time;
  v_today_time time;
  v_week_delay integer;
  v_week_time time;
  v_gentle_time time;
  v_urgent_expiry integer;
  v_routine_expiry integer;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;

  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_critical_time := COALESCE((v_rules#>>'{tasks,critical_time}')::time,time '09:00');
  v_today_time := COALESCE((v_rules#>>'{tasks,today_time}')::time,time '12:00');
  v_week_delay := COALESCE((v_rules#>>'{tasks,this_week_delay_days}')::int,2);
  v_week_time := COALESCE((v_rules#>>'{tasks,this_week_time}')::time,time '09:00');
  v_gentle_time := COALESCE((v_rules#>>'{tasks,gentle_time}')::time,time '10:00');
  v_urgent_expiry := COALESCE((v_rules#>>'{tasks,urgent_expiry_hours}')::int,24);
  v_routine_expiry := COALESCE((v_rules#>>'{tasks,routine_expiry_hours}')::int,72);

  WITH desired AS (
    SELECT prs.user_id,CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END AS action_type
    FROM public.patient_risk_scores prs
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
  ), stale AS (
    UPDATE public.agent_pending_actions apa SET status='cancelled',updated_at=now(),execution_result=COALESCE(apa.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','signal_no_longer_current','reference_date',p_reference_date)
    WHERE apa.tenant_id=p_tenant_id AND apa.agent_name='followup_engine' AND apa.status='pending'
      AND apa.action_type IN ('human_followup','gentle_reengagement_candidate')
      AND NOT EXISTS (SELECT 1 FROM desired d WHERE d.user_id=apa.target_user_id AND d.action_type=apa.action_type)
    RETURNING apa.id
  ) SELECT count(*) INTO v_closed FROM stale;

  WITH current_rows AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name,
      CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END AS desired_action_type,
      CASE prs.attention_bucket WHEN 'critical' THEN 'Intervenção humana prioritária' WHEN 'today' THEN 'Acompanhamento prioritário hoje' WHEN 'this_week' THEN 'Acompanhamento nesta semana' WHEN 'automatic' THEN 'Candidata a retomada leve' END AS task_title,
      CASE prs.attention_bucket
        WHEN 'critical' THEN (p_reference_date::timestamp+v_critical_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'today' THEN (p_reference_date::timestamp+v_today_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'this_week' THEN ((p_reference_date+v_week_delay)::timestamp+v_week_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'automatic' THEN (p_reference_date::timestamp+v_gentle_time) AT TIME ZONE 'America/Sao_Paulo'
      END AS due_at
    FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
  ), changed AS (
    UPDATE public.agent_pending_actions apa SET target_patient_name=c.patient_name,title=c.task_title,
      content=COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),content_preview=COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),
      reasoning=CASE WHEN c.attention_bucket='critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.' WHEN c.attention_bucket='today' THEN 'Sinal que merece prioridade hoje.' WHEN c.attention_bucket='this_week' THEN 'Sinal que merece revisão nesta semana.' ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.' END,
      context_data=jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'risk_score_id',c.id,'attention_bucket',c.attention_bucket,'operational_status',c.operational_status,'overall_risk',c.overall_risk,'days_since_activity',c.days_since_activity,'adherence_7d',c.adherence_7d,'reasons',COALESCE(c.reasons,'[]'::jsonb)),
      scheduled_for=c.due_at,updated_at=now()
    FROM current_rows c
    WHERE apa.tenant_id=p_tenant_id AND apa.agent_name='followup_engine' AND apa.status='pending' AND apa.target_user_id=c.user_id AND apa.action_type=c.desired_action_type
    RETURNING apa.id
  ) SELECT count(*) INTO v_updated FROM changed;

  WITH current_rows AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name,
      CASE WHEN prs.attention_bucket='automatic' THEN 'gentle_reengagement_candidate' ELSE 'human_followup' END AS desired_action_type,
      CASE prs.attention_bucket WHEN 'critical' THEN 'Intervenção humana prioritária' WHEN 'today' THEN 'Acompanhamento prioritário hoje' WHEN 'this_week' THEN 'Acompanhamento nesta semana' WHEN 'automatic' THEN 'Candidata a retomada leve' END AS task_title,
      CASE prs.attention_bucket
        WHEN 'critical' THEN (p_reference_date::timestamp+v_critical_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'today' THEN (p_reference_date::timestamp+v_today_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'this_week' THEN ((p_reference_date+v_week_delay)::timestamp+v_week_time) AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'automatic' THEN (p_reference_date::timestamp+v_gentle_time) AT TIME ZONE 'America/Sao_Paulo'
      END AS due_at
    FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.attention_bucket IN ('critical','today','this_week','automatic')
  ), inserted AS (
    INSERT INTO public.agent_pending_actions (tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at)
    SELECT c.tenant_id,'followup_engine',c.desired_action_type,'patient',c.user_id,c.patient_name,c.task_title,
      COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),COALESCE(c.recommended_action,'Revisar o contexto da paciente.'),
      CASE WHEN c.attention_bucket='critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.' WHEN c.attention_bucket='today' THEN 'Sinal que merece prioridade hoje.' WHEN c.attention_bucket='this_week' THEN 'Sinal que merece revisão nesta semana.' ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.' END,
      jsonb_build_object('source','patient_risk_scores','snapshot_date',p_reference_date,'risk_score_id',c.id,'attention_bucket',c.attention_bucket,'operational_status',c.operational_status,'overall_risk',c.overall_risk,'days_since_activity',c.days_since_activity,'adherence_7d',c.adherence_7d,'reasons',COALESCE(c.reasons,'[]'::jsonb)),
      c.due_at,'pending',c.due_at + CASE WHEN c.attention_bucket IN ('critical','today') THEN make_interval(hours=>v_urgent_expiry) ELSE make_interval(hours=>v_routine_expiry) END
    FROM current_rows c
    WHERE NOT EXISTS (SELECT 1 FROM public.agent_pending_actions apa WHERE apa.tenant_id=c.tenant_id AND apa.target_user_id=c.user_id AND apa.agent_name='followup_engine' AND apa.action_type=c.desired_action_type AND apa.status='pending')
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object('created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_patient_followup_tasks(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_patient_followup_tasks(uuid,date) TO service_role;

-- A tarefa de revisão de fase também usa horário e validade configuráveis.
CREATE OR REPLACE FUNCTION public.sync_phase_review_tasks(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluated integer := 0; v_created integer := 0; v_updated integer := 0; v_closed integer := 0;
  v_rules jsonb; v_review_time time; v_review_expiry integer;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;
  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_review_time := COALESCE((v_rules#>>'{tasks,phase_review_time}')::time,time '15:00');
  v_review_expiry := COALESCE((v_rules#>>'{tasks,phase_review_expiry_days}')::int,3);
  v_evaluated := public.refresh_phase_advancement_eligibility(p_tenant_id,p_reference_date);

  WITH stale AS (
    UPDATE public.agent_pending_actions apa SET status='cancelled',updated_at=now(),execution_result=COALESCE(apa.execution_result,'{}'::jsonb)||jsonb_build_object('closed_by','followup_engine','closed_reason','phase_no_longer_eligible','reference_date',p_reference_date)
    WHERE apa.tenant_id=p_tenant_id AND apa.agent_name='followup_engine' AND apa.action_type='phase_advancement_review' AND apa.status='pending'
      AND NOT EXISTS (SELECT 1 FROM public.patient_risk_scores prs WHERE prs.tenant_id=p_tenant_id AND prs.user_id=apa.target_user_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true)
    RETURNING id
  ) SELECT count(*) INTO v_closed FROM stale;

  WITH eligible AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true
  ), changed AS (
    UPDATE public.agent_pending_actions apa SET target_patient_name=e.patient_name,title='Revisar avanço de fase',
      content='Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.',content_preview='Paciente elegível para revisão de fase.',
      reasoning='Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',
      context_data=jsonb_build_object('source','phase_advancement_criteria','snapshot_date',p_reference_date,'risk_score_id',e.id,'current_method_phase_id',e.current_method_phase_id,'phase_review_details',e.phase_review_details),
      scheduled_for=((p_reference_date::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo'),updated_at=now()
    FROM eligible e WHERE apa.tenant_id=p_tenant_id AND apa.agent_name='followup_engine' AND apa.action_type='phase_advancement_review' AND apa.status='pending' AND apa.target_user_id=e.user_id RETURNING apa.id
  ) SELECT count(*) INTO v_updated FROM changed;

  WITH eligible AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name FROM public.patient_risk_scores prs LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date AND prs.phase_review_eligible=true
  ), inserted AS (
    INSERT INTO public.agent_pending_actions (tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at)
    SELECT e.tenant_id,'followup_engine','phase_advancement_review','patient',e.user_id,e.patient_name,'Revisar avanço de fase',
      'Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.','Paciente elegível para revisão de fase.',
      'Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',
      jsonb_build_object('source','phase_advancement_criteria','snapshot_date',p_reference_date,'risk_score_id',e.id,'current_method_phase_id',e.current_method_phase_id,'phase_review_details',e.phase_review_details),
      ((p_reference_date::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo'),'pending',
      (((p_reference_date+v_review_expiry)::timestamp+v_review_time) AT TIME ZONE 'America/Sao_Paulo')
    FROM eligible e WHERE NOT EXISTS (SELECT 1 FROM public.agent_pending_actions apa WHERE apa.tenant_id=e.tenant_id AND apa.target_user_id=e.user_id AND apa.agent_name='followup_engine' AND apa.action_type='phase_advancement_review' AND apa.status='pending')
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object('evaluated',v_evaluated,'created',v_created,'updated',v_updated,'closed',v_closed,'reference_date',p_reference_date);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_phase_review_tasks(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_phase_review_tasks(uuid,date) TO service_role;
