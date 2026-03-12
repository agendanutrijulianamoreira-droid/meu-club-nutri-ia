-- ============================================
-- Check-ins Semanais (formulário da paciente)
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_checkin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  -- Respostas do formulário (JSONB flexível para perguntas dinâmicas)
  diet_score INTEGER CHECK (diet_score BETWEEN 0 AND 10),    -- 0-10
  main_difficulty TEXT,                                       -- texto livre
  bowel TEXT,                                                 -- Normal / Preso / Solto
  had_binge BOOLEAN DEFAULT false,                            -- compulsão?
  mood TEXT,                                                  -- Ótimo / Bom / Regular / Ruim
  extra_notes TEXT,                                           -- obs livres

  -- IA analisa e salva aqui
  ai_summary TEXT,
  ai_risk_level TEXT DEFAULT 'low' CHECK (ai_risk_level IN ('low', 'medium', 'high')),
  ai_suggestion TEXT,

  -- Bloquear duplicata na mesma semana
  week_start DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::DATE,
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_wcr_tenant ON weekly_checkin_responses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcr_user ON weekly_checkin_responses(user_id, created_at DESC);

-- RLS
ALTER TABLE weekly_checkin_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_own_checkin" ON weekly_checkin_responses
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "nutritionist_tenant_checkins" ON weekly_checkin_responses
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_id = auth.uid()
  ));
