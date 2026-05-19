-- Migration: agent_learning
-- Adds indexes for performance + view for agent feedback analytics

-- Index for querying agent actions by status and tenant
CREATE INDEX IF NOT EXISTS idx_agent_pending_actions_tenant_status
  ON agent_pending_actions(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pending_actions_reviewed
  ON agent_pending_actions(tenant_id, status, reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL;

-- View for agent feedback summary (used by /api/admin/agent-feedback)
CREATE OR REPLACE VIEW agent_feedback_summary AS
SELECT
  tenant_id,
  agent_name,
  COUNT(*) FILTER (WHERE status = 'approved') AS approvals,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejections,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'approved')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')), 0) * 100, 1
  ) AS approval_rate_pct,
  MAX(reviewed_at) AS last_reviewed_at
FROM agent_pending_actions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY tenant_id, agent_name;

-- Enable RLS on agent_pending_actions if not already set
ALTER TABLE IF EXISTS agent_pending_actions ENABLE ROW LEVEL SECURITY;

-- Policy: tenants see only their own actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_pending_actions'
    AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON agent_pending_actions
      USING (tenant_id IN (
        SELECT id FROM tenants WHERE owner_id = auth.uid()
      ));
  END IF;
END$$;
