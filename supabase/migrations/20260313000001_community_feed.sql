-- ============================================
-- Community Feed
-- community_posts + community_reactions
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL DEFAULT 'text'
        CHECK (type IN ('text', 'victory', 'streak', 'checkin', 'weight', 'system')),
    body TEXT NOT NULL,
    meta JSONB DEFAULT '{}',   -- streak_days, xp_earned, goal_achieved etc
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🔥',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)  -- 1 reação por paciente por post
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant ON community_posts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post ON community_reactions(post_id);

-- RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;

-- Pacientes veem posts do próprio tenant
CREATE POLICY "patients_read_tenant_posts" ON community_posts
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Pacientes criam próprios posts
CREATE POLICY "patients_insert_own_posts" ON community_posts
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Admins e sistema podem inserir qualquer post do tenant
CREATE POLICY "service_role_manage_posts" ON community_posts
    FOR ALL TO service_role USING (true);

-- Reactions: leitura pública no tenant
CREATE POLICY "patients_read_reactions" ON community_reactions
    FOR SELECT TO authenticated
    USING (
        post_id IN (
            SELECT id FROM community_posts WHERE tenant_id IN (
                SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
            )
        )
    );

-- Reactions: cada um reage 1x (upsert)
CREATE POLICY "patients_react" ON community_reactions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_manage_reactions" ON community_reactions
    FOR ALL TO service_role USING (true);
