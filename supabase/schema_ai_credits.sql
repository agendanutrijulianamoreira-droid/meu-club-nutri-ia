-- ============================================
-- MEU CLUB NUTRI.AI - SCHEMA AI CREDITS
-- Sistema de Créditos de IA por Tenant
-- ============================================

-- ============================================
-- 1. AI_CREDITS (Saldo de créditos por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 5 CHECK (credits_remaining >= 0),
  credits_total_used INTEGER NOT NULL DEFAULT 0,
  monthly_limit INTEGER NOT NULL DEFAULT 5,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ai_credits_tenant ON ai_credits(tenant_id);

-- ============================================
-- 2. AI_CREDIT_TRANSACTIONS (Histórico)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,                -- negativo = consumo, positivo = recarga
  type TEXT NOT NULL CHECK (type IN ('consumption', 'monthly_refill', 'manual_add', 'bonus')),
  description TEXT,
  generation_type TEXT,                   -- 'protocol','challenge','persona','club_plan','club_setup'
  balance_after INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_tenant ON ai_credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_created ON ai_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_type ON ai_credit_transactions(type);

-- ============================================
-- 3. RLS (Row Level Security)
-- ============================================
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admins veem créditos do próprio tenant
CREATE POLICY "Admins see own credits" ON ai_credits
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "Admins update own credits" ON ai_credits
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "Service role manages credits" ON ai_credits
  FOR ALL TO service_role
  USING (true);

-- Admins veem transações do próprio tenant
CREATE POLICY "Admins see own transactions" ON ai_credit_transactions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY "Service role manages transactions" ON ai_credit_transactions
  FOR ALL TO service_role
  USING (true);

-- Authenticated users can insert credits (via server action)
CREATE POLICY "Authenticated can insert credits" ON ai_credits
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert transactions" ON ai_credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- 4. FUNCTION: consume_ai_credit (Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION consume_ai_credit(
  p_tenant_id UUID,
  p_generation_type TEXT DEFAULT 'protocol',
  p_description TEXT DEFAULT 'Geração de conteúdo IA'
)
RETURNS JSON AS $$
DECLARE
  v_credits_remaining INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock row for update (prevent race conditions)
  SELECT credits_remaining INTO v_credits_remaining
  FROM ai_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  -- Se não existir registro, criar com padrão
  IF v_credits_remaining IS NULL THEN
    INSERT INTO ai_credits (tenant_id, credits_remaining, monthly_limit)
    VALUES (p_tenant_id, 5, 5)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    SELECT credits_remaining INTO v_credits_remaining
    FROM ai_credits WHERE tenant_id = p_tenant_id;
  END IF;

  -- Verificar saldo
  IF v_credits_remaining <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Créditos de IA esgotados. Faça upgrade do plano ou aguarde a renovação mensal.',
      'credits_remaining', 0
    );
  END IF;

  -- Consumir 1 crédito
  v_new_balance := v_credits_remaining - 1;

  UPDATE ai_credits
  SET 
    credits_remaining = v_new_balance,
    credits_total_used = credits_total_used + 1,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Registrar transação
  INSERT INTO ai_credit_transactions (tenant_id, amount, type, description, generation_type, balance_after)
  VALUES (p_tenant_id, -1, 'consumption', p_description, p_generation_type, v_new_balance);

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. FUNCTION: refill_ai_credits
-- ============================================
CREATE OR REPLACE FUNCTION refill_ai_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'manual_add',
  p_description TEXT DEFAULT 'Recarga manual'
)
RETURNS JSON AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Upsert: criar se não existir
  INSERT INTO ai_credits (tenant_id, credits_remaining, monthly_limit)
  VALUES (p_tenant_id, p_amount, 5)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    credits_remaining = ai_credits.credits_remaining + p_amount,
    updated_at = NOW(),
    last_reset_at = CASE WHEN p_type = 'monthly_refill' THEN NOW() ELSE ai_credits.last_reset_at END;

  SELECT credits_remaining INTO v_new_balance
  FROM ai_credits WHERE tenant_id = p_tenant_id;

  -- Registrar transação
  INSERT INTO ai_credit_transactions (tenant_id, amount, type, description, balance_after)
  VALUES (p_tenant_id, p_amount, p_type, p_description, v_new_balance);

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. TRIGGER: updated_at automático
-- ============================================
CREATE TRIGGER ai_credits_updated_at BEFORE UPDATE ON ai_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 7. SEED: Créditos iniciais para tenant demo
-- ============================================
INSERT INTO ai_credits (tenant_id, credits_remaining, monthly_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 50, 50)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE ai_credits IS 'Saldo de créditos de IA por tenant (nutricionista)';
COMMENT ON TABLE ai_credit_transactions IS 'Histórico de consumo e recarga de créditos IA';
COMMENT ON FUNCTION consume_ai_credit IS 'Consome 1 crédito de IA atomicamente (com lock)';
COMMENT ON FUNCTION refill_ai_credits IS 'Adiciona créditos de IA (recarga manual ou mensal)';
