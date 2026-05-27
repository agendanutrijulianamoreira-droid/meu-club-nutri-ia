-- ============================================================
-- 1. Add is_favorite to protocols
-- ============================================================
ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Create goals table (Metas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT DEFAULT '🎯',
  goal_type     TEXT DEFAULT 'habit'
    CHECK (goal_type IN ('weight', 'habit', 'nutrition', 'exercise', 'wellness', 'custom')),
  metric        TEXT,
  target_value  DECIMAL,
  unit          TEXT,
  deadline      DATE,
  is_active     BOOLEAN DEFAULT true,
  is_favorite   BOOLEAN DEFAULT false,
  content_json  JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_goals_tenant ON public.goals(tenant_id);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_admin_all ON public.goals
  FOR ALL TO authenticated
  USING  (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()));

CREATE POLICY goals_service_role ON public.goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
