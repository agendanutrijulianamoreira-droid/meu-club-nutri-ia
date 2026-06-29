-- ============================================================
-- Migration: Check-in Diário de Sintomas Subjetivos
-- Fase 2 — Gráficos de progresso com sintomas 0-10
-- 2026-06-28
-- ============================================================
-- Tabela diferente de weekly_checkin_responses (semanal)
-- Esta é para registro diário de bem-estar e sintomas

CREATE TABLE IF NOT EXISTS checkin_diario (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data                date NOT NULL DEFAULT CURRENT_DATE,

  -- Sintomas em escala 0 (ausente) a 10 (intenso)
  nivel_energia       integer CHECK (nivel_energia BETWEEN 0 AND 10),
  nivel_inchaco       integer CHECK (nivel_inchaco BETWEEN 0 AND 10),
  nivel_compulsao     integer CHECK (nivel_compulsao BETWEEN 0 AND 10),
  qualidade_sono      integer CHECK (qualidade_sono BETWEEN 0 AND 10),
  nivel_ansiedade     integer CHECK (nivel_ansiedade BETWEEN 0 AND 10),
  dor_abdominal       integer CHECK (dor_abdominal BETWEEN 0 AND 10),
  retencao_liquido    integer CHECK (retencao_liquido BETWEEN 0 AND 10),
  humor               integer CHECK (humor BETWEEN 0 AND 10),

  -- Dados objetivos
  peso_kg             numeric(5,2),
  horas_sono          numeric(4,1),
  copos_agua          integer,

  -- Ciclo menstrual
  dia_ciclo           integer,
  fase_ciclo          text,  -- 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

  -- Texto livre
  observacoes         text,

  created_at          timestamptz DEFAULT now(),

  UNIQUE(paciente_id, data)  -- apenas 1 check-in por dia
);

CREATE INDEX IF NOT EXISTS idx_checkin_diario_paciente_data
  ON checkin_diario(paciente_id, data);

ALTER TABLE checkin_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_proprio_checkin_diario" ON checkin_diario
  FOR ALL USING (auth.uid() = paciente_id);

CREATE POLICY "nutri_ve_checkins_diarios" ON checkin_diario
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.role IN ('nutritionist', 'admin')
        AND paciente_id IN (
          SELECT user_id FROM profiles WHERE tenant_id = t.id
        )
    )
  );
