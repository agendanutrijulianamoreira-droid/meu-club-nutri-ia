# Scripts SQL legados

Estes arquivos foram usados para aplicar mudanças manualmente no SQL Editor do
Supabase antes (ou em paralelo) das migrations numeradas em `/supabase/migrations`.
Confirmado contra o schema real de produção (`antszuxeairmbctwuafo`) em 2026-07-02:

- `schema_appointments.sql` e `schema_nutritionists.sql` — as tabelas
  `nutritionists`/`appointments` em produção têm exatamente as colunas definidas
  em `migrations/20260625000001_appointments.sql`, não as destes arquivos.
  Superseded.
- `schema_community_rewards.sql` — as tabelas `posts`/`post_likes`/
  `post_comments` deste arquivo nunca existiram em produção (o feed social real
  é `community_posts`/`community_reactions`, criado por
  `migrations/20260313000001_community_feed.sql`). A tabela `rewards` deste
  arquivo existe em produção mas está órfã — nenhum código lê ou escreve nela
  hoje (o sistema de loja real é `reward_items`/`reward_redemptions`, de
  `migrations/20260313000003_reward_store.sql`).
- `schema_commissions.sql` — as tabelas `referrals`/`commissions` nunca
  existiram em produção. Nunca foi aplicado.
- `DEPLOY_SQL_COMPLETO.sql` e `PARTE2_CORRIGIDA.sql` — scripts de deploy
  consolidados, redundantes com as migrations numeradas.
- `fix_*.sql`, `add_recurrence_id.sql`, `trigger_auto_create_profile.sql` —
  patches pontuais já refletidos no schema de produção atual (confirmado:
  por exemplo, a coluna `scheduled_events.recurrence_id` de
  `add_recurrence_id.sql` já existe em produção).
- `seed_user_test.sql`, `verificar_schema.sql` — scripts de desenvolvimento/
  diagnóstico, não fazem parte do schema.

**Não execute nada nesta pasta.** Para qualquer mudança de schema nova, crie
uma migration em `/supabase/migrations` seguindo a Seção 11 do `CLAUDE.md`.

## Arquivos que ficaram fora desta pasta (ainda são referência ativa)

`schema_core.sql` e `schema_extended.sql` continuam sendo o schema principal
documentado no `CLAUDE.md`.

`schema_ai_credits.sql` e `schema_scheduled_events.sql` **não foram movidos**:
as tabelas `ai_credits`, `scheduled_events` e `content_templates` estão ativas
em produção e não têm nenhuma migration numerada equivalente — esses dois
arquivos são hoje a única documentação de como recriar essas tabelas do zero.
Ainda precisam ser convertidos em migrations de verdade (item pendente).
