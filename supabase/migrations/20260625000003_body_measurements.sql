-- Body measurements tracking for patients
CREATE TABLE IF NOT EXISTS body_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    patient_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2),
    waist_cm DECIMAL(5,1),
    hip_cm DECIMAL(5,1),
    arm_cm DECIMAL(5,1),
    thigh_cm DECIMAL(5,1),
    abdomen_cm DECIMAL(5,1),
    chest_cm DECIMAL(5,1),
    notes TEXT,
    measured_at DATE NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_measurements"
ON body_measurements FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY "tenant_admin_view_measurements"
ON body_measurements FOR SELECT TO authenticated
USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_patient ON body_measurements(patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_tenant ON body_measurements(tenant_id);
