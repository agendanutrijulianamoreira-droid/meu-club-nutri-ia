-- Juliana tinha 2 tenants com o mesmo owner_id: o sentinel demo
-- (00000000-0000-0000-0000-000000000001, criado em fev/26) e o tenant
-- real (criado em mai/26 via create_clinic_and_profile).
-- Isso fazia .single() nas rotas admin retornar erro PGRST116 (multiple rows),
-- impedindo que qualquer paciente aparecesse no painel.
-- O tenant demo está vazio (0 perfis, 0 protocolos, 0 subscriptions),
-- então é seguro remover o vínculo de owner.
UPDATE tenants
SET owner_id = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Subscription da paciente "Teste" que ficou faltando no cadastro
-- (o insert da subscription falhou silenciosamente antes do fix do updated_at).
INSERT INTO subscriptions (user_id, tenant_id, plan, status, gateway, updated_at)
SELECT
  '66cbd9e3-6c28-4b45-a709-c23000448038',
  '2949970e-57d1-4a6e-9d28-75ea65552db1',
  'community',
  'active',
  'manual',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE user_id = '66cbd9e3-6c28-4b45-a709-c23000448038'
);
