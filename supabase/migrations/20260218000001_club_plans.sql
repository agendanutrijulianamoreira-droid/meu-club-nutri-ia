-- Migration: Club Plans (AI-generated semester/annual plans)
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS public.club_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  plan_type text CHECK (plan_type IN ('semestral','anual')) NOT NULL,
  months jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.club_plans ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage their own club plans
DROP POLICY IF EXISTS "Admins manage own club plans" ON public.club_plans;
CREATE POLICY "Admins manage own club plans"
ON public.club_plans
FOR ALL
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);
