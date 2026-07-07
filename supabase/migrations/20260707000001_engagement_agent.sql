-- Agente de Engajamento (Fase 2 do roadmap): comentários automáticos da IA em posts
-- da comunidade. Reaproveita a tabela de comentários já existente (comentarios_comunidade)
-- em vez de criar uma tabela nova — só precisa de um marcador para diferenciar
-- visualmente comentário gerado por IA de comentário escrito por paciente.
ALTER TABLE comentarios_comunidade ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT false;

-- Mesmo marcador em community_posts: usado pelo agent-orchestrator (runCommunityAgent) para
-- identificar seus próprios posts diários sem depender de string-matching em "[IA]" no corpo
-- do texto (mecanismo antigo, frágil e além disso já quebrado — ver nota abaixo).
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT false;

-- Nota: ao implementar esta fase, foi descoberto que runCommunityAgent e
-- runCommunityModerationAgent (supabase/functions/agent-orchestrator/index.ts) referenciavam
-- uma tabela "posts" com coluna "content" que nunca existiram em produção (a tabela real é
-- community_posts, coluna "body") — essas duas funções falhavam 100% das execuções. Corrigido
-- junto nesta mesma mudança, já que o Agente de Engajamento roda no mesmo evento (post_created)
-- e teria ficado ao lado de um agente irmão sabidamente quebrado.
