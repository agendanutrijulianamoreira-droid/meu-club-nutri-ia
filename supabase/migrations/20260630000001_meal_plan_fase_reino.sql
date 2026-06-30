-- ============================================
-- Fase 6: Plano Alimentar por IA + Fase do REINO
-- ============================================

-- Adicionar fase_aplicada em meal_plans (qual fase clínica do REINO gerou este plano)
ALTER TABLE meal_plans
    ADD COLUMN IF NOT EXISTS fase_aplicada INTEGER CHECK (fase_aplicada BETWEEN 1 AND 6);

-- Índice para filtrar planos por fase
CREATE INDEX IF NOT EXISTS idx_meal_plans_fase ON meal_plans(fase_aplicada) WHERE fase_aplicada IS NOT NULL;

-- Adicionar fase_aplicada em meal_plan_assignments para rastrear por atribuição
ALTER TABLE meal_plan_assignments
    ADD COLUMN IF NOT EXISTS fase_aplicada INTEGER CHECK (fase_aplicada BETWEEN 1 AND 6);
