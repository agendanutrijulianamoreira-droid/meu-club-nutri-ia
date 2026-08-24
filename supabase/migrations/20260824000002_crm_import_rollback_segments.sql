-- Phase 3: safe set-based rollback and configurable recency segments.

ALTER TABLE public.crm_import_settings ADD COLUMN IF NOT EXISTS recent_days integer NOT NULL DEFAULT 90;
ALTER TABLE public.crm_import_settings ADD COLUMN IF NOT EXISTS warm_days integer NOT NULL DEFAULT 180;
ALTER TABLE public.crm_import_settings ADD COLUMN IF NOT EXISTS cold_days integer NOT NULL DEFAULT 365;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS recency_segment text;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS segment_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.refresh_crm_recency_segments(p_tenant_id uuid,p_reference_date date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_recent int:=90;v_warm int:=180;v_cold int:=365;v_count int;
BEGIN
  SELECT recent_days,warm_days,cold_days INTO v_recent,v_warm,v_cold FROM public.crm_import_settings WHERE tenant_id=p_tenant_id;
  v_recent:=COALESCE(v_recent,90);v_warm:=COALESCE(v_warm,180);v_cold:=COALESCE(v_cold,365);
  IF NOT (v_recent>=1 AND v_recent<v_warm AND v_warm<v_cold) THEN RAISE EXCEPTION 'Invalid CRM recency thresholds';END IF;
  UPDATE public.crm_contacts c SET recency_segment=CASE
    WHEN COALESCE(c.last_activity_at,c.last_consultation_at) IS NULL THEN 'unknown'
    WHEN p_reference_date-(COALESCE(c.last_activity_at,c.last_consultation_at) AT TIME ZONE 'America/Sao_Paulo')::date<=v_recent THEN 'recent'
    WHEN p_reference_date-(COALESCE(c.last_activity_at,c.last_consultation_at) AT TIME ZONE 'America/Sao_Paulo')::date<=v_warm THEN 'warm'
    WHEN p_reference_date-(COALESCE(c.last_activity_at,c.last_consultation_at) AT TIME ZONE 'America/Sao_Paulo')::date<=v_cold THEN 'cold'
    ELSE 'dormant' END,segment_updated_at=now()
  WHERE c.tenant_id=p_tenant_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.rollback_crm_import(p_import_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_tenant uuid;v_status text;v_deleted int:=0;v_restored int:=0;
BEGIN
  SELECT tenant_id,status INTO v_tenant,v_status FROM public.crm_imports WHERE id=p_import_id;
  IF v_tenant IS NULL OR v_status<>'imported' THEN RAISE EXCEPTION 'Import unavailable for rollback';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=v_tenant AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')) THEN RAISE EXCEPTION 'Forbidden';END IF;
  DELETE FROM public.crm_contacts c USING public.crm_import_rows r WHERE r.import_id=p_import_id AND r.tenant_id=v_tenant AND r.outcome='inserted' AND r.contact_id=c.id AND c.last_import_id=p_import_id AND c.tenant_id=v_tenant;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  UPDATE public.crm_contacts c SET
    name=r.before_snapshot->>'name',email=r.before_snapshot->>'email',phone=r.before_snapshot->>'phone',whatsapp=r.before_snapshot->>'whatsapp',external_id=r.before_snapshot->>'external_id',
    last_activity_at=NULLIF(r.before_snapshot->>'last_activity_at','')::timestamptz,last_consultation_at=NULLIF(r.before_snapshot->>'last_consultation_at','')::timestamptz,primary_goal=r.before_snapshot->>'primary_goal',
    email_normalized=r.before_snapshot->>'email_normalized',phone_normalized=r.before_snapshot->>'phone_normalized',source=COALESCE(r.before_snapshot->>'source',c.source),
    stage_id=NULLIF(r.before_snapshot->>'stage_id','')::uuid,metadata=COALESCE(r.before_snapshot->'metadata','{}'::jsonb),last_import_id=NULLIF(r.before_snapshot->>'last_import_id','')::uuid,updated_at=now()
  FROM public.crm_import_rows r WHERE r.import_id=p_import_id AND r.tenant_id=v_tenant AND r.outcome='updated' AND r.contact_id=c.id AND c.last_import_id=p_import_id AND c.tenant_id=v_tenant AND r.before_snapshot IS NOT NULL;
  GET DIAGNOSTICS v_restored=ROW_COUNT;
  UPDATE public.crm_imports SET status='rolled_back',rolled_back_at=now() WHERE id=p_import_id AND tenant_id=v_tenant;
  RETURN jsonb_build_object('deleted',v_deleted,'restored',v_restored);
END $$;

REVOKE ALL ON FUNCTION public.refresh_crm_recency_segments(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_crm_recency_segments(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.rollback_crm_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rollback_crm_import(uuid) TO authenticated;
