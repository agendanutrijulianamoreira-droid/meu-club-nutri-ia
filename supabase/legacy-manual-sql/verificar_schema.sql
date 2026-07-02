-- ============================================
-- SCRIPT DE VERIFICAÇÃO
-- Execute este script no Supabase SQL Editor
-- ============================================

-- 1. Verificar se as tabelas existem
SELECT 
    tablename,
    schemaname
FROM pg_tables 
WHERE tablename IN ('scheduled_events', 'content_templates')
ORDER BY tablename;

-- Resultado esperado:
-- Se as tabelas existem, verá 2 linhas
-- Se não existir nenhuma, verá 0 linhas


-- 2. Se as tabelas existem, verificar templates
SELECT COUNT(*) as total_templates 
FROM content_templates;

-- Resultado esperado: 10


-- 3. Verificar seu perfil (tenant_id)
SELECT 
    user_id,
    tenant_id,
    name,
    email
FROM profiles
WHERE user_id = auth.uid();

-- Resultado esperado:
-- Deve mostrar 1 linha com seu tenant_id
-- Se tenant_id for NULL, esse é o problema!


-- 4. Se tenant_id estiver NULL, corrigir:
-- (Descomente e execute se necessário)
/*
UPDATE profiles
SET tenant_id = (
    SELECT id FROM tenants 
    WHERE owner_id = auth.uid() 
    LIMIT 1
)
WHERE user_id = auth.uid()
AND tenant_id IS NULL;
*/
