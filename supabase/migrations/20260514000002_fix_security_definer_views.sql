-- Converter views de SECURITY DEFINER para SECURITY INVOKER.
-- Com SECURITY INVOKER, as views respeitam o RLS do usuário que faz a query,
-- em vez de executar com privilégios do owner da view.
ALTER VIEW public.daily_summary SET (security_invoker = true);
ALTER VIEW public.team_financial_summary SET (security_invoker = true);
ALTER VIEW public.patient_ranking SET (security_invoker = true);
