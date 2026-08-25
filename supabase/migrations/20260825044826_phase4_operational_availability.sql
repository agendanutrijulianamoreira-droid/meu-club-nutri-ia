create table public.nutritionist_availability_settings (
  nutritionist_id uuid primary key references public.nutritionists(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enabled boolean not null default true,
  work_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  work_hours_start time not null default '08:00',
  work_hours_end time not null default '18:00',
  buffer_minutes integer not null default 10 check (buffer_minutes between 0 and 240),
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 240),
  min_notice_minutes integer not null default 0 check (min_notice_minutes between 0 and 43200),
  max_advance_days integer not null default 365 check (max_advance_days between 1 and 1095),
  default_meeting_link text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutritionist_availability_work_days_check check (
    cardinality(work_days) between 1 and 7 and work_days <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint nutritionist_availability_hours_check check (work_hours_end > work_hours_start)
);

insert into public.nutritionist_availability_settings(
  nutritionist_id,tenant_id,enabled,work_days,work_hours_start,work_hours_end,
  buffer_minutes,slot_interval_minutes,default_meeting_link
)
select n.id,n.tenant_id,coalesce(n.calendar_enabled,true),
  coalesce((select array_agg(x::smallint order by x::smallint) from jsonb_array_elements_text(coalesce(n.calendar_settings->'work_days','[1,2,3,4,5]'::jsonb)) q(x)),array[1,2,3,4,5]::smallint[]),
  coalesce(nullif(n.calendar_settings->>'work_hours_start','')::time,'08:00'::time),
  coalesce(nullif(n.calendar_settings->>'work_hours_end','')::time,'18:00'::time),
  coalesce(nullif(n.calendar_settings->>'buffer_minutes','')::integer,10),
  greatest(5,least(240,coalesce(nullif(n.calendar_settings->>'slot_duration_minutes','')::integer,15))),
  nullif(n.calendar_settings->>'default_meeting_link','')
from public.nutritionists n
on conflict (nutritionist_id) do nothing;

create table public.nutritionist_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_type text not null default 'unavailable' check (block_type in ('unavailable','vacation','holiday','personal','other')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutritionist_schedule_blocks_range_check check (ends_at > starts_at)
);

create index nutritionist_schedule_blocks_lookup_idx on public.nutritionist_schedule_blocks(nutritionist_id,starts_at,ends_at);
alter table public.nutritionist_schedule_blocks add constraint nutritionist_schedule_blocks_no_overlap
  exclude using gist (nutritionist_id with =, tstzrange(starts_at,ends_at,'[)') with &&);

alter table public.appointments add column buffer_minutes integer;
alter table public.appointments add column blocked_ends_at timestamptz;
alter table public.appointments add column schedule_override boolean not null default false;
alter table public.appointments add column override_reason text;

update public.appointments a set buffer_minutes=coalesce(s.buffer_minutes,0)
from public.nutritionist_availability_settings s where s.nutritionist_id=a.nutritionist_id;
update public.appointments set buffer_minutes=0 where buffer_minutes is null;
update public.appointments set blocked_ends_at=ends_at+(buffer_minutes*interval '1 minute');
alter table public.appointments alter column buffer_minutes set not null;
alter table public.appointments alter column buffer_minutes set default 0;
alter table public.appointments alter column blocked_ends_at set not null;

alter table public.appointments drop constraint appointments_no_overlapping_slots;
drop trigger if exists appointments_set_ends_at on public.appointments;
drop function if exists public.set_appointment_ends_at();

create or replace function public.set_appointment_timing()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_buffer integer;
begin
  if tg_op='INSERT' or new.nutritionist_id is distinct from old.nutritionist_id or new.scheduled_at is distinct from old.scheduled_at then
    select s.buffer_minutes into v_buffer from public.nutritionist_availability_settings s where s.nutritionist_id=new.nutritionist_id and s.tenant_id=new.tenant_id;
    new.buffer_minutes:=coalesce(v_buffer,0);
  end if;
  new.ends_at:=new.scheduled_at+(new.duration_minutes*interval '1 minute');
  new.blocked_ends_at:=new.ends_at+(new.buffer_minutes*interval '1 minute');
  return new;
end;$$;
create trigger a_appointments_set_timing before insert or update of scheduled_at,duration_minutes,nutritionist_id,tenant_id on public.appointments
for each row execute function public.set_appointment_timing();

alter table public.appointments add constraint appointments_no_overlapping_slots
  exclude using gist (nutritionist_id with =, tstzrange(scheduled_at,blocked_ends_at,'[)') with &&)
  where (status in ('scheduled','confirmed','in_progress'));

create or replace function public.validate_availability_tenant_link()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.nutritionists n where n.id=new.nutritionist_id and n.tenant_id=new.tenant_id) then
    raise exception 'Nutricionista não pertence à clínica da disponibilidade';
  end if;
  new.updated_at:=now();
  return new;
end;$$;
create trigger nutritionist_availability_validate before insert or update on public.nutritionist_availability_settings
for each row execute function public.validate_availability_tenant_link();

create or replace function public.validate_appointment_schedule()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  v_settings public.nutritionist_availability_settings%rowtype;
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow integer;
  v_minutes integer;
  v_start_minutes integer;
begin
  if new.status not in ('scheduled','confirmed','in_progress') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.nutritionist_id::text,0));
  select * into v_settings from public.nutritionist_availability_settings s where s.nutritionist_id=new.nutritionist_id and s.tenant_id=new.tenant_id;
  select timezone into v_timezone from public.tenant_appointment_settings where tenant_id=new.tenant_id;
  v_timezone:=coalesce(v_timezone,'America/Sao_Paulo');
  if new.schedule_override then
    if coalesce(btrim(new.override_reason),'')='' then raise exception 'Informe o motivo do encaixe/exceção de agenda'; end if;
    return new;
  end if;
  if v_settings.nutritionist_id is null or not v_settings.enabled then raise exception 'Agenda da profissional está desativada'; end if;
  if new.scheduled_at < now()+(v_settings.min_notice_minutes*interval '1 minute') then raise exception 'Horário não respeita a antecedência mínima'; end if;
  if new.scheduled_at > now()+(v_settings.max_advance_days*interval '1 day') then raise exception 'Horário excede a antecedência máxima permitida'; end if;
  v_local_start:=new.scheduled_at at time zone v_timezone;
  v_local_end:=new.ends_at at time zone v_timezone;
  v_dow:=extract(isodow from v_local_start)::integer;
  if not (v_dow=any(v_settings.work_days::integer[])) then raise exception 'Dia fora da disponibilidade da profissional'; end if;
  if v_local_start::time < v_settings.work_hours_start or v_local_end::time > v_settings.work_hours_end or v_local_start::date<>v_local_end::date then raise exception 'Horário fora da jornada da profissional'; end if;
  v_minutes:=extract(hour from v_local_start)::integer*60+extract(minute from v_local_start)::integer;
  v_start_minutes:=extract(hour from v_settings.work_hours_start)::integer*60+extract(minute from v_settings.work_hours_start)::integer;
  if mod(v_minutes-v_start_minutes,v_settings.slot_interval_minutes)<>0 then raise exception 'Horário não respeita o intervalo de início configurado'; end if;
  if exists(select 1 from public.nutritionist_schedule_blocks b where b.nutritionist_id=new.nutritionist_id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.scheduled_at,new.ends_at,'[)')) then raise exception 'Horário bloqueado na agenda da profissional'; end if;
  return new;
end;$$;
create trigger b_appointments_validate_schedule before insert or update of scheduled_at,duration_minutes,nutritionist_id,tenant_id,status,schedule_override,override_reason on public.appointments
for each row execute function public.validate_appointment_schedule();

create or replace function public.validate_schedule_block()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.nutritionists n where n.id=new.nutritionist_id and n.tenant_id=new.tenant_id) then raise exception 'Nutricionista não pertence à clínica do bloqueio'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.nutritionist_id::text,0));
  if exists(select 1 from public.appointments a where a.nutritionist_id=new.nutritionist_id and a.status in ('scheduled','confirmed','in_progress') and tstzrange(a.scheduled_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then
    raise exception 'Existe consulta ativa no período; reagende ou cancele antes de bloquear';
  end if;
  return new;
end;$$;
create trigger nutritionist_schedule_blocks_validate before insert or update on public.nutritionist_schedule_blocks
for each row execute function public.validate_schedule_block();

alter table public.nutritionist_availability_settings enable row level security;
alter table public.nutritionist_schedule_blocks enable row level security;
create policy nutritionist_availability_staff_read on public.nutritionist_availability_settings for select to authenticated
using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_availability_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy nutritionist_availability_staff_manage on public.nutritionist_availability_settings for all to authenticated
using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_availability_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_availability_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy nutritionist_blocks_staff_read on public.nutritionist_schedule_blocks for select to authenticated
using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_schedule_blocks.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy nutritionist_blocks_staff_manage on public.nutritionist_schedule_blocks for all to authenticated
using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_schedule_blocks.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=nutritionist_schedule_blocks.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));