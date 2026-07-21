-- ============================================================
-- Arquitetura "Método Clínico" — Sub-fase 2: Biblioteca Clínica
-- Cria os Ativos Clínicos (shots, chás, suplementos, materiais,
-- refeições), o registro de categorias configuráveis, e as tabelas
-- de composição relacional (nunca JSON) que os ligam a alimentos/
-- receitas/suplementos, seguindo ADR-0001, ADR-0002 e ADR-0003.
-- 2026-07-22
-- ============================================================

-- ============================================================
-- 0. Trigger genérico de updated_at já existe (update_methods_updated_at,
--    criado na Sub-fase 1) — reaproveitado em todas as tabelas novas.
-- ============================================================

-- ============================================================
-- 1. clinical_categories — taxonomia configurável por tenant e por
--    tipo de ativo, substituindo os antigos CHECK enums fixos.
-- ============================================================

CREATE TABLE IF NOT EXISTS clinical_categories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('recipe','meal','shot','tea','supplement','material')),
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, entity_type, name)
);

CREATE INDEX IF NOT EXISTS idx_clinical_categories_tenant ON clinical_categories(tenant_id, entity_type);

ALTER TABLE clinical_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read clinical_categories"
  ON clinical_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = clinical_categories.tenant_id));

CREATE POLICY "Admin manages own clinical_categories"
  ON clinical_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = clinical_categories.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ============================================================
-- 2. supplements — leaf entity (sem composição própria).
-- ============================================================

CREATE TABLE IF NOT EXISTS supplements (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category_id       uuid REFERENCES clinical_categories(id),
  default_dosage    numeric,
  dosage_unit       text,
  frequency         text,
  best_time         text,
  is_active         boolean NOT NULL DEFAULT true,
  is_ai_generated   boolean NOT NULL DEFAULT false,
  tags              text[] DEFAULT '{}',
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  ai_summary        text,
  ai_keywords       text[] DEFAULT '{}',
  indications       text,
  contraindications text,
  embedding_status  text,
  last_ai_update    timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplements_tenant ON supplements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplements_active ON supplements(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_supplements_tags ON supplements USING GIN(tags);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant patients can read active supplements"
  ON supplements FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = supplements.tenant_id));

CREATE POLICY "Admin manages own supplements"
  ON supplements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = supplements.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP TRIGGER IF EXISTS trg_supplements_updated_at ON supplements;
CREATE TRIGGER trg_supplements_updated_at
  BEFORE UPDATE ON supplements
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

-- ============================================================
-- 3. materials — leaf entity (documentos/vídeos educativos).
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category_id       uuid REFERENCES clinical_categories(id),
  file_url          text,
  external_url      text,
  estimated_minutes integer,
  author            text,
  source             text,
  is_active         boolean NOT NULL DEFAULT true,
  is_ai_generated   boolean NOT NULL DEFAULT false,
  tags              text[] DEFAULT '{}',
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  ai_summary        text,
  ai_keywords       text[] DEFAULT '{}',
  indications       text,
  contraindications text,
  embedding_status  text,
  last_ai_update    timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_tenant ON materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_materials_tags ON materials USING GIN(tags);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant patients can read active materials"
  ON materials FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = materials.tenant_id));

CREATE POLICY "Admin manages own materials"
  ON materials FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = materials.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP TRIGGER IF EXISTS trg_materials_updated_at ON materials;
CREATE TRIGGER trg_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

-- ============================================================
-- 4. shots + shot_components (composição relacional — ADR-0003:
--    nunca JSON quando existe alternativa relacional).
-- ============================================================

CREATE TABLE IF NOT EXISTS shots (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category_id       uuid REFERENCES clinical_categories(id),
  instructions      text,
  volume_ml         integer,
  best_time         text,
  is_active         boolean NOT NULL DEFAULT true,
  is_ai_generated   boolean NOT NULL DEFAULT false,
  tags              text[] DEFAULT '{}',
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  ai_summary        text,
  ai_keywords       text[] DEFAULT '{}',
  indications       text,
  contraindications text,
  embedding_status  text,
  last_ai_update    timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shots_tenant ON shots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shots_active ON shots(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shots_tags ON shots USING GIN(tags);

ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant patients can read active shots"
  ON shots FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = shots.tenant_id));

CREATE POLICY "Admin manages own shots"
  ON shots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = shots.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP TRIGGER IF EXISTS trg_shots_updated_at ON shots;
CREATE TRIGGER trg_shots_updated_at
  BEFORE UPDATE ON shots
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

CREATE TABLE IF NOT EXISTS shot_components (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_id       uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  food_id       uuid REFERENCES foods(id),
  recipe_id     uuid REFERENCES recipes(id),
  supplement_id uuid REFERENCES supplements(id),
  quantity      numeric,
  unit          text,
  serving_label text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  CHECK (num_nonnulls(food_id, recipe_id, supplement_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_shot_components_shot ON shot_components(shot_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_shot_components_tenant ON shot_components(tenant_id);

ALTER TABLE shot_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read shot_components"
  ON shot_components FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = shot_components.tenant_id));

CREATE POLICY "Admin manages own shot_components"
  ON shot_components FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = shot_components.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ============================================================
-- 5. teas + tea_components (mesma filosofia de shots).
-- ============================================================

CREATE TABLE IF NOT EXISTS teas (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category_id       uuid REFERENCES clinical_categories(id),
  instructions      text,
  best_time         text,
  is_active         boolean NOT NULL DEFAULT true,
  is_ai_generated   boolean NOT NULL DEFAULT false,
  tags              text[] DEFAULT '{}',
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  ai_summary        text,
  ai_keywords       text[] DEFAULT '{}',
  indications       text,
  contraindications text,
  embedding_status  text,
  last_ai_update    timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teas_tenant ON teas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teas_active ON teas(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_teas_tags ON teas USING GIN(tags);

ALTER TABLE teas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant patients can read active teas"
  ON teas FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = teas.tenant_id));

CREATE POLICY "Admin manages own teas"
  ON teas FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = teas.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP TRIGGER IF EXISTS trg_teas_updated_at ON teas;
CREATE TRIGGER trg_teas_updated_at
  BEFORE UPDATE ON teas
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

CREATE TABLE IF NOT EXISTS tea_components (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tea_id        uuid NOT NULL REFERENCES teas(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  food_id       uuid REFERENCES foods(id),
  recipe_id     uuid REFERENCES recipes(id),
  supplement_id uuid REFERENCES supplements(id),
  quantity      numeric,
  unit          text,
  serving_label text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  CHECK (num_nonnulls(food_id, recipe_id, supplement_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_tea_components_tea ON tea_components(tea_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tea_components_tenant ON tea_components(tenant_id);

ALTER TABLE tea_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read tea_components"
  ON tea_components FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = tea_components.tenant_id));

CREATE POLICY "Admin manages own tea_components"
  ON tea_components FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = tea_components.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ============================================================
-- 6. meals + meal_components — conceito "Refeição" da Biblioteca
--    Clínica (composição reaproveitável de alimentos/receitas/
--    suplementos). Não confundir com meal_plans (camada Dieta).
-- ============================================================

CREATE TABLE IF NOT EXISTS meals (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category_id       uuid REFERENCES clinical_categories(id),
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  is_ai_generated   boolean NOT NULL DEFAULT false,
  tags              text[] DEFAULT '{}',
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  ai_summary        text,
  ai_keywords       text[] DEFAULT '{}',
  indications       text,
  contraindications text,
  embedding_status  text,
  last_ai_update    timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meals_tenant ON meals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meals_active ON meals(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_meals_tags ON meals USING GIN(tags);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant patients can read active meals"
  ON meals FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = meals.tenant_id));

CREATE POLICY "Admin manages own meals"
  ON meals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = meals.tenant_id AND profiles.role IN ('admin','nutritionist')));

DROP TRIGGER IF EXISTS trg_meals_updated_at ON meals;
CREATE TRIGGER trg_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

CREATE TABLE IF NOT EXISTS meal_components (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id       uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  food_id       uuid REFERENCES foods(id),
  recipe_id     uuid REFERENCES recipes(id),
  supplement_id uuid REFERENCES supplements(id),
  quantity      numeric,
  unit          text,
  serving_label text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  CHECK (num_nonnulls(food_id, recipe_id, supplement_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_meal_components_meal ON meal_components(meal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_meal_components_tenant ON meal_components(tenant_id);

ALTER TABLE meal_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read meal_components"
  ON meal_components FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = meal_components.tenant_id));

CREATE POLICY "Admin manages own meal_components"
  ON meal_components FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = meal_components.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ============================================================
-- 7. recipes — retrofit para o contrato ADR-0002 + conversão de
--    category (CHECK fixo) para category_id, + recipe_components
--    substituindo o jsonb ingredients (0 linhas em produção, sem
--    risco de migração de dado real).
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES clinical_categories(id),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS indications text,
  ADD COLUMN IF NOT EXISTS contraindications text,
  ADD COLUMN IF NOT EXISTS embedding_status text,
  ADD COLUMN IF NOT EXISTS last_ai_update timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_category_check;
ALTER TABLE recipes DROP COLUMN IF EXISTS category;
ALTER TABLE recipes ALTER COLUMN ingredients DROP NOT NULL;
ALTER TABLE recipes ALTER COLUMN ingredients DROP DEFAULT;
ALTER TABLE recipes DROP COLUMN IF EXISTS ingredients;

COMMENT ON COLUMN recipes.substitutions IS 'Sugestões de substituição de ingrediente em texto/jsonb — mantido como está (não é a composição da receita, é uma dica secundária). A composição real vive em recipe_components (ADR-0003).';

CREATE TABLE IF NOT EXISTS recipe_components (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id          uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  food_id            uuid REFERENCES foods(id),
  component_recipe_id uuid REFERENCES recipes(id),
  supplement_id      uuid REFERENCES supplements(id),
  quantity           numeric,
  unit               text,
  serving_label      text,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  CHECK (num_nonnulls(food_id, component_recipe_id, supplement_id) = 1),
  CHECK (component_recipe_id IS NULL OR component_recipe_id <> recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_components_recipe ON recipe_components(recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_components_tenant ON recipe_components(tenant_id);

ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read recipe_components"
  ON recipe_components FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = recipe_components.tenant_id));

CREATE POLICY "Admin manages own recipe_components"
  ON recipe_components FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = recipe_components.tenant_id AND profiles.role IN ('admin','nutritionist')));

-- ============================================================
-- 8. goals — retrofit para o contrato ADR-0002 (Metas viram um
--    Ativo Clínico de pleno direito, gerenciado pela Biblioteca
--    Clínica em vez de dentro de ProtocolsView).
-- ============================================================

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS indications text,
  ADD COLUMN IF NOT EXISTS contraindications text,
  ADD COLUMN IF NOT EXISTS embedding_status text,
  ADD COLUMN IF NOT EXISTS last_ai_update timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_methods_updated_at();

-- ============================================================
-- 9. Seed: categorias padrão por tipo de ativo, para cada tenant
--    existente (preserva as mesmas opções que recipes.category
--    já usava, mais defaults sensatos para os ativos novos).
-- ============================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    INSERT INTO clinical_categories (tenant_id, entity_type, name, sort_order) VALUES
      (t.id, 'recipe', 'café da manhã', 0),
      (t.id, 'recipe', 'lanche', 1),
      (t.id, 'recipe', 'almoço', 2),
      (t.id, 'recipe', 'jantar', 3),
      (t.id, 'recipe', 'sobremesa', 4),
      (t.id, 'recipe', 'bebida', 5),
      (t.id, 'recipe', 'refeição', 6),
      (t.id, 'meal', 'café da manhã', 0),
      (t.id, 'meal', 'lanche', 1),
      (t.id, 'meal', 'almoço', 2),
      (t.id, 'meal', 'jantar', 3),
      (t.id, 'meal', 'ceia', 4),
      (t.id, 'shot', 'anti-inflamatório', 0),
      (t.id, 'shot', 'digestivo', 1),
      (t.id, 'shot', 'energético', 2),
      (t.id, 'shot', 'detox', 3),
      (t.id, 'shot', 'imunidade', 4),
      (t.id, 'tea', 'digestivo', 0),
      (t.id, 'tea', 'calmante', 1),
      (t.id, 'tea', 'termogênico', 2),
      (t.id, 'tea', 'diurético', 3),
      (t.id, 'tea', 'imunidade', 4),
      (t.id, 'supplement', 'vitamina', 0),
      (t.id, 'supplement', 'mineral', 1),
      (t.id, 'supplement', 'proteína', 2),
      (t.id, 'supplement', 'ômega', 3),
      (t.id, 'supplement', 'probiótico', 4),
      (t.id, 'supplement', 'outro', 5),
      (t.id, 'material', 'pdf', 0),
      (t.id, 'material', 'vídeo', 1),
      (t.id, 'material', 'infográfico', 2),
      (t.id, 'material', 'guia', 3),
      (t.id, 'material', 'artigo', 4)
    ON CONFLICT (tenant_id, entity_type, name) DO NOTHING;
  END LOOP;
END $$;
