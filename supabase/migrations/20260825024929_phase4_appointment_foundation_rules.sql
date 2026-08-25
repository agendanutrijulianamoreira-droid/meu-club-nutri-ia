alter table public.appointments alter column status set default 'scheduled';
update public.appointments set status='scheduled' where status is null;
alter table public.appointments alter column status set not null;

create or replace function public.validate_tenant_appointment_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Timezone IANA inválido: %', new.timezone;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenant_appointment_settings_validate
before insert or update on public.tenant_appointment_settings
for each row execute function public.validate_tenant_appointment_timezone();

create or replace function public.validate_appointment_links()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_code text;
begin
  if not exists (select 1 from public.nutritionists n where n.id=new.nutritionist_id and n.tenant_id=new.tenant_id) then
    raise exception 'Nutricionista não pertence à clínica do agendamento';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id=new.patient_id and p.tenant_id=new.tenant_id) then
    raise exception 'Paciente não pertence à clínica do agendamento';
  end if;
  select t.code into v_code from public.appointment_types t
  where t.id=new.appointment_type_id and t.tenant_id=new.tenant_id and t.active=true;
  if v_code is null then raise exception 'Tipo de consulta inválido ou inativo para esta clínica'; end if;
  new.appointment_type := v_code;
  return new;
end;
$$;

create trigger appointments_validate_links
before insert or update of tenant_id, nutritionist_id, patient_id, appointment_type_id on public.appointments
for each row execute function public.validate_appointment_links();

create or replace function public.validate_appointment_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if not (
    (old.status='scheduled' and new.status in ('confirmed','in_progress','cancelled','no_show')) or
    (old.status='confirmed' and new.status in ('scheduled','in_progress','cancelled','no_show')) or
    (old.status='in_progress' and new.status in ('completed','cancelled')) or
    (old.status='no_show' and new.status in ('scheduled','confirmed','completed'))
  ) then raise exception 'Transição de status inválida: % -> %', old.status, new.status; end if;
  if new.status='in_progress' and new.started_at is null then new.started_at := now(); end if;
  if new.status='completed' and new.completed_at is null then new.completed_at := now(); end if;
  if new.status='confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
  if new.status='cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  return new;
end;
$$;

create trigger appointments_validate_status_transition
before update of status on public.appointments
for each row execute function public.validate_appointment_status_transition();

create or replace function public.log_appointment_status_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id)
    values(new.tenant_id,new.id,case when tg_op='INSERT' then null else old.status end,new.status,case when auth.uid() is null then 'system' else 'staff' end,auth.uid());
  end if;
  return new;
end;
$$;

create trigger appointments_log_status_event
after insert or update of status on public.appointments
for each row execute function public.log_appointment_status_event();

create or replace function public.materialize_appointment_no_shows(p_tenant_id uuid, p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role required'; end if;
  update public.appointments a set status='no_show',updated_at=now()
  from public.tenant_appointment_settings s
  where a.tenant_id=p_tenant_id and s.tenant_id=a.tenant_id and s.no_show_enabled=true
    and a.status in ('scheduled','confirmed')
    and a.ends_at + (s.no_show_grace_minutes * interval '1 minute') <= p_now;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.materialize_appointment_no_shows(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.materialize_appointment_no_shows(uuid,timestamptz) to service_role;

create or replace function public.seed_appointment_foundation_for_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.tenant_appointment_settings(tenant_id) values(new.id) on conflict do nothing;
  insert into public.appointment_types(tenant_id,code,name,duration_minutes,default_is_virtual,sort_order)
  values
    (new.id,'consultation','Consulta',60,true,10),
    (new.id,'followup','Retorno',45,true,20),
    (new.id,'initial_assessment','Avaliação inicial',60,true,30),
    (new.id,'group_session','Sessão em grupo',60,true,40)
  on conflict (tenant_id,code) do nothing;
  return new;
end;
$$;
create trigger tenants_seed_appointment_foundation after insert on public.tenants
for each row execute function public.seed_appointment_foundation_for_tenant();

alter table public.tenant_appointment_settings enable row level security;
alter table public.appointment_types enable row level security;
alter table public.appointment_status_events enable row level security;

create policy appointment_settings_members_read on public.tenant_appointment_settings for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id));
create policy appointment_settings_staff_manage on public.tenant_appointment_settings for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

create policy appointment_types_members_read on public.appointment_types for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id));
create policy appointment_types_staff_manage on public.appointment_types for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

create policy appointment_status_events_staff_read on public.appointment_status_events for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointment_status_events_patient_read on public.appointment_status_events for select to authenticated
using (exists(select 1 from public.appointments a where a.id=appointment_id and a.patient_id=auth.uid()));

drop policy if exists "Nutritionists can create appointments" on public.appointments;
drop policy if exists "Nutritionists can update own appointments" on public.appointments;
drop policy if exists "Nutritionists can view own appointments" on public.appointments;
drop policy if exists "Patients can view own appointments" on public.appointments;

create policy appointments_staff_read on public.appointments for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_insert on public.appointments for insert to authenticated
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_update on public.appointments for update to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_delete on public.appointments for delete to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_patient_read on public.appointments for select to authenticated using (patient_id=auth.uid());
