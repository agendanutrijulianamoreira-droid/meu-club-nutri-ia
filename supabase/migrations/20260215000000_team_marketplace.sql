-- =============================================
-- SISTEMA DE EQUIPE & PARCEIROS - MARKETPLACE
-- Meu Club Nutri.AI
-- =============================================

-- 1. Tabela de Perfis Profissionais
-- =============================================

CREATE TABLE IF NOT EXISTS public.professional_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(user_id) UNIQUE NOT NULL,
  
  -- Configurações de Negócio
  is_moderator BOOLEAN DEFAULT false,
  has_agenda BOOLEAN DEFAULT false,
  commission_rate DECIMAL(5,2) DEFAULT 10.00, -- % de comissão (ex: 10.00 = 10%)
  referral_code TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  
  -- Dados Bancários (para pagamento de comissões)
  pix_key TEXT,
  bank_account JSONB, -- {banco, agencia, conta, tipo}
  
  -- Métricas de Performance
  total_sales INTEGER DEFAULT 0,
  total_commission_earned DECIMAL(10,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_professional_referral_code ON public.professional_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_professional_user_id ON public.professional_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_status ON public.professional_profiles(status);

-- Comentários
COMMENT ON TABLE public.professional_profiles IS 'Perfis de nutricionistas e profissionais parceiros';
COMMENT ON COLUMN public.professional_profiles.commission_rate IS 'Percentual de comissão (0-100)';
COMMENT ON COLUMN public.professional_profiles.referral_code IS 'Código único para indicação de pacientes';

-- 2. Função para gerar código de referral automático
-- =============================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    -- Gera código único de 8 caracteres baseado no ID
    NEW.referral_code := UPPER(LEFT(REPLACE(CAST(NEW.id AS TEXT), '-', ''), 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON public.professional_profiles;
CREATE TRIGGER set_referral_code
BEFORE INSERT ON public.professional_profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- 3. Trigger para atualizar updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_professional_profiles_updated_at ON public.professional_profiles;
CREATE TRIGGER update_professional_profiles_updated_at
BEFORE UPDATE ON public.professional_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Tabela de Vendas (para rastreamento de comissões)
-- =============================================

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.profiles(user_id) NOT NULL,
  professional_id UUID REFERENCES public.professional_profiles(user_id),
  
  -- Dados da Venda
  plan_type TEXT NOT NULL CHECK (plan_type IN ('community', 'tech_diet', 'vip')),
  amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  
  -- Referral tracking
  referral_code TEXT,
  
  -- Status de Pagamento
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method TEXT, -- 'credit_card', 'pix', 'boleto'
  transaction_id TEXT,
  
  -- Comissão
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMPTZ,
  commission_payment_method TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_professional ON public.sales(professional_id);
CREATE INDEX IF NOT EXISTS idx_sales_patient ON public.sales(patient_id);
CREATE INDEX IF NOT EXISTS idx_sales_referral_code ON public.sales(referral_code);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- 5. Trigger para calcular comissão automaticamente
-- =============================================

CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.professional_id IS NOT NULL AND NEW.commission_rate IS NOT NULL THEN
    NEW.commission_amount := (NEW.amount * NEW.commission_rate / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_commission_amount ON public.sales;
CREATE TRIGGER set_commission_amount
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION calculate_commission();

-- 6. Trigger para atualizar métricas do profissional
-- =============================================

CREATE OR REPLACE FUNCTION update_professional_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    UPDATE public.professional_profiles
    SET 
      total_sales = total_sales + 1,
      total_commission_earned = total_commission_earned + NEW.commission_amount
    WHERE user_id = NEW.professional_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_metrics_on_sale ON public.sales;
CREATE TRIGGER update_metrics_on_sale
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION update_professional_metrics();

-- 7. RLS Policies
-- =============================================

ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policies para professional_profiles

-- Admins veem e gerenciam tudo
DROP POLICY IF EXISTS "Admins gerenciam profissionais" ON public.professional_profiles;
CREATE POLICY "Admins gerenciam profissionais" 
ON public.professional_profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.email = 'juliana@agendanutri.com' -- Ajuste para o email admin
  )
);

-- Profissional vê seu próprio perfil
DROP POLICY IF EXISTS "Profissional vê seu próprio perfil" ON public.professional_profiles;
CREATE POLICY "Profissional vê seu próprio perfil" 
ON public.professional_profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Pacientes podem ver profissionais ativos (para escolher)
DROP POLICY IF EXISTS "Pacientes veem profissionais ativos" ON public.professional_profiles;
CREATE POLICY "Pacientes veem profissionais ativos" 
ON public.professional_profiles 
FOR SELECT 
USING (status = 'active');

-- Policies para sales

-- Admins veem todas as vendas
DROP POLICY IF EXISTS "Admins veem todas vendas" ON public.sales;
CREATE POLICY "Admins veem todas vendas" 
ON public.sales 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.email = 'juliana@agendanutri.com'
  )
);

-- Profissional vê apenas suas vendas
DROP POLICY IF EXISTS "Profissional vê suas vendas" ON public.sales;
CREATE POLICY "Profissional vê suas vendas" 
ON public.sales 
FOR SELECT 
USING (professional_id = auth.uid());

-- Paciente vê suas compras
DROP POLICY IF EXISTS "Paciente vê suas compras" ON public.sales;
CREATE POLICY "Paciente vê suas compras" 
ON public.sales 
FOR SELECT 
USING (patient_id = auth.uid());

-- 8. View de Resumo Financeiro da Equipe
-- =============================================

CREATE OR REPLACE VIEW team_financial_summary AS
SELECT 
  p.id,
  p.user_id,
  prof.name,
  prof.email,
  p.commission_rate,
  p.total_sales,
  p.total_commission_earned,
  COUNT(s.id) FILTER (WHERE s.payment_status = 'paid') as paid_sales,
  COUNT(s.id) FILTER (WHERE s.payment_status = 'pending') as pending_sales,
  SUM(s.commission_amount) FILTER (WHERE s.payment_status = 'paid' AND NOT s.commission_paid) as pending_commission
FROM public.professional_profiles p
LEFT JOIN public.profiles prof ON prof.user_id = p.user_id
LEFT JOIN public.sales s ON s.professional_id = p.user_id
GROUP BY p.id, p.user_id, prof.name, prof.email, p.commission_rate, p.total_sales, p.total_commission_earned;

-- 9. Função auxiliar para buscar profissional por código
-- =============================================

CREATE OR REPLACE FUNCTION get_professional_by_referral(ref_code TEXT)
RETURNS UUID AS $$
DECLARE
  prof_id UUID;
BEGIN
  SELECT user_id INTO prof_id
  FROM public.professional_profiles
  WHERE referral_code = UPPER(ref_code) AND status = 'active';
  
  RETURN prof_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FIM DO SCRIPT
-- =============================================

-- Para testar, rode:
-- SELECT * FROM public.professional_profiles;
-- SELECT * FROM team_financial_summary;
