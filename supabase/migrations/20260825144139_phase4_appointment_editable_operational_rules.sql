alter table public.tenant_appointment_settings
  add column if not exists allow_staff_schedule_override boolean not null default true,
  add column if not exists require_cancellation_reason boolean not null default true,
  add column if not exists allow_custom_duration boolean not null default true;

create or replace function public.validate_appointment_business_rules()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_settings public.tenant_appointment_settings%rowtype;
  v_default_duration integer;
begin
  select * into v_settings
  from public.tenant_appointment_settings s
  where s.tenant_id=new.tenant_id;

  if new.schedule_override and not coalesce(v_settings.allow_staff_schedule_override,true) then
    raise exception 'Encaixes fora da disponibilidade estão desativados para esta clínica';
  end if;

  if new.status='cancelled'
     and coalesce(v_settings.require_cancellation_reason,true)
     and coalesce(btrim(new.cancellation_reason),'')='' then
    raise exception 'Informe o motivo do cancelamento';
  end if;

  if not coalesce(v_settings.allow_custom_duration,true) then
    select t.duration_minutes into v_default_duration
    from public.appointment_types t
    where t.id=new.appointment_type_id and t.tenant_id=new.tenant_id;
    if v_default_duration is not null and new.duration_minutes<>v_default_duration then
      raise exception 'Duração personalizada está desativada para esta clínica';
    end if;
  end if;

  return new;
end;$$;

drop trigger if exists c_appointments_validate_business_rules on public.appointments;
create trigger c_appointments_validate_business_rules
before insert or update of schedule_override,status,cancellation_reason,duration_minutes,appointment_type_id
on public.appointments
for each row execute function public.validate_appointment_business_rules();