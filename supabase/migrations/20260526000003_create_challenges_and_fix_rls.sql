-- ============================================================
-- 1. Criar tabela challenges (ausente no banco)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT DEFAULT '🏆',
  duration_days   INTEGER NOT NULL DEFAULT 7,
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN DEFAULT true,
  prize_pool_coins INTEGER DEFAULT 0,
  entry_fee_coins  INTEGER DEFAULT 0,
  max_participants INTEGER,
  rewards_json    JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY challenges_admin_all ON public.challenges
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY challenges_patient_select ON public.challenges
  FOR SELECT TO authenticated
  USING (
    is_active = true AND
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY challenges_service_role ON public.challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Criar tabela challenge_participants (ausente no banco)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'active',
  score        INTEGER DEFAULT 0,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_challenge_id ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_cp_user_id      ON public.challenge_participants(user_id);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Paciente gerencia própria participação
CREATE POLICY cp_patient_own ON public.challenge_participants
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Paciente vê todos participantes do mesmo desafio (ranking)
CREATE POLICY cp_patient_read_same ON public.challenge_participants
  FOR SELECT TO authenticated
  USING (
    challenge_id IN (
      SELECT c.id FROM challenges c
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin gerencia todos do seu tenant
CREATE POLICY cp_admin_all ON public.challenge_participants
  FOR ALL TO authenticated
  USING (
    challenge_id IN (
      SELECT id FROM challenges
      WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    challenge_id IN (
      SELECT id FROM challenges
      WHERE tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY cp_service_role ON public.challenge_participants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Corrigir tabela chats (0 políticas bloqueava tudo)
-- ============================================================
CREATE POLICY chats_service_role ON public.chats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Remover política duplicada em notifications
-- ============================================================
DROP POLICY IF EXISTS "Patients view own notifications" ON public.notifications;

-- ============================================================
-- 5. Renomear política de ai_generations para padrão de nomes
-- ============================================================
ALTER POLICY "Authenticated insert own tenant generations" ON public.ai_generations
  RENAME TO ai_generations_auth_insert;
