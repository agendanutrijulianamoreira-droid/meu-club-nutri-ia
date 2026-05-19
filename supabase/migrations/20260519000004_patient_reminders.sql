CREATE TABLE IF NOT EXISTS patient_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  reminder_type TEXT NOT NULL, -- 'water' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom'
  label TEXT NOT NULL, -- display name (e.g. "Beber água", "Café da manhã")

  -- Time stored in local HH:MM, timezone stored separately
  time_local TEXT NOT NULL, -- e.g. "08:00"
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',

  -- Days: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,0],

  -- Message sent in the push
  message TEXT NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, reminder_type)
);

ALTER TABLE patient_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON patient_reminders FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Tenant owner sees all reminders"
  ON patient_reminders FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE INDEX idx_patient_reminders_user ON patient_reminders(user_id);
CREATE INDEX idx_patient_reminders_active ON patient_reminders(tenant_id, is_active, time_local) WHERE is_active = true;

CREATE TRIGGER update_patient_reminders_updated_at
  BEFORE UPDATE ON patient_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
