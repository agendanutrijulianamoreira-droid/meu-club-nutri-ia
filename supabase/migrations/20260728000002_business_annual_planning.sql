-- Planejamento anual do consultório (faturamento, estratégia mês a mês e
-- semana a semana para os planos Tech Diet/Premium e VIP), com distribuição
-- gradual dos itens aprovados para as tabelas reais do sistema (feito por um
-- agente do orchestrator, não aqui).
--
-- Substitui dois pares de tabelas órfãos de uma tentativa anterior abandonada
-- da mesma ideia — confirmado 100% vazios (zero linhas em produção) e sem
-- nenhuma referência em app/ ou lib/ nem FK de outra migration:
--   - annual_plans / annual_plan_items (20260519000003_annual_planning.sql):
--     tinha o ciclo de revisão certo (pending_review→approved/edited/rejected→
--     pushed) mas guardava os meses só como um blob `plan_data` jsonb solto.
--   - strategic_plans / strategic_plan_months (20260519000007_strategic_plans.sql):
--     tinha meses como linha de verdade, mas sem granularidade de semana e
--     sem ciclo de aprovação por item (campaigns/challenges eram jsonb solto).
-- O schema novo pega o melhor dos dois: meses e semanas como linhas de
-- verdade, e cada ação distribuível como uma linha revisável em
-- business_plan_items.
--
-- Nome "business_plan" (não "annual_plan") para não colidir com o literal
-- 'annual_plan' já usado em VALID_UPSELL_OFFERS (app/api/admin/patient-journey),
-- que é um conceito totalmente diferente (oferta de upsell pra uma paciente).

DROP TABLE IF EXISTS annual_plan_items CASCADE;
DROP TABLE IF EXISTS annual_plans CASCADE;
DROP TABLE IF EXISTS strategic_plan_months CASCADE;
DROP TABLE IF EXISTS strategic_plans CASCADE;

CREATE TABLE IF NOT EXISTS business_plans (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year              integer NOT NULL,
  title             text NOT NULL,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  revenue_goal_cents integer,
  questionnaire     jsonb NOT NULL DEFAULT '{}', -- respostas dela: meta, foco do ano, notas
  ai_summary        text,

  generated_at      timestamptz,
  activated_at      timestamptz,

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  UNIQUE(tenant_id, year)
);

CREATE TABLE IF NOT EXISTS business_plan_months (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id             uuid NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  month_number        integer NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  theme               text NOT NULL,
  focus_area          text,
  revenue_target_cents integer,
  new_members_target  integer,
  notes               text,

  created_at          timestamptz DEFAULT now(),

  UNIQUE(plan_id, month_number)
);

CREATE TABLE IF NOT EXISTS business_plan_weeks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id      uuid NOT NULL REFERENCES business_plan_months(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  week_number   integer NOT NULL CHECK (week_number BETWEEN 1 AND 5),
  theme         text NOT NULL,
  notes         text,

  created_at    timestamptz DEFAULT now(),

  UNIQUE(month_id, week_number)
);

CREATE TABLE IF NOT EXISTS business_plan_items (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id             uuid NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  month_id            uuid REFERENCES business_plan_months(id) ON DELETE CASCADE,
  week_id             uuid REFERENCES business_plan_weeks(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  club_tier           text NOT NULL DEFAULT 'both' CHECK (club_tier IN ('tech_diet', 'vip', 'both')),
  item_type           text NOT NULL CHECK (item_type IN (
    'challenge', 'protocol', 'content_post', 'push_campaign',
    'email_campaign', 'promotion', 'product_launch', 'special_event'
  )),
  title               text NOT NULL,
  description         text,
  details             jsonb NOT NULL DEFAULT '{}', -- dados específicos do tipo (ex: duration_days para challenge)
  linked_product_id   uuid REFERENCES products(id) ON DELETE SET NULL,

  status              text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'edited', 'rejected', 'scheduled', 'pushed'
  )),
  scheduled_for        date,

  -- Auditoria de distribuição automática (preenchido pelo agente do orchestrator)
  pushed_at            timestamptz,
  pushed_ref_table     text,
  pushed_ref_id        uuid,

  edited_title         text,
  edited_description   text,
  owner_notes          text,

  created_at           timestamptz DEFAULT now(),

  CHECK (month_id IS NOT NULL OR week_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_business_plan_months_plan ON business_plan_months(plan_id);
CREATE INDEX IF NOT EXISTS idx_business_plan_weeks_month ON business_plan_weeks(month_id);
CREATE INDEX IF NOT EXISTS idx_business_plan_items_plan ON business_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_business_plan_items_tenant_status ON business_plan_items(tenant_id, status);
-- Índice parcial casando exatamente com a query do motor de distribuição gradual
CREATE INDEX IF NOT EXISTS idx_business_plan_items_distribution
  ON business_plan_items(tenant_id, scheduled_for)
  WHERE status = 'approved' AND pushed_at IS NULL;

ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia planos de negócio"
  ON business_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = business_plans.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Admin gerencia meses do plano"
  ON business_plan_months FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = business_plan_months.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Admin gerencia semanas do plano"
  ON business_plan_weeks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = business_plan_weeks.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE POLICY "Admin gerencia itens do plano"
  ON business_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = business_plan_items.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

CREATE TRIGGER update_business_plans_updated_at
  BEFORE UPDATE ON business_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
