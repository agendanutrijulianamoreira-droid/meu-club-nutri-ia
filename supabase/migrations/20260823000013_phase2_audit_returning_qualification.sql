-- Fix ambiguity found by the post-migration audit tests in UPDATE ... FROM CTEs.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='sync_phase_review_tasks';
  v_def := replace(v_def,
    'AND a.target_user_id=e.user_id RETURNING id) SELECT count(*) INTO v_updated FROM changed;',
    'AND a.target_user_id=e.user_id RETURNING a.id) SELECT count(*) INTO v_updated FROM changed;');
  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='sync_checkin_feedback_tasks';
  v_def := replace(v_def,
    'AND (a.context_data->>''weekly_checkin_id'')::uuid=s.id RETURNING id) SELECT count(*) INTO v_updated FROM changed;',
    'AND (a.context_data->>''weekly_checkin_id'')::uuid=s.id RETURNING a.id) SELECT count(*) INTO v_updated FROM changed;');
  EXECUTE v_def;
END $$;

REVOKE ALL ON FUNCTION public.sync_phase_review_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_phase_review_tasks(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_checkin_feedback_tasks(uuid,date) TO service_role;
