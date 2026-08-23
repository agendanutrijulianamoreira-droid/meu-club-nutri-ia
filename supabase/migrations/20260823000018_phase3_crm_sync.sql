CREATE OR REPLACE FUNCTION public.ensure_default_crm_stages(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_rows integer:=0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório'; END IF;
  INSERT INTO public.crm_stages(tenant_id,code,name,sort_order,category,is_system)
  VALUES
    (p_tenant_id,'new','Novo contato',10,'acquisition',true),
    (p_tenant_id,'active_patient','Paciente ativa',20,'active',true),
    (p_tenant_id,'attention','Precisa de atenção',30,'retention',true),
    (p_tenant_id,'reactivation','Reativação',40,'reactivation',true),
    (p_tenant_id,'care_completed','Acompanhamento concluído',50,'completed',true),
    (p_tenant_id,'do_not_contact','Não contatar',90,'blocked',true)
  ON CONFLICT(tenant_id,code) DO NOTHING;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.sync_app_patients_to_crm(
  p_tenant_id uuid,
  p_reference_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_inserted integer:=0; v_updated integer:=0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id é obrigatório'; END IF;
  PERFORM public.ensure_default_crm_stages(p_tenant_id);

  WITH latest_risk AS (
    SELECT DISTINCT ON (rs.user_id) rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date
    FROM public.patient_risk_scores rs
    WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date<=p_reference_date
    ORDER BY rs.user_id,rs.calculated_date DESC
  ), source_rows AS (
    SELECT p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,
      CASE WHEN lr.lifecycle_status='reactivation' THEN 'reactivation'
           WHEN lr.lifecycle_status='care_completed' THEN 'care_completed'
           WHEN lr.operational_status IN ('inactive','at_risk','oscillating') THEN 'attention'
           ELSE 'active_patient' END AS stage_code
    FROM public.profiles p LEFT JOIN latest_risk lr ON lr.user_id=p.user_id
    WHERE p.tenant_id=p_tenant_id AND lower(COALESCE(p.role,''))='patient'
  ), ins AS (
    INSERT INTO public.crm_contacts(tenant_id,linked_user_id,stage_id,source,name,email,phone,whatsapp,birth_date,primary_goal,last_activity_at,metadata)
    SELECT p_tenant_id,s.user_id,st.id,'app',COALESCE(NULLIF(s.name,''),COALESCE(s.email,'Paciente')),s.email,s.phone,s.phone,s.birth_date,s.primary_goal,
      CASE WHEN s.last_activity_date IS NOT NULL THEN (s.last_activity_date::timestamp AT TIME ZONE 'America/Sao_Paulo') ELSE NULL END,
      jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status)
    FROM source_rows s JOIN public.crm_stages st ON st.tenant_id=p_tenant_id AND st.code=s.stage_code
    WHERE NOT EXISTS (SELECT 1 FROM public.crm_contacts c WHERE c.tenant_id=p_tenant_id AND c.linked_user_id=s.user_id)
    RETURNING id
  ) SELECT count(*) INTO v_inserted FROM ins;

  WITH latest_risk AS (
    SELECT DISTINCT ON (rs.user_id) rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date
    FROM public.patient_risk_scores rs
    WHERE rs.tenant_id=p_tenant_id AND rs.calculated_date<=p_reference_date
    ORDER BY rs.user_id,rs.calculated_date DESC
  ), source_rows AS (
    SELECT p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,
      CASE WHEN lr.lifecycle_status='reactivation' THEN 'reactivation'
           WHEN lr.lifecycle_status='care_completed' THEN 'care_completed'
           WHEN lr.operational_status IN ('inactive','at_risk','oscillating') THEN 'attention'
           ELSE 'active_patient' END AS stage_code
    FROM public.profiles p LEFT JOIN latest_risk lr ON lr.user_id=p.user_id
    WHERE p.tenant_id=p_tenant_id AND lower(COALESCE(p.role,''))='patient'
  ), upd AS (
    UPDATE public.crm_contacts c SET
      name=COALESCE(NULLIF(s.name,''),c.name), email=COALESCE(s.email,c.email), phone=COALESCE(s.phone,c.phone), whatsapp=COALESCE(s.phone,c.whatsapp),
      birth_date=COALESCE(s.birth_date,c.birth_date), primary_goal=COALESCE(s.primary_goal,c.primary_goal),
      stage_id=CASE WHEN c.do_not_contact THEN c.stage_id ELSE st.id END,
      last_activity_at=CASE WHEN s.last_activity_date IS NOT NULL THEN (s.last_activity_date::timestamp AT TIME ZONE 'America/Sao_Paulo') ELSE c.last_activity_at END,
      metadata=COALESCE(c.metadata,'{}'::jsonb)||jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status), updated_at=now()
    FROM source_rows s JOIN public.crm_stages st ON st.tenant_id=p_tenant_id AND st.code=s.stage_code
    WHERE c.tenant_id=p_tenant_id AND c.linked_user_id=s.user_id
    RETURNING c.id
  ) SELECT count(*) INTO v_updated FROM upd;

  RETURN jsonb_build_object('inserted',v_inserted,'updated',v_updated,'reference_date',p_reference_date);
END $$;

REVOKE ALL ON FUNCTION public.ensure_default_crm_stages(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_app_patients_to_crm(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_crm_stages(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_app_patients_to_crm(uuid,date) TO service_role;
