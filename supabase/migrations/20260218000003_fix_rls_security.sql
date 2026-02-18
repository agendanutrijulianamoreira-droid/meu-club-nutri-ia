-- ==========================================================
-- FIX RLS: club_plans (admin/nutri only) + notifications (paciente read-only)
-- ==========================================================

-- 1. club_plans: Restringir a admin/nutritionist/nutri SOMENTE
DROP POLICY IF EXISTS "Admins manage own club plans" ON public.club_plans;
CREATE POLICY "Admins manage own club plans" ON public.club_plans
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.tenant_id = club_plans.tenant_id
            AND profiles.role IN ('admin', 'nutritionist', 'nutri')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.tenant_id = club_plans.tenant_id
            AND profiles.role IN ('admin', 'nutritionist', 'nutri')
        )
    );

-- 2. notifications: Paciente só SELECT + UPDATE (marcar como lida), sem INSERT/DELETE
DROP POLICY IF EXISTS "Patients view and mark read own notifications" ON public.notifications;

-- 2a. Paciente pode VER suas notificações
CREATE POLICY "Patients view own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 2b. Paciente pode ATUALIZAR (marcar como lida) suas notificações
CREATE POLICY "Patients mark read own notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
