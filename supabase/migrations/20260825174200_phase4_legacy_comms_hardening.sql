-- Fase 4 · Bloco 4.1 — hardening da central legada de comunicação
-- As tabelas abaixo estão vazias, sem referências no app atual e não são usadas
-- pelo motor transacional da agenda. Mantemos a estrutura por compatibilidade,
-- mas removemos exposição pela Data API para anon/authenticated.

begin;

alter table if exists public.disparos enable row level security;
alter table if exists public.tokens enable row level security;
alter table if exists public.whatsapp_numbers enable row level security;
alter table if exists public.campanhas enable row level security;
alter table if exists public.n8n_fluxos enable row level security;

drop policy if exists secretaria_allow_auth on public.tokens;
drop policy if exists secretaria_allow_auth on public.whatsapp_numbers;
drop policy if exists secretaria_allow_auth on public.campanhas;
drop policy if exists secretaria_allow_auth on public.n8n_fluxos;

revoke all privileges on table public.disparos from anon, authenticated;
revoke all privileges on table public.tokens from anon, authenticated;
revoke all privileges on table public.whatsapp_numbers from anon, authenticated;
revoke all privileges on table public.campanhas from anon, authenticated;
revoke all privileges on table public.n8n_fluxos from anon, authenticated;

-- Mantém acesso somente para operações server-side/administrativas privilegiadas.
grant select, insert, update, delete on table public.disparos to service_role;
grant select, insert, update, delete on table public.tokens to service_role;
grant select, insert, update, delete on table public.whatsapp_numbers to service_role;
grant select, insert, update, delete on table public.campanhas to service_role;
grant select, insert, update, delete on table public.n8n_fluxos to service_role;

comment on table public.disparos is 'LEGACY: estrutura antiga de disparos; isolada da Data API pública no hardening da Fase 4.';
comment on table public.tokens is 'LEGACY: estrutura antiga de tokens da central de comunicação; acesso restrito ao service role.';
comment on table public.whatsapp_numbers is 'LEGACY: estrutura antiga de números WhatsApp; acesso restrito ao service role.';
comment on table public.campanhas is 'LEGACY: estrutura antiga em português; não confundir com public.campaigns, usada pela central atual.';
comment on table public.n8n_fluxos is 'LEGACY: estrutura antiga de fluxos n8n; acesso restrito ao service role.';

commit;