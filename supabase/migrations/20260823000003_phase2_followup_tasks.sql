-- Fase 2 — Motor de Acompanhamento
-- Bloco 3: transforma o snapshot operacional em tarefas deduplicadas e histórico auditável.
-- Importante: esta migration NÃO envia mensagens nem executa contatos.

CREATE TABLE IF NOT EXISTS public.patient_followup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_id uuid REFERENCES public.agent_pending_actions(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  source text NOT NULL DEFAULT 'followup_engine',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_followup_events_tenant_created
  ON public.patient_followup_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_followup_events_patient_created
  ON public.patient_followup_events (patient_id, created_at DESC);

ALTER TABLE public.patient_followup_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff reads followup events" ON public.patient_followup_events;
CREATE POLICY "Staff reads followup events"
ON public.patient_followup_events
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('admin', 'nutritionist', 'nutri')
  )
);

DROP POLICY IF EXISTS "Staff manages phase2 followup actions" ON public.agent_pending_actions;
CREATE POLICY "Staff manages phase2 followup actions"
ON public.agent_pending_actions
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('admin', 'nutritionist', 'nutri')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(COALESCE(p.role, '')) IN ('admin', 'nutritionist', 'nutri')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_phase2_open_followup_action
  ON public.agent_pending_actions (tenant_id, target_user_id, action_type)
  WHERE agent_name = 'followup_engine' AND status = 'pending';

CREATE OR REPLACE FUNCTION public.log_phase2_followup_action_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.agent_name, OLD.agent_name) <> 'followup_engine' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_followup_events (
      tenant_id, action_id, patient_id, event_type, from_status, to_status, metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.target_user_id,
      'task_created',
      NULL,
      NEW.status,
      jsonb_build_object(
        'action_type', NEW.action_type,
        'title', NEW.title,
        'scheduled_for', NEW.scheduled_for,
        'context_data', COALESCE(NEW.context_data, '{}'::jsonb)
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for
    OR OLD.context_data IS DISTINCT FROM NEW.context_data
  ) THEN
    INSERT INTO public.patient_followup_events (
      tenant_id, action_id, patient_id, event_type, from_status, to_status, actor_user_id, metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.target_user_id,
      CASE
        WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'task_status_changed'
        ELSE 'task_refreshed'
      END,
      OLD.status,
      NEW.status,
      NEW.reviewed_by,
      jsonb_build_object(
        'action_type', NEW.action_type,
        'scheduled_for', NEW.scheduled_for,
        'context_data', COALESCE(NEW.context_data, '{}'::jsonb)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase2_followup_action_change ON public.agent_pending_actions;
CREATE TRIGGER trg_phase2_followup_action_change
AFTER INSERT OR UPDATE ON public.agent_pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.log_phase2_followup_action_change();

CREATE OR REPLACE FUNCTION public.sync_patient_followup_tasks(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer := 0;
  v_updated integer := 0;
  v_closed integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  -- Encerra tarefas abertas que já não correspondem ao snapshot atual.
  WITH desired AS (
    SELECT
      prs.user_id,
      CASE
        WHEN prs.attention_bucket = 'automatic' THEN 'gentle_reengagement_candidate'
        ELSE 'human_followup'
      END AS action_type
    FROM public.patient_risk_scores prs
    WHERE prs.tenant_id = p_tenant_id
      AND prs.calculated_date = p_reference_date
      AND prs.attention_bucket IN ('critical', 'today', 'this_week', 'automatic')
  ), stale AS (
    UPDATE public.agent_pending_actions apa
       SET status = 'cancelled',
           updated_at = now(),
           execution_result = COALESCE(apa.execution_result, '{}'::jsonb)
             || jsonb_build_object('closed_by', 'followup_engine', 'closed_reason', 'signal_no_longer_current', 'reference_date', p_reference_date)
     WHERE apa.tenant_id = p_tenant_id
       AND apa.agent_name = 'followup_engine'
       AND apa.status = 'pending'
       AND NOT EXISTS (
         SELECT 1
         FROM desired d
         WHERE d.user_id = apa.target_user_id
           AND d.action_type = apa.action_type
       )
    RETURNING apa.id
  )
  SELECT count(*) INTO v_closed FROM stale;

  -- Atualiza tarefas abertas existentes com a prioridade e os sinais atuais.
  WITH current_rows AS (
    SELECT
      prs.*,
      COALESCE(p.name, 'Paciente') AS patient_name,
      CASE
        WHEN prs.attention_bucket = 'automatic' THEN 'gentle_reengagement_candidate'
        ELSE 'human_followup'
      END AS desired_action_type,
      CASE prs.attention_bucket
        WHEN 'critical' THEN 'Intervenção humana prioritária'
        WHEN 'today' THEN 'Acompanhamento prioritário hoje'
        WHEN 'this_week' THEN 'Acompanhamento nesta semana'
        WHEN 'automatic' THEN 'Candidata a retomada leve'
      END AS task_title,
      CASE prs.attention_bucket
        WHEN 'critical' THEN (p_reference_date::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'today' THEN (p_reference_date::timestamp + time '12:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'this_week' THEN ((p_reference_date + 2)::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'automatic' THEN (p_reference_date::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo'
      END AS due_at
    FROM public.patient_risk_scores prs
    LEFT JOIN public.profiles p
      ON p.user_id = prs.user_id
     AND p.tenant_id = prs.tenant_id
    WHERE prs.tenant_id = p_tenant_id
      AND prs.calculated_date = p_reference_date
      AND prs.attention_bucket IN ('critical', 'today', 'this_week', 'automatic')
  ), changed AS (
    UPDATE public.agent_pending_actions apa
       SET target_patient_name = c.patient_name,
           title = c.task_title,
           content = COALESCE(c.recommended_action, 'Revisar o contexto da paciente.'),
           content_preview = COALESCE(c.recommended_action, 'Revisar o contexto da paciente.'),
           reasoning = CASE
             WHEN c.attention_bucket = 'critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.'
             WHEN c.attention_bucket = 'today' THEN 'Sinal que merece prioridade hoje.'
             WHEN c.attention_bucket = 'this_week' THEN 'Sinal que merece revisão nesta semana.'
             ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.'
           END,
           context_data = jsonb_build_object(
             'source', 'patient_risk_scores',
             'snapshot_date', p_reference_date,
             'risk_score_id', c.id,
             'attention_bucket', c.attention_bucket,
             'operational_status', c.operational_status,
             'overall_risk', c.overall_risk,
             'days_since_activity', c.days_since_activity,
             'adherence_7d', c.adherence_7d,
             'reasons', COALESCE(c.reasons, '[]'::jsonb)
           ),
           scheduled_for = c.due_at,
           updated_at = now()
      FROM current_rows c
     WHERE apa.tenant_id = p_tenant_id
       AND apa.agent_name = 'followup_engine'
       AND apa.status = 'pending'
       AND apa.target_user_id = c.user_id
       AND apa.action_type = c.desired_action_type
    RETURNING apa.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  -- Cria apenas as tarefas que ainda não existem abertas.
  WITH current_rows AS (
    SELECT
      prs.*,
      COALESCE(p.name, 'Paciente') AS patient_name,
      CASE
        WHEN prs.attention_bucket = 'automatic' THEN 'gentle_reengagement_candidate'
        ELSE 'human_followup'
      END AS desired_action_type,
      CASE prs.attention_bucket
        WHEN 'critical' THEN 'Intervenção humana prioritária'
        WHEN 'today' THEN 'Acompanhamento prioritário hoje'
        WHEN 'this_week' THEN 'Acompanhamento nesta semana'
        WHEN 'automatic' THEN 'Candidata a retomada leve'
      END AS task_title,
      CASE prs.attention_bucket
        WHEN 'critical' THEN (p_reference_date::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'today' THEN (p_reference_date::timestamp + time '12:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'this_week' THEN ((p_reference_date + 2)::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
        WHEN 'automatic' THEN (p_reference_date::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo'
      END AS due_at
    FROM public.patient_risk_scores prs
    LEFT JOIN public.profiles p
      ON p.user_id = prs.user_id
     AND p.tenant_id = prs.tenant_id
    WHERE prs.tenant_id = p_tenant_id
      AND prs.calculated_date = p_reference_date
      AND prs.attention_bucket IN ('critical', 'today', 'this_week', 'automatic')
  ), inserted AS (
    INSERT INTO public.agent_pending_actions (
      tenant_id,
      agent_name,
      action_type,
      target_type,
      target_user_id,
      target_patient_name,
      title,
      content,
      content_preview,
      reasoning,
      context_data,
      scheduled_for,
      status,
      expires_at
    )
    SELECT
      c.tenant_id,
      'followup_engine',
      c.desired_action_type,
      'patient',
      c.user_id,
      c.patient_name,
      c.task_title,
      COALESCE(c.recommended_action, 'Revisar o contexto da paciente.'),
      COALESCE(c.recommended_action, 'Revisar o contexto da paciente.'),
      CASE
        WHEN c.attention_bucket = 'critical' THEN 'Sinal crítico identificado pelo motor de acompanhamento.'
        WHEN c.attention_bucket = 'today' THEN 'Sinal que merece prioridade hoje.'
        WHEN c.attention_bucket = 'this_week' THEN 'Sinal que merece revisão nesta semana.'
        ELSE 'Paciente elegível para retomada leve; nenhum contato automático é executado neste estágio.'
      END,
      jsonb_build_object(
        'source', 'patient_risk_scores',
        'snapshot_date', p_reference_date,
        'risk_score_id', c.id,
        'attention_bucket', c.attention_bucket,
        'operational_status', c.operational_status,
        'overall_risk', c.overall_risk,
        'days_since_activity', c.days_since_activity,
        'adherence_7d', c.adherence_7d,
        'reasons', COALESCE(c.reasons, '[]'::jsonb)
      ),
      c.due_at,
      'pending',
      CASE
        WHEN c.attention_bucket IN ('critical', 'today') THEN c.due_at + interval '24 hours'
        ELSE c.due_at + interval '72 hours'
      END
    FROM current_rows c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agent_pending_actions apa
      WHERE apa.tenant_id = c.tenant_id
        AND apa.target_user_id = c.user_id
        AND apa.agent_name = 'followup_engine'
        AND apa.action_type = c.desired_action_type
        AND apa.status = 'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_created FROM inserted;

  RETURN jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'closed', v_closed,
    'reference_date', p_reference_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_patient_followup_tasks(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_patient_followup_tasks(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.sync_patient_followup_tasks(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_patient_followup_tasks(uuid, date) TO service_role;
