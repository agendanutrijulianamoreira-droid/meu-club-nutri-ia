-- ==========================================================
-- REFINAMENTO DE RLS PARA CAMPANHAS (Equipe Completa)
-- ==========================================================

-- 1. Campanhas: Permitir que qualquer Admin ou Nutri do mesmo Tenant gerencie
DROP POLICY IF EXISTS "Admins manage tenant campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Team manages tenant campaigns" ON public.campaigns;
CREATE POLICY "Team manages tenant campaigns" ON public.campaigns
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.tenant_id = campaigns.tenant_id
            AND (profiles.role = 'admin' OR profiles.role = 'nutritionist')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.tenant_id = campaigns.tenant_id
            AND (profiles.role = 'admin' OR profiles.role = 'nutritionist')
        )
    );

-- 2. Destinatários: Permitir visualização por Admins/Nutricionistas do Tenant
DROP POLICY IF EXISTS "Admins view tenant recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Team manages tenant recipients" ON public.campaign_recipients;
CREATE POLICY "Team manages tenant recipients" ON public.campaign_recipients
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.tenant_id IN (
                SELECT tenant_id FROM public.campaigns WHERE id = campaign_recipients.campaign_id
            )
            AND (profiles.role = 'admin' OR profiles.role = 'nutritionist')
        )
    );

-- 3. Notificações: Inserção e Visualização para Equipe; Visualização e "Lido" para Paciente
DROP POLICY IF EXISTS "Admins view tenant notifications" ON public.notifications;
DROP POLICY IF EXISTS "Team manages tenant notifications" ON public.notifications;
CREATE POLICY "Team manages tenant notifications" ON public.notifications
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.tenant_id = notifications.tenant_id
            AND (profiles.role = 'admin' OR profiles.role = 'nutritionist')
        )
    );

DROP POLICY IF EXISTS "Users move own notifications as read" ON public.notifications;
DROP POLICY IF EXISTS "Users mark own notifications as read" ON public.notifications;
DROP POLICY IF EXISTS "Patients view and mark read own notifications" ON public.notifications;
CREATE POLICY "Patients view and mark read own notifications" ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
