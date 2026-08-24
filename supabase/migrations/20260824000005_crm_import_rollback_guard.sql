-- If an imported contact is later linked/synced with the app, it has evolved beyond the import.
-- Clear last_import_id so an old rollback cannot delete or restore over current app data.

CREATE OR REPLACE FUNCTION public.sync_app_patients_to_crm(p_tenant_id uuid,p_reference_date date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inserted integer:=0;v_updated integer:=0;v_linked integer:=0;v_country text:='55';
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório';END IF;
  SELECT COALESCE(NULLIF(default_country_code,''),'55') INTO v_country FROM public.crm_import_settings WHERE tenant_id=p_tenant_id;
  v_country:=COALESCE(v_country,'55');
  PERFORM public.ensure_default_crm_stages(p_tenant_id);

  WITH latest_risk AS (
    SELECT DISTINCT ON (rs.user_id) rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date
    FROM public.patient_risk_scores rs WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date<=p_reference_date ORDER BY rs.user_id,rs.calculated_date DESC
  ), src0 AS (
    SELECT p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,
      lower(NULLIF(trim(p.email),'')) AS email_norm,regexp_replace(COALESCE(p.phone,''),'\D','','g') AS phone_digits,
      CASE WHEN lr.lifecycle_status='reactivation' THEN 'reactivation' WHEN lr.lifecycle_status='care_completed' THEN 'care_completed' WHEN lr.operational_status IN ('inactive','at_risk','oscillating') THEN 'attention' ELSE 'active_patient' END AS stage_code
    FROM public.profiles p LEFT JOIN latest_risk lr ON lr.user_id=p.user_id WHERE p.tenant_id=p_tenant_id AND lower(COALESCE(p.role,''))='patient'
  ), source_rows AS (
    SELECT s.*,CASE WHEN length(s.phone_digits) IN (10,11) THEN v_country||s.phone_digits ELSE NULLIF(s.phone_digits,'') END AS phone_norm FROM src0 s
  ), candidates AS (
    SELECT s.user_id,c.id,count(*) OVER(PARTITION BY s.user_id) AS matches
    FROM source_rows s JOIN public.crm_contacts c ON c.tenant_id=p_tenant_id AND c.linked_user_id IS NULL AND (
      (s.email_norm IS NOT NULL AND c.email_normalized=s.email_norm) OR (s.phone_norm IS NOT NULL AND c.phone_normalized=s.phone_norm)
    )
  ), linked AS (
    UPDATE public.crm_contacts c SET linked_user_id=x.user_id,last_import_id=NULL,metadata=COALESCE(c.metadata,'{}'::jsonb)||jsonb_build_object('linked_from','app'),updated_at=now()
    FROM candidates x WHERE x.matches=1 AND c.id=x.id RETURNING c.id
  ) SELECT count(*) INTO v_linked FROM linked;

  WITH latest_risk AS (
    SELECT DISTINCT ON (rs.user_id) rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date
    FROM public.patient_risk_scores rs WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date<=p_reference_date ORDER BY rs.user_id,rs.calculated_date DESC
  ), src0 AS (
    SELECT p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,
      lower(NULLIF(trim(p.email),'')) AS email_norm,regexp_replace(COALESCE(p.phone,''),'\D','','g') AS phone_digits,
      CASE WHEN lr.lifecycle_status='reactivation' THEN 'reactivation' WHEN lr.lifecycle_status='care_completed' THEN 'care_completed' WHEN lr.operational_status IN ('inactive','at_risk','oscillating') THEN 'attention' ELSE 'active_patient' END AS stage_code
    FROM public.profiles p LEFT JOIN latest_risk lr ON lr.user_id=p.user_id WHERE p.tenant_id=p_tenant_id AND lower(COALESCE(p.role,''))='patient'
  ), source_rows AS (
    SELECT s.*,CASE WHEN length(s.phone_digits) IN (10,11) THEN v_country||s.phone_digits ELSE NULLIF(s.phone_digits,'') END AS phone_norm FROM src0 s
  ), ins AS (
    INSERT INTO public.crm_contacts(tenant_id,linked_user_id,stage_id,source,name,email,phone,whatsapp,birth_date,primary_goal,last_activity_at,email_normalized,phone_normalized,metadata)
    SELECT p_tenant_id,s.user_id,st.id,'app',COALESCE(NULLIF(s.name,''),COALESCE(s.email,'Paciente')),s.email,s.phone,s.phone,s.birth_date,s.primary_goal,
      CASE WHEN s.last_activity_date IS NOT NULL THEN (s.last_activity_date::timestamp AT TIME ZONE 'America/Sao_Paulo') ELSE NULL END,s.email_norm,s.phone_norm,
      jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status)
    FROM source_rows s JOIN public.crm_stages st ON st.tenant_id=p_tenant_id AND st.code=s.stage_code
    WHERE NOT EXISTS(SELECT 1 FROM public.crm_contacts c WHERE c.tenant_id=p_tenant_id AND c.linked_user_id=s.user_id)
    RETURNING id
  ) SELECT count(*) INTO v_inserted FROM ins;

  WITH latest_risk AS (
    SELECT DISTINCT ON (rs.user_id) rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date
    FROM public.patient_risk_scores rs WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date<=p_reference_date ORDER BY rs.user_id,rs.calculated_date DESC
  ), src0 AS (
    SELECT p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,
      lower(NULLIF(trim(p.email),'')) AS email_norm,regexp_replace(COALESCE(p.phone,''),'\D','','g') AS phone_digits,
      CASE WHEN lr.lifecycle_status='reactivation' THEN 'reactivation' WHEN lr.lifecycle_status='care_completed' THEN 'care_completed' WHEN lr.operational_status IN ('inactive','at_risk','oscillating') THEN 'attention' ELSE 'active_patient' END AS stage_code
    FROM public.profiles p LEFT JOIN latest_risk lr ON lr.user_id=p.user_id WHERE p.tenant_id=p_tenant_id AND lower(COALESCE(p.role,''))='patient'
  ), source_rows AS (
    SELECT s.*,CASE WHEN length(s.phone_digits) IN (10,11) THEN v_country||s.phone_digits ELSE NULLIF(s.phone_digits,'') END AS phone_norm FROM src0 s
  ), upd AS (
    UPDATE public.crm_contacts c SET name=COALESCE(NULLIF(s.name,''),c.name),email=COALESCE(s.email,c.email),phone=COALESCE(s.phone,c.phone),whatsapp=COALESCE(s.phone,c.whatsapp),birth_date=COALESCE(s.birth_date,c.birth_date),primary_goal=COALESCE(s.primary_goal,c.primary_goal),email_normalized=COALESCE(s.email_norm,c.email_normalized),phone_normalized=COALESCE(s.phone_norm,c.phone_normalized),stage_id=CASE WHEN c.do_not_contact THEN c.stage_id ELSE st.id END,last_activity_at=CASE WHEN s.last_activity_date IS NOT NULL THEN (s.last_activity_date::timestamp AT TIME ZONE 'America/Sao_Paulo') ELSE c.last_activity_at END,last_import_id=NULL,metadata=COALESCE(c.metadata,'{}'::jsonb)||jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status),updated_at=now()
    FROM source_rows s JOIN public.crm_stages st ON st.tenant_id=p_tenant_id AND st.code=s.stage_code
    WHERE c.tenant_id=p_tenant_id AND c.linked_user_id=s.user_id RETURNING c.id
  ) SELECT count(*) INTO v_updated FROM upd;
  RETURN jsonb_build_object('inserted',v_inserted,'linked',v_linked,'updated',v_updated,'reference_date',p_reference_date);
END $$;

REVOKE ALL ON FUNCTION public.sync_app_patients_to_crm(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_app_patients_to_crm(uuid,date) TO service_role;
