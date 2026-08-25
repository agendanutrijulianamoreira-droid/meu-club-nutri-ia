alter table public.crm_outcome_types
  add column if not exists counts_as_response boolean not null default false;

update public.crm_outcome_types
set counts_as_response = case
  when code in ('replied','followup_requested','appointment_booked','protocol_purchased') then true
  else false
end
where code in ('replied','no_response','followup_requested','appointment_booked','protocol_purchased','not_interested');

alter table public.crm_contact_outcomes
  add column if not exists recency_segment_snapshot text,
  add column if not exists stage_id_snapshot uuid references public.crm_stages(id) on delete set null,
  add column if not exists owner_user_id_snapshot uuid references auth.users(id) on delete set null,
  add column if not exists scheduled_action_at_snapshot timestamptz,
  add column if not exists minutes_late_snapshot integer;

create table if not exists public.crm_metric_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  window_days integer not null default 30 check (window_days between 1 and 3650),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.crm_metric_settings enable row level security;

drop policy if exists "Staff reads CRM metric settings" on public.crm_metric_settings;
create policy "Staff reads CRM metric settings" on public.crm_metric_settings for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.tenant_id=crm_metric_settings.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));

drop policy if exists "Staff manages CRM metric settings" on public.crm_metric_settings;
create policy "Staff manages CRM metric settings" on public.crm_metric_settings for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.tenant_id=crm_metric_settings.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.tenant_id=crm_metric_settings.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));

insert into public.crm_metric_settings(tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;

create or replace function public.seed_crm_metric_settings_after_tenant_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.crm_metric_settings(tenant_id) values(new.id)
  on conflict (tenant_id) do nothing;
  return new;
end $$;
revoke all on function public.seed_crm_metric_settings_after_tenant_insert() from public, anon, authenticated;

drop trigger if exists trg_seed_crm_metric_settings_after_tenant_insert on public.tenants;
create trigger trg_seed_crm_metric_settings_after_tenant_insert after insert on public.tenants
for each row execute function public.seed_crm_metric_settings_after_tenant_insert();

create or replace function public.capture_crm_outcome_snapshot()
returns trigger language plpgsql set search_path=public as $$
declare
  v_contact public.crm_contacts%rowtype;
begin
  select * into v_contact from public.crm_contacts
  where id=new.contact_id and tenant_id=new.tenant_id;
  if v_contact.id is null then raise exception 'Contato inválido para esta clínica'; end if;
  new.recency_segment_snapshot := v_contact.recency_segment;
  new.stage_id_snapshot := v_contact.stage_id;
  new.owner_user_id_snapshot := v_contact.owner_user_id;
  new.scheduled_action_at_snapshot := v_contact.next_action_at;
  if v_contact.next_action_at is not null and new.occurred_at > v_contact.next_action_at then
    new.minutes_late_snapshot := floor(extract(epoch from (new.occurred_at-v_contact.next_action_at))/60)::integer;
  else
    new.minutes_late_snapshot := 0;
  end if;
  return new;
end $$;
revoke all on function public.capture_crm_outcome_snapshot() from public, anon, authenticated;

drop trigger if exists trg_capture_crm_outcome_snapshot on public.crm_contact_outcomes;
create trigger trg_capture_crm_outcome_snapshot before insert on public.crm_contact_outcomes
for each row execute function public.capture_crm_outcome_snapshot();

create index if not exists idx_crm_contact_outcomes_tenant_segment on public.crm_contact_outcomes(tenant_id, recency_segment_snapshot, occurred_at desc);
create index if not exists idx_crm_contact_outcomes_tenant_owner on public.crm_contact_outcomes(tenant_id, owner_user_id_snapshot, occurred_at desc);
