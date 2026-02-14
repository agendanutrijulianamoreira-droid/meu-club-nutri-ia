-- ============================================
-- MEU CLUB NUTRI.AI - COMMISSIONS SCHEMA
-- Sistema de Comissões e Indicações
-- ============================================

-- Tabela de Indicações
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Quem indicou (nutricionista)
  referrer_id UUID REFERENCES nutritionists(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  
  -- Quem foi indicado (paciente)
  referred_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  referred_email TEXT,
  
  -- Métricas
  converted BOOLEAN DEFAULT false, -- Se virou cliente pagante
  conversion_date TIMESTAMPTZ,
  plan_purchased TEXT, -- Qual plano foi comprado
  
  -- Metadata
  utm_source TEXT,
  utm_campaign TEXT,
  landing_page TEXT
);

-- Índices
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_converted ON referrals(converted) WHERE converted = true;

-- Tabela de Comissões
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relacionamentos
  nutritionist_id UUID REFERENCES nutritionists(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  
  -- Valores
  amount_brl DECIMAL(10,2) NOT NULL CHECK (amount_brl >= 0),
  commission_rate DECIMAL(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  base_value DECIMAL(10,2) NOT NULL CHECK (base_value >= 0), -- Valor da venda que gerou a comissão
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT, -- Ex: ID da transação PIX, transferência
  
  -- Metadata
  notes TEXT,
  cancelled_reason TEXT
);

-- Índices
CREATE INDEX idx_commissions_nutritionist ON commissions(nutritionist_id);
CREATE INDEX idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_created ON commissions(created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para calcular comissão automaticamente quando uma conversão ocorre
CREATE OR REPLACE FUNCTION calculate_commission_on_conversion()
RETURNS TRIGGER AS $$
DECLARE
  v_nutritionist RECORD;
  v_plan_value DECIMAL(10,2);
  v_commission_amount DECIMAL(10,2);
BEGIN
  -- Apenas processar se converteu agora (mudou de false para true)
  IF NEW.converted = true AND (OLD.converted IS NULL OR OLD.converted = false) THEN
    
    -- Buscar dados do nutricionista referenciador
    SELECT * INTO v_nutritionist 
    FROM nutritionists 
    WHERE id = NEW.referrer_id AND commission_enabled = true;
    
    IF FOUND THEN
      -- Definir valor base do plano (valores exemplo - ajustar conforme sua estratégia)
      v_plan_value := CASE NEW.plan_purchased
        WHEN 'community' THEN 0.00
        WHEN 'tech_diet' THEN 97.00
        WHEN 'vip' THEN 297.00
        ELSE 0.00
      END;
      
      -- Calcular comissão
      v_commission_amount := (v_plan_value * v_nutritionist.commission_rate) / 100;
      
      -- Criar registro de comissão (se houver valor)
      IF v_commission_amount > 0 THEN
        INSERT INTO commissions (
          nutritionist_id,
          tenant_id,
          referral_id,
          amount_brl,
          commission_rate,
          base_value,
          status
        ) VALUES (
          v_nutritionist.id,
          v_nutritionist.tenant_id,
          NEW.id,
          v_commission_amount,
          v_nutritionist.commission_rate,
          v_plan_value,
          'pending'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referrals_calculate_commission AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION calculate_commission_on_conversion();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- REFERRALS POLICIES --

-- Nutricionista vê apenas suas próprias indicações
CREATE POLICY "Nutritionists see own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (
    referrer_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

-- Admin do tenant vê todas indicações de seu tenant
CREATE POLICY "Tenant admins see all referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (
    referrer_id IN (
      SELECT n.id FROM nutritionists n
      JOIN tenants t ON n.tenant_id = t.id
      WHERE t.owner_id = auth.uid()
    )
  );

-- Qualquer autenticado pode inserir indicação (captura de leads)
CREATE POLICY "Authenticated can insert referrals"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Atualizar conversão (backend/Edge Function)
CREATE POLICY "System can update referrals"
  ON referrals FOR UPDATE
  TO authenticated
  USING (true);

-- COMMISSIONS POLICIES --

-- Nutricionista vê apenas suas próprias comissões
CREATE POLICY "Nutritionists see own commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    nutritionist_id IN (
      SELECT id FROM nutritionists WHERE user_id = auth.uid()
    )
  );

-- Admin do tenant vê todas comissões de seu tenant
CREATE POLICY "Tenant admins see all commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Sistema pode inserir comissões (via trigger)
CREATE POLICY "System can insert commissions"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin pode atualizar status de comissões
CREATE POLICY "Tenant admins can update commissions"
  ON commissions FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- Resumo de comissões por nutricionista
CREATE OR REPLACE VIEW nutritionist_commission_summary AS
SELECT 
  n.id as nutritionist_id,
  n.name as nutritionist_name,
  n.tenant_id,
  COUNT(DISTINCT r.id) as total_referrals,
  COUNT(DISTINCT CASE WHEN r.converted = true THEN r.id END) as converted_referrals,
  COUNT(DISTINCT c.id) as total_commissions,
  COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.amount_brl END), 0) as pending_amount,
  COALESCE(SUM(CASE WHEN c.status = 'approved' THEN c.amount_brl END), 0) as approved_amount,
  COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount_brl END), 0) as paid_amount,
  COALESCE(SUM(CASE WHEN c.status IN ('pending', 'approved', 'paid') THEN c.amount_brl END), 0) as total_earned
FROM nutritionists n
LEFT JOIN referrals r ON r.referrer_id = n.id
LEFT JOIN commissions c ON c.nutritionist_id = n.id
WHERE n.commission_enabled = true
GROUP BY n.id, n.name, n.tenant_id;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE referrals IS 'Registro de indicações feitas por nutricionistas';
COMMENT ON TABLE commissions IS 'Comissões ganhas por nutricionistas via indicações';
COMMENT ON COLUMN referrals.converted IS 'Se o lead indicado converteu em cliente pagante';
COMMENT ON COLUMN commissions.amount_brl IS 'Valor da comissão em reais';
COMMENT ON COLUMN commissions.base_value IS 'Valor da venda que gerou a comissão';
