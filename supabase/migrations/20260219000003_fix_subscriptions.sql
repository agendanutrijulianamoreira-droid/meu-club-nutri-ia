-- ============================================
-- FIX: Adicionar colunas faltantes à tabela subscriptions
-- (A tabela já existia sem as colunas de gateway)
-- ============================================

-- Colunas de gateway
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_checkout_session_id TEXT;

-- Colunas de período
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Metadata
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'brl';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Índices (safe com IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_sub ON subscriptions(gateway_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- UNIQUE constraint para permitir UPSERT no webhook
-- (PostgreSQL exige UNIQUE explícito para onConflict funcionar)
ALTER TABLE subscriptions
  ADD CONSTRAINT unique_user_tenant_subscription UNIQUE(user_id, tenant_id);

-- RLS (idempotent)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies (DROP + CREATE para ser idempotent)
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view tenant subscriptions" ON subscriptions;
CREATE POLICY "Admin can view tenant subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = subscriptions.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- ============================================
-- TRIGGER: Sync subscription → profiles.current_plan
-- ============================================
CREATE OR REPLACE FUNCTION sync_subscription_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE profiles
    SET 
      current_plan = NEW.plan,
      plan_started_at = NEW.current_period_start,
      plan_expires_at = NEW.current_period_end,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status IN ('cancelled', 'past_due') THEN
    UPDATE profiles
    SET 
      current_plan = 'community',
      plan_expires_at = NEW.current_period_end,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_change ON subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_to_profile();

-- ============================================
-- Tabela tenant_plans (configuração de preços)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('tech_diet', 'vip')),
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  description TEXT,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, plan)
);

ALTER TABLE tenant_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active plans" ON tenant_plans;
CREATE POLICY "Anyone can read active plans"
  ON tenant_plans FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin can manage own tenant plans" ON tenant_plans;
CREATE POLICY "Admin can manage own tenant plans"
  ON tenant_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = tenant_plans.tenant_id
        AND profiles.role = 'admin'
    )
  );

-- Adicionar colunas de plano ao profiles (se não existirem)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
