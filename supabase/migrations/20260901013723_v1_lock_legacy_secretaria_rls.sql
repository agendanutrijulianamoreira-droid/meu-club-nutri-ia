-- P0 security hardening: legacy secretaria tables are not yet wired to the current tenant model.
-- Keep RLS enabled and fail closed until an explicit client->tenant authorization bridge exists.
-- This mirrors the production migration applied as 20260901013723_v1_lock_legacy_secretaria_rls.

DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.agendamentos;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.alerts;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.clients;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.contatos;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.ia_aprendizados;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.invoices;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.pacientes;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.portal_messages;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.servicos;
DROP POLICY IF EXISTS "secretaria_allow_auth" ON public.vendas;
