-- =============================================
-- REFINAMENTO DE MULTI-TENANCY - EQUIPE & PARCEIROS
-- =============================================

-- 1. Adicionar tenant_id às tabelas
-- =============================================

ALTER TABLE public.professional_profiles 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_professional_tenant_id ON public.professional_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id ON public.sales(tenant_id);

-- 2. Limpar políticas antigas (hardcoded)
-- =============================================

DROP POLICY IF EXISTS "Admins gerenciam profissionais" ON public.professional_profiles;
DROP POLICY IF EXISTS "Profissional vê seu próprio perfil" ON public.professional_profiles;
DROP POLICY IF EXISTS "Pacientes veem profissionais ativos" ON public.professional_profiles;

DROP POLICY IF EXISTS "Admins veem todas vendas" ON public.sales;
DROP POLICY IF EXISTS "Profissional vê suas vendas" ON public.sales;
DROP POLICY IF EXISTS "Paciente vê suas compras" ON public.sales;

-- 3. Novas políticas seguras (Multi-Tenant)
-- =============================================

-- POLÍTICAS: professional_profiles

-- Admins da clínica podem gerenciar seus profissionais
CREATE POLICY "Admins gerenciam profissionais do tenant" 
ON public.professional_profiles 
FOR ALL 
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'nutritionist')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'nutritionist')
  )
);

-- Profissional vê seu próprio perfil
CREATE POLICY "Profissionais veem seu próprio perfil" 
ON public.professional_profiles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Pacientes veem profissionais do seu próprio tenant que estão ativos
CREATE POLICY "Pacientes veem profissionais do tenant" 
ON public.professional_profiles 
FOR SELECT 
TO authenticated
USING (
  status = 'active' 
  AND tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- POLÍTICAS: sales

-- Admins vêm vendas do seu tenant
CREATE POLICY "Admins veem vendas do tenant" 
ON public.sales 
FOR ALL 
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'nutritionist')
  )
);

-- Profissional vê apenas suas vendas
CREATE POLICY "Profissionais veem suas vendas" 
ON public.sales 
FOR SELECT 
TO authenticated
USING (professional_id = auth.uid());

-- Paciente vê suas compras
CREATE POLICY "Pacientes veem suas compras" 
ON public.sales 
FOR SELECT 
TO authenticated
USING (patient_id = auth.uid());

-- 4. Atualizar View (team_financial_summary) para incluir tenant_id
-- =============================================

DROP VIEW IF EXISTS team_financial_summary;
CREATE OR REPLACE VIEW team_financial_summary AS
SELECT 
  p.id,
  p.user_id,
  p.tenant_id,
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
GROUP BY p.id, p.user_id, p.tenant_id, prof.name, prof.email, p.commission_rate, p.total_sales, p.total_commission_earned;
