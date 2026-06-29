-- Fase 4: Comunidade com Controle de Acesso
-- Estende community_posts, cria nivel_paciente e comentarios_comunidade

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS nivel_minimo INTEGER DEFAULT 1 CHECK (nivel_minimo BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN DEFAULT FALSE;

-- Nível atual de cada paciente no clube
CREATE TABLE IF NOT EXISTS nivel_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 4),
  validade DATE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE nivel_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nivel_paciente_select_proprio" ON nivel_paciente
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nivel_paciente_admin_all" ON nivel_paciente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'nutritionist')
        AND p.tenant_id = nivel_paciente.tenant_id
    )
  );

-- Comentários nas publicações da comunidade
CREATE TABLE IF NOT EXISTS comentarios_comunidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  corpo TEXT NOT NULL CHECK (char_length(corpo) BETWEEN 1 AND 500),
  oculto BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comentarios_comunidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios_select_paciente" ON comentarios_comunidade
  FOR SELECT USING (
    (NOT oculto)
    AND tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "comentarios_select_admin" ON comentarios_comunidade
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = comentarios_comunidade.tenant_id
        AND tenants.owner_id = auth.uid()
    )
  );

CREATE POLICY "comentarios_insert_paciente" ON comentarios_comunidade
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "comentarios_update_admin" ON comentarios_comunidade
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = comentarios_comunidade.tenant_id
        AND tenants.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_nivel_paciente_user_id ON nivel_paciente(user_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_post_id ON comentarios_comunidade(post_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_nivel ON community_posts(nivel_minimo);
