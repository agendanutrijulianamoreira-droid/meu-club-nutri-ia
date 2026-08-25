-- Configurable CRM recency segmentation + tighter import audit policies.

create table if not exists public.crm_recency_rules(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 code text not null,
 name text not null,
 max_days integer check(max_days is null or max_days>=0),
 is_no_date boolean not null default false,
 sort_order integer not null default 100,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,code)
);
alter table public.crm_recency_rules enable row level security;
create policy "Staff reads CRM recency rules" on public.crm_recency_rules for select to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_recency_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
create policy "Staff manages CRM recency rules" on public.crm_recency_rules for all to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_recency_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri'))) with check(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_recency_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));

create or replace function public.ensure_default_crm_recency_rules(p_tenant_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare n int:=0;
begin
 insert into public.crm_recency_rules(tenant_id,code,name,max_days,is_no_date,sort_order) values
 (p_tenant_id,'recent','Recente',90,false,10),(p_tenant_id,'warm','Morna',180,false,20),(p_tenant_id,'cold','Fria',365,false,30),(p_tenant_id,'dormant','Adormecida',null,false,40),(p_tenant_id,'unknown','Sem data',null,true,90)
 on conflict(tenant_id,code) do nothing;get diagnostics n=row_count;return n;
end$$;
revoke all on function public.ensure_default_crm_recency_rules(uuid) from public,anon,authenticated;grant execute on function public.ensure_default_crm_recency_rules(uuid) to service_role;
select public.ensure_default_crm_recency_rules(id) from public.tenants;

create or replace function public.refresh_crm_recency_segments(p_tenant_id uuid,p_reference_date date default(now()at time zone'America/Sao_Paulo')::date) returns integer language plpgsql security definer set search_path=public as $$
declare n int;
begin
 perform public.ensure_default_crm_recency_rules(p_tenant_id);
 update public.crm_contacts c set recency_segment=case when greatest(c.last_activity_at,c.last_consultation_at)is null then(select r.code from public.crm_recency_rules r where r.tenant_id=p_tenant_id and r.active and r.is_no_date order by r.sort_order limit 1) else(select r.code from public.crm_recency_rules r where r.tenant_id=p_tenant_id and r.active and not r.is_no_date and(r.max_days is null or p_reference_date-(greatest(c.last_activity_at,c.last_consultation_at)at time zone'America/Sao_Paulo')::date<=r.max_days) order by case when r.max_days is null then 1 else 0 end,r.max_days,r.sort_order limit 1) end,segment_updated_at=now() where c.tenant_id=p_tenant_id;
 get diagnostics n=row_count;return n;
end$$;
revoke all on function public.refresh_crm_recency_segments(uuid,date) from public,anon,authenticated;grant execute on function public.refresh_crm_recency_segments(uuid,date) to service_role;

-- Import audit rows are append-only to staff; batches cannot be deleted directly.
drop policy if exists "Staff manages CRM import rows" on public.crm_import_rows;
create policy "Staff reads CRM import rows" on public.crm_import_rows for select to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_import_rows.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
create policy "Staff inserts CRM import rows" on public.crm_import_rows for insert to authenticated with check(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_import_rows.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));

drop policy if exists "Staff manages CRM imports" on public.crm_imports;
create policy "Staff reads CRM imports" on public.crm_imports for select to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_imports.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
create policy "Staff inserts CRM imports" on public.crm_imports for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_imports.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
create policy "Staff updates own active CRM imports" on public.crm_imports for update to authenticated using(created_by=(select auth.uid()) and status in('preview','imported') and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_imports.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri'))) with check(created_by=(select auth.uid()) and status in('preview','imported','failed','rolled_back') and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_imports.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
