-- ============================================
-- FIX: Infinite Recursion in Profiles RLS
-- ============================================

-- 1. Remover a política recursiva
DROP POLICY IF EXISTS "Users see profiles from same tenant" ON profiles;

-- 2. Criar política segura: Usuários veem apenas o próprio perfil
-- (Isso evita recursão porque não faz sub-select na própria tabela)
CREATE POLICY "Users see own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Garantir que a política de Admin continue funcionando
-- (Esta já é segura pois consulta a tabela 'tenants')
-- DROP POLICY IF EXISTS "Admins see all tenant profiles" ON profiles;
-- CREATE POLICY "Admins see all tenant profiles"
--   ON profiles FOR SELECT
--   TO authenticated
--   USING (
--     tenant_id IN (
--       SELECT id FROM tenants WHERE owner_id = auth.uid()
--     )
--   );

-- 4. Notar que o Admin também verá seu próprio perfil pela regra #2
-- se o user_id dele estiver na tabela profiles.
