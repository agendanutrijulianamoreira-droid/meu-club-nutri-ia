-- ============================================
-- MEU CLUB NUTRI.AI - NUTRITIONISTS SCHEMA
-- Sistema de Cadastro de Nutricionistas
-- ============================================

-- Tabela de Nutricionistas (colaboradores dentro de um tenant)
CREATE TABLE nutritionists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relacionamento
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados Pessoais
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  
  -- Profissionais
  crn TEXT, -- Conselho Regional de Nutrição
  specialties TEXT[], -- Ex: ['esportiva', 'clinica', 'estetica']
  bio TEXT,
  
  -- Configurações de Comissão
  commission_enabled BOOLEAN DEFAULT false,
  commission_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (commission_rate >= 0 AND commission_rate <= 100), -- Ex: 10.00 = 10%
  referral_code TEXT UNIQUE, -- Código único para indicações
  
  -- Moderação
  is_moderator BOOLEAN DEFAULT false,
  moderator_permissions JSONB DEFAULT '[]', -- Ex: ["manage_patients", "approve_content", "manage_protocols"]
  
  -- Agenda
  calendar_enabled BOOLEAN DEFAULT false,
  calendar_settings JSONB DEFAULT '{
    "work_days": [1,2,3,4,5],
    "work_hours_start": "08:00",
    "work_hours_end": "18:00",
    "slot_duration_minutes": 60,
    "booking_advance_days": 30,
    "allow_same_day_booking": false
  }',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'nutritionist' CHECK (role IN ('nutritionist', 'moderator', 'admin'))
);

-- Índices para performance
CREATE INDEX idx_nutritionists_tenant ON nutritionists(tenant_id);
CREATE INDEX idx_nutritionists_user ON nutritionists(user_id);
CREATE INDEX idx_nutritionists_referral ON nutritionists(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_nutritionists_active ON nutritionists(is_active) WHERE is_active = true;

-- Trigger para atualizar updated_at
CREATE TRIGGER nutritionists_updated_at BEFORE UPDATE ON nutritionists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para gerar código de indicação único
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar código: primeiras 3 letras do nome + 4 números aleatórios
    code := UPPER(SUBSTRING(REPLACE(NEW.name, ' ', ''), 1, 3)) || 
            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM nutritionists WHERE referral_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar referral_code automaticamente ao inserir
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.commission_enabled = true AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nutritionists_set_referral_code BEFORE INSERT OR UPDATE ON nutritionists
  FOR EACH ROW EXECUTE FUNCTION set_referral_code();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE nutritionists ENABLE ROW LEVEL SECURITY;

-- Admin do tenant pode ver todos nutricionistas de seu tenant
CREATE POLICY "Tenant admins can view their nutritionists"
  ON nutritionists FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Nutricionista pode ver seu próprio perfil
CREATE POLICY "Nutritionists can view own profile"
  ON nutritionists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin do tenant pode inserir nutricionistas
CREATE POLICY "Tenant admins can insert nutritionists"
  ON nutritionists FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Admin do tenant pode atualizar seus nutricionistas
CREATE POLICY "Tenant admins can update nutritionists"
  ON nutritionists FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Nutricionista pode atualizar alguns campos de seu próprio perfil
CREATE POLICY "Nutritionists can update own profile"
  ON nutritionists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin do tenant pode deletar nutricionistas
CREATE POLICY "Tenant admins can delete nutritionists"
  ON nutritionists FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE nutritionists IS 'Nutricionistas colaboradores dentro de um tenant (clínica/marca)';
COMMENT ON COLUMN nutritionists.commission_enabled IS 'Se o nutricionista ganha comissão por indicações';
COMMENT ON COLUMN nutritionists.commission_rate IS 'Porcentagem de comissão (0-100)';
COMMENT ON COLUMN nutritionists.referral_code IS 'Código único para indicações (gerado automaticamente)';
COMMENT ON COLUMN nutritionists.is_moderator IS 'Se pode moderar conteúdo do sistema';
COMMENT ON COLUMN nutritionists.calendar_enabled IS 'Se disponibiliza agenda para consultas';
