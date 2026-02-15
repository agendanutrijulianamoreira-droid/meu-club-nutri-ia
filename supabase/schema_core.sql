-- ============================================
-- MEU CLUB NUTRI.AI - SCHEMA CORE
-- Versão: 2.0 - Focado em Lógica de Negócios
-- Multi-tenant + Gamificação + AI Integration
-- ============================================

-- Limpar schema anterior (cuidado em produção!)
DROP TABLE IF EXISTS ai_generations CASCADE;
DROP TABLE IF EXISTS daily_logs CASCADE;
DROP TABLE IF EXISTS protocol_blocks CASCADE;
DROP TABLE IF EXISTS protocol_days CASCADE;
DROP TABLE IF EXISTS protocols CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- ============================================
-- 1. TENANTS (Nutricionistas/White-label)
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Branding (White-label)
  brand_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#EC4899', -- Rosa padrão
  secondary_color TEXT DEFAULT '#8B5CF6', -- Roxo padrão
  
  -- Configurações GPT (Customização do tom da IA)
  gpt_system_prompt TEXT DEFAULT 'Você é uma nutricionista anti-bullshit. Seja direta, use alimentos acessíveis e foque na biologia, não em modismos.',
  gpt_temperature DECIMAL(2,1) DEFAULT 0.7,
  
  -- Owner
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'professional', 'premium'))
);

-- Índices
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);

-- ============================================
-- 2. PROFILES (Pacientes)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Auth
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados Básicos
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  
  -- Plano (Good-Better-Best)
  current_plan TEXT DEFAULT 'community' CHECK (current_plan IN ('community', 'tech_diet', 'vip')),
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  
  -- Gamificação
  nutri_coins INTEGER DEFAULT 0 CHECK (nutri_coins >= 0),
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  
  -- Onboarding Data
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 1,
  
  -- Dados de Saúde (Progressive Profiling)
  initial_weight DECIMAL(5,2),
  current_weight DECIMAL(5,2),
  height DECIMAL(5,2),
  birth_date DATE,
  gender TEXT CHECK (gender IN ('female', 'male', 'other', 'prefer_not_say')),
  
  -- Objetivo Principal
  primary_goal TEXT, -- Ex: "Desinchar pós-festas", "Emagrecer 10kg"
  goal_timeline_days INTEGER,
  
  -- Restrições Alimentares (JSON para flexibilidade)
  dietary_restrictions JSONB DEFAULT '[]', -- Ex: ["lactose", "gluten", "vegetarian"]
  
  -- Configurações
  settings JSONB DEFAULT '{
    "notifications_enabled": true,
    "daily_reminder_time": "08:00",
    "weekly_summary": true
  }',

  -- RBAC Role
  role TEXT DEFAULT 'patient' CHECK (role IN ('patient', 'nutritionist', 'admin'))
);

-- Índices
CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_profiles_plan ON profiles(current_plan);
CREATE INDEX idx_profiles_streak ON profiles(current_streak DESC);

-- ============================================
-- 3. DAILY_LOGS (O "Diário" Gamificado)
-- ============================================
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relações
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Check-ins Booleanos (Sistema de Não-Punição)
  water_check BOOLEAN DEFAULT false, -- Meta: 2L/dia
  workout_check BOOLEAN DEFAULT false,
  sleep_check BOOLEAN DEFAULT false, -- 7-9h
  meal_plan_check BOOLEAN DEFAULT false, -- Seguiu o cardápio
  
  -- Vitória do Dia (Gratidão/Positividade)
  daily_victory TEXT,
  
  -- Foto de Evidência
  proof_photo_url TEXT,
  
  -- Gamificação
  coins_earned INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  
  -- Apenas 1 log por dia por usuário
  UNIQUE(user_id, log_date)
);

-- Índices
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, log_date DESC);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date DESC);

-- ============================================
-- 4. PROTOCOLS (Protocolos Sazonais)
-- ============================================
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relação
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Meta Info
  title TEXT NOT NULL, -- Ex: "Protocolo Pós-Festas"
  description TEXT,
  emoji TEXT DEFAULT '🌿',
  category TEXT DEFAULT 'custom' CHECK (category IN ('detox', 'lowcarb', 'maintenance', 'challenge', 'seasonal', 'custom')),
  
  -- Duração
  duration_days INTEGER NOT NULL DEFAULT 7 CHECK (duration_days > 0),
  
  -- Conteúdo JSON (Array de Dias)
  -- Estrutura: [{ day: 1, title: "Dia 1", tasks: [{ time, type, description, points }] }]
  content JSONB NOT NULL DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false, -- Para marketplace futuro
  
  -- Gamificação
  total_points_available INTEGER DEFAULT 0
);

-- Índices
CREATE INDEX idx_protocols_tenant ON protocols(tenant_id);
CREATE INDEX idx_protocols_active ON protocols(is_active) WHERE is_active = true;
CREATE INDEX idx_protocols_category ON protocols(category);

-- ============================================
-- 5. AI_GENERATIONS (Logs do Magic AI Generator)
-- ============================================
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relações
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Input do Usuário
  prompt_text TEXT NOT NULL, -- Ex: "Cardápio detox 7 dias pós-festas"
  focus TEXT, -- Ex: "desinchar", "emagrecer"
  duration_days INTEGER,
  
  -- Dados do Perfil (snapshot no momento)
  user_profile_snapshot JSONB, -- Peso, restrições, objetivo
  
  -- Configuração GPT Usada
  gpt_model TEXT DEFAULT 'gpt-4o',
  gpt_temperature DECIMAL(2,1) DEFAULT 0.7,
  system_prompt_used TEXT,
  
  -- Output da IA (JSON do cardápio)
  generated_content JSONB NOT NULL,
  
  -- Métricas
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  cost_usd DECIMAL(8,6),
  
  -- Status
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  
  -- Foi salvo como protocolo?
  saved_as_protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_ai_gen_user ON ai_generations(user_id);
CREATE INDEX idx_ai_gen_tenant ON ai_generations(tenant_id);
CREATE INDEX idx_ai_gen_created ON ai_generations(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES - TENANTS
-- ============================================

-- Admin pode ver apenas seu próprio tenant
CREATE POLICY "Admins can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Admin pode atualizar seu tenant
CREATE POLICY "Admins can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================
-- POLICIES - PROFILES
-- ============================================

-- Usuários veem apenas o próprio perfil (evita recursão)
CREATE POLICY "Users see own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuários podem atualizar apenas próprio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin pode ver todos perfis de seu tenant
CREATE POLICY "Admins see all tenant profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES - DAILY_LOGS
-- ============================================

-- Usuários veem apenas próprios logs
CREATE POLICY "Users see own logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuários podem inserir próprios logs
CREATE POLICY "Users insert own logs"
  ON daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar próprios logs
CREATE POLICY "Users update own logs"
  ON daily_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin pode ver logs de pacientes do tenant
CREATE POLICY "Admins see tenant logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.user_id FROM profiles p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE t.owner_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES - PROTOCOLS
-- ============================================

-- Todos veem protocolos públicos
CREATE POLICY "Public protocols visible to all"
  ON protocols FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Usuários veem protocolos de seu tenant
CREATE POLICY "Users see tenant protocols"
  ON protocols FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin pode CRUD protocolos de seu tenant
CREATE POLICY "Admins manage tenant protocols"
  ON protocols FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES - AI_GENERATIONS
-- ============================================

-- Usuários veem apenas próprias gerações
CREATE POLICY "Users see own generations"
  ON ai_generations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin vê gerações de seu tenant
CREATE POLICY "Admins see tenant generations"
  ON ai_generations FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- Inserir gerações (via Edge Function)
CREATE POLICY "Authenticated can insert generations"
  ON ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Edge Function validará

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER protocols_updated_at BEFORE UPDATE ON protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Calcular Level automaticamente
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(xp / 500) + 1;
END;
$$ LANGUAGE plpgsql;

-- Atualizar gamificação após daily_log
CREATE OR REPLACE FUNCTION update_gamification_after_log()
RETURNS TRIGGER AS $$
DECLARE
  v_new_coins INTEGER;
  v_old_coins INTEGER;
  v_delta INTEGER;
BEGIN
  -- Calcular moedas do estado novo
  v_new_coins := (
    CASE WHEN NEW.water_check THEN 10 ELSE 0 END +
    CASE WHEN NEW.workout_check THEN 20 ELSE 0 END +
    CASE WHEN NEW.sleep_check THEN 10 ELSE 0 END +
    CASE WHEN NEW.meal_plan_check THEN 30 ELSE 0 END +
    CASE WHEN NEW.daily_victory IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN NEW.proof_photo_url IS NOT NULL THEN 10 ELSE 0 END
  );
  
  -- Calcular moedas do estado antigo (se existir)
  v_old_coins := 0;
  IF (TG_OP = 'UPDATE') THEN
    v_old_coins := (
      CASE WHEN OLD.water_check THEN 10 ELSE 0 END +
      CASE WHEN OLD.workout_check THEN 20 ELSE 0 END +
      CASE WHEN OLD.sleep_check THEN 10 ELSE 0 END +
      CASE WHEN OLD.meal_plan_check THEN 30 ELSE 0 END +
      CASE WHEN OLD.daily_victory IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN OLD.proof_photo_url IS NOT NULL THEN 10 ELSE 0 END
    );
  END IF;

  -- Delta a ser aplicado
  v_delta := v_new_coins - v_old_coins;
  
  -- Sincronizar campos de bônus no próprio log
  NEW.coins_earned := v_new_coins;
  NEW.xp_earned := v_new_coins;
  
  -- Atualizar perfil do usuário apenas se houver mudança
  IF (v_delta != 0 OR TG_OP = 'INSERT') THEN
    UPDATE profiles 
    SET 
      nutri_coins = GREATEST(0, nutri_coins + v_delta),
      total_xp = GREATEST(0, total_xp + v_delta),
      current_level = calculate_level(GREATEST(0, total_xp + v_delta)),
      last_checkin_date = NEW.log_date,
      -- Atualizar streak (lógica simplificada para MVP)
      current_streak = CASE 
        WHEN last_checkin_date = NEW.log_date - INTERVAL '1 day' THEN current_streak + 1
        WHEN last_checkin_date <= NEW.log_date - INTERVAL '2 days' THEN 1
        ELSE current_streak -- Mesmo dia ou futuro (proteção)
      END,
      longest_streak = GREATEST(longest_streak, current_streak)
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_log_gamification BEFORE INSERT OR UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_gamification_after_log();

-- ============================================
-- SEED INICIAL
-- ============================================

-- Tenant Demo (Dra. Nutri)
INSERT INTO tenants (id, brand_name, slug, owner_id, primary_color, secondary_color, gpt_system_prompt)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Clube Nutri.AI Demo',
  'demo',
  NULL, -- Ajustar após criar owner
  '#EC4899',
  '#8B5CF6',
  'Você é uma nutricionista anti-bullshit. Seja direta, use alimentos acessíveis e foque na biologia, não em modismos. Seja motivacional mas realista.'
);

-- Protocolo Exemplo: Detox Pós-Festas
INSERT INTO protocols (tenant_id, title, description, category, duration_days, is_active, content)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '🎉 Protocolo Pós-Festas (7 dias)',
  'Reset completo após excessos. Foco em desinchar, melhorar digestão e retomar energia.',
  'detox',
  7,
  true,
  '[
    {
      "day": 1,
      "title": "Dia 1: Reset Digestivo",
      "tasks": [
        {
          "time": "08:00",
          "type": "water",
          "description": "1L água morna com limão",
          "points": 10
        },
        {
          "time": "09:00",
          "type": "meal",
          "description": "Café: Ovo mexido + abacate + torrada integral",
          "points": 20
        },
        {
          "time": "12:00",
          "type": "meal",
          "description": "Almoço: Frango grelhado + salada verde + quinoa",
          "points": 30
        }
      ]
    },
    {
      "day": 2,
      "title": "Dia 2: Hidratação Máxima",
      "tasks": [
        {
          "time": "08:00",
          "type": "water",
          "description": "2L água ao longo do dia",
          "points": 20
        }
      ]
    }
  ]'::jsonb
);

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- Ranking de Pacientes por Tenant
CREATE OR REPLACE VIEW patient_ranking AS
SELECT 
  p.tenant_id,
  p.user_id,
  p.name,
  p.nutri_coins,
  p.total_xp,
  p.current_level,
  p.current_streak,
  p.avatar_url,
  RANK() OVER (PARTITION BY p.tenant_id ORDER BY p.total_xp DESC) as rank
FROM profiles p
WHERE p.current_plan IS NOT NULL
ORDER BY p.tenant_id, rank;

-- Resumo Diário por Tenant (Admin Dashboard)
CREATE OR REPLACE VIEW daily_summary AS
SELECT 
  t.id as tenant_id,
  t.brand_name,
  COUNT(DISTINCT p.user_id) as total_patients,
  COUNT(DISTINCT CASE WHEN dl.log_date = CURRENT_DATE THEN p.user_id END) as active_today,
  SUM(CASE WHEN dl.log_date = CURRENT_DATE THEN dl.coins_earned ELSE 0 END) as coins_distributed_today
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id
LEFT JOIN daily_logs dl ON dl.user_id = p.user_id
GROUP BY t.id, t.brand_name;

-- ============================================
-- COMENTÁRIOS FINAIS
-- ============================================

COMMENT ON TABLE tenants IS 'Nutricionistas/Clínicas (Multi-tenant root)';
COMMENT ON TABLE profiles IS 'Pacientes (Rainhas) com dados de gamificação';
COMMENT ON TABLE daily_logs IS 'Diário de check-ins com sistema de não-punição';
COMMENT ON TABLE protocols IS 'Protocolos sazonais com conteúdo JSON flexível';
COMMENT ON TABLE ai_generations IS 'Logs do Magic AI Generator para auditoria';

COMMENT ON COLUMN profiles.nutri_coins IS 'Moedas de gamificação (1 ação = 10-30 coins)';
COMMENT ON COLUMN profiles.current_plan IS 'Plano: community (grátis), tech_diet (intermediário), vip (premium)';
COMMENT ON COLUMN daily_logs.daily_victory IS 'Gratidão diária baseada em psicologia positiva';
COMMENT ON COLUMN tenants.gpt_system_prompt IS 'Customização do tom da IA por nutricionista';
