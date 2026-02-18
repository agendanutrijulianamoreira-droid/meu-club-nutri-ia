-- ============================================
-- MEU CLUB NUTRI.AI - COMMUNICATION CENTER
-- Phase P1: Push + Inbox
-- ============================================

-- 1. DEVICE TOKENS
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    token TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- 2. CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cta_label TEXT,
    cta_url TEXT,
    channels JSONB NOT NULL DEFAULT '{"push": true, "inbox": true}',
    segment JSONB NOT NULL DEFAULT '{"type": "all"}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CAMPAIGN RECIPIENTS (Idempotency: UNIQUE(campaign_id, user_id))
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

-- 4. NOTIFICATIONS (Inbox) (Idempotency: UNIQUE(user_id, campaign_id))
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cta_label TEXT,
    cta_url TEXT,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, campaign_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Device Tokens: Patients manage their own
DROP POLICY IF EXISTS "Users manage own tokens" ON device_tokens;
CREATE POLICY "Users manage own tokens" ON device_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Campaigns: Nutri/Admin manage their tenant's
DROP POLICY IF EXISTS "Admins manage tenant campaigns" ON campaigns;
CREATE POLICY "Admins manage tenant campaigns" ON campaigns
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Recipients: Nutri/Admin see their tenant's
DROP POLICY IF EXISTS "Admins view tenant recipients" ON campaign_recipients;
CREATE POLICY "Admins view tenant recipients" ON campaign_recipients
    FOR SELECT TO authenticated
    USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE tenant_id IN (
                SELECT id FROM tenants WHERE owner_id = auth.uid()
            )
        )
    );

-- Notifications: Patients see own; Admins see tenant's
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view tenant notifications" ON notifications;
CREATE POLICY "Admins view tenant notifications" ON notifications
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Restricted UPDATE for Patients (Only status and read_at)
DROP POLICY IF EXISTS "Users mark own notifications as read" ON notifications;
CREATE POLICY "Users mark own notifications as read" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid() AND 
        id = (SELECT id FROM notifications n WHERE n.id = notifications.id) AND
        tenant_id = (SELECT tenant_id FROM notifications n WHERE n.id = notifications.id) AND
        campaign_id IS NOT DISTINCT FROM (SELECT campaign_id FROM notifications n WHERE n.id = notifications.id) AND
        title = (SELECT title FROM notifications n WHERE n.id = notifications.id) AND
        body = (SELECT body FROM notifications n WHERE n.id = notifications.id)
    );

-- ============================================
-- HELPERS FOR SEGMENTATION
-- ============================================

CREATE OR REPLACE FUNCTION get_inactive_users(p_tenant_id UUID, p_days INTEGER)
RETURNS TABLE (user_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT p.user_id 
    FROM profiles p
    WHERE p.tenant_id = p_tenant_id
    AND p.role = 'patient'  -- Role filter guaranteed
    AND NOT EXISTS (
        SELECT 1 
        FROM daily_logs dl 
        WHERE dl.user_id = p.user_id 
        AND dl.log_date >= CURRENT_DATE - p_days
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
