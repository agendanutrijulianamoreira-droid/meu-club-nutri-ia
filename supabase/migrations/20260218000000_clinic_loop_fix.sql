-- Migration: Clinic Onboarding Loop Fix (P0)
-- Date: 2026-02-18
-- Description: Fixes RLS for tenants, atomic RPC for onboarding, and adjusts auto-profile trigger for nutritionists.

-- 1. Fix RLS for Tenants: Allow members to view their own tenant
DROP POLICY IF EXISTS "Members can view tenant" ON public.tenants;
CREATE POLICY "Members can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT tenant_id 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  )
  OR owner_id = auth.uid()
);

-- 2. Refine handle_new_user trigger: Avoid demo tenant for Nutris/Admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Determine role based on metadata
  v_role := CASE 
    WHEN NEW.raw_user_meta_data->>'user_type' IN ('nutri', 'nutritionist') THEN 'nutritionist'
    WHEN NEW.raw_user_meta_data->>'user_type' = 'admin' THEN 'admin'
    ELSE 'patient'
  END;

  INSERT INTO public.profiles (
    user_id,
    tenant_id,
    name,
    email,
    role,
    current_plan,
    nutri_coins,
    total_xp,
    current_level,
    current_streak,
    longest_streak
  )
  VALUES (
    NEW.id,
    CASE 
      WHEN v_role IN ('nutritionist', 'admin') THEN NULL -- Allow onboarding to pick tenant
      ELSE '00000000-0000-0000-0000-000000000001' -- Demo for patients
    END,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role,
    CASE WHEN v_role IN ('nutritionist', 'admin') THEN 'professional' ELSE 'community' END,
    100,
    0,
    1,
    0,
    0
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Refine create_clinic_and_profile RPC (Atomic & Security Definer)
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

  -- Check if user already has an active tenant (ignoring demo)
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE user_id = v_uid;
  IF v_tenant_id IS NOT NULL AND v_tenant_id != '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN v_tenant_id;
  END IF;

  -- Generate slug
  v_slug := COALESCE(
    p_slug,
    lower(regexp_replace(p_brand_name, '[^a-z0-9]+', '-', 'g')) || '-' || substring(v_uid::text, 1, 6)
  );

  -- 1. Create Tenant (Atomic)
  INSERT INTO public.tenants (brand_name, slug, owner_id)
  VALUES (p_brand_name, v_slug, v_uid)
  RETURNING id INTO v_tenant_id;

  -- 2. Update/Insert Profile (Atomic)
  INSERT INTO public.profiles (user_id, tenant_id, name, email, role)
  VALUES (
    v_uid,
    v_tenant_id,
    COALESCE(p_admin_name, 'Admin'),
    p_email,
    'admin'
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
