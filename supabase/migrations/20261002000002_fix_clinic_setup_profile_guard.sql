-- O onboarding profissional é um fluxo SECURITY DEFINER autorizado.
-- A proteção de perfis não deve bloquear a promoção do perfil neutro para a clínica criada.

CREATE OR REPLACE FUNCTION public.create_clinic_and_profile(
  p_brand_name text,
  p_slug text DEFAULT NULL,
  p_admin_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  -- Escopo transacional: só este RPC pode atravessar a proteção do perfil.
  PERFORM set_config('app.internal_clinic_setup', 'on', true);

  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      name = COALESCE(NULLIF(BTRIM(p_admin_name), ''), name),
      email = COALESCE(NULLIF(BTRIM(p_email), ''), email),
      role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE 'nutritionist' END
  WHERE user_id = v_uid;

  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_self_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_internal_clinic_setup boolean :=
    COALESCE(current_setting('app.internal_clinic_setup', true), 'off') = 'on';
BEGIN
  IF v_actor IS NOT NULL AND v_actor = OLD.user_id AND NOT v_internal_clinic_setup THEN
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

REVOKE ALL ON FUNCTION public.create_clinic_and_profile(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile(text, text, text, text) TO authenticated, service_role;
