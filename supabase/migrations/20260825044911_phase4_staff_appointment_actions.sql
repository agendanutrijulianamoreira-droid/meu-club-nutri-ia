alter table public.appointment_status_events add column event_type text not null default 'status_changed';

create or replace function public.validate_appointment_links()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_code text;
begin
  if not exists(select 1 from public.nutritionists n where n.id=new.nutritionist_id and n.tenant_id=new.tenant_id) then raise exception 'Nutricionista não pertence à clínica do agendamento'; end if;
  if not exists(select 1 from public.profiles p where p.user_id=new.patient_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,''))='patient') then raise exception 'Paciente inválida para esta clínica'; end if;
  select t.code into v_code from public.appointment_types t where t.id=new.appointment_type_id and t.tenant_id=new.tenant_id and t.active=true;
  if v_code is null then raise exception 'Tipo de consulta inválido ou inativo para esta clínica'; end if;
  new.appointment_type:=v_code;
  return new;
end;$$;

create or replace function public.log_appointment_status_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_source text:=case when auth.uid() is null then 'system' else 'staff' end;
begin
  if tg_op='INSERT' then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,null,new.status,v_source,auth.uid(),'created',jsonb_build_object('scheduled_at',new.scheduled_at,'duration_minutes',new.duration_minutes,'appointment_type_id',new.appointment_type_id));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,auth.uid(),'status_changed',jsonb_build_object('scheduled_at',new.scheduled_at,'reason',new.cancellation_reason));
  end if;
  if new.scheduled_at is distinct from old.scheduled_at then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,auth.uid(),'rescheduled',jsonb_build_object('from',old.scheduled_at,'to',new.scheduled_at,'override',new.schedule_override,'override_reason',new.override_reason));
  end if;
  if new.appointment_type_id is distinct from old.appointment_type_id or new.duration_minutes is distinct from old.duration_minutes or new.is_virtual is distinct from old.is_virtual then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,auth.uid(),'details_changed',jsonb_build_object('appointment_type_id',new.appointment_type_id,'duration_minutes',new.duration_minutes,'is_virtual',new.is_virtual));
  end if;
  return new;
end;$$;
revoke all on function public.log_appointment_status_event() from public,anon,authenticated;

drop trigger if exists appointments_log_status_event on public.appointments;
create trigger appointments_log_status_event after insert or update on public.appointments for each row execute function public.log_appointment_status_event();

create or replace function public.staff_create_appointment(
  p_patient_id uuid,p_nutritionist_id uuid,p_appointment_type_id uuid,p_local_start timestamp,
  p_duration_minutes integer default null,p_is_virtual boolean default null,p_meeting_link text default null,
  p_location_address text default null,p_notes text default null,p_schedule_override boolean default false,p_override_reason text default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;v_timezone text;v_type public.appointment_types%rowtype;v_avail public.nutritionist_availability_settings%rowtype;v_id uuid;v_start timestamptz;v_duration integer;v_virtual boolean;v_link text;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  select * into v_type from public.appointment_types t where t.id=p_appointment_type_id and t.tenant_id=v_tenant and t.active=true;
  if v_type.id is null then raise exception 'Tipo de consulta inválido'; end if;
  if not exists(select 1 from public.profiles p where p.user_id=p_patient_id and p.tenant_id=v_tenant and lower(coalesce(p.role,''))='patient') then raise exception 'Paciente inválida'; end if;
  if not exists(select 1 from public.nutritionists n where n.id=p_nutritionist_id and n.tenant_id=v_tenant) then raise exception 'Profissional inválida'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=v_tenant;
  select * into v_avail from public.nutritionist_availability_settings s where s.nutritionist_id=p_nutritionist_id and s.tenant_id=v_tenant;
  v_start:=p_local_start at time zone coalesce(v_timezone,'America/Sao_Paulo');
  v_duration:=coalesce(p_duration_minutes,v_type.duration_minutes);
  if v_duration<5 or v_duration>720 then raise exception 'Duração inválida'; end if;
  v_virtual:=coalesce(p_is_virtual,v_type.default_is_virtual);
  v_link:=coalesce(nullif(btrim(p_meeting_link),''),case when v_virtual then v_avail.default_meeting_link else null end);
  insert into public.appointments(tenant_id,patient_id,nutritionist_id,appointment_type_id,scheduled_at,duration_minutes,is_virtual,meeting_link,location_address,notes,status,schedule_override,override_reason)
  values(v_tenant,p_patient_id,p_nutritionist_id,p_appointment_type_id,v_start,v_duration,v_virtual,v_link,nullif(btrim(p_location_address),''),nullif(btrim(p_notes),''),'scheduled',p_schedule_override,nullif(btrim(p_override_reason),'')) returning id into v_id;
  return v_id;
end;$$;

create or replace function public.staff_reschedule_appointment(
  p_appointment_id uuid,p_local_start timestamp,p_duration_minutes integer default null,p_schedule_override boolean default false,p_override_reason text default null
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;v_timezone text;v_status text;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  select a.status into v_status from public.appointments a where a.id=p_appointment_id and a.tenant_id=v_tenant;
  if v_status is null then raise exception 'Consulta não encontrada'; end if;
  if v_status not in ('scheduled','confirmed','no_show') then raise exception 'Esta consulta não pode ser reagendada no estado atual'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=v_tenant;
  update public.appointments a set scheduled_at=p_local_start at time zone coalesce(v_timezone,'America/Sao_Paulo'),duration_minutes=coalesce(p_duration_minutes,a.duration_minutes),status='scheduled',confirmed_at=null,schedule_override=p_schedule_override,override_reason=nullif(btrim(p_override_reason),''),updated_at=now()
  where a.id=p_appointment_id and a.tenant_id=v_tenant;
end;$$;

create or replace function public.staff_update_appointment_details(
  p_appointment_id uuid,p_appointment_type_id uuid,p_duration_minutes integer,p_is_virtual boolean,
  p_meeting_link text default null,p_location_address text default null,p_notes text default null
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  if p_duration_minutes<5 or p_duration_minutes>720 then raise exception 'Duração inválida'; end if;
  if not exists(select 1 from public.appointment_types t where t.id=p_appointment_type_id and t.tenant_id=v_tenant and t.active=true) then raise exception 'Tipo de consulta inválido'; end if;
  update public.appointments a set appointment_type_id=p_appointment_type_id,duration_minutes=p_duration_minutes,is_virtual=p_is_virtual,meeting_link=nullif(btrim(p_meeting_link),''),location_address=nullif(btrim(p_location_address),''),notes=nullif(btrim(p_notes),''),updated_at=now()
  where a.id=p_appointment_id and a.tenant_id=v_tenant and a.status in ('scheduled','confirmed');
  if not found then raise exception 'Consulta não encontrada ou não editável'; end if;
end;$$;

create or replace function public.staff_transition_appointment(p_appointment_id uuid,p_to_status text,p_reason text default null)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  if p_to_status not in ('scheduled','confirmed','in_progress','completed','cancelled','no_show') then raise exception 'Status inválido'; end if;
  update public.appointments a set status=p_to_status,cancellation_reason=case when p_to_status='cancelled' then nullif(btrim(p_reason),'') else a.cancellation_reason end,cancelled_by=case when p_to_status='cancelled' then auth.uid() else a.cancelled_by end,updated_at=now()
  where a.id=p_appointment_id and a.tenant_id=v_tenant;
  if not found then raise exception 'Consulta não encontrada'; end if;
end;$$;

grant execute on function public.staff_create_appointment(uuid,uuid,uuid,timestamp,integer,boolean,text,text,text,boolean,text) to authenticated;
grant execute on function public.staff_reschedule_appointment(uuid,timestamp,integer,boolean,text) to authenticated;
grant execute on function public.staff_update_appointment_details(uuid,uuid,integer,boolean,text,text,text) to authenticated;
grant execute on function public.staff_transition_appointment(uuid,text,text) to authenticated;