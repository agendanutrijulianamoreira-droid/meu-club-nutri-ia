-- ============================================================
-- Migration: Relatório Pré-Consulta Automático
-- Fase 8 — consolida adesão/sintomas/peso + análise clínica via IA
-- 2026-06-30
-- ============================================================

CREATE TABLE IF NOT EXISTS relatorios_pre_consulta (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  paciente_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id  uuid REFERENCES appointments(id) ON DELETE SET NULL,

  periodo_inicio  date NOT NULL,
  periodo_fim     date NOT NULL,
  dados_json      jsonb NOT NULL,      -- adesão, sintomas, peso, metas consolidados
  analise_clinica text,                -- texto gerado pela IA (resumo, pontos de atenção, evolução, condutas)

  gerado_por      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_pre_consulta_paciente
  ON relatorios_pre_consulta(paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relatorios_pre_consulta_appointment
  ON relatorios_pre_consulta(appointment_id);

ALTER TABLE relatorios_pre_consulta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutri_gerencia_relatorios" ON relatorios_pre_consulta
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'nutritionist')
    )
  );
