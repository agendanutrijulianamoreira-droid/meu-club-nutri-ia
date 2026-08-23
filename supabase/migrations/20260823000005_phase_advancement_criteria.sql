-- Fase 2 — critérios editáveis de avanço de fase
-- O motor de acompanhamento lê esta configuração; não há critério clínico fixo escondido no código.

ALTER TABLE public.method_phases
  ADD COLUMN IF NOT EXISTS advancement_criteria jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', false,
    'mode', 'all',
    'min_days_in_phase', null,
    'min_adherence_7d', null,
    'require_weekly_checkin', false,
    'require_protocol_completion', false,
    'require_manual_approval', true,
    'custom_note', ''
  );

ALTER TABLE public.method_phases
  ADD CONSTRAINT method_phases_advancement_criteria_object
  CHECK (jsonb_typeof(advancement_criteria) = 'object') NOT VALID;

ALTER TABLE public.method_phases
  VALIDATE CONSTRAINT method_phases_advancement_criteria_object;

COMMENT ON COLUMN public.method_phases.advancement_criteria IS
'Critérios configuráveis no Admin para elegibilidade de avanço da fase. O motor apenas avalia esta configuração; decisão clínica final pode permanecer manual.';
