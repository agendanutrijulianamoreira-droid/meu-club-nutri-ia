-- ============================================================
-- BLOCO 4 — RECEITAS COM IA
-- Banco de receitas do tenant com filtro por restrição
-- ============================================================

CREATE TABLE IF NOT EXISTS recipes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identidade
  title           text NOT NULL,
  description     text,
  emoji           text DEFAULT '🍽️',

  -- Classificação
  category        text NOT NULL DEFAULT 'refeição' CHECK (category IN (
    'café da manhã', 'lanche', 'almoço', 'jantar', 'sobremesa', 'shot', 'bebida', 'refeição'
  )),
  meal_type       text[] DEFAULT '{}',

  -- Restrições alimentares (vazio = sem restrição específica)
  -- ex: ['lactose', 'gluten', 'vegana']
  dietary_tags    text[] DEFAULT '{}',

  -- Conteúdo
  prep_time_min   integer,
  servings        integer DEFAULT 1,
  ingredients     jsonb NOT NULL DEFAULT '[]',
  instructions    text NOT NULL DEFAULT '',

  -- Nutrição (opcional, para plano premium)
  calories        integer,
  protein_g       decimal,
  carbs_g         decimal,
  fat_g           decimal,

  -- Substituições sugeridas
  substitutions   jsonb DEFAULT '[]',

  -- Plano de acesso
  access_tier     text NOT NULL DEFAULT 'basic' CHECK (access_tier IN ('basic', 'premium')),

  -- Imagem
  image_url       text,

  -- Controle
  is_active       boolean DEFAULT true,
  is_ai_generated boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(dietary_tags);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Pacientes autenticadas do tenant podem ler receitas ativas
CREATE POLICY "Tenant patients can read active recipes"
  ON recipes FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = recipes.tenant_id
    )
  );

-- Admin gerencia as próprias receitas
CREATE POLICY "Admin manages own recipes"
  ON recipes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = recipes.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON recipes;
CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_recipes_updated_at();
