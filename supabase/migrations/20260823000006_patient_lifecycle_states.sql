-- Fase 2 — estados de jornada operacional separados do risco, com override manual por tenant.

ALTER TABLE public.patient_risk_scores
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS lifecycle_next_action text,
  ADD COLUMN IF NOT EXISTS lifecycle_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.patient_lifecycle_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  override_status text NOT NULL,
  next_action text,
  note text,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.patient_lifecycle_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant clinicians read lifecycle overrides" ON public.patient_lifecycle_overrides;
CREATE POLICY "Tenant clinicians read lifecycle overrides"
ON public.patient_lifecycle_overrides FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id=auth.uid() AND p.tenant_id=patient_lifecycle_overrides.tenant_id
    AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
));

DROP POLICY IF EXISTS "Tenant clinicians manage lifecycle overrides" ON public.patient_lifecycle_overrides;
CREATE POLICY "Tenant clinicians manage lifecycle overrides"
ON public.patient_lifecycle_overrides FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id=auth.uid() AND p.tenant_id=patient_lifecycle_overrides.tenant_id
    AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id=auth.uid() AND p.tenant_id=patient_lifecycle_overrides.tenant_id
    AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')
));

CREATE OR REPLACE FUNCTION public.default_followup_engine_rules()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT jsonb_build_object(
    'inactivity', jsonb_build_object('gentle_days',2,'oscillating_days',4,'risk_days',7,'critical_days',10,'inactive_days',14),
    'adherence', jsonb_build_object('at_risk_below',40,'oscillating_below',60),
    'checkin', jsonb_build_object('overdue_days',8),
    'plan', jsonb_build_object('expiring_days',15,'urgent_days',7),
    'protocol', jsonb_build_object('ending_days',7,'urgent_days',3),
    'tasks', jsonb_build_object('critical_time','09:00','today_time','12:00','this_week_delay_days',2,'this_week_time','09:00','gentle_time','10:00','phase_review_time','15:00','urgent_expiry_hours',24,'routine_expiry_hours',72,'phase_review_expiry_days',3),
    'feedback', jsonb_build_object('enabled',true,'due_hours',24,'expiry_hours',72,'dismiss_counts_as_resolved',true),
    'exit', jsonb_build_object('completed_cooldown_days',1,'dismissed_cooldown_days',3),
    'lifecycle', jsonb_build_object(
      'enabled',true,
      'return_overdue_days',45,
      'reactivation_after_days',30,
      'protocol_completed_window_days',7,
      'plan_expired_grace_days',0,
      'manual_completed_only',true
    ),
    'automation', jsonb_build_object('automatic_contact_enabled',false)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_followup_engine_rules(p_tenant_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
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
    'lifecycle', (d.rules->'lifecycle') || COALESCE(s.rules->'lifecycle','{}'::jsonb),
    'automation', (d.rules->'automation') || COALESCE(s.rules->'automation','{}'::jsonb)
  ) FROM d,s;
$$;

CREATE OR REPLACE FUNCTION public.refresh_patient_lifecycle_states(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::date
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rules jsonb;
  v_enabled boolean;
  v_return_days int;
  v_reactivation_days int;
  v_protocol_window int;
  v_plan_grace int;
  v_rows int := 0;
BEGIN
  v_rules := public.get_followup_engine_rules(p_tenant_id);
  v_enabled := COALESCE((v_rules#>>'{lifecycle,enabled}')::boolean,true);
  IF NOT v_enabled THEN RETURN 0; END IF;
  v_return_days := GREATEST(1,COALESCE((v_rules#>>'{lifecycle,return_overdue_days}')::int,45));
  v_reactivation_days := GREATEST(1,COALESCE((v_rules#>>'{lifecycle,reactivation_after_days}')::int,30));
  v_protocol_window := GREATEST(0,COALESCE((v_rules#>>'{lifecycle,protocol_completed_window_days}')::int,7));
  v_plan_grace := GREATEST(0,COALESCE((v_rules#>>'{lifecycle,plan_expired_grace_days}')::int,0));

  WITH latest_protocol AS (
    SELECT DISTINCT ON (pa.user_id) pa.user_id, pa.status, pa.end_date, pa.progress_percentage
    FROM public.protocol_assignments pa
    JOIN public.profiles p ON p.user_id=pa.user_id AND p.tenant_id=p_tenant_id
    ORDER BY pa.user_id, COALESCE(pa.end_date,pa.start_date) DESC NULLS LAST, pa.created_at DESC
  ), overrides AS (
    SELECT * FROM public.patient_lifecycle_overrides WHERE tenant_id=p_tenant_id AND active=true
  ), base AS (
    SELECT rs.id,rs.user_id,rs.days_since_activity,rs.next_appointment_at,rs.last_appointment_at,rs.consultation_overdue,rs.plan_expiring,
           p.plan_expires_at,p.onboarding_completed,
           lp.status AS protocol_status,lp.end_date AS protocol_end_date,lp.progress_percentage,
           o.override_status,o.next_action AS override_next_action,o.note AS override_note
    FROM public.patient_risk_scores rs
    JOIN public.profiles p ON p.user_id=rs.user_id AND p.tenant_id=rs.tenant_id
    LEFT JOIN latest_protocol lp ON lp.user_id=rs.user_id
    LEFT JOIN overrides o ON o.user_id=rs.user_id
    WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date=p_reference_date
  ), calc AS (
    SELECT b.*,
      CASE
        WHEN b.override_status IS NOT NULL THEN b.override_status
        WHEN NOT COALESCE(b.onboarding_completed,false) THEN 'onboarding'
        WHEN b.consultation_overdue THEN 'return_overdue'
        WHEN b.plan_expires_at IS NOT NULL AND (b.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date < p_reference_date-v_plan_grace THEN 'plan_expired'
        WHEN b.plan_expiring THEN 'plan_expiring'
        WHEN b.next_appointment_at IS NOT NULL THEN 'awaiting_consultation'
        WHEN b.protocol_status='completed' OR (b.protocol_end_date IS NOT NULL AND b.protocol_end_date BETWEEN p_reference_date-v_protocol_window AND p_reference_date) THEN 'protocol_completed'
        WHEN b.last_appointment_at IS NOT NULL AND ((p_reference_date - (b.last_appointment_at AT TIME ZONE 'America/Sao_Paulo')::date) >= v_return_days) THEN 'return_overdue'
        WHEN COALESCE(b.days_since_activity,0) >= v_reactivation_days THEN 'reactivation'
        ELSE 'active_followup'
      END AS status_calc
    FROM base b
  )
  UPDATE public.patient_risk_scores rs
  SET lifecycle_status=c.status_calc,
      lifecycle_next_action=COALESCE(c.override_next_action,
        CASE c.status_calc
          WHEN 'onboarding' THEN 'Concluir ativação e orientar os primeiros passos.'
          WHEN 'awaiting_consultation' THEN 'Aguardar a consulta e revisar preparo/pré-consulta.'
          WHEN 'return_overdue' THEN 'Revisar necessidade de retorno e definir contato.'
          WHEN 'plan_expiring' THEN 'Revisar continuidade e renovação antes do vencimento.'
          WHEN 'plan_expired' THEN 'Definir renovação, encerramento ou reativação.'
          WHEN 'protocol_completed' THEN 'Revisar resultado, conclusão e próximo protocolo/fase.'
          WHEN 'reactivation' THEN 'Avaliar motivo clínico para reativação e próximo passo.'
          WHEN 'care_completed' THEN 'Acompanhamento encerrado; manter histórico e critérios de reentrada.'
          ELSE 'Manter acompanhamento conforme o método atual.'
        END),
      lifecycle_details=jsonb_build_object(
        'source',CASE WHEN c.override_status IS NOT NULL THEN 'manual_override' ELSE 'engine' END,
        'override_note',c.override_note,
        'plan_expires_at',c.plan_expires_at,
        'protocol_status',c.protocol_status,
        'protocol_end_date',c.protocol_end_date,
        'next_appointment_at',c.next_appointment_at,
        'last_appointment_at',c.last_appointment_at
      )
  FROM calc c WHERE rs.id=c.id;

  GET DIAGNOSTICS v_rows=ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.default_followup_engine_rules() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_followup_engine_rules(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refresh_patient_lifecycle_states(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.default_followup_engine_rules() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_followup_engine_rules(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_patient_lifecycle_states(uuid,date) TO service_role;
