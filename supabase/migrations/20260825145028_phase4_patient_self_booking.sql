alter table public.tenant_appointment_settings
  add column if not exists patient_self_booking_enabled boolean not null default false;

alter table public.appointment_types
  add column if not exists patient_self_booking_enabled boolean not null default false;

create or replace function public.patient_available_appointment_slots(
  p_appointment_type_id uuid,
  p_from_date date,
  p_to_date date
) returns table(
  nutritionist_id uuid,
  nutritionist_name text,
  local_start timestamp,
  local_end timestamp,
  is_virtual boolean
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_tenant uuid;
  v_role text;
  v_timezone text;
  v_type public.appointment_types%rowtype;
  v_day date;
  v_slot timestamp;
  v_slot_end timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_max_date date;
  v_a public.nutritionist_availability_settings%rowtype;
  v_nutri_name text;
begin
  if v_uid is null then raise exception 'Autenticação necessária'; end if;
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role
  from public.profiles p where p.user_id=v_uid;
  if v_tenant is null or v_role<>'patient' then raise exception 'Acesso de paciente necessário'; end if;

  if not exists(select 1 from public.tenant_appointment_settings s where s.tenant_id=v_tenant and s.patient_self_booking_enabled=true) then
    raise exception 'Autoagendamento não está habilitado para esta clínica';
  end if;

  select * into v_type from public.appointment_types t
  where t.id=p_appointment_type_id and t.tenant_id=v_tenant and t.active=true and t.patient_self_booking_enabled=true;
  if v_type.id is null then raise exception 'Este tipo de consulta não permite autoagendamento'; end if;

  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone
  from public.tenant_appointment_settings s where s.tenant_id=v_tenant;

  if p_from_date is null or p_to_date is null or p_to_date<p_from_date or p_to_date-p_from_date>60 then
    raise exception 'Janela de busca inválida';
  end if;
  if p_to_date < (now() at time zone v_timezone)::date then return; end if;

  for v_a in
    select s.* from public.nutritionist_availability_settings s
    where s.tenant_id=v_tenant and s.enabled=true
    order by s.nutritionist_id
  loop
    select n.name into v_nutri_name from public.nutritionists n where n.id=v_a.nutritionist_id;
    v_max_date:=least(p_to_date,(now() at time zone v_timezone)::date+v_a.max_advance_days);
    v_day:=greatest(p_from_date,(now() at time zone v_timezone)::date);
    while v_day<=v_max_date loop
      if extract(isodow from v_day)::integer=any(v_a.work_days::integer[]) then
        v_slot:=v_day+v_a.work_hours_start;
        while v_slot+(v_type.duration_minutes*interval '1 minute')<=v_day+v_a.work_hours_end loop
          v_slot_end:=v_slot+(v_type.duration_minutes*interval '1 minute');
          v_start:=v_slot at time zone v_timezone;
          v_end:=v_slot_end at time zone v_timezone;
          if v_start>=now()+(v_a.min_notice_minutes*interval '1 minute')
             and not exists(select 1 from public.nutritionist_schedule_blocks b where b.nutritionist_id=v_a.nutritionist_id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(v_start,v_end,'[)'))
             and not exists(select 1 from public.appointments a where a.nutritionist_id=v_a.nutritionist_id and a.status in ('scheduled','confirmed','in_progress') and tstzrange(a.scheduled_at,a.blocked_ends_at,'[)') && tstzrange(v_start,v_end+(v_a.buffer_minutes*interval '1 minute'),'[)')) then
            nutritionist_id:=v_a.nutritionist_id;
            nutritionist_name:=v_nutri_name;
            local_start:=v_slot;
            local_end:=v_slot_end;
            is_virtual:=v_type.default_is_virtual;
            return next;
          end if;
          v_slot:=v_slot+(v_a.slot_interval_minutes*interval '1 minute');
        end loop;
      end if;
      v_day:=v_day+1;
    end loop;
  end loop;
end;$$;

create or replace function public.patient_self_book_appointment(
  p_appointment_type_id uuid,
  p_nutritionist_id uuid,
  p_local_start timestamp
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_tenant uuid;
  v_role text;
  v_timezone text;
  v_contact_id uuid;
  v_type public.appointment_types%rowtype;
  v_avail public.nutritionist_availability_settings%rowtype;
  v_start timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Autenticação necessária'; end if;
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=v_uid;
  if v_tenant is null or v_role<>'patient' then raise exception 'Acesso de paciente necessário'; end if;
  if not exists(select 1 from public.tenant_appointment_settings s where s.tenant_id=v_tenant and s.patient_self_booking_enabled=true) then raise exception 'Autoagendamento não está habilitado para esta clínica'; end if;

  select * into v_type from public.appointment_types t where t.id=p_appointment_type_id and t.tenant_id=v_tenant and t.active=true and t.patient_self_booking_enabled=true;
  if v_type.id is null then raise exception 'Este tipo de consulta não permite autoagendamento'; end if;
  select * into v_avail from public.nutritionist_availability_settings s where s.nutritionist_id=p_nutritionist_id and s.tenant_id=v_tenant and s.enabled=true;
  if v_avail.nutritionist_id is null then raise exception 'Profissional indisponível para autoagendamento'; end if;
  select c.id into v_contact_id from public.crm_contacts c where c.tenant_id=v_tenant and c.linked_user_id=v_uid order by c.created_at limit 1;
  if v_contact_id is null then raise exception 'Seu cadastro precisa ser vinculado pela clínica antes do autoagendamento'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=v_tenant;
  v_start:=p_local_start at time zone coalesce(v_timezone,'America/Sao_Paulo');

  perform pg_advisory_xact_lock(hashtextextended(p_nutritionist_id::text,0));

  insert into public.appointments(
    tenant_id,crm_contact_id,patient_id,nutritionist_id,appointment_type_id,scheduled_at,duration_minutes,
    is_virtual,meeting_link,status,schedule_override,override_reason,notes
  ) values(
    v_tenant,v_contact_id,v_uid,p_nutritionist_id,p_appointment_type_id,v_start,v_type.duration_minutes,
    v_type.default_is_virtual,case when v_type.default_is_virtual then v_avail.default_meeting_link else null end,
    'scheduled',false,null,'Agendada pela paciente no app'
  ) returning id into v_id;
  return v_id;
end;$$;

revoke all on function public.patient_available_appointment_slots(uuid,date,date) from public,anon;
revoke all on function public.patient_self_book_appointment(uuid,uuid,timestamp) from public,anon;
grant execute on function public.patient_available_appointment_slots(uuid,date,date) to authenticated;
grant execute on function public.patient_self_book_appointment(uuid,uuid,timestamp) to authenticated;