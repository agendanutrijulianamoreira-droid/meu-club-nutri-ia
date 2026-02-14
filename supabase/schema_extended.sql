-- ============================================
-- MEU CLUB NUTRI.AI - SCHEMA EXTENDED (Option B)
-- ============================================

-- 1. PROTOCOL_ASSIGNMENTS (Vínculo entre Paciente e Protocolo)
CREATE TABLE protocol_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  
  -- Um paciente só pode ter um protocolo ativo por vez (regra de negócio opcional)
  UNIQUE(user_id, status) WHERE (status = 'active')
);

-- 2. PROTOCOL_PROGRESS (Log granular de conclusão por item)
CREATE TABLE protocol_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  assignment_id UUID REFERENCES protocol_assignments(id) ON DELETE CASCADE NOT NULL,
  protocol_item_id UUID NOT NULL, -- Referência ao item do protocolo
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  points_earned INTEGER DEFAULT 10,
  
  UNIQUE(assignment_id, protocol_item_id)
);

-- 2.1 RPC: Incrementar pontos do usuário
CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET 
    nutri_coins = nutri_coins + points_to_add,
    total_xp = total_xp + points_to_add,
    current_level = calculate_level(total_xp + points_to_add)
  WHERE profiles.user_id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CHALLENGES (Desafios em grupo)
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  
  max_participants INTEGER,
  entry_fee_coins INTEGER DEFAULT 0,
  prize_pool_coins INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'finished'))
);

-- 4. CHALLENGE_PARTICIPANTS
CREATE TABLE challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  
  current_score INTEGER DEFAULT 0,
  rank INTEGER,
  
  UNIQUE(challenge_id, user_id)
);

-- Habilitar RLS
ALTER TABLE protocol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Exemplo de Policy para protocol_assignments
CREATE POLICY "Users see own assignments" ON protocol_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage tenant assignments" ON protocol_assignments
  FOR ALL TO authenticated USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Índices
CREATE INDEX idx_pa_user ON protocol_assignments(user_id);
CREATE INDEX idx_pa_protocol ON protocol_assignments(protocol_id);
CREATE INDEX idx_challenges_tenant ON challenges(tenant_id);
