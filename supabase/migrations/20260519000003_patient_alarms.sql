-- ============================================================
-- BLOCO 3 — ALARMES PROGRAMÁVEIS PELA PACIENTE
-- Lembretes de água, refeições e hábitos no horário certo
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_alarms (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tipo e rótulo
  type            text NOT NULL DEFAULT 'custom' CHECK (type IN ('water', 'meal', 'exercise', 'medication', 'custom')),
  label           text NOT NULL,

  -- Horário
  time_hhmm       text NOT NULL CHECK (time_hhmm ~ '^([01]\d|2[0-3]):[0-5]\d$'),

  -- Dias da semana: array de 0-6 (0=domingo, 1=segunda, ..., 6=sábado)
  -- Ex: [1,2,3,4,5] = dias úteis
  days_of_week    integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}',

  -- Mensagem push customizada (opcional — usa padrão por tipo se vazio)
  push_title      text,
  push_body       text,

  -- Controle
  is_active       boolean DEFAULT true,
  last_fired_at   timestamptz,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_alarms_user ON patient_alarms(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_alarms_active ON patient_alarms(is_active, time_hhmm);

ALTER TABLE patient_alarms ENABLE ROW LEVEL SECURITY;

-- Paciente gerencia os próprios alarmes
CREATE POLICY "Users manage own alarms"
  ON patient_alarms FOR ALL
  USING (user_id = auth.uid());

-- Admin pode visualizar alarmes do tenant
CREATE POLICY "Admin can view tenant alarms"
  ON patient_alarms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = patient_alarms.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_patient_alarms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_alarms_updated_at ON patient_alarms;
CREATE TRIGGER trg_patient_alarms_updated_at
  BEFORE UPDATE ON patient_alarms
  FOR EACH ROW EXECUTE FUNCTION update_patient_alarms_updated_at();
