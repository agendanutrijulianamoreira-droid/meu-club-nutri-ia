-- ============================================
-- Add checkin_date (DATE puro) para timezone-safe check-ins
-- ============================================

-- A coluna checkin_date armazena a data LOCAL do usuário
-- sem informação de timezone. Isso evita o bug onde um
-- check-in às 22:00 BRT (01:00 UTC) aparece no dia errado.

ALTER TABLE protocol_progress
ADD COLUMN IF NOT EXISTS checkin_date DATE;

-- Backfill: converter completed_at existentes para date
-- (usa UTC, mas é o melhor que temos para dados antigos)
UPDATE protocol_progress
SET checkin_date = (completed_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE checkin_date IS NULL AND completed_at IS NOT NULL;

-- Índice para queries por data
CREATE INDEX IF NOT EXISTS idx_progress_checkin_date
ON protocol_progress(assignment_id, checkin_date);
