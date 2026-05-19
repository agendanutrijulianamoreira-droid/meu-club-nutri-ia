-- Gateway products: upsell/cross-sell offerings linked to the club
CREATE TABLE IF NOT EXISTS gateway_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  short_pitch TEXT, -- short sentence for patient cards (e.g. "Consulta personalizada 1:1")
  product_type TEXT NOT NULL DEFAULT 'custom', -- 'consultation' | 'program_90d' | 'genetic_test' | 'custom'
  price_label TEXT, -- display string, e.g. "R$ 297" or "A partir de R$97"
  cta_text TEXT NOT NULL DEFAULT 'Quero saber mais',
  external_url TEXT, -- destination URL when patient clicks
  badge_text TEXT, -- optional badge like "MAIS POPULAR" or "NOVO"
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'after_days' | 'after_checkins' | 'low_adherence' | 'high_engagement'
  trigger_value INTEGER, -- e.g. after_days=30 means show after 30 days in club
  visible_to_plans TEXT[] DEFAULT ARRAY['community', 'tech_diet'], -- plans that see this offer
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gateway_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owner manages gateway products"
  ON gateway_products FOR ALL
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE POLICY "Patients see active gateway products for their tenant"
  ON gateway_products FOR SELECT
  USING (
    is_active = true AND
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE INDEX idx_gateway_products_tenant ON gateway_products(tenant_id);
CREATE INDEX idx_gateway_products_active ON gateway_products(tenant_id, is_active) WHERE is_active = true;

-- Track when a patient clicked/viewed an offer (analytics + anti-spam)
CREATE TABLE IF NOT EXISTS gateway_product_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES gateway_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  interaction_type TEXT NOT NULL DEFAULT 'view', -- 'view' | 'click' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, user_id, interaction_type) -- one record per type per user
);

ALTER TABLE gateway_product_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own interactions"
  ON gateway_product_interactions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Tenant owner sees all interactions"
  ON gateway_product_interactions FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE TRIGGER update_gateway_products_updated_at
  BEFORE UPDATE ON gateway_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
