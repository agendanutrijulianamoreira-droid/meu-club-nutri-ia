-- ============================================================
-- Migration: 20260702000001_cleanup_deprecated_tables
-- Fase 1 — Limpeza de tabelas mortas
--
-- Decisões registradas em: implementation_plan.md
--
--  1. DROP notifications → zero leitura/escrita confirmado.
--     A tabela inbox_messages já é o canal ativo.
--
--  2. RENAME rewards → _deprecated_rewards
--     RENAME patient_reminders → _deprecated_patient_reminders
--     Sem uso no código, mas mantemos por 30 dias como precaução.
--     Dropar definitivamente após ~2026-08-01 se ninguém reclamar.
--
-- ROLLBACK (emergência):
--   ALTER TABLE _deprecated_rewards RENAME TO rewards;
--   ALTER TABLE _deprecated_patient_reminders RENAME TO patient_reminders;
--   (notifications não tem rollback — dados eram descartáveis por design)
-- ============================================================

-- -----------------------------------------------------------
-- 1. Drop tabela notifications (legada — substituída por inbox_messages)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS notifications CASCADE;

-- -----------------------------------------------------------
-- 2. Marcar rewards como deprecated (reversível por 30 dias)
--    A loja real usa reward_items + reward_redemptions
-- -----------------------------------------------------------
ALTER TABLE IF EXISTS rewards
  RENAME TO _deprecated_rewards;

-- -----------------------------------------------------------
-- 3. Marcar patient_reminders como deprecated (reversível por 30 dias)
--    A lógica ativa já está em patient_alarms
-- -----------------------------------------------------------
ALTER TABLE IF EXISTS patient_reminders
  RENAME TO _deprecated_patient_reminders;
