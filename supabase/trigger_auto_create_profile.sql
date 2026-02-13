-- ==============================================
-- TRIGGER: AUTO-CRIAR PERFIL QUANDO USUÁRIO SE CADASTRA
-- ==============================================
-- Este trigger garante que quando um usuário é criado no auth.users,
-- automaticamente é criado um perfil correspondente na tabela profiles

-- 1. Criar função que insere perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insere novo perfil na tabela profiles
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
    primary_goal,
    dietary_restrictions
  )
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001', -- tenant demo padrão
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), -- nome do metadata ou email
    NEW.email,
    'community', -- plano inicial gratuito
    100, -- 100 NutriCoins de boas-vindas! 🎉
    0, -- XP inicial
    1, -- Level inicial
    0, -- Streak inicial
    0, -- Longest streak inicial
    NULL, -- Objetivo será definido depois
    '[]'::jsonb -- Sem restrições alimentares inicialmente
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Criar trigger que dispara a função acima
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Dar permissões necessárias
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

-- Verificar se o trigger foi criado
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Se aparecer 1 linha, está tudo certo! ✅
