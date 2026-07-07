-- Questionnaire responses table
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Patients can insert and view their own responses
CREATE POLICY "patients_manage_own_responses"
ON questionnaire_responses
FOR ALL
TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

-- Tenant admins can view all responses for their tenant
CREATE POLICY "tenant_admin_view_responses"
ON questionnaire_responses
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_questionnaire_id
    ON questionnaire_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_patient_id
    ON questionnaire_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_tenant_id
    ON questionnaire_responses(tenant_id);
