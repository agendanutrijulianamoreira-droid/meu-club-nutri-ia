create table if not exists public.crm_outcome_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  terminal boolean not null default false,
  followup_days integer,
  set_do_not_contact boolean not null default false,
  next_stage_id uuid references public.crm_stages(id) on delete set null,
  counts_as_conversion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.crm_contact_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  outcome_type_id uuid not null references public.crm_outcome_types(id) on delete restrict,
  note text,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_contact_outcomes_contact_occurred on public.crm_contact_outcomes(contact_id, occurred_at desc);
create index if not exists idx_crm_contact_outcomes_tenant_occurred on public.crm_contact_outcomes(tenant_id, occurred_at desc);
create index if not exists idx_crm_outcome_types_tenant_sort on public.crm_outcome_types(tenant_id, active, sort_order);

alter table public.crm_outcome_types enable row level security;
alter table public.crm_contact_outcomes enable row level security;

create policy "Staff reads CRM outcome types" on public.crm_outcome_types for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_outcome_types.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy "Staff manages CRM outcome types" on public.crm_outcome_types for all to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_outcome_types.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_outcome_types.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy "Staff reads CRM contact outcomes" on public.crm_contact_outcomes for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_contact_outcomes.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy "Staff creates CRM contact outcomes" on public.crm_contact_outcomes for insert to authenticated
with check (actor_user_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_contact_outcomes.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

create or replace function public.seed_default_crm_outcomes_for_tenant(p_tenant_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.crm_outcome_types(tenant_id,code,name,sort_order,terminal,followup_days,set_do_not_contact,counts_as_conversion)
  values
    (p_tenant_id,'replied','Respondeu',10,false,null,false,false),
    (p_tenant_id,'no_response','Não respondeu',20,false,3,false,false),
    (p_tenant_id,'followup_requested','Pediu retorno',30,false,7,false,false),
    (p_tenant_id,'appointment_booked','Consulta agendada',40,true,null,false,true),
    (p_tenant_id,'protocol_purchased','Protocolo comprado',50,true,null,false,true),
    (p_tenant_id,'not_interested','Sem interesse',60,true,null,true,false)
  on conflict (tenant_id,code) do nothing;
end $$;
revoke all on function public.seed_default_crm_outcomes_for_tenant(uuid) from public, anon, authenticated;
grant execute on function public.seed_default_crm_outcomes_for_tenant(uuid) to service_role;

select public.seed_default_crm_outcomes_for_tenant(id) from public.tenants;

create or replace function public.seed_crm_outcomes_after_tenant_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.seed_default_crm_outcomes_for_tenant(new.id);
  return new;
end $$;
revoke all on function public.seed_crm_outcomes_after_tenant_insert() from public, anon, authenticated;

drop trigger if exists trg_seed_crm_outcomes_after_tenant_insert on public.tenants;
create trigger trg_seed_crm_outcomes_after_tenant_insert after insert on public.tenants
for each row execute function public.seed_crm_outcomes_after_tenant_insert();

create or replace function public.apply_crm_contact_outcome()
returns trigger language plpgsql set search_path=public as $$
declare
  v_type public.crm_outcome_types%rowtype;
  v_next timestamptz;
begin
  select * into v_type from public.crm_outcome_types where id=new.outcome_type_id and tenant_id=new.tenant_id;
  if v_type.id is null then raise exception 'Resultado inválido para esta clínica'; end if;
  if not exists(select 1 from public.crm_contacts c where c.id=new.contact_id and c.tenant_id=new.tenant_id) then raise exception 'Contato inválido para esta clínica'; end if;
  if v_type.next_stage_id is not null and not exists(select 1 from public.crm_stages s where s.id=v_type.next_stage_id and s.tenant_id=new.tenant_id) then raise exception 'Etapa de destino inválida'; end if;
  if v_type.terminal then v_next:=null;
  elsif v_type.followup_days is not null then v_next:=new.occurred_at + make_interval(days=>greatest(v_type.followup_days,0));
  else v_next:=(select next_action_at from public.crm_contacts where id=new.contact_id);
  end if;
  update public.crm_contacts set
    last_contact_at=new.occurred_at,
    next_action_at=v_next,
    do_not_contact=case when v_type.set_do_not_contact then true else do_not_contact end,
    stage_id=coalesce(v_type.next_stage_id,stage_id),
    updated_at=now()
  where id=new.contact_id and tenant_id=new.tenant_id;
  insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,note,to_value,metadata,source,actor_user_id,created_at)
  values(new.tenant_id,new.contact_id,'contact_outcome','Resultado da abordagem: '||v_type.name,new.note,jsonb_build_object('outcome_type_id',v_type.id,'code',v_type.code,'name',v_type.name),jsonb_build_object('counts_as_conversion',v_type.counts_as_conversion),'staff',new.actor_user_id,new.occurred_at);
  return new;
end $$;
revoke all on function public.apply_crm_contact_outcome() from public, anon, authenticated;

drop trigger if exists trg_apply_crm_contact_outcome on public.crm_contact_outcomes;
create trigger trg_apply_crm_contact_outcome after insert on public.crm_contact_outcomes
for each row execute function public.apply_crm_contact_outcome();