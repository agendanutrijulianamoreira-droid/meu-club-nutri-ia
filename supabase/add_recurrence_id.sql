-- ============================================
-- ADD RECURRENCE_ID - Agrupamento de Eventos
-- ============================================

ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS recurrence_id UUID;
CREATE INDEX IF NOT EXISTS idx_scheduled_events_recurrence ON scheduled_events(recurrence_id);

COMMENT ON COLUMN scheduled_events.recurrence_id IS 'ID de grupo para eventos repetidos (Google Calendar style)';
