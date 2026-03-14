-- ============================================
-- Loja de Recompensas
-- reward_items + reward_redemptions
-- ============================================

CREATE TABLE IF NOT EXISTS reward_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost INTEGER NOT NULL CHECK (cost > 0),   -- em NutriCoins
    type TEXT NOT NULL DEFAULT 'digital'
        CHECK (type IN ('digital', 'fisico', 'cupom', 'experiencia')),
    emoji TEXT DEFAULT '🎁',
    stock INTEGER,          -- NULL = ilimitado
    active BOOLEAN DEFAULT true,
    delivery_info TEXT,     -- instruções de entrega/resgate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES reward_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,   -- snapshot do nome na hora do resgate
    item_cost INTEGER NOT NULL, -- snapshot do custo
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    notes TEXT,                -- nota da nutricionista
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reward_items_tenant ON reward_items(tenant_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_redemptions_tenant ON reward_redemptions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON reward_redemptions(user_id, created_at DESC);

-- RLS
ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Pacientes veem itens ativos do seu tenant
CREATE POLICY "patients_read_active_items" ON reward_items
    FOR SELECT TO authenticated
    USING (
        active = true AND
        tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    );

-- Admin CRUD nos próprios itens
CREATE POLICY "admin_manage_items" ON reward_items
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Pacientes veem próprios resgates
CREATE POLICY "patients_read_own_redemptions" ON reward_redemptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Pacientes criam resgates
CREATE POLICY "patients_create_redemptions" ON reward_redemptions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    );

-- Admin vê e gerencia todos os resgates do tenant
CREATE POLICY "admin_manage_redemptions" ON reward_redemptions
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Service role acesso total
CREATE POLICY "service_role_reward_items" ON reward_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_redemptions" ON reward_redemptions FOR ALL TO service_role USING (true);

-- Seed: inserir exemplos para novos tenants (função auxiliar)
CREATE OR REPLACE FUNCTION seed_reward_items(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO reward_items (tenant_id, name, description, cost, type, emoji, delivery_info) VALUES
    (p_tenant_id, 'E-book Receitas Fit', '30 receitas saudáveis e gostosas criadas pela nutricionista', 500, 'digital', '📘', 'Link enviado por e-mail em até 24h'),
    (p_tenant_id, 'Desconto 15% na Renovação', 'Cupom de desconto para sua próxima mensalidade', 1200, 'cupom', '🏷️', 'Código enviado por mensagem'),
    (p_tenant_id, 'Mentoria Express 30min', 'Sessão individual online com a nutricionista', 4000, 'experiencia', '👑', 'Agendamento por WhatsApp após confirmação'),
    (p_tenant_id, 'Kit Caneca + Squeeze', 'Kit personalizado do método enviado em casa', 3500, 'fisico', '☕', 'Entrega em 5-10 dias úteis. Endereço solicitado no pedido')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
