-- Briefing e rascunhos gerados para a fundação do Clube.

CREATE TABLE IF NOT EXISTS public.club_content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post', 'challenge', 'protocol', 'announcement')),
  month_index integer NOT NULL CHECK (month_index BETWEEN 1 AND 6),
  week_index integer CHECK (week_index IS NULL OR week_index BETWEEN 1 AND 5),
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'archived')),
  scheduled_for date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_content_drafts_tenant_month
  ON public.club_content_drafts(tenant_id, month_index, kind, status);

ALTER TABLE public.club_content_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_content_drafts_read_tenant ON public.club_content_drafts;
CREATE POLICY club_content_drafts_read_tenant
  ON public.club_content_drafts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = club_content_drafts.tenant_id
  ));

DROP POLICY IF EXISTS club_content_drafts_manage_staff ON public.club_content_drafts;
CREATE POLICY club_content_drafts_manage_staff
  ON public.club_content_drafts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = club_content_drafts.tenant_id
      AND lower(coalesce(p.role, '')) IN ('admin', 'nutritionist', 'nutri')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = club_content_drafts.tenant_id
      AND lower(coalesce(p.role, '')) IN ('admin', 'nutritionist', 'nutri')
  ));
