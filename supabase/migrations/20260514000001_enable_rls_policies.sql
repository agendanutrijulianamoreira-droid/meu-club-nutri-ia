-- ============================================================
-- Migration: Enable RLS on all tables flagged by Supabase advisor
-- ============================================================

-- ─── 1. TABLES WITH EXISTING POLICIES: just enable RLS ──────

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
-- Existing "Public read" SELECT policies on these tables remain valid.

-- ─── 2. PROTOCOL_ASSIGNMENTS: replace test policies ─────────

ALTER TABLE public.protocol_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos (TESTE)" ON public.protocol_assignments;
DROP POLICY IF EXISTS "Admins gerenciam assignments" ON public.protocol_assignments;

-- Patients can see their own assignments
CREATE POLICY "patients_read_own_assignments"
  ON public.protocol_assignments FOR SELECT
  USING (user_id = auth.uid());

-- Admins/nutritionists can see and manage all assignments within their tenant
CREATE POLICY "admins_manage_tenant_assignments"
  ON public.protocol_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.protocols p
      JOIN public.profiles pr ON pr.tenant_id = p.tenant_id
      WHERE p.id = protocol_assignments.protocol_id
        AND pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'nutritionist')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.protocols p
      JOIN public.profiles pr ON pr.tenant_id = p.tenant_id
      WHERE p.id = protocol_assignments.protocol_id
        AND pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'nutritionist')
    )
  );

-- ─── 3. PROTOCOL_PROGRESS: replace test policy ──────────────

ALTER TABLE public.protocol_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para todos (TESTE)" ON public.protocol_progress;

-- Patients can manage their own progress (via their own assignments)
CREATE POLICY "patients_manage_own_progress"
  ON public.protocol_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.protocol_assignments pa
      WHERE pa.id = protocol_progress.assignment_id
        AND pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.protocol_assignments pa
      WHERE pa.id = protocol_progress.assignment_id
        AND pa.user_id = auth.uid()
    )
  );

-- Admins/nutritionists can read all progress in their tenant
CREATE POLICY "admins_read_tenant_progress"
  ON public.protocol_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.protocol_assignments pa
      JOIN public.protocols p ON p.id = pa.protocol_id
      JOIN public.profiles pr ON pr.tenant_id = p.tenant_id
      WHERE pa.id = protocol_progress.assignment_id
        AND pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'nutritionist')
    )
  );

-- ─── 4. PROTOCOL_DAYS & PROTOCOL_ITEMS ──────────────────────
-- Structure data: readable by any authenticated user.
-- Writes handled exclusively via service role (API routes).

ALTER TABLE public.protocol_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_protocol_days"
  ON public.protocol_days FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.protocol_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_protocol_items"
  ON public.protocol_items FOR SELECT
  TO authenticated
  USING (true);

-- ─── 5. USER DATA TABLES ────────────────────────────────────

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_stats"
  ON public.user_stats FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_user_progress"
  ON public.user_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_badges"
  ON public.user_badges FOR SELECT
  USING (user_id = auth.uid());
-- Badge grants are handled server-side via service role (bypasses RLS).

-- ─── 6. CONTENT_CALENDAR ────────────────────────────────────

ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read_content_calendar"
  ON public.content_calendar FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_manage_content_calendar"
  ON public.content_calendar FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND tenant_id = content_calendar.tenant_id
        AND role IN ('admin', 'nutritionist')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND tenant_id = content_calendar.tenant_id
        AND role IN ('admin', 'nutritionist')
    )
  );

-- ─── 7. CHAT_MESSAGES ───────────────────────────────────────

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_chat_messages"
  ON public.chat_messages FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 8. PATIENT_CHECKINS ────────────────────────────────────

ALTER TABLE public.patient_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_checkins"
  ON public.patient_checkins FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "patients_insert_own_checkins"
  ON public.patient_checkins FOR INSERT
  WITH CHECK (patient_id = auth.uid());

-- Admins/nutritionists can read all checkins for patients in their tenant
CREATE POLICY "admins_read_tenant_checkins"
  ON public.patient_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p_admin
      JOIN public.profiles p_patient
        ON p_patient.tenant_id = p_admin.tenant_id
      WHERE p_admin.user_id = auth.uid()
        AND p_admin.role IN ('admin', 'nutritionist')
        AND p_patient.user_id = patient_checkins.patient_id
    )
  );

-- ─── 9. LEGACY / SERVICE-ROLE-ONLY TABLES ───────────────────
-- These tables have no auth.uid() linkage.
-- Enabling RLS with no policies denies all JWT/anon access.
-- Access remains available to service role key (n8n, Edge Functions).

ALTER TABLE public.dados_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories_gerente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
