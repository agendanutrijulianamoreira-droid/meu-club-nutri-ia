-- ============================================================
-- BLOCO 7 — PLANEJAMENTO ANUAL COM IA
-- Permite ao admin gerar e salvar planos estratégicos anuais
-- ============================================================

CREATE TABLE IF NOT EXISTS strategic_plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  title       text NOT NULL,
  summary     text,
  goals       jsonb DEFAULT '[]',   -- [{goal, metric, target}]
  is_ai_generated boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE(tenant_id, year)
);

CREATE TABLE IF NOT EXISTS strategic_plan_months (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id         uuid NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month_number    integer NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  theme           text NOT NULL,
  focus_area      text,
  -- Ações planejadas
  campaigns       jsonb DEFAULT '[]',   -- [{title, channel, week}]
  challenges      jsonb DEFAULT '[]',   -- [{title, duration_days, xp_reward}]
  protocols       jsonb DEFAULT '[]',   -- [{title, category}]
  content_ideas   jsonb DEFAULT '[]',   -- [{title, type, platform}]
  -- Metas do mês
  target_checkins integer,
  target_new_members integer,
  notes           text,

  created_at  timestamptz DEFAULT now(),

  UNIQUE(plan_id, month_number)
);

CREATE INDEX IF NOT EXISTS idx_strategic_plans_tenant ON strategic_plans(tenant_id, year);
CREATE INDEX IF NOT EXISTS idx_strategic_plan_months_plan ON strategic_plan_months(plan_id);

ALTER TABLE strategic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_plan_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia planos estratégicos"
  ON strategic_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = strategic_plans.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Admin gerencia meses do plano"
  ON strategic_plan_months FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = strategic_plan_months.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );
