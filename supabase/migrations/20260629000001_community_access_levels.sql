-- ============================================
-- Fase 4: Controle de Acesso por Nível na Comunidade
-- ============================================

-- 1. Tabela de níveis de acesso
CREATE TABLE IF NOT EXISTS niveis_acesso (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,      -- 'basico', 'plus', 'vip', 'consulta'
    descricao TEXT,
    ordem INTEGER NOT NULL   -- hierarquia: maior = mais acesso
);

INSERT INTO niveis_acesso (nome, descricao, ordem) VALUES
    ('basico',   'Clube básico — acesso ao feed geral', 1),
    ('plus',     'Clube Plus — materiais exclusivos', 2),
    ('vip',      'Clube VIP — lives e Q&A', 3),
    ('consulta', 'Paciente em consulta — acesso total', 4)
ON CONFLICT DO NOTHING;

-- 2. Tabela de nível por paciente (por tenant)
CREATE TABLE IF NOT EXISTS nivel_paciente (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nivel_id    INTEGER NOT NULL REFERENCES niveis_acesso(id),
    valido_ate  DATE,                                   -- NULL = sem expiração
    concedido_por UUID REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (paciente_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_nivel_paciente_tenant ON nivel_paciente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nivel_paciente_user   ON nivel_paciente(paciente_id);

ALTER TABLE nivel_paciente ENABLE ROW LEVEL SECURITY;

-- Paciente vê seu próprio nível
CREATE POLICY "paciente_ve_proprio_nivel" ON nivel_paciente
    FOR SELECT TO authenticated
    USING (paciente_id = auth.uid());

-- Admin do tenant gerencia níveis dos seus pacientes
CREATE POLICY "admin_gerencia_niveis" ON nivel_paciente
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "service_role_niveis" ON nivel_paciente
    FOR ALL TO service_role USING (true);

-- 3. Adicionar colunas de controle em community_posts (se não existirem)
ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS nivel_minimo INTEGER DEFAULT 1 REFERENCES niveis_acesso(id),
    ADD COLUMN IF NOT EXISTS oculto BOOLEAN DEFAULT false;

-- 4. Atualizar política de SELECT da paciente para filtrar por nível
-- (drop e recria para incluir a lógica de nível)
DROP POLICY IF EXISTS "patients_read_tenant_posts" ON community_posts;

CREATE POLICY "patients_read_tenant_posts" ON community_posts
    FOR SELECT TO authenticated
    USING (
        oculto = false
        AND tenant_id IN (
            SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
        )
        AND (
            -- post sem restrição de nível OU paciente com nível suficiente OU post é da própria paciente
            nivel_minimo IS NULL
            OR nivel_minimo <= 1
            OR user_id = auth.uid()
            OR nivel_minimo <= (
                SELECT COALESCE(MAX(na.ordem), 1)
                FROM nivel_paciente np
                JOIN niveis_acesso na ON np.nivel_id = na.id
                WHERE np.paciente_id = auth.uid()
                  AND np.tenant_id = community_posts.tenant_id
                  AND (np.valido_ate IS NULL OR np.valido_ate >= CURRENT_DATE)
            )
        )
    );

-- 5. Política para admin ocultar posts
DROP POLICY IF EXISTS "admin_update_posts" ON community_posts;

CREATE POLICY "admin_update_posts" ON community_posts
    FOR UPDATE TO authenticated
    USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );
