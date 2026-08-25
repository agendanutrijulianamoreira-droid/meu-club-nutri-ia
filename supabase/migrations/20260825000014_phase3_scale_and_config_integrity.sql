create or replace function public.validate_crm_import_settings_links()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.default_stage_id is not null and not exists(
    select 1 from public.crm_stages s where s.id=new.default_stage_id and s.tenant_id=new.tenant_id
  ) then raise exception 'Etapa inicial pertence a outra clínica'; end if;
  return new;
end $$;
revoke all on function public.validate_crm_import_settings_links() from public,anon,authenticated;
drop trigger if exists trg_validate_crm_import_settings_links on public.crm_import_settings;
create trigger trg_validate_crm_import_settings_links before insert or update on public.crm_import_settings
for each row execute function public.validate_crm_import_settings_links();

create or replace function public.get_crm_dashboard_summary(p_tenant_id uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=p_tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  ) then raise exception 'Acesso negado'; end if;
  with totals as (
    select count(*)::int total,
      count(*) filter(where next_action_at is not null and next_action_at<now() and not do_not_contact)::int overdue,
      count(*) filter(where owner_user_id is null and not do_not_contact)::int unassigned
    from public.crm_contacts where tenant_id=p_tenant_id
  ), stages as (
    select coalesce(jsonb_agg(jsonb_build_object('stage_id',stage_id,'count',n)),'[]'::jsonb) data
    from (select stage_id,count(*)::int n from public.crm_contacts where tenant_id=p_tenant_id group by stage_id) x
  ), segments as (
    select coalesce(jsonb_agg(jsonb_build_object('segment',segment,'count',n)),'[]'::jsonb) data
    from (select coalesce(recency_segment,'') segment,count(*)::int n from public.crm_contacts where tenant_id=p_tenant_id group by coalesce(recency_segment,'')) x
  )
  select jsonb_build_object('total',t.total,'overdue',t.overdue,'unassigned',t.unassigned,'stages',s.data,'segments',g.data)
  into v_result from totals t cross join stages s cross join segments g;
  return coalesce(v_result,'{}'::jsonb);
end $$;
revoke all on function public.get_crm_dashboard_summary(uuid) from public,anon;
grant execute on function public.get_crm_dashboard_summary(uuid) to authenticated,service_role;
