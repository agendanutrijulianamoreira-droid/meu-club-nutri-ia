-- ============================================================
-- Migration: Agent Infrastructure Tables
-- Suporte à orquestra de agentes IA do VitaClub
-- 2026-03-20
-- ============================================================

-- 1. AGENT_LOGS — Registro de todas as execuções de agentes
-- Cada vez que um agente roda, ele loga aqui.
-- Usado para debug, métricas e billing de tokens.
CREATE TABLE IF NOT EXISTS agent_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name    text NOT NULL,  -- 'onboarding', 'daily_checkin', 'sabotage', 'meals', 'gamification', 'community', 'retention', 'protocol', 'orchestrator'
  trigger_type  text NOT NULL,  -- 'cron', 'webhook', 'realtime', 'manual', 'agent_chain'
  input_payload jsonb DEFAULT '{}'::jsonb,
  output_payload jsonb DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'running', -- 'running', 'success', 'error', 'skipped'
  error_message text,
  tokens_used   integer DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  duration_ms   integer DEFAULT 0,
  model_used    text DEFAULT 'claude-sonnet-4-20250514',
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX idx_agent_logs_tenant ON agent_logs(tenant_id);
CREATE INDEX idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);
CREATE INDEX idx_agent_logs_status ON agent_logs(status);

-- RLS
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view agent logs for their tenant"
  ON agent_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Service role can insert agent logs"
  ON agent_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update agent logs"
  ON agent_logs FOR UPDATE
  USING (true);


-- 2. INBOX_MESSAGES — Mensagens dos agentes para as pacientes
-- Substitui a tabela 'notifications' com mais contexto.
-- Suporta diferentes tipos de mensagem e canais de entrega.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name      text NOT NULL,        -- qual agente gerou
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  
  -- Conteúdo
  title           text NOT NULL,
  body            text NOT NULL,
  message_type    text NOT NULL DEFAULT 'engagement', -- 'engagement', 'celebration', 'rescue', 'tip', 'alert', 'protocol', 'community', 'onboarding'
  priority        text NOT NULL DEFAULT 'normal',     -- 'low', 'normal', 'high', 'urgent'
  
  -- CTA
  cta_label       text,
  cta_url         text,
  
  -- Delivery
  channels        text[] DEFAULT ARRAY['inbox'],  -- 'inbox', 'push', 'chat', 'feed'
  push_sent       boolean DEFAULT false,
  push_sent_at    timestamptz,
  
  -- Status
  status          text NOT NULL DEFAULT 'unread', -- 'unread', 'read', 'dismissed', 'acted'
  read_at         timestamptz,
  
  -- Metadata
  metadata        jsonb DEFAULT '{}'::jsonb,      -- dados extras do agente
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_tenant_user ON inbox_messages(tenant_id, user_id);
CREATE INDEX idx_inbox_user_status ON inbox_messages(user_id, status);
CREATE INDEX idx_inbox_created ON inbox_messages(created_at DESC);
CREATE INDEX idx_inbox_type ON inbox_messages(message_type);

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inbox"
  ON inbox_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own messages"
  ON inbox_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can insert inbox messages"
  ON inbox_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view tenant inbox"
  ON inbox_messages FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')
    )
  );


-- 3. PATIENT_RISK_SCORES — Score de risco calculado diariamente
-- Alimentado pelo Sabotage Detection Agent.
-- Histórico permite ver tendências e acionar retenção proativamente.
CREATE TABLE IF NOT EXISTS patient_risk_scores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Scores (0-100, onde 100 = máximo risco)
  overall_risk    integer NOT NULL DEFAULT 0,
  inactivity_risk integer NOT NULL DEFAULT 0,
  adherence_risk  integer NOT NULL DEFAULT 0,
  emotional_risk  integer NOT NULL DEFAULT 0,
  engagement_risk integer NOT NULL DEFAULT 0,
  
  -- Classificação
  risk_level      text NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  
  -- Sinais detectados
  signals         jsonb DEFAULT '[]'::jsonb, -- Ex: ["streak_broken", "low_checkin_score", "binge_reported", "inactive_5d"]
  
  -- Ação recomendada pelo agente
  recommended_action text,  -- 'celebrate', 'nudge', 'rescue', 'alert_nutritionist', 'no_action'
  action_taken       boolean DEFAULT false,
  
  -- Contexto
  days_since_activity integer DEFAULT 0,
  current_streak      integer DEFAULT 0,
  adherence_7d        numeric(5,2) DEFAULT 0,
  last_checkin_score  integer,
  
  -- Metadata
  agent_log_id    uuid REFERENCES agent_logs(id) ON DELETE SET NULL,
  calculated_at   timestamptz DEFAULT now()
);

-- Um score por usuário por dia (cast não pode ir em UNIQUE inline no Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_unique_user_day
  ON patient_risk_scores (user_id, (calculated_at::date));

CREATE INDEX idx_risk_tenant ON patient_risk_scores(tenant_id);
CREATE INDEX idx_risk_user ON patient_risk_scores(user_id);
CREATE INDEX idx_risk_level ON patient_risk_scores(risk_level);
CREATE INDEX idx_risk_date ON patient_risk_scores(calculated_at DESC);

ALTER TABLE patient_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view risk scores"
  ON patient_risk_scores FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Patients can view own risk score"
  ON patient_risk_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage risk scores"
  ON patient_risk_scores FOR ALL
  USING (true);


-- 4. Habilitar Realtime para inbox_messages (pacientes recebem mensagens em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;

-- 5. Comentários para documentação
COMMENT ON TABLE agent_logs IS 'Log de execução de todos os agentes IA — debug, métricas e billing';
COMMENT ON TABLE inbox_messages IS 'Mensagens enviadas pelos agentes para as pacientes — inbox unificado';
COMMENT ON TABLE patient_risk_scores IS 'Score de risco diário calculado pelo Sabotage Detection Agent';
