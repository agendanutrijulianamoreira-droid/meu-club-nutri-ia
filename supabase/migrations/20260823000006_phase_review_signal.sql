-- Fase 2 — conecta os critérios editáveis de avanço ao motor operacional.
-- A elegibilidade gera sinal/tarefa de revisão, mas nunca altera a fase automaticamente.

ALTER TABLE public.patient_risk_scores
  ADD COLUMN IF NOT EXISTS current_method_phase_id uuid,
  ADD COLUMN IF NOT EXISTS phase_review_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_review_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.patient_risk_scores.phase_review_eligible IS
'Indica que os critérios configurados no Admin para a fase atual foram atendidos. Não autoriza avanço automático.';

COMMENT ON COLUMN public.patient_risk_scores.phase_review_details IS
'Detalhamento explicável da avaliação dos critérios de avanço configurados no Admin.';

CREATE OR REPLACE FUNCTION public.refresh_phase_advancement_eligibility(
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
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023';
  END IF;

  WITH current_phase AS (
    SELECT DISTINCT ON (fp.paciente_id)
      fp.paciente_id AS user_id,
      fp.method_phase_id,
      fp.inicio,
      mp.method_id,
      mp.name AS phase_name,
      mp.sort_order,
      mp.advancement_criteria,
      next_mp.id AS next_phase_id,
      next_mp.name AS next_phase_name
    FROM public.fase_paciente fp
    JOIN public.method_phases mp ON mp.id = fp.method_phase_id
    LEFT JOIN LATERAL (
      SELECT nmp.id, nmp.name
      FROM public.method_phases nmp
      WHERE nmp.method_id = mp.method_id
        AND nmp.tenant_id = mp.tenant_id
        AND nmp.sort_order > mp.sort_order
      ORDER BY nmp.sort_order ASC
      LIMIT 1
    ) next_mp ON true
    JOIN public.profiles p ON p.user_id = fp.paciente_id AND p.tenant_id = p_tenant_id
    WHERE fp.fim IS NULL
      AND mp.tenant_id = p_tenant_id
      AND p.role = 'patient'
    ORDER BY fp.paciente_id, fp.inicio DESC, fp.created_at DESC
  ),
  protocol_state AS (
    SELECT cp.user_id,
      EXISTS (
        SELECT 1
        FROM public.protocol_assignments pa
        WHERE pa.user_id = cp.user_id
          AND (
            lower(COALESCE(pa.status,'')) IN ('completed','concluido','concluído','finished')
            OR COALESCE(pa.progress_percentage,0) >= 100
          )
      ) AS protocol_completed
    FROM current_phase cp
  ),
  evaluation AS (
    SELECT
      prs.id AS risk_score_id,
      prs.user_id,
      cp.method_phase_id,
      cp.phase_name,
      cp.next_phase_id,
      cp.next_phase_name,
      cp.inicio,
      cp.advancement_criteria,
      prs.adherence_7d,
      prs.checkin_overdue,
      COALESCE(ps.protocol_completed,false) AS protocol_completed,
      GREATEST(0, p_reference_date - cp.inicio) AS days_in_phase,
      COALESCE((cp.advancement_criteria->>'enabled')::boolean,false) AS criteria_enabled,
      COALESCE(NULLIF(cp.advancement_criteria->>'mode',''),'all') AS criteria_mode,
      (cp.advancement_criteria->>'min_days_in_phase')::integer AS min_days,
      (cp.advancement_criteria->>'min_adherence_7d')::numeric AS min_adherence,
      COALESCE((cp.advancement_criteria->>'require_weekly_checkin')::boolean,false) AS require_weekly,
      COALESCE((cp.advancement_criteria->>'require_protocol_completion')::boolean,false) AS require_protocol,
      COALESCE((cp.advancement_criteria->>'require_manual_approval')::boolean,true) AS require_manual_approval,
      COALESCE(cp.advancement_criteria->>'custom_note','') AS custom_note
    FROM public.patient_risk_scores prs
    JOIN current_phase cp ON cp.user_id = prs.user_id
    LEFT JOIN protocol_state ps ON ps.user_id = prs.user_id
    WHERE prs.tenant_id = p_tenant_id
      AND prs.calculated_date = p_reference_date
  ),
  counted AS (
    SELECT e.*,
      ((e.min_days IS NOT NULL)::int
       + (e.min_adherence IS NOT NULL)::int
       + e.require_weekly::int
       + e.require_protocol::int) AS configured_count,
      ((CASE WHEN e.min_days IS NOT NULL AND e.days_in_phase >= e.min_days THEN 1 ELSE 0 END)
       + (CASE WHEN e.min_adherence IS NOT NULL AND COALESCE(e.adherence_7d,0) >= e.min_adherence THEN 1 ELSE 0 END)
       + (CASE WHEN e.require_weekly AND NOT COALESCE(e.checkin_overdue,true) THEN 1 ELSE 0 END)
       + (CASE WHEN e.require_protocol AND e.protocol_completed THEN 1 ELSE 0 END)) AS passed_count
    FROM evaluation e
  ),
  final_eval AS (
    SELECT c.*,
      (
        c.criteria_enabled
        AND c.next_phase_id IS NOT NULL
        AND c.configured_count > 0
        AND CASE
          WHEN c.criteria_mode = 'any' THEN c.passed_count >= 1
          ELSE c.passed_count = c.configured_count
        END
      ) AS eligible
    FROM counted c
  )
  UPDATE public.patient_risk_scores prs
  SET
    current_method_phase_id = f.method_phase_id,
    phase_review_eligible = f.eligible,
    phase_review_details = jsonb_build_object(
      'phase_name', f.phase_name,
      'next_phase_id', f.next_phase_id,
      'next_phase_name', f.next_phase_name,
      'criteria_enabled', f.criteria_enabled,
      'mode', f.criteria_mode,
      'configured_count', f.configured_count,
      'passed_count', f.passed_count,
      'require_manual_approval', f.require_manual_approval,
      'custom_note', f.custom_note,
      'checks', jsonb_build_object(
        'days_in_phase', jsonb_build_object(
          'configured', f.min_days IS NOT NULL,
          'current', f.days_in_phase,
          'required', f.min_days,
          'passed', CASE WHEN f.min_days IS NULL THEN NULL ELSE f.days_in_phase >= f.min_days END
        ),
        'adherence_7d', jsonb_build_object(
          'configured', f.min_adherence IS NOT NULL,
          'current', f.adherence_7d,
          'required', f.min_adherence,
          'passed', CASE WHEN f.min_adherence IS NULL THEN NULL ELSE COALESCE(f.adherence_7d,0) >= f.min_adherence END
        ),
        'weekly_checkin', jsonb_build_object(
          'configured', f.require_weekly,
          'passed', CASE WHEN NOT f.require_weekly THEN NULL ELSE NOT COALESCE(f.checkin_overdue,true) END
        ),
        'protocol_completion', jsonb_build_object(
          'configured', f.require_protocol,
          'passed', CASE WHEN NOT f.require_protocol THEN NULL ELSE f.protocol_completed END
        )
      )
    ),
    signals = COALESCE(prs.signals,'{}'::jsonb) || jsonb_build_object(
      'phase_review_eligible', f.eligible,
      'current_method_phase_id', f.method_phase_id,
      'next_phase_id', f.next_phase_id
    ),
    reasons = COALESCE(prs.reasons,'[]'::jsonb)
      || CASE WHEN f.eligible THEN jsonb_build_array(jsonb_build_object(
        'code','phase_review_eligible',
        'phase_name',f.phase_name,
        'next_phase_name',f.next_phase_name,
        'manual_approval_required',f.require_manual_approval
      )) ELSE '[]'::jsonb END
  FROM final_eval f
  WHERE prs.id = f.risk_score_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_phase_advancement_eligibility(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_phase_advancement_eligibility(uuid,date) TO service_role;

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
  v_evaluated integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_closed integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE='22023';
  END IF;

  v_evaluated := public.refresh_phase_advancement_eligibility(p_tenant_id,p_reference_date);

  WITH stale AS (
    UPDATE public.agent_pending_actions apa
    SET status='cancelled',
        updated_at=now(),
        execution_result=COALESCE(apa.execution_result,'{}'::jsonb) || jsonb_build_object(
          'closed_by','followup_engine',
          'closed_reason','phase_no_longer_eligible',
          'reference_date',p_reference_date
        )
    WHERE apa.tenant_id=p_tenant_id
      AND apa.agent_name='followup_engine'
      AND apa.action_type='phase_advancement_review'
      AND apa.status='pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_risk_scores prs
        WHERE prs.tenant_id=p_tenant_id
          AND prs.user_id=apa.target_user_id
          AND prs.calculated_date=p_reference_date
          AND prs.phase_review_eligible=true
      )
    RETURNING id
  ) SELECT count(*) INTO v_closed FROM stale;

  WITH eligible AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name
    FROM public.patient_risk_scores prs
    LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id
      AND prs.calculated_date=p_reference_date
      AND prs.phase_review_eligible=true
  ), changed AS (
    UPDATE public.agent_pending_actions apa
    SET target_patient_name=e.patient_name,
        title='Revisar avanço de fase',
        content='Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.',
        content_preview='Paciente elegível para revisão de fase.',
        reasoning='Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',
        context_data=jsonb_build_object(
          'source','phase_advancement_criteria',
          'snapshot_date',p_reference_date,
          'risk_score_id',e.id,
          'current_method_phase_id',e.current_method_phase_id,
          'phase_review_details',e.phase_review_details
        ),
        scheduled_for=((p_reference_date::timestamp + time '15:00') AT TIME ZONE 'America/Sao_Paulo'),
        updated_at=now()
    FROM eligible e
    WHERE apa.tenant_id=p_tenant_id
      AND apa.agent_name='followup_engine'
      AND apa.action_type='phase_advancement_review'
      AND apa.status='pending'
      AND apa.target_user_id=e.user_id
    RETURNING apa.id
  ) SELECT count(*) INTO v_updated FROM changed;

  WITH eligible AS (
    SELECT prs.*,COALESCE(p.name,'Paciente') AS patient_name
    FROM public.patient_risk_scores prs
    LEFT JOIN public.profiles p ON p.user_id=prs.user_id AND p.tenant_id=prs.tenant_id
    WHERE prs.tenant_id=p_tenant_id
      AND prs.calculated_date=p_reference_date
      AND prs.phase_review_eligible=true
  ), inserted AS (
    INSERT INTO public.agent_pending_actions (
      tenant_id,agent_name,action_type,target_type,target_user_id,target_patient_name,
      title,content,content_preview,reasoning,context_data,scheduled_for,status,expires_at
    )
    SELECT e.tenant_id,'followup_engine','phase_advancement_review','patient',e.user_id,e.patient_name,
      'Revisar avanço de fase',
      'Os critérios configurados para a fase atual foram atendidos. Revisar clinicamente antes de decidir o avanço.',
      'Paciente elegível para revisão de fase.',
      'Elegibilidade calculada exclusivamente a partir dos critérios configurados no Admin.',
      jsonb_build_object(
        'source','phase_advancement_criteria',
        'snapshot_date',p_reference_date,
        'risk_score_id',e.id,
        'current_method_phase_id',e.current_method_phase_id,
        'phase_review_details',e.phase_review_details
      ),
      ((p_reference_date::timestamp + time '15:00') AT TIME ZONE 'America/Sao_Paulo'),
      'pending',
      (((p_reference_date+3)::timestamp + time '15:00') AT TIME ZONE 'America/Sao_Paulo')
    FROM eligible e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.agent_pending_actions apa
      WHERE apa.tenant_id=e.tenant_id
        AND apa.target_user_id=e.user_id
        AND apa.agent_name='followup_engine'
        AND apa.action_type='phase_advancement_review'
        AND apa.status='pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  ) SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object(
    'evaluated',v_evaluated,
    'created',v_created,
    'updated',v_updated,
    'closed',v_closed,
    'reference_date',p_reference_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_phase_review_tasks(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_phase_review_tasks(uuid,date) TO service_role;
