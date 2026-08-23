-- Fase 2 — regras do Motor de Acompanhamento editáveis por tenant.
-- Defaults preservam o comportamento atual; o Admin pode sobrescrevê-los sem alterar código.

CREATE TABLE IF NOT EXISTS public.tenant_followup_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_followup_settings_rules_object CHECK (jsonb_typeof(rules) = 'object')
);

ALTER TABLE public.tenant_followup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff read followup settings" ON public.tenant_followup_settings;
CREATE POLICY "Tenant staff read followup settings"
ON public.tenant_followup_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = tenant_followup_settings.tenant_id
      AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri','secretaria')
  )
);

DROP POLICY IF EXISTS "Tenant clinicians manage followup settings" ON public.tenant_followup_settings;
CREATE POLICY "Tenant clinicians manage followup settings"
ON public.tenant_followup_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = tenant_followup_settings.tenant_id
      AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = tenant_followup_settings.tenant_id
      AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
  )
);

CREATE OR REPLACE FUNCTION public.default_followup_engine_rules()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'inactivity', jsonb_build_object(
      'gentle_days', 2,
      'oscillating_days', 4,
      'risk_days', 7,
      'critical_days', 10,
      'inactive_days', 14
    ),
    'adherence', jsonb_build_object(
      'at_risk_below', 40,
      'oscillating_below', 60
    ),
    'checkin', jsonb_build_object(
      'overdue_days', 8
    ),
    'plan', jsonb_build_object(
      'expiring_days', 15,
      'urgent_days', 7
    ),
    'protocol', jsonb_build_object(
      'ending_days', 7,
      'urgent_days', 3
    ),
    'tasks', jsonb_build_object(
      'critical_time', '09:00',
      'today_time', '12:00',
      'this_week_delay_days', 2,
      'this_week_time', '09:00',
      'gentle_time', '10:00',
      'phase_review_time', '15:00',
      'urgent_expiry_hours', 24,
      'routine_expiry_hours', 72,
      'phase_review_expiry_days', 3
    ),
    'automation', jsonb_build_object(
      'automatic_contact_enabled', false
    )
  );
$$;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;

CREATE OR REPLACE FUNCTION public.get_followup_engine_rules(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.default_followup_engine_rules() || COALESCE(
    (SELECT s.rules FROM public.tenant_followup_settings s WHERE s.tenant_id = p_tenant_id),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_patient_operational_snapshot(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
  v_calculated_at timestamptz := ((p_reference_date::timestamp + time '12:00') AT TIME ZONE 'America/Sao_Paulo');
  v_rules jsonb;
  v_gentle integer;
  v_oscillating integer;
  v_risk integer;
  v_critical integer;
  v_inactive integer;
  v_adherence_risk numeric;
  v_adherence_oscillating numeric;
  v_checkin_overdue integer;
  v_plan_expiring integer;
  v_plan_urgent integer;
  v_protocol_ending integer;
  v_protocol_urgent integer;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023'; END IF;

  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_gentle := COALESCE((v_rules#>>'{inactivity,gentle_days}')::int,2);
  v_oscillating := COALESCE((v_rules#>>'{inactivity,oscillating_days}')::int,4);
  v_risk := COALESCE((v_rules#>>'{inactivity,risk_days}')::int,7);
  v_critical := COALESCE((v_rules#>>'{inactivity,critical_days}')::int,10);
  v_inactive := COALESCE((v_rules#>>'{inactivity,inactive_days}')::int,14);
  v_adherence_risk := COALESCE((v_rules#>>'{adherence,at_risk_below}')::numeric,40);
  v_adherence_oscillating := COALESCE((v_rules#>>'{adherence,oscillating_below}')::numeric,60);
  v_checkin_overdue := COALESCE((v_rules#>>'{checkin,overdue_days}')::int,8);
  v_plan_expiring := COALESCE((v_rules#>>'{plan,expiring_days}')::int,15);
  v_plan_urgent := COALESCE((v_rules#>>'{plan,urgent_days}')::int,7);
  v_protocol_ending := COALESCE((v_rules#>>'{protocol,ending_days}')::int,7);
  v_protocol_urgent := COALESCE((v_rules#>>'{protocol,urgent_days}')::int,3);

  IF NOT (v_gentle >= 1 AND v_gentle < v_oscillating AND v_oscillating < v_risk AND v_risk < v_critical AND v_critical < v_inactive) THEN
    RAISE EXCEPTION 'Faixas de inatividade inválidas nas configurações do motor' USING ERRCODE='22023';
  END IF;

  WITH patients AS (
    SELECT p.user_id,p.tenant_id,p.created_at::date AS created_date,COALESCE(p.onboarding_completed,false) AS onboarding_completed,p.plan_expires_at,COALESCE(p.current_streak,0) AS current_streak
    FROM public.profiles p WHERE p.tenant_id=p_tenant_id AND p.role='patient'
  ), activity_dates AS (
    SELECT dl.user_id,dl.log_date AS activity_date FROM public.daily_logs dl JOIN patients p ON p.user_id=dl.user_id WHERE dl.log_date BETWEEN p_reference_date-30 AND p_reference_date
    UNION SELECT cd.paciente_id,cd.data FROM public.checkin_diario cd JOIN patients p ON p.user_id=cd.paciente_id WHERE cd.data BETWEEN p_reference_date-30 AND p_reference_date
    UNION SELECT wr.user_id,(wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date FROM public.weekly_checkin_responses wr JOIN patients p ON p.user_id=wr.user_id WHERE (wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_reference_date-30 AND p_reference_date
    UNION SELECT pa.user_id,pp.checkin_date FROM public.protocol_progress pp JOIN public.protocol_assignments pa ON pa.id=pp.assignment_id JOIN patients p ON p.user_id=pa.user_id WHERE pp.checkin_date BETWEEN p_reference_date-30 AND p_reference_date
  ), activity AS (
    SELECT p.user_id,max(a.activity_date) AS last_activity_date,count(DISTINCT a.activity_date) FILTER (WHERE a.activity_date BETWEEN p_reference_date-6 AND p_reference_date)::integer AS active_days_7d FROM patients p LEFT JOIN activity_dates a ON a.user_id=p.user_id GROUP BY p.user_id
  ), weekly AS (
    SELECT p.user_id,max((wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS last_weekly_checkin_date FROM patients p LEFT JOIN public.weekly_checkin_responses wr ON wr.user_id=p.user_id GROUP BY p.user_id
  ), appointments AS (
    SELECT p.user_id,min(a.scheduled_at) FILTER (WHERE a.scheduled_at >= (p_reference_date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND a.status IN ('scheduled','confirmed')) AS next_appointment_at,max(COALESCE(a.completed_at,a.scheduled_at)) FILTER (WHERE a.status='completed') AS last_appointment_at,bool_or(a.scheduled_at < (p_reference_date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND a.status IN ('scheduled','confirmed')) AS consultation_overdue
    FROM patients p LEFT JOIN public.appointments a ON a.patient_id=p.user_id AND a.tenant_id=p.tenant_id GROUP BY p.user_id
  ), protocols AS (
    SELECT p.user_id,min(pa.end_date) FILTER (WHERE pa.status='active' AND pa.end_date>=p_reference_date) AS active_protocol_end_date FROM patients p LEFT JOIN public.protocol_assignments pa ON pa.user_id=p.user_id GROUP BY p.user_id
  ), base AS (
    SELECT p.*,a.last_activity_date,COALESCE(a.active_days_7d,0) AS active_days_7d,GREATEST(1,LEAST(7,(p_reference_date-p.created_date)+1))::integer AS eligible_days,COALESCE(p_reference_date-a.last_activity_date,p_reference_date-p.created_date) AS days_inactive,w.last_weekly_checkin_date,ap.next_appointment_at,ap.last_appointment_at,COALESCE(ap.consultation_overdue,false) AS consultation_overdue,pr.active_protocol_end_date
    FROM patients p LEFT JOIN activity a ON a.user_id=p.user_id LEFT JOIN weekly w ON w.user_id=p.user_id LEFT JOIN appointments ap ON ap.user_id=p.user_id LEFT JOIN protocols pr ON pr.user_id=p.user_id
  ), scored AS (
    SELECT b.*,round((100.0*b.active_days_7d/NULLIF(b.eligible_days,0))::numeric,1) AS adherence_7d_calc,
      CASE WHEN b.days_inactive < v_gentle THEN 0 WHEN b.days_inactive < v_oscillating THEN 20 WHEN b.days_inactive < v_risk THEN 40 WHEN b.days_inactive < v_critical THEN 60 WHEN b.days_inactive < v_inactive THEN 80 ELSE 100 END AS inactivity_risk_calc,
      GREATEST(0,LEAST(100,round(100-(100.0*b.active_days_7d/NULLIF(b.eligible_days,0)))::integer)) AS adherence_risk_calc,
      (b.onboarding_completed AND (b.last_weekly_checkin_date IS NULL OR p_reference_date-b.last_weekly_checkin_date>=v_checkin_overdue)) AS checkin_overdue_calc,
      (b.plan_expires_at IS NOT NULL AND (b.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_reference_date AND p_reference_date+v_plan_expiring) AS plan_expiring_calc,
      (b.active_protocol_end_date IS NOT NULL AND b.active_protocol_end_date BETWEEN p_reference_date AND p_reference_date+v_protocol_ending) AS protocol_ending_calc FROM base b
  ), classified AS (
    SELECT s.*,round((s.inactivity_risk_calc*0.60)+(s.adherence_risk_calc*0.40))::integer AS overall_risk_calc,
      CASE WHEN NOT s.onboarding_completed THEN 'onboarding' WHEN s.days_inactive>=v_inactive THEN 'inactive' WHEN s.days_inactive>=v_risk OR s.adherence_7d_calc<v_adherence_risk THEN 'at_risk' WHEN s.days_inactive>=v_oscillating OR s.adherence_7d_calc<v_adherence_oscillating THEN 'oscillating' ELSE 'adherent' END AS operational_status_calc,
      CASE WHEN s.days_inactive>=v_critical OR s.consultation_overdue THEN 'critical' WHEN s.days_inactive>=v_risk OR (s.plan_expiring_calc AND (s.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date<=p_reference_date+v_plan_urgent) OR (s.protocol_ending_calc AND s.active_protocol_end_date<=p_reference_date+v_protocol_urgent) THEN 'today' WHEN s.days_inactive>=v_oscillating OR s.checkin_overdue_calc OR s.plan_expiring_calc OR s.protocol_ending_calc THEN 'this_week' WHEN s.days_inactive>=v_gentle AND s.days_inactive<v_oscillating THEN 'automatic' ELSE 'none' END AS attention_bucket_calc FROM scored s
  )
  INSERT INTO public.patient_risk_scores (tenant_id,user_id,overall_risk,inactivity_risk,adherence_risk,emotional_risk,engagement_risk,risk_level,signals,recommended_action,action_taken,days_since_activity,current_streak,adherence_7d,last_checkin_score,calculated_at,operational_status,attention_bucket,last_activity_date,eligible_activity_days,next_appointment_at,last_appointment_at,active_protocol_end_date,checkin_overdue,consultation_overdue,plan_expiring,protocol_ending,reasons)
  SELECT c.tenant_id,c.user_id,c.overall_risk_calc,c.inactivity_risk_calc,c.adherence_risk_calc,0,GREATEST(c.inactivity_risk_calc,c.adherence_risk_calc),CASE WHEN c.overall_risk_calc>=75 THEN 'critical' WHEN c.overall_risk_calc>=55 THEN 'high' WHEN c.overall_risk_calc>=30 THEN 'medium' ELSE 'low' END,
    jsonb_build_object('days_since_activity',c.days_inactive,'adherence_7d',c.adherence_7d_calc,'checkin_overdue',c.checkin_overdue_calc,'consultation_overdue',c.consultation_overdue,'plan_expiring',c.plan_expiring_calc,'protocol_ending',c.protocol_ending_calc,'rules_version',1),
    CASE c.attention_bucket_calc WHEN 'critical' THEN 'Revisar hoje e definir intervenção humana.' WHEN 'today' THEN 'Priorizar contato ou revisão hoje.' WHEN 'this_week' THEN 'Revisar nesta semana.' WHEN 'automatic' THEN 'Elegível para lembrete leve automático.' ELSE 'Sem intervenção necessária.' END,
    false,c.days_inactive,c.current_streak,c.adherence_7d_calc,NULL,v_calculated_at,c.operational_status_calc,c.attention_bucket_calc,c.last_activity_date,c.eligible_days,c.next_appointment_at,c.last_appointment_at,c.active_protocol_end_date,c.checkin_overdue_calc,c.consultation_overdue,c.plan_expiring_calc,c.protocol_ending_calc,
    (CASE WHEN c.days_inactive>=v_oscillating THEN jsonb_build_array(jsonb_build_object('code','inactivity','days',c.days_inactive)) ELSE '[]'::jsonb END)
    || (CASE WHEN c.checkin_overdue_calc THEN jsonb_build_array(jsonb_build_object('code','checkin_overdue')) ELSE '[]'::jsonb END)
    || (CASE WHEN c.consultation_overdue THEN jsonb_build_array(jsonb_build_object('code','consultation_overdue')) ELSE '[]'::jsonb END)
    || (CASE WHEN c.plan_expiring_calc THEN jsonb_build_array(jsonb_build_object('code','plan_expiring','date',(c.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date)) ELSE '[]'::jsonb END)
    || (CASE WHEN c.protocol_ending_calc THEN jsonb_build_array(jsonb_build_object('code','protocol_ending','date',c.active_protocol_end_date)) ELSE '[]'::jsonb END)
  FROM classified c
  ON CONFLICT (user_id,calculated_date) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,overall_risk=EXCLUDED.overall_risk,inactivity_risk=EXCLUDED.inactivity_risk,adherence_risk=EXCLUDED.adherence_risk,emotional_risk=EXCLUDED.emotional_risk,engagement_risk=EXCLUDED.engagement_risk,risk_level=EXCLUDED.risk_level,signals=EXCLUDED.signals,recommended_action=EXCLUDED.recommended_action,action_taken=false,days_since_activity=EXCLUDED.days_since_activity,current_streak=EXCLUDED.current_streak,adherence_7d=EXCLUDED.adherence_7d,calculated_at=EXCLUDED.calculated_at,operational_status=EXCLUDED.operational_status,attention_bucket=EXCLUDED.attention_bucket,last_activity_date=EXCLUDED.last_activity_date,eligible_activity_days=EXCLUDED.eligible_activity_days,next_appointment_at=EXCLUDED.next_appointment_at,last_appointment_at=EXCLUDED.last_appointment_at,active_protocol_end_date=EXCLUDED.active_protocol_end_date,checkin_overdue=EXCLUDED.checkin_overdue,consultation_overdue=EXCLUDED.consultation_overdue,plan_expiring=EXCLUDED.plan_expiring,protocol_ending=EXCLUDED.protocol_ending,reasons=EXCLUDED.reasons;
  GET DIAGNOSTICS v_rows=ROW_COUNT; RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_patient_operational_snapshot(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_patient_operational_snapshot(uuid,date) TO service_role;

COMMENT ON TABLE public.tenant_followup_settings IS
'Regras editáveis do Motor de Acompanhamento por clínica/tenant. Defaults de produto não substituem decisões configuráveis no Admin.';
