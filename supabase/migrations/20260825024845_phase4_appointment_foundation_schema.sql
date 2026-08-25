create extension if not exists btree_gist with schema extensions;

create table public.tenant_appointment_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  no_show_enabled boolean not null default true,
  no_show_grace_minutes integer not null default 15 check (no_show_grace_minutes between 0 and 1440),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tenant_appointment_settings (tenant_id)
select id from public.tenants;

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 720),
  default_is_virtual boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_types_tenant_code_key unique (tenant_id, code),
  constraint appointment_types_tenant_id_id_key unique (tenant_id, id),
  constraint appointment_types_code_format check (code ~ '^[a-z0-9][a-z0-9_-]*$')
);

insert into public.appointment_types (tenant_id, code, name, duration_minutes, default_is_virtual, sort_order)
select t.id, v.code, v.name, v.duration_minutes, v.default_is_virtual, v.sort_order
from public.tenants t
cross join (values
  ('consultation','Consulta',60,true,10),
  ('followup','Retorno',45,true,20),
  ('initial_assessment','Avaliação inicial',60,true,30),
  ('group_session','Sessão em grupo',60,true,40)
) as v(code,name,duration_minutes,default_is_virtual,sort_order);

alter table public.appointments
  add column appointment_type_id uuid,
  add column started_at timestamptz,
  add column ends_at timestamptz;

alter table public.appointments alter column duration_minutes set default 60;
update public.appointments set duration_minutes = 60 where duration_minutes is null;
alter table public.appointments alter column duration_minutes set not null;

update public.appointments a
set appointment_type_id = t.id
from public.appointment_types t
where t.tenant_id = a.tenant_id
  and t.code = coalesce(a.appointment_type,'consultation');

alter table public.appointments drop constraint appointments_appointment_type_check;
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status = any (array['scheduled'::text,'confirmed'::text,'in_progress'::text,'completed'::text,'cancelled'::text,'no_show'::text]));
alter table public.appointments add constraint appointments_tenant_type_fkey
  foreign key (tenant_id, appointment_type_id)
  references public.appointment_types(tenant_id, id);
alter table public.appointments alter column appointment_type_id set not null;

create or replace function public.set_appointment_ends_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.ends_at := new.scheduled_at + (new.duration_minutes * interval '1 minute');
  return new;
end;
$$;

create trigger appointments_set_ends_at
before insert or update of scheduled_at, duration_minutes on public.appointments
for each row execute function public.set_appointment_ends_at();

update public.appointments set ends_at = scheduled_at + (duration_minutes * interval '1 minute');
alter table public.appointments alter column ends_at set not null;

create table public.appointment_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status text,
  to_status text not null,
  source text not null default 'staff',
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index appointment_status_events_appointment_idx on public.appointment_status_events(appointment_id, created_at desc);
create index appointment_types_tenant_active_idx on public.appointment_types(tenant_id, active, sort_order);
create index appointments_tenant_scheduled_idx on public.appointments(tenant_id, scheduled_at);

alter table public.appointments add constraint appointments_no_overlapping_slots
  exclude using gist (
    nutritionist_id with =,
    tstzrange(scheduled_at, ends_at, '[)') with &&
  ) where (status in ('scheduled','confirmed','in_progress'));

drop trigger if exists appointments_check_availability on public.appointments;
drop trigger if exists appointments_auto_status on public.appointments;
