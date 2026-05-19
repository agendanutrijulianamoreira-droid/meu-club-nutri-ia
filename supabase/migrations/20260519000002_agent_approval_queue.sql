-- ============================================================
-- BLOCO 2 — FILA DE APROVAÇÃO DOS AGENTES
-- Nenhum agente age sem sua permissão explícita
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_approval_queue (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Origem
  agent_name      text NOT NULL,
  event_type      text NOT NULL,

  -- Ação proposta
  action_type     text NOT NULL CHECK (action_type IN (
    'send_message',
    'send_offer',
    'create_post',
    'create_challenge',
    'assign_protocol',
    'send_push',
    'flag_patient',
    'send_campaign'
  )),
  target_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_segment  text,
  payload         jsonb NOT NULL DEFAULT '{}',

  -- Preview legível para você revisar
  preview_title   text NOT NULL,
  preview_body    text NOT NULL,
  preview_context text,

  -- Decisão
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  admin_note      text,
  edited_payload  jsonb,

  -- Execução
  executed_at     timestamptz,
  execution_result jsonb,

  -- Expiração automática (ações obsoletas)
  expires_at      timestamptz DEFAULT (now() + interval '48 hours'),
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_tenant_status ON agent_approval_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_pending ON agent_approval_queue(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_queue_created ON agent_approval_queue(created_at DESC);

ALTER TABLE agent_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages own approval queue"
  ON agent_approval_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = agent_approval_queue.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- ============================================================
-- AGENT_FEEDBACK — Gerente aprende com suas decisões
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_feedback (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  approval_id     uuid REFERENCES agent_approval_queue(id) ON DELETE SET NULL,

  agent_name      text NOT NULL,
  action_type     text NOT NULL,
  decision        text NOT NULL CHECK (decision IN ('approved', 'rejected', 'edited')),
  original_payload jsonb,
  final_payload   jsonb,
  admin_note      text,

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_tenant ON agent_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent ON agent_feedback(tenant_id, agent_name);

ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view own feedback"
  ON agent_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = agent_feedback.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Função: Expirar itens antigos da fila
CREATE OR REPLACE FUNCTION expire_stale_approvals()
RETURNS void AS $$
BEGIN
  UPDATE agent_approval_queue
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
