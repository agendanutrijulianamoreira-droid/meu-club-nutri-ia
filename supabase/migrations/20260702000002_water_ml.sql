-- ============================================================
-- Migration: Controle de hidratação em ml
-- Adiciona quantidade real de água (não só o check binário) a daily_logs
-- 2026-07-02
-- ============================================================

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_ml INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN daily_logs.water_ml IS
  'Total de ml de água registrados no dia. water_check é setado pelo app quando water_ml atinge a meta calculada (peso x 35ml, mínimo 1500ml).';
