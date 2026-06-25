-- ============================================
-- NUTRITIONISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS nutritionists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  calendar_enabled BOOLEAN DEFAULT true,
  calendar_settings JSONB DEFAULT '{
    "work_days": [1, 2, 3, 4, 5],
    "work_hours_start": "08:00",
    "work_hours_end": "18:00",
    "slot_duration_minutes": 60,
    "buffer_minutes": 10
  }'::jsonb,
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_nutritionists_tenant ON nutritionists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nutritionists_user ON nutritionists(user_id);

ALTER TABLE nutritionists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutritionists manage own record"
  ON nutritionists FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant members can view nutritionist"
  ON nutritionists FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Auto-populate from existing tenants (skip those with null owner_id)
INSERT INTO nutritionists (user_id, tenant_id, name, email, calendar_enabled)
SELECT
  t.owner_id,
  t.id,
  COALESCE(p.name, t.brand_name),
  p.email,
  true
FROM tenants t
LEFT JOIN profiles p ON p.user_id = t.owner_id
WHERE t.owner_id IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger: auto-create nutritionist record when a new tenant is created
CREATE OR REPLACE FUNCTION auto_create_nutritionist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO nutritionists (user_id, tenant_id, name, calendar_enabled)
    VALUES (NEW.owner_id, NEW.id, NEW.brand_name, true)
    ON CONFLICT (tenant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tenants_auto_nutritionist ON tenants;
CREATE TRIGGER tenants_auto_nutritionist AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION auto_create_nutritionist();

-- ============================================
-- ENSURE update_updated_at() EXISTS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  nutritionist_id UUID REFERENCES nutritionists(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0),

  appointment_type TEXT DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'followup', 'initial_assessment', 'group_session')),
  is_virtual BOOLEAN DEFAULT true,
  meeting_link TEXT,
  location_address TEXT,

  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),

  notes TEXT,
  patient_notes TEXT,
  pre_consultation_form JSONB,

  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  confirmation_sent BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_appointments_nutritionist ON appointments(nutritionist_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at) WHERE status IN ('scheduled', 'confirmed');

-- Prevent double-booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_overlap ON appointments(
  nutritionist_id,
  scheduled_at
) WHERE status NOT IN ('cancelled', 'no_show');

-- updated_at trigger
DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Simplified overlap check (no calendar_enabled gate)
CREATE OR REPLACE FUNCTION check_appointment_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_conflicts INTEGER;
  v_slot_end TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    v_slot_end := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL;

    SELECT COUNT(*) INTO v_conflicts
    FROM appointments
    WHERE nutritionist_id = NEW.nutritionist_id
      AND id IS DISTINCT FROM NEW.id
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (NEW.scheduled_at >= scheduled_at AND NEW.scheduled_at < scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
        OR (v_slot_end > scheduled_at AND v_slot_end <= scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
        OR (NEW.scheduled_at <= scheduled_at AND v_slot_end >= scheduled_at + (duration_minutes || ' minutes')::INTERVAL)
      );

    IF v_conflicts > 0 THEN
      RAISE EXCEPTION 'Horário conflita com outro agendamento existente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_check_availability ON appointments;
CREATE TRIGGER appointments_check_availability BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_appointment_availability();

-- Auto no_show after time passes
CREATE OR REPLACE FUNCTION auto_update_appointment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'confirmed') AND
     NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL < NOW() THEN
    NEW.status := 'no_show';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_auto_status ON appointments;
CREATE TRIGGER appointments_auto_status BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_update_appointment_status();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients see own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Nutritionists see own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins see all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Nutritionists can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
    OR tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Patients can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Nutritionists can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
    OR tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Patients can cancel appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid() AND status = 'cancelled');

-- ============================================
-- VIEWS
-- ============================================
CREATE OR REPLACE VIEW upcoming_appointments AS
SELECT
  a.*,
  p.name as patient_name,
  p.email as patient_email,
  p.avatar_url as patient_avatar,
  n.name as nutritionist_name,
  n.avatar_url as nutritionist_avatar
FROM appointments a
JOIN profiles p ON p.user_id = a.patient_id
JOIN nutritionists n ON n.id = a.nutritionist_id
WHERE a.scheduled_at > NOW()
  AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.scheduled_at ASC;

CREATE OR REPLACE VIEW nutritionist_appointment_stats AS
SELECT
  n.id as nutritionist_id,
  n.name as nutritionist_name,
  n.tenant_id,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE a.status = 'completed') as completed_appointments,
  COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled_appointments,
  COUNT(*) FILTER (WHERE a.status = 'no_show') as no_show_appointments,
  COUNT(*) FILTER (WHERE a.scheduled_at > NOW() AND a.status IN ('scheduled', 'confirmed')) as upcoming_appointments
FROM nutritionists n
LEFT JOIN appointments a ON a.nutritionist_id = n.id
GROUP BY n.id, n.name, n.tenant_id;
