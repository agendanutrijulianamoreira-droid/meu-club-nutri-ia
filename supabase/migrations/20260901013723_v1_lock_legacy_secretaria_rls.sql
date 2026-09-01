-- P0 security hardening: legacy secretaria tables are not yet wired to the current tenant model.
-- Keep RLS enabled and fail closed until an explicit client->tenant authorization bridge exists.
-- Replays the production hardening outcome while safely no-oping on fresh databases where
-- these legacy tables were never created by the tracked migration history.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agendamentos',
    'alerts',
    'clients',
    'contatos',
    'ia_aprendizados',
    'invoices',
    'pacientes',
    'portal_messages',
    'servicos',
    'vendas'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        'secretaria_allow_auth',
        table_name
      );
    END IF;
  END LOOP;
END
$$;
