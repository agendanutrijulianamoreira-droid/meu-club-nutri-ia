-- ==============================================
-- TRIGGER: AUTO-CRIAR PERFIL QUANDO USUÁRIO SE CADASTRA
-- ==============================================

-- 1. Criar função que insere perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    tenant_id,
    name,
    email,
    current_plan,
    nutri_coins,
    total_xp,
    current_level,
    current_streak,
    longest_streak,
    role
  )
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001', -- tenant demo padrão
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'community',
    100,
    0,
    1,
    0,
    0,
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' IN ('nutri', 'nutritionist') THEN 'nutritionist'
      WHEN NEW.raw_user_meta_data->>'user_type' = 'admin' THEN 'admin'
      ELSE 'patient'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
