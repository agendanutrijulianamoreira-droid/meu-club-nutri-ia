-- Remove tabelas legadas sem nenhuma leitura/escrita confirmada no código de aplicação.
--
-- notifications: substituída por inbox_messages (ver 20260320_agent_infrastructure.sql).
--   Migração de dados já concluída antes desta mudança; zero ocorrências de
--   `.from('notifications')` em todo o repositório no momento desta migration.
--
-- rewards: a loja de recompensas real usa reward_items/reward_redemptions
--   (20260313000003_reward_store.sql). `rewards` só existia em SQL manual legado
--   (supabase/legacy-manual-sql/schema_community_rewards.sql), nunca aplicado
--   via migration numerada, e sem nenhum código de aplicação lendo/escrevendo.

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.rewards CASCADE;
