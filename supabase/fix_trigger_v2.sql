-- ==============================================
-- TRIGGER: AUTO-CRIAR PERFIL ROBUSTO
-- ==============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  -- 1. Extrair Tenant ID do Metadata ou usar default demo
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  
  -- Fallback se não vier no metadata (para signups diretos)
  IF v_tenant_id IS NULL THEN
    -- Tenta pegar o primeiro tenant disponível se o demo não existir
    SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  END IF;

  -- 2. Extrair Role
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role', 
    NEW.raw_user_meta_data->>'user_type',
    'patient'
  );

  -- 3. Inserir apenas se não existir (evita erros em fluxos duplos)
  INSERT INTO public.profiles (
    user_id,
    tenant_id,
    name,
    email,
    role,
    current_plan,
    nutri_coins,
    total_xp,
    current_level
  )
  VALUES (
    NEW.id,
    v_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'plan', 'community'),
    100, -- Bonus inicial
    0,
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
