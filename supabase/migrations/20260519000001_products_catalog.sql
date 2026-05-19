-- ============================================================
-- BLOCO 1 — CATÁLOGO DE PRODUTOS
-- Porta de entrada: Consulta, Método 90 Dias, Teste Genético
-- ============================================================

-- 1. PRODUCTS — Produtos vendáveis do tenant
CREATE TABLE IF NOT EXISTS products (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identidade
  name            text NOT NULL,
  slug            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('consultation', 'method_90d', 'genetic_test', 'subscription', 'custom')),
  description     text,
  short_description text,

  -- Precificação
  price_cents     integer NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'brl',
  stripe_price_id text,
  payment_type    text NOT NULL DEFAULT 'one_time' CHECK (payment_type IN ('one_time', 'recurring')),
  recurring_interval text CHECK (recurring_interval IN ('month', 'year')),

  -- Conteúdo desbloqueado ao comprar
  content_access  jsonb NOT NULL DEFAULT '{
    "protocols": false,
    "meal_plans": false,
    "genetic_report": false,
    "consultation_booking": false,
    "community": false,
    "premium_recipes": false
  }',

  -- Apresentação
  features        jsonb NOT NULL DEFAULT '[]',
  badge_text      text,
  highlight       boolean DEFAULT false,
  image_url       text,

  -- Controle
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin manages own products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = products.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- 2. PATIENT_PRODUCTS — Acesso do paciente a cada produto
CREATE TABLE IF NOT EXISTS patient_products (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Origem da compra
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  gateway_payment_id text,
  amount_paid_cents integer,

  -- Status
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded', 'pending')),
  expires_at      timestamptz,
  granted_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),

  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_products_user ON patient_products(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_products_tenant ON patient_products(tenant_id);

ALTER TABLE patient_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product access"
  ON patient_products FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view tenant product access"
  ON patient_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = patient_products.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Apenas service role pode conceder acesso (via webhook)
-- INSERT/UPDATE sem policy pública = restrito ao service role

-- 3. Extend subscriptions to reference product
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();
