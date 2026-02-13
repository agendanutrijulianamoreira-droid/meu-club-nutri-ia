-- ==============================================
-- SEED: CRIAR USUÁRIO DE TESTE
-- ==============================================
-- Este script cria um usuário de teste para você poder fazer login
-- Execute no SQL Editor do Supabase Dashboard

-- IMPORTANTE: Você precisa criar o usuário no Authentication primeiro!
-- Vá em: Authentication → Users → Add User
-- Email: teste@meuclub.com
-- Password: senha123
-- ✅ Marque "Auto Confirm User"

-- Depois que criar o usuário, copie o UUID dele e cole abaixo:

-- Inserir perfil para o usuário de teste
INSERT INTO profiles (
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
) VALUES (
    'COLE_O_UUID_DO_USUARIO_AQUI', -- ⚠️ ALTERE ISSO!
    '00000000-0000-0000-0000-000000000001', -- tenant demo
    'Rainha Teste',
    'teste@meuclub.com',
    'vip', -- pode ser: 'community', 'tech_diet', ou 'vip'
    1000, -- moedas iniciais
    500, -- XP inicial
    3, -- level inicial
    5, -- streak atual (dias consecutivos)
    10, -- maior streak já atingido
    'Testar o sistema e ver a mágica acontecer! 🎉',
    '["vegetariano", "sem glúten"]'::jsonb
);

-- Criar um check-in de teste para hoje
INSERT INTO daily_logs (
    user_id,
    log_date,
    water_check,
    workout_check,
    sleep_check,
    meal_plan_check,
    daily_victory,
    coins_earned,
    xp_earned
) VALUES (
    'COLE_O_UUID_DO_USUARIO_AQUI', -- ⚠️ ALTERE ISSO!
    CURRENT_DATE,
    false, -- ainda não bebeu água
    false, -- ainda não treinou
    true, -- dormiu bem (exemplo)
    false, -- ainda não seguiu cardápio
    'Acordei cedo e motivada!',
    10, -- moedas ganhas por dormir bem
    10 -- XP ganho
);

-- Verificar se deu certo
SELECT 
    p.name,
    p.email,
    p.current_plan,
    p.nutri_coins,
    p.current_level,
    p.current_streak
FROM profiles p
WHERE p.email = 'teste@meuclub.com';

-- Se aparecer os dados, está tudo certo! ✅
