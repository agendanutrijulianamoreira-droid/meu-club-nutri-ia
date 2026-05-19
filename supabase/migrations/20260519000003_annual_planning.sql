-- Annual plans generated via Q&A
CREATE TABLE IF NOT EXISTS annual_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'in_review' | 'active' | 'archived'

  -- Q&A answers (stored as JSONB for flexibility)
  questionnaire JSONB NOT NULL DEFAULT '{}',

  -- AI-generated plan structure
  plan_data JSONB, -- { months: [...], highlights: [...], themes: [...] }

  -- Metadata
  generated_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, year)
);

ALTER TABLE annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner manages annual plans"
  ON annual_plans FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Individual plan items that can be reviewed and approved
CREATE TABLE IF NOT EXISTS annual_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES annual_plans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,

  month INTEGER, -- 1-12, null = year-wide
  item_type TEXT NOT NULL, -- 'challenge' | 'protocol' | 'promotion' | 'content_theme' | 'push_campaign' | 'special_event'
  title TEXT NOT NULL,
  description TEXT,
  details JSONB, -- type-specific data

  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review' | 'approved' | 'edited' | 'rejected' | 'pushed'

  -- Owner edits
  edited_title TEXT,
  edited_description TEXT,
  owner_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE annual_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner manages plan items"
  ON annual_plan_items FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_annual_plan_items_plan ON annual_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_annual_plan_items_tenant ON annual_plan_items(tenant_id, status);

CREATE TRIGGER update_annual_plans_updated_at
  BEFORE UPDATE ON annual_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
