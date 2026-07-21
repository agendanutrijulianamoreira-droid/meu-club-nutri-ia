-- ============================================================
-- Sub-fase 2 (Biblioteca Clínica) — endurecimento pré-merge,
-- decorrente da auditoria arquitetural da PR.
-- ============================================================

-- ------------------------------------------------------------
-- 1. recipes.substitutions (jsonb) → recipe_substitutions
--    relacional. Era a última relação em JSON na Biblioteca
--    Clínica quando poderia ser FK (mesmo princípio do ADR-0003
--    aplicado a receitas/shots/chás/refeições). 0 linhas em
--    produção — sem risco de migração de dado real.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recipe_substitutions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id         uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_food_id  uuid REFERENCES foods(id),
  substitute_food_id uuid REFERENCES foods(id),
  reason            text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_substitutions_recipe ON recipe_substitutions(recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_substitutions_tenant ON recipe_substitutions(tenant_id);

ALTER TABLE recipe_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read recipe_substitutions"
  ON recipe_substitutions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = recipe_substitutions.tenant_id));

CREATE POLICY "Admin manages own recipe_substitutions"
  ON recipe_substitutions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = recipe_substitutions.tenant_id AND profiles.role IN ('admin','nutritionist')));

ALTER TABLE recipes DROP COLUMN IF EXISTS substitutions;

-- ------------------------------------------------------------
-- 2. Índices em category_id — todas as telas da Biblioteca
--    Clínica filtram por categoria (GET .eq('category_id', ...)),
--    e a coluna não tinha índice próprio.
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_meals_category ON meals(category_id);
CREATE INDEX IF NOT EXISTS idx_shots_category ON shots(category_id);
CREATE INDEX IF NOT EXISTS idx_teas_category ON teas(category_id);
CREATE INDEX IF NOT EXISTS idx_supplements_category ON supplements(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
