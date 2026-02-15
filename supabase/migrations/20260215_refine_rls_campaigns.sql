-- ==========================================================
-- REFINAMENTO DE RLS PARA CAMPANHAS (Permitir Nutris e Admins)
-- ==========================================================

-- 1. Campanhas: Permitir que qualquer Admin ou Nutri do mesmo Tenant gerencie
DROP POLICY IF EXISTS "Admins manage tenant campaigns" ON public.campaigns;
CREATE POLICY "Admins manage tenant campaigns" ON public.campaigns
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
CREATE POLICY "Admins view tenant recipients" ON public.campaign_recipients
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns c
            JOIN public.profiles p ON p.tenant_id = c.tenant_id
            WHERE c.id = campaign_recipients.campaign_id
            AND p.user_id = auth.uid()
            AND (p.role = 'admin' OR p.role = 'nutritionist')
        )
    );

-- 3. Notificações: Permitir visualização por Admins/Nutricionistas do Tenant
DROP POLICY IF EXISTS "Admins view tenant notifications" ON public.notifications;
CREATE POLICY "Admins view tenant notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.tenant_id = notifications.tenant_id
            AND (profiles.role = 'admin' OR profiles.role = 'nutritionist')
        )
    );
