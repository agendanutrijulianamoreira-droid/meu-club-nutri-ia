-- Release v1 production hardening.
-- Keep client-controlled auth metadata out of tenant, role and entitlement decisions.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_tenant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'paciente'), '@', 1),
    'Paciente'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = v_demo_tenant AND COALESCE(t.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Neutral onboarding tenant is not configured';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, name, email, role, current_plan)
  VALUES (NEW.id, v_demo_tenant, LEFT(v_name, 120), NEW.email, 'patient', 'community')
  ON CONFLICT (user_id) DO UPDATE
  SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
      email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

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
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(COALESCE(p.role, '')) INTO v_role
  FROM public.profiles p
  WHERE p.user_id = v_uid;

  IF v_role NOT IN ('admin', 'nutritionist', 'nutri') THEN
    RAISE EXCEPTION 'Professional authorization required' USING ERRCODE = '42501';
  END IF;

  IF length(BTRIM(COALESCE(p_brand_name, ''))) < 3 OR length(BTRIM(p_brand_name)) > 80 THEN
    RAISE EXCEPTION 'O nome da clínica deve ter entre 3 e 80 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = v_uid;

  IF v_tenant_id IS NOT NULL
     AND v_tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN v_tenant_id;
  END IF;

  v_slug := COALESCE(
    NULLIF(BTRIM(p_slug), ''),
    lower(regexp_replace(BTRIM(p_brand_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(v_uid::text, 1, 6)
  );

  INSERT INTO public.tenants (brand_name, slug, owner_id)
  VALUES (BTRIM(p_brand_name), LEFT(v_slug, 120), v_uid)
  RETURNING id INTO v_tenant_id;

  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      name = COALESCE(NULLIF(BTRIM(p_admin_name), ''), name),
      email = COALESCE(NULLIF(BTRIM(p_email), ''), email),
      role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE 'nutritionist' END
  WHERE user_id = v_uid;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic_and_profile(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_clinic_and_profile(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_self_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NOT NULL AND v_actor = OLD.user_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.current_plan IS DISTINCT FROM OLD.current_plan
       OR NEW.plan_started_at IS DISTINCT FROM OLD.plan_started_at
       OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
       OR NEW.nutri_coins IS DISTINCT FROM OLD.nutri_coins
       OR NEW.total_xp IS DISTINCT FROM OLD.total_xp
       OR NEW.current_level IS DISTINCT FROM OLD.current_level
    THEN
      RAISE EXCEPTION 'Protected profile fields cannot be changed by the account owner' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_security_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_security_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_self_security_fields();

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

DROP POLICY IF EXISTS profiles_user_insert ON public.profiles;
CREATE POLICY profiles_user_insert
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'patient'
  AND current_plan = 'community'
  AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DROP POLICY IF EXISTS profiles_user_update ON public.profiles;
CREATE POLICY profiles_user_update
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
