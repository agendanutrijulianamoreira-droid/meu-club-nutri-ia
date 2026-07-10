-- Fase 3 do roadmap: recompensas por posição no ranking dos desafios.
-- NÃO reaproveita challenges.rewards_json — esse campo já é usado pelo
-- builder de missões diárias (app/admin/desafios/builder/page.tsx), que
-- grava { days, feedPosts }. Um campo novo evita colidir com esse uso.
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS ranking_rewards JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.challenges.ranking_rewards IS
  'Lista de recompensas por posição final do ranking: [{ position, label, image_url }]';
