-- ============================================================
-- Metas individuais da paciente (patient_goal_assignments)
-- ============================================================
-- `goals` (20260527000002) é só a biblioteca de templates por tenant, sem
-- nenhuma atribuição por paciente. Esta tabela guarda um snapshot da meta
-- no momento da atribuição (título/descrição/valor-alvo etc.) para que
-- editar o template depois não altere retroativamente a meta em andamento
-- da paciente — mesmo raciocínio de protocol_assignments vs protocols.

CREATE TABLE IF NOT EXISTS public.patient_goal_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  goal_id       UUID REFERENCES public.goals(id) ON DELETE SET NULL,
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
  current_value DECIMAL DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  completed_at  TIMESTAMPTZ
);

-- Diferente de protocol_assignments, uma paciente pode ter várias metas
-- ativas ao mesmo tempo (água + peso + exercício), então não há unique
-- constraint de "uma ativa por vez".

CREATE INDEX IF NOT EXISTS idx_pga_user ON public.patient_goal_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_pga_tenant ON public.patient_goal_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pga_goal ON public.patient_goal_assignments(goal_id);

ALTER TABLE public.patient_goal_assignments ENABLE ROW LEVEL SECURITY;

-- Admin/dona do tenant: full access (mesmo padrão de goals_admin_all)
CREATE POLICY pga_admin_all ON public.patient_goal_assignments
  FOR ALL TO authenticated
  USING  (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()));

-- Paciente: só leitura das próprias metas. Toda escrita (progresso, XP)
-- passa pelas API routes /api/patient/goals/*, que rodam no server — mesmo
-- racional do comentário em lib/services/gamification.ts (não escrever XP
-- direto do client).
CREATE POLICY pga_patient_select ON public.patient_goal_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY pga_service_role ON public.patient_goal_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
