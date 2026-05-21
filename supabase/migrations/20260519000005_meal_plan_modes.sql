-- ============================================================
-- BLOCO 5 — CARDÁPIO BÁSICO vs PREMIUM
-- plan_mode: 'basic' (qualitativo) | 'premium' (calculado)
-- ============================================================

-- Adiciona modo ao plano alimentar
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS plan_mode TEXT NOT NULL DEFAULT 'premium'
  CHECK (plan_mode IN ('basic', 'premium'));

-- Adiciona descrição qualitativa por item (usado no modo básico)
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS qualitative_description TEXT;

-- Adiciona notes de preparação se não existir
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS substitution_note TEXT;

-- Índice para buscar planos por modo
CREATE INDEX IF NOT EXISTS idx_meal_plans_mode ON meal_plans(tenant_id, plan_mode);
