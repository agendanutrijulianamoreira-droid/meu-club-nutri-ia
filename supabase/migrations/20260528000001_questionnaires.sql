-- Questionnaire templates
CREATE TABLE IF NOT EXISTS questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  plan_filters TEXT[] DEFAULT '{}',
  estimated_minutes INTEGER DEFAULT 3,
  total_respondents INTEGER DEFAULT 0,
  response_rate_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions per questionnaire
CREATE TABLE IF NOT EXISTS questionnaire_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'open_text',
  question_order INTEGER NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-plan automation rules
CREATE TABLE IF NOT EXISTS plan_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  questionnaire_names TEXT[] DEFAULT '{}',
  frequency_label TEXT NOT NULL DEFAULT 'Semanal',
  channel TEXT DEFAULT 'WhatsApp',
  rule_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Smart triggers
CREATE TABLE IF NOT EXISTS automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  condition_text TEXT NOT NULL,
  action_label TEXT NOT NULL,
  action_type TEXT DEFAULT 'alert',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_rls_questionnaires" ON questionnaires
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "tenant_rls_questionnaire_questions" ON questionnaire_questions
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "tenant_rls_plan_automations" ON plan_automations
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "tenant_rls_automation_triggers" ON automation_triggers
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant ON questionnaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_qid ON questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_plan_automations_tenant_plan ON plan_automations(tenant_id, plan_type);
CREATE INDEX IF NOT EXISTS idx_automation_triggers_tenant_plan ON automation_triggers(tenant_id, plan_type);
