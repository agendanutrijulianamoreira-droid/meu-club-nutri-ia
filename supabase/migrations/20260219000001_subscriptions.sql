-- ============================================
-- SUBSCRIPTIONS TABLE
-- Registro de assinaturas processadas via gateway
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relações
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Plano
  plan TEXT NOT NULL DEFAULT 'community' CHECK (plan IN ('community', 'tech_diet', 'vip')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'cancelled', 'past_due', 'pending', 'trialing')),
  
  -- Gateway
  gateway TEXT NOT NULL DEFAULT 'stripe' CHECK (gateway IN ('stripe', 'mercadopago', 'asaas', 'manual')),
  gateway_subscription_id TEXT,
  gateway_customer_id TEXT,
  gateway_checkout_session_id TEXT,
  
  -- Período
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Metadata
  amount_cents INTEGER, -- valor em centavos
  currency TEXT DEFAULT 'brl',
  cancel_at_period_end BOOLEAN DEFAULT false
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_sub ON subscriptions(gateway_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Paciente pode ler a própria assinatura
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Admin pode ler todas do tenant
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

-- Apenas service role pode inserir/atualizar (via webhook)
-- (Sem policy de INSERT/UPDATE = apenas service role pode mutar)

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
-- Tabela de preços por tenant (configuração)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('tech_diet', 'vip')),
  price_cents INTEGER NOT NULL, -- ex: 9700 = R$97,00
  stripe_price_id TEXT, -- ID do preço no Stripe
  description TEXT,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, plan)
);

ALTER TABLE tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON tenant_plans FOR SELECT
  USING (is_active = true);

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
