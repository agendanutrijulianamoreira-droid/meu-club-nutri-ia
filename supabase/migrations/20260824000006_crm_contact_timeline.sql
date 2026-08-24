create table if not exists public.crm_contact_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  event_type text not null,
  title text not null,
  note text,
  from_value jsonb,
  to_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'staff',
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_contact_events_contact_created on public.crm_contact_events(contact_id, created_at desc);
create index if not exists idx_crm_contact_events_tenant_created on public.crm_contact_events(tenant_id, created_at desc);

alter table public.crm_contact_events enable row level security;

drop policy if exists "Staff reads CRM contact events" on public.crm_contact_events;
create policy "Staff reads CRM contact events" on public.crm_contact_events for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.tenant_id=crm_contact_events.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));

drop policy if exists "Staff creates CRM contact events" on public.crm_contact_events;
create policy "Staff creates CRM contact events" on public.crm_contact_events for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.tenant_id=crm_contact_events.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));

create or replace function public.log_crm_contact_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid := auth.uid();
  v_source text := case when auth.uid() is null then 'system' else 'staff' end;
begin
  if new.stage_id is distinct from old.stage_id then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'stage_changed','Etapa alterada',jsonb_build_object('stage_id',old.stage_id),jsonb_build_object('stage_id',new.stage_id),v_source,v_actor);
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'owner_changed','Responsável alterado',jsonb_build_object('owner_user_id',old.owner_user_id),jsonb_build_object('owner_user_id',new.owner_user_id),v_source,v_actor);
  end if;
  if new.next_action_at is distinct from old.next_action_at then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'next_action_changed','Próxima ação alterada',jsonb_build_object('next_action_at',old.next_action_at),jsonb_build_object('next_action_at',new.next_action_at),v_source,v_actor);
  end if;
  if new.last_contact_at is distinct from old.last_contact_at then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'contact_recorded','Contato registrado',jsonb_build_object('last_contact_at',old.last_contact_at),jsonb_build_object('last_contact_at',new.last_contact_at),v_source,v_actor);
  end if;
  if new.do_not_contact is distinct from old.do_not_contact then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'contact_permission_changed',case when new.do_not_contact then 'Contato bloqueado' else 'Contato liberado' end,jsonb_build_object('do_not_contact',old.do_not_contact),jsonb_build_object('do_not_contact',new.do_not_contact),v_source,v_actor);
  end if;
  return new;
end $$;

revoke all on function public.log_crm_contact_changes() from public, anon, authenticated;

drop trigger if exists trg_log_crm_contact_changes on public.crm_contacts;
create trigger trg_log_crm_contact_changes after update of stage_id,owner_user_id,next_action_at,last_contact_at,do_not_contact on public.crm_contacts
for each row execute function public.log_crm_contact_changes();