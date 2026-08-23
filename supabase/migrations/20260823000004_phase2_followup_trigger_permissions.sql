-- Fase 2 — hardening do histórico de acompanhamento.
-- A função abaixo é apenas trigger interno e não deve ser chamável via PostgREST RPC.

REVOKE ALL ON FUNCTION public.log_phase2_followup_action_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_phase2_followup_action_change() FROM anon;
REVOKE ALL ON FUNCTION public.log_phase2_followup_action_change() FROM authenticated;
