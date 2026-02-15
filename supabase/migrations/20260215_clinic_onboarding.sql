-- Migration: Clinic Onboarding Flow
-- Date: 2026-02-15
-- Description: RPC for creating clinic + profile in one step and updated RLS for tenants.

-- 1. Ensure profiles table has the role column (safety for older schemas)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'patient' CHECK (role IN ('patient', 'nutritionist', 'admin'));
    END IF;
END $$;

-- 2. Create the RPC function with security definer
CREATE OR REPLACE FUNCTION public.create_clinic_and_profile(
  p_brand_name text,
  p_slug text DEFAULT NULL,
  p_admin_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_slug text;
BEGIN
  -- Security: Ensure user is authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validation: brand_name length 3-80
  IF length(p_brand_name) < 3 OR length(p_brand_name) > 80 THEN
    RAISE EXCEPTION 'O nome da clínica deve ter entre 3 e 80 caracteres.';
  END IF;

  -- Check if user already has a tenant_id in their profile
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE user_id = v_uid;
  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  -- Generate slug if not provided, ensuring uniqueness with UID suffix
  v_slug := COALESCE(
    p_slug,
    lower(regexp_replace(p_brand_name, '[^a-z0-9]+', '-', 'g')) || '-' || substring(v_uid::text, 1, 6)
  );

  -- Insert into tenants (INSERT policy is closed, but this is SECURITY DEFINER)
  INSERT INTO public.tenants (brand_name, slug, owner_id)
  VALUES (p_brand_name, v_slug, v_uid)
  RETURNING id INTO v_tenant_id;

  -- Insert/Update profile
  -- Today there might not be an INSERT policy on profiles either
  INSERT INTO public.profiles (user_id, tenant_id, name, email, role)
  VALUES (
    v_uid,
    v_tenant_id,
    COALESCE(p_admin_name, 'Admin'),
    p_email,
    'admin' -- Onboarding creator is always admin
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    tenant_id = EXCLUDED.tenant_id,
    name = COALESCE(EXCLUDED.name, profiles.name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    role = 'admin';

  RETURN v_tenant_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile TO authenticated;

-- 2. Refine Tenants RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if exists
DROP POLICY IF EXISTS "Admins can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Members can view tenant" ON public.tenants;

-- New SELECT policy: Owner or Member
CREATE POLICY "Members can view tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
);

-- UPDATE/DELETE: Only owner or admin of the tenant
DROP POLICY IF EXISTS "Owners can update own tenant" ON public.tenants;
CREATE POLICY "Owners and admins can update tenant"
ON public.tenants FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  owner_id = auth.uid() 
  OR id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Ensure INSERT is closed (except via SEC DEFINER or specific policies if needed)
-- (Supabase default is closed if no policy)
