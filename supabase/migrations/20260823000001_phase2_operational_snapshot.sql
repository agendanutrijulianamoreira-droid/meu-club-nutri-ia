-- Fase 2 — Motor de Acompanhamento
-- Bloco 1: transforma patient_risk_scores no snapshot operacional diário da paciente.
-- As regras são determinísticas, explicáveis e executadas apenas pelo backend com service_role.

ALTER TABLE public.patient_risk_scores
  ADD COLUMN IF NOT EXISTS operational_status text,
  ADD COLUMN IF NOT EXISTS attention_bucket text,
  ADD COLUMN IF NOT EXISTS last_activity_date date,
  ADD COLUMN IF NOT EXISTS eligible_activity_days integer,
  ADD COLUMN IF NOT EXISTS next_appointment_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_appointment_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_protocol_end_date date,
  ADD COLUMN IF NOT EXISTS checkin_overdue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consultation_overdue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_expiring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS protocol_ending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_patient_risk_attention
  ON public.patient_risk_scores (tenant_id, calculated_date DESC, attention_bucket, overall_risk DESC);

CREATE OR REPLACE FUNCTION public.refresh_patient_operational_snapshot(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  WITH patients AS (
    SELECT
      p.user_id,
      p.tenant_id,
      p.created_at::date AS created_date,
      COALESCE(p.onboarding_completed, false) AS onboarding_completed,
      p.plan_expires_at,
      COALESCE(p.current_streak, 0) AS current_streak
    FROM public.profiles p
    WHERE p.tenant_id = p_tenant_id
      AND p.role = 'patient'
  ),
  activity_dates AS (
    SELECT dl.user_id, dl.log_date AS activity_date
    FROM public.daily_logs dl
    JOIN patients p ON p.user_id = dl.user_id
    WHERE dl.log_date BETWEEN p_reference_date - 30 AND p_reference_date

    UNION

    SELECT cd.paciente_id AS user_id, cd.data AS activity_date
    FROM public.checkin_diario cd
    JOIN patients p ON p.user_id = cd.paciente_id
    WHERE cd.data BETWEEN p_reference_date - 30 AND p_reference_date

    UNION

    SELECT wr.user_id, (wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS activity_date
    FROM public.weekly_checkin_responses wr
    JOIN patients p ON p.user_id = wr.user_id
    WHERE (wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_reference_date - 30 AND p_reference_date

    UNION

    SELECT pa.user_id, pp.checkin_date AS activity_date
    FROM public.protocol_progress pp
    JOIN public.protocol_assignments pa ON pa.id = pp.assignment_id
    JOIN patients p ON p.user_id = pa.user_id
    WHERE pp.checkin_date BETWEEN p_reference_date - 30 AND p_reference_date
  ),
  activity AS (
    SELECT
      p.user_id,
      max(a.activity_date) AS last_activity_date,
      count(DISTINCT a.activity_date) FILTER (
        WHERE a.activity_date BETWEEN p_reference_date - 6 AND p_reference_date
      )::integer AS active_days_7d
    FROM patients p
    LEFT JOIN activity_dates a ON a.user_id = p.user_id
    GROUP BY p.user_id
  ),
  weekly AS (
    SELECT
      p.user_id,
      max((wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS last_weekly_checkin_date
    FROM patients p
    LEFT JOIN public.weekly_checkin_responses wr ON wr.user_id = p.user_id
    GROUP BY p.user_id
  ),
  appointments AS (
    SELECT
      p.user_id,
      min(a.scheduled_at) FILTER (
        WHERE a.scheduled_at >= (p_reference_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND a.status IN ('scheduled', 'confirmed')
      ) AS next_appointment_at,
      max(COALESCE(a.completed_at, a.scheduled_at)) FILTER (
        WHERE a.status = 'completed'
      ) AS last_appointment_at,
      bool_or(
        a.scheduled_at < (p_reference_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND a.status IN ('scheduled', 'confirmed')
      ) AS consultation_overdue
    FROM patients p
    LEFT JOIN public.appointments a
      ON a.patient_id = p.user_id
     AND a.tenant_id = p.tenant_id
    GROUP BY p.user_id
  ),
  protocols AS (
    SELECT
      p.user_id,
      min(pa.end_date) FILTER (
        WHERE pa.status = 'active' AND pa.end_date >= p_reference_date
      ) AS active_protocol_end_date
    FROM patients p
    LEFT JOIN public.protocol_assignments pa ON pa.user_id = p.user_id
    GROUP BY p.user_id
  ),
  base AS (
    SELECT
      p.*,
      a.last_activity_date,
      COALESCE(a.active_days_7d, 0) AS active_days_7d,
      GREATEST(1, LEAST(7, (p_reference_date - p.created_date) + 1))::integer AS eligible_days,
      COALESCE(p_reference_date - a.last_activity_date, p_reference_date - p.created_date) AS days_inactive,
      w.last_weekly_checkin_date,
      ap.next_appointment_at,
      ap.last_appointment_at,
      COALESCE(ap.consultation_overdue, false) AS consultation_overdue,
      pr.active_protocol_end_date
    FROM patients p
    LEFT JOIN activity a ON a.user_id = p.user_id
    LEFT JOIN weekly w ON w.user_id = p.user_id
    LEFT JOIN appointments ap ON ap.user_id = p.user_id
    LEFT JOIN protocols pr ON pr.user_id = p.user_id
  ),
  scored AS (
    SELECT
      b.*,
      round((100.0 * b.active_days_7d / NULLIF(b.eligible_days, 0)))::numeric, 1) AS adherence_7d_calc,
      CASE
        WHEN b.days_inactive <= 1 THEN 0
        WHEN b.days_inactive <= 3 THEN 20
        WHEN b.days_inactive <= 6 THEN 40
        WHEN b.days_inactive <= 9 THEN 60
        WHEN b.days_inactive <= 13 THEN 80
        ELSE 100
      END AS inactivity_risk_calc,
      GREATEST(0, LEAST(100,
        round(100 - (100.0 * b.active_days_7d / NULLIF(b.eligible_days, 0)))::integer
      )) AS adherence_risk_calc,
      (
        b.onboarding_completed
        AND (
          b.last_weekly_checkin_date IS NULL
          OR p_reference_date - b.last_weekly_checkin_date >= 8
        )
      ) AS checkin_overdue_calc,
      (
        b.plan_expires_at IS NOT NULL
        AND (b.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_reference_date AND p_reference_date + 15
      ) AS plan_expiring_calc,
      (
        b.active_protocol_end_date IS NOT NULL
        AND b.active_protocol_end_date BETWEEN p_reference_date AND p_reference_date + 7
      ) AS protocol_ending_calc
    FROM base b
  ),
  classified AS (
    SELECT
      s.*,
      round((s.inactivity_risk_calc * 0.60) + (s.adherence_risk_calc * 0.40))::integer AS overall_risk_calc,
      CASE
        WHEN NOT s.onboarding_completed THEN 'onboarding'
        WHEN s.days_inactive >= 14 THEN 'inactive'
        WHEN s.days_inactive >= 7 OR s.adherence_7d_calc < 40 THEN 'at_risk'
        WHEN s.days_inactive >= 4 OR s.adherence_7d_calc < 60 THEN 'oscillating'
        ELSE 'adherent'
      END AS operational_status_calc,
      CASE
        WHEN s.days_inactive >= 10 OR s.consultation_overdue THEN 'critical'
        WHEN s.days_inactive >= 7 OR s.plan_expiring_calc AND (s.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_reference_date + 7
          OR s.protocol_ending_calc AND s.active_protocol_end_date <= p_reference_date + 3 THEN 'today'
        WHEN s.days_inactive >= 4 OR s.checkin_overdue_calc OR s.plan_expiring_calc OR s.protocol_ending_calc THEN 'this_week'
        WHEN s.days_inactive BETWEEN 2 AND 3 THEN 'automatic'
        ELSE 'none'
      END AS attention_bucket_calc
    FROM scored s
  )
  INSERT INTO public.patient_risk_scores (
    tenant_id,
    user_id,
    overall_risk,
    inactivity_risk,
    adherence_risk,
    emotional_risk,
    engagement_risk,
    risk_level,
    signals,
    recommended_action,
    action_taken,
    days_since_activity,
    current_streak,
    adherence_7d,
    last_checkin_score,
    calculated_at,
    calculated_date,
    operational_status,
    attention_bucket,
    last_activity_date,
    eligible_activity_days,
    next_appointment_at,
    last_appointment_at,
    active_protocol_end_date,
    checkin_overdue,
    consultation_overdue,
    plan_expiring,
    protocol_ending,
    reasons
  )
  SELECT
    c.tenant_id,
    c.user_id,
    c.overall_risk_calc,
    c.inactivity_risk_calc,
    c.adherence_risk_calc,
    0,
    GREATEST(c.inactivity_risk_calc, c.adherence_risk_calc),
    CASE
      WHEN c.overall_risk_calc >= 75 THEN 'critical'
      WHEN c.overall_risk_calc >= 55 THEN 'high'
      WHEN c.overall_risk_calc >= 30 THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'days_since_activity', c.days_inactive,
      'adherence_7d', c.adherence_7d_calc,
      'checkin_overdue', c.checkin_overdue_calc,
      'consultation_overdue', c.consultation_overdue,
      'plan_expiring', c.plan_expiring_calc,
      'protocol_ending', c.protocol_ending_calc
    ),
    CASE c.attention_bucket_calc
      WHEN 'critical' THEN 'Revisar hoje e definir intervenção humana.'
      WHEN 'today' THEN 'Priorizar contato ou revisão hoje.'
      WHEN 'this_week' THEN 'Revisar nesta semana.'
      WHEN 'automatic' THEN 'Elegível para lembrete leve automático.'
      ELSE 'Sem intervenção necessária.'
    END,
    false,
    c.days_inactive,
    c.current_streak,
    c.adherence_7d_calc,
    NULL,
    now(),
    p_reference_date,
    c.operational_status_calc,
    c.attention_bucket_calc,
    c.last_activity_date,
    c.eligible_days,
    c.next_appointment_at,
    c.last_appointment_at,
    c.active_protocol_end_date,
    c.checkin_overdue_calc,
    c.consultation_overdue,
    c.plan_expiring_calc,
    c.protocol_ending_calc,
    jsonb_strip_nulls(jsonb_build_array(
      CASE WHEN c.days_inactive >= 4 THEN jsonb_build_object('code','inactivity','days',c.days_inactive) END,
      CASE WHEN c.checkin_overdue_calc THEN jsonb_build_object('code','checkin_overdue') END,
      CASE WHEN c.consultation_overdue THEN jsonb_build_object('code','consultation_overdue') END,
      CASE WHEN c.plan_expiring_calc THEN jsonb_build_object('code','plan_expiring','date',(c.plan_expires_at AT TIME ZONE 'America/Sao_Paulo')::date) END,
      CASE WHEN c.protocol_ending_calc THEN jsonb_build_object('code','protocol_ending','date',c.active_protocol_end_date) END
    ))
  FROM classified c
  ON CONFLICT (user_id, calculated_date)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    overall_risk = EXCLUDED.overall_risk,
    inactivity_risk = EXCLUDED.inactivity_risk,
    adherence_risk = EXCLUDED.adherence_risk,
    emotional_risk = EXCLUDED.emotional_risk,
    engagement_risk = EXCLUDED.engagement_risk,
    risk_level = EXCLUDED.risk_level,
    signals = EXCLUDED.signals,
    recommended_action = EXCLUDED.recommended_action,
    action_taken = false,
    days_since_activity = EXCLUDED.days_since_activity,
    current_streak = EXCLUDED.current_streak,
    adherence_7d = EXCLUDED.adherence_7d,
    calculated_at = EXCLUDED.calculated_at,
    operational_status = EXCLUDED.operational_status,
    attention_bucket = EXCLUDED.attention_bucket,
    last_activity_date = EXCLUDED.last_activity_date,
    eligible_activity_days = EXCLUDED.eligible_activity_days,
    next_appointment_at = EXCLUDED.next_appointment_at,
    last_appointment_at = EXCLUDED.last_appointment_at,
    active_protocol_end_date = EXCLUDED.active_protocol_end_date,
    checkin_overdue = EXCLUDED.checkin_overdue,
    consultation_overdue = EXCLUDED.consultation_overdue,
    plan_expiring = EXCLUDED.plan_expiring,
    protocol_ending = EXCLUDED.protocol_ending,
    reasons = EXCLUDED.reasons;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_patient_operational_snapshot(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_patient_operational_snapshot(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_patient_operational_snapshot(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_patient_operational_snapshot(uuid, date) TO service_role;
