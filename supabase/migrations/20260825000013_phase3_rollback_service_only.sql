create or replace function public.rollback_crm_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_tenant uuid;v_status text;v_deleted int:=0;v_restored int:=0;v_skipped int:=0;
begin
  select tenant_id,status into v_tenant,v_status from public.crm_imports where id=p_import_id;
  if v_tenant is null or v_status<>'imported' then raise exception 'Import unavailable for rollback';end if;

  select count(*) into v_skipped
  from public.crm_import_rows r
  join public.crm_contacts c on c.id=r.contact_id and c.tenant_id=v_tenant
  where r.import_id=p_import_id and r.tenant_id=v_tenant and c.last_import_id=p_import_id
    and (
      exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz))
      or exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.occurred_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz))
    );

  delete from public.crm_contacts c using public.crm_import_rows r
  where r.import_id=p_import_id and r.tenant_id=v_tenant and r.outcome='inserted' and r.contact_id=c.id and c.last_import_id=p_import_id and c.tenant_id=v_tenant
    and not exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz))
    and not exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.occurred_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz));
  get diagnostics v_deleted=row_count;

  update public.crm_contacts c set
    name=r.before_snapshot->>'name',email=r.before_snapshot->>'email',phone=r.before_snapshot->>'phone',whatsapp=r.before_snapshot->>'whatsapp',external_id=r.before_snapshot->>'external_id',
    last_activity_at=nullif(r.before_snapshot->>'last_activity_at','')::timestamptz,last_consultation_at=nullif(r.before_snapshot->>'last_consultation_at','')::timestamptz,primary_goal=r.before_snapshot->>'primary_goal',
    email_normalized=r.before_snapshot->>'email_normalized',phone_normalized=r.before_snapshot->>'phone_normalized',source=coalesce(r.before_snapshot->>'source',c.source),
    stage_id=nullif(r.before_snapshot->>'stage_id','')::uuid,metadata=coalesce(r.before_snapshot->'metadata','{}'::jsonb),last_import_id=nullif(r.before_snapshot->>'last_import_id','')::uuid,updated_at=now()
  from public.crm_import_rows r
  where r.import_id=p_import_id and r.tenant_id=v_tenant and r.outcome='updated' and r.contact_id=c.id and c.last_import_id=p_import_id and c.tenant_id=v_tenant and r.before_snapshot is not null
    and not exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz))
    and not exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.occurred_at>coalesce((select imported_at from public.crm_imports where id=p_import_id),'-infinity'::timestamptz));
  get diagnostics v_restored=row_count;

  update public.crm_imports set status='rolled_back',rolled_back_at=now() where id=p_import_id and tenant_id=v_tenant;
  return jsonb_build_object('deleted',v_deleted,'restored',v_restored,'skipped_evolved',v_skipped);
end $$;
revoke all on function public.rollback_crm_import(uuid) from public,anon,authenticated;
grant execute on function public.rollback_crm_import(uuid) to service_role;
