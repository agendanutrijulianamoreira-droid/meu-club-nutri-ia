-- ============================================
-- Cron: daily-engagement às 09:00 BRT (12:00 UTC)
-- Requer pg_cron + pg_net habilitados no Supabase
-- ============================================

-- Habilitar pg_net se ainda não estiver
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabela de log das execuções do cron (para o admin monitorar)
CREATE TABLE IF NOT EXISTS ai_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  function_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  tenants_processed INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  elapsed_ms INTEGER,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'cron'  -- 'cron' | 'manual'
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_fn ON ai_cron_logs(function_name, created_at DESC);

-- RLS: apenas dono do tenant vê os logs
ALTER TABLE ai_cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON ai_cron_logs
  FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_cron_logs" ON ai_cron_logs
  FOR SELECT TO authenticated
  USING (true);  -- qualquer admin autenticado pode ver (filtro no app)

-- Agendar cron via pg_cron (09:00 BRT = 12:00 UTC)
-- IMPORTANTE: Execute este bloco manualmente no SQL Editor do Supabase
-- após habilitar pg_cron em Database > Extensions
--
-- SELECT cron.schedule(
--   'daily-engagement',
--   '0 12 * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/daily-engagement',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', current_setting('app.cron_secret')
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );
