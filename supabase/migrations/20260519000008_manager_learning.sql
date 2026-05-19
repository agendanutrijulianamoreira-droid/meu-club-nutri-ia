-- ============================================================
-- BLOCO 8 — MANAGER LEARNING LOOP
-- O gerente aprende com o feedback do admin para melhorar sugestões
-- ============================================================

-- Tabela de resumos de aprendizado (atualizada periodicamente pelo sistema)
CREATE TABLE IF NOT EXISTS manager_learning (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_name      text NOT NULL,
  action_type     text NOT NULL,

  -- Métricas de feedback
  total_approved  integer DEFAULT 0,
  total_rejected  integer DEFAULT 0,
  total_edited    integer DEFAULT 0,
  approval_rate   numeric(5,2) DEFAULT 0,

  -- Padrões detectados (JSONB para flexibilidade)
  approved_patterns  jsonb DEFAULT '[]',   -- [{pattern, count, example}]
  rejected_patterns  jsonb DEFAULT '[]',   -- [{pattern, count, reason}]
  edit_patterns      jsonb DEFAULT '[]',   -- [{what_changed, frequency}]

  -- Instruções geradas para o agente (injetadas no próximo ciclo)
  learning_instructions text,

  last_analyzed_at  timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  UNIQUE(tenant_id, agent_name, action_type)
);

CREATE INDEX IF NOT EXISTS idx_manager_learning_tenant ON manager_learning(tenant_id, agent_name);

ALTER TABLE manager_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê aprendizado do gerente"
  ON manager_learning FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = manager_learning.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );
