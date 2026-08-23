-- Ajustes de semântica do sinal de avanço:
-- 1) check-in semanal usa a resposta real mais recente;
-- 2) protocolo usa somente a atribuição mais recente;
-- 3) limpa estado anterior antes de recalcular;
-- 4) evita duplicar o mesmo motivo em refreshes sucessivos.

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

  UPDATE public.patient_risk_scores
  SET phase_review_eligible=false,
      current_method_phase_id=NULL,
      phase_review_details='{}'::jsonb,
      signals=COALESCE(signals,'{}'::jsonb) - 'phase_review_eligible' - 'current_method_phase_id' - 'next_phase_id',
      reasons=COALESCE((
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(COALESCE(reasons,'[]'::jsonb)) elem
        WHERE elem->>'code' <> 'phase_review_eligible'
      ),'[]'::jsonb)
  WHERE tenant_id=p_tenant_id AND calculated_date=p_reference_date;

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
    JOIN public.method_phases mp ON mp.id=fp.method_phase_id
    LEFT JOIN LATERAL (
      SELECT nmp.id,nmp.name
      FROM public.method_phases nmp
      WHERE nmp.method_id=mp.method_id
        AND nmp.tenant_id=mp.tenant_id
        AND nmp.sort_order>mp.sort_order
      ORDER BY nmp.sort_order ASC
      LIMIT 1
    ) next_mp ON true
    JOIN public.profiles p ON p.user_id=fp.paciente_id AND p.tenant_id=p_tenant_id
    WHERE fp.fim IS NULL
      AND mp.tenant_id=p_tenant_id
      AND p.role='patient'
    ORDER BY fp.paciente_id,fp.inicio DESC,fp.created_at DESC
  ),
  weekly_state AS (
    SELECT cp.user_id,
      max((wr.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS last_weekly_date
    FROM current_phase cp
    LEFT JOIN public.weekly_checkin_responses wr ON wr.user_id=cp.user_id
    GROUP BY cp.user_id
  ),
  latest_protocol AS (
    SELECT DISTINCT ON (cp.user_id)
      cp.user_id,
      pa.status,
      pa.progress_percentage,
      pa.created_at
    FROM current_phase cp
    LEFT JOIN public.protocol_assignments pa ON pa.user_id=cp.user_id
    ORDER BY cp.user_id,pa.created_at DESC NULLS LAST
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
      ws.last_weekly_date,
      (ws.last_weekly_date IS NOT NULL AND ws.last_weekly_date>=p_reference_date-7) AS weekly_recent,
      (
        lp.created_at IS NOT NULL AND (
          lower(COALESCE(lp.status,'')) IN ('completed','concluido','concluído','finished')
          OR COALESCE(lp.progress_percentage,0)>=100
        )
      ) AS protocol_completed,
      GREATEST(0,p_reference_date-cp.inicio) AS days_in_phase,
      COALESCE((cp.advancement_criteria->>'enabled')::boolean,false) AS criteria_enabled,
      COALESCE(NULLIF(cp.advancement_criteria->>'mode',''),'all') AS criteria_mode,
      (cp.advancement_criteria->>'min_days_in_phase')::integer AS min_days,
      (cp.advancement_criteria->>'min_adherence_7d')::numeric AS min_adherence,
      COALESCE((cp.advancement_criteria->>'require_weekly_checkin')::boolean,false) AS require_weekly,
      COALESCE((cp.advancement_criteria->>'require_protocol_completion')::boolean,false) AS require_protocol,
      COALESCE((cp.advancement_criteria->>'require_manual_approval')::boolean,true) AS require_manual_approval,
      COALESCE(cp.advancement_criteria->>'custom_note','') AS custom_note
    FROM public.patient_risk_scores prs
    JOIN current_phase cp ON cp.user_id=prs.user_id
    LEFT JOIN weekly_state ws ON ws.user_id=prs.user_id
    LEFT JOIN latest_protocol lp ON lp.user_id=prs.user_id
    WHERE prs.tenant_id=p_tenant_id AND prs.calculated_date=p_reference_date
  ),
  counted AS (
    SELECT e.*,
      ((e.min_days IS NOT NULL)::int
       +(e.min_adherence IS NOT NULL)::int
       +e.require_weekly::int
       +e.require_protocol::int) AS configured_count,
      ((CASE WHEN e.min_days IS NOT NULL AND e.days_in_phase>=e.min_days THEN 1 ELSE 0 END)
       +(CASE WHEN e.min_adherence IS NOT NULL AND COALESCE(e.adherence_7d,0)>=e.min_adherence THEN 1 ELSE 0 END)
       +(CASE WHEN e.require_weekly AND e.weekly_recent THEN 1 ELSE 0 END)
       +(CASE WHEN e.require_protocol AND e.protocol_completed THEN 1 ELSE 0 END)) AS passed_count
    FROM evaluation e
  ),
  final_eval AS (
    SELECT c.*,
      (c.criteria_enabled
       AND c.next_phase_id IS NOT NULL
       AND c.configured_count>0
       AND CASE WHEN c.criteria_mode='any' THEN c.passed_count>=1 ELSE c.passed_count=c.configured_count END
      ) AS eligible
    FROM counted c
  )
  UPDATE public.patient_risk_scores prs
  SET current_method_phase_id=f.method_phase_id,
      phase_review_eligible=f.eligible,
      phase_review_details=jsonb_build_object(
        'phase_name',f.phase_name,
        'next_phase_id',f.next_phase_id,
        'next_phase_name',f.next_phase_name,
        'criteria_enabled',f.criteria_enabled,
        'mode',f.criteria_mode,
        'configured_count',f.configured_count,
        'passed_count',f.passed_count,
        'require_manual_approval',f.require_manual_approval,
        'custom_note',f.custom_note,
        'checks',jsonb_build_object(
          'days_in_phase',jsonb_build_object('configured',f.min_days IS NOT NULL,'current',f.days_in_phase,'required',f.min_days,'passed',CASE WHEN f.min_days IS NULL THEN NULL ELSE f.days_in_phase>=f.min_days END),
          'adherence_7d',jsonb_build_object('configured',f.min_adherence IS NOT NULL,'current',f.adherence_7d,'required',f.min_adherence,'passed',CASE WHEN f.min_adherence IS NULL THEN NULL ELSE COALESCE(f.adherence_7d,0)>=f.min_adherence END),
          'weekly_checkin',jsonb_build_object('configured',f.require_weekly,'last_date',f.last_weekly_date,'passed',CASE WHEN NOT f.require_weekly THEN NULL ELSE f.weekly_recent END),
          'protocol_completion',jsonb_build_object('configured',f.require_protocol,'passed',CASE WHEN NOT f.require_protocol THEN NULL ELSE f.protocol_completed END)
        )
      ),
      signals=COALESCE(prs.signals,'{}'::jsonb)||jsonb_build_object('phase_review_eligible',f.eligible,'current_method_phase_id',f.method_phase_id,'next_phase_id',f.next_phase_id),
      reasons=COALESCE(prs.reasons,'[]'::jsonb)||CASE WHEN f.eligible THEN jsonb_build_array(jsonb_build_object('code','phase_review_eligible','phase_name',f.phase_name,'next_phase_name',f.next_phase_name,'manual_approval_required',f.require_manual_approval)) ELSE '[]'::jsonb END
  FROM final_eval f
  WHERE prs.id=f.risk_score_id;

  GET DIAGNOSTICS v_rows=ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_phase_advancement_eligibility(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_phase_advancement_eligibility(uuid,date) TO service_role;
