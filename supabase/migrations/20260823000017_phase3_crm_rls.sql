DROP POLICY IF EXISTS "Staff manages crm stages" ON public.crm_stages;
CREATE POLICY "Staff manages crm stages" ON public.crm_stages
FOR ALL TO authenticated
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'))
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'));

DROP POLICY IF EXISTS "Staff manages crm contacts" ON public.crm_contacts;
CREATE POLICY "Staff manages crm contacts" ON public.crm_contacts
FOR ALL TO authenticated
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'))
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'));

DROP POLICY IF EXISTS "Staff manages crm events" ON public.crm_events;
CREATE POLICY "Staff manages crm events" ON public.crm_events
FOR ALL TO authenticated
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'))
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1)
  AND lower(COALESCE((SELECT p.role FROM public.profiles p WHERE p.user_id=auth.uid() LIMIT 1),'')) IN ('admin','nutritionist','nutri'));
