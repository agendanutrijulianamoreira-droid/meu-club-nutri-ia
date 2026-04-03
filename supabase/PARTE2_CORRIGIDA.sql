-- ====================================================================
-- PARTE 2 CORRIGIDA: TABELAS DA ORQUESTRA DE AGENTES IA
-- ====================================================================

-- 2.1 AGENT_LOGS
CREATE TABLE IF NOT EXISTS agent_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name    text NOT NULL,
  trigger_type  text NOT NULL,
  input_payload jsonb DEFAULT '{}'::jsonb,
  output_payload jsonb DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'running',
  error_message text,
  tokens_used   integer DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  duration_ms   integer DEFAULT 0,
  model_used    text DEFAULT 'claude-sonnet-4-20250514',
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_tenant ON agent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON agent_logs(status);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_logs_admin_select" ON agent_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));

CREATE POLICY "agent_logs_insert" ON agent_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "agent_logs_update" ON agent_logs FOR UPDATE USING (true);


-- 2.2 INBOX_MESSAGES
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name      text NOT NULL,
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  message_type    text NOT NULL DEFAULT 'engagement',
  priority        text NOT NULL DEFAULT 'normal',
  cta_label       text,
  cta_url         text,
  channels        text[] DEFAULT ARRAY['inbox'],
  push_sent       boolean DEFAULT false,
  push_sent_at    timestamptz,
  status          text NOT NULL DEFAULT 'unread',
  read_at         timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_tenant_user ON inbox_messages(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON inbox_messages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_type ON inbox_messages(message_type);

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_user_select" ON inbox_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "inbox_user_update" ON inbox_messages FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "inbox_insert" ON inbox_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "inbox_admin_select" ON inbox_messages FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));


-- 2.3 PATIENT_RISK_SCORES
CREATE TABLE IF NOT EXISTS patient_risk_scores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_risk    integer NOT NULL DEFAULT 0,
  inactivity_risk integer NOT NULL DEFAULT 0,
  adherence_risk  integer NOT NULL DEFAULT 0,
  emotional_risk  integer NOT NULL DEFAULT 0,
  engagement_risk integer NOT NULL DEFAULT 0,
  risk_level      text NOT NULL DEFAULT 'low',
  signals         jsonb DEFAULT '[]'::jsonb,
  recommended_action text,
  action_taken       boolean DEFAULT false,
  days_since_activity integer DEFAULT 0,
  current_streak      integer DEFAULT 0,
  adherence_7d        numeric(5,2) DEFAULT 0,
  last_checkin_score  integer,
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  calculated_at   timestamptz DEFAULT now(),
  score_date      date GENERATED ALWAYS AS ((calculated_at AT TIME ZONE 'America/Sao_Paulo')::date) STORED
);

-- Unique index por dia (em vez de UNIQUE constraint com cast)
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_user_date ON patient_risk_scores(user_id, score_date);

CREATE INDEX IF NOT EXISTS idx_risk_tenant ON patient_risk_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_user ON patient_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_level ON patient_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_date ON patient_risk_scores(calculated_at DESC);

ALTER TABLE patient_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk_admin_select" ON patient_risk_scores FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')));

CREATE POLICY "risk_patient_select" ON patient_risk_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "risk_service_all" ON patient_risk_scores FOR ALL USING (true);


-- 2.4 Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- 2.5 Comentários
COMMENT ON TABLE agent_logs IS 'Log de execução de todos os agentes IA';
COMMENT ON TABLE inbox_messages IS 'Mensagens dos agentes para pacientes — inbox com Realtime';
COMMENT ON TABLE patient_risk_scores IS 'Score de risco diário por paciente';

-- ✅ Parte 2 concluída! Agora rode a Parte 3 (alimentos + cardápios).
