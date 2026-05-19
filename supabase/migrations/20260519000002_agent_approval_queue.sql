-- Agent actions are proposed here and must be approved before execution
CREATE TABLE IF NOT EXISTS agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Which agent proposed this
  agent_name TEXT NOT NULL, -- 'daily-engagement' | 'retention' | 'onboarding' | 'protocol' | 'community' | 'sabotage' | 'meals' | 'moderation'

  -- What the action is
  action_type TEXT NOT NULL, -- 'send_message' | 'create_post' | 'send_push' | 'flag_patient' | 'complete_protocol'

  -- Who is the target (patient, all patients, etc.)
  target_type TEXT NOT NULL DEFAULT 'patient', -- 'patient' | 'all_patients' | 'segment' | 'community'
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_patient_name TEXT, -- denormalized for easy display

  -- The proposed content
  title TEXT, -- short summary for the approval card
  content TEXT NOT NULL, -- full message/post/action content
  content_preview TEXT, -- truncated for list view (first 120 chars)

  -- Context / reason for the action
  reasoning TEXT, -- why the agent is proposing this
  context_data JSONB, -- extra data (risk score, streak, etc.)

  -- Scheduling
  scheduled_for TIMESTAMPTZ, -- when it should be sent once approved

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'

  -- Owner decision
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Execution tracking
  executed_at TIMESTAMPTZ,
  execution_result JSONB,

  -- Auto-expiry: pending actions older than 48h expire
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours'),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner manages pending actions"
  ON agent_pending_actions FOR ALL
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_pending_actions_tenant_status ON agent_pending_actions(tenant_id, status);
CREATE INDEX idx_pending_actions_target ON agent_pending_actions(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_pending_actions_expires ON agent_pending_actions(expires_at) WHERE status = 'pending';

CREATE TRIGGER update_agent_pending_actions_updated_at
  BEFORE UPDATE ON agent_pending_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-expire function (called by cron or on read)
CREATE OR REPLACE FUNCTION expire_pending_actions()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE agent_pending_actions
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
$$;
