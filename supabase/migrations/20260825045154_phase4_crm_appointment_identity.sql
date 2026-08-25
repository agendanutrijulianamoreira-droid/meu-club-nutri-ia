alter table public.appointments add column crm_contact_id uuid references public.crm_contacts(id) on delete restrict;
alter table public.appointments alter column patient_id drop not null;
create index appointments_crm_contact_idx on public.appointments(tenant_id,crm_contact_id,scheduled_at desc);
alter table public.appointments add constraint appointments_patient_identity_check check (patient_id is not null or crm_contact_id is not null);

create or replace function public.validate_appointment_links()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_code text;v_linked_user uuid;v_contact uuid;
begin
  if not exists(select 1 from public.nutritionists n where n.id=new.nutritionist_id and n.tenant_id=new.tenant_id) then raise exception 'Nutricionista não pertence à clínica do agendamento'; end if;
  if new.crm_contact_id is not null then
    select c.linked_user_id into v_linked_user from public.crm_contacts c where c.id=new.crm_contact_id and c.tenant_id=new.tenant_id;
    if not found then raise exception 'Contato do CRM não pertence à clínica do agendamento'; end if;
    if v_linked_user is not null then new.patient_id:=v_linked_user; end if;
  elsif new.patient_id is not null then
    if not exists(select 1 from public.profiles p where p.user_id=new.patient_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,''))='patient') then raise exception 'Paciente inválida para esta clínica'; end if;
    select c.id into v_contact from public.crm_contacts c where c.tenant_id=new.tenant_id and c.linked_user_id=new.patient_id order by c.created_at limit 1;
    new.crm_contact_id:=v_contact;
  else
    raise exception 'Informe um contato do CRM ou paciente vinculada';
  end if;
  select t.code into v_code from public.appointment_types t where t.id=new.appointment_type_id and t.tenant_id=new.tenant_id and t.active=true;
  if v_code is null then raise exception 'Tipo de consulta inválido ou inativo para esta clínica'; end if;
  new.appointment_type:=v_code;
  return new;
end;$$;

drop policy if exists appointments_patient_read on public.appointments;
create policy appointments_patient_read on public.appointments for select to authenticated
using(patient_id=auth.uid() or exists(select 1 from public.crm_contacts c where c.id=appointments.crm_contact_id and c.tenant_id=appointments.tenant_id and c.linked_user_id=auth.uid()));

drop policy if exists appointment_status_events_patient_read on public.appointment_status_events;
create policy appointment_status_events_patient_read on public.appointment_status_events for select to authenticated
using(exists(select 1 from public.appointments a left join public.crm_contacts c on c.id=a.crm_contact_id and c.tenant_id=a.tenant_id where a.id=appointment_status_events.appointment_id and (a.patient_id=auth.uid() or c.linked_user_id=auth.uid())));

drop function public.staff_create_appointment(uuid,uuid,uuid,timestamp,integer,boolean,text,text,text,boolean,text);
create or replace function public.staff_create_appointment(
  p_crm_contact_id uuid,p_nutritionist_id uuid,p_appointment_type_id uuid,p_local_start timestamp,
  p_duration_minutes integer default null,p_is_virtual boolean default null,p_meeting_link text default null,
  p_location_address text default null,p_notes text default null,p_schedule_override boolean default false,p_override_reason text default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;v_timezone text;v_type public.appointment_types%rowtype;v_avail public.nutritionist_availability_settings%rowtype;v_contact public.crm_contacts%rowtype;v_id uuid;v_start timestamptz;v_duration integer;v_virtual boolean;v_link text;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  select * into v_contact from public.crm_contacts c where c.id=p_crm_contact_id and c.tenant_id=v_tenant;
  if v_contact.id is null then raise exception 'Contato do CRM inválido'; end if;
  select * into v_type from public.appointment_types t where t.id=p_appointment_type_id and t.tenant_id=v_tenant and t.active=true;
  if v_type.id is null then raise exception 'Tipo de consulta inválido'; end if;
  if not exists(select 1 from public.nutritionists n where n.id=p_nutritionist_id and n.tenant_id=v_tenant) then raise exception 'Profissional inválida'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=v_tenant;
  select * into v_avail from public.nutritionist_availability_settings s where s.nutritionist_id=p_nutritionist_id and s.tenant_id=v_tenant;
  v_start:=p_local_start at time zone coalesce(v_timezone,'America/Sao_Paulo');
  v_duration:=coalesce(p_duration_minutes,v_type.duration_minutes);
  if v_duration<5 or v_duration>720 then raise exception 'Duração inválida'; end if;
  v_virtual:=coalesce(p_is_virtual,v_type.default_is_virtual);
  v_link:=coalesce(nullif(btrim(p_meeting_link),''),case when v_virtual then v_avail.default_meeting_link else null end);
  insert into public.appointments(tenant_id,crm_contact_id,patient_id,nutritionist_id,appointment_type_id,scheduled_at,duration_minutes,is_virtual,meeting_link,location_address,notes,status,schedule_override,override_reason)
  values(v_tenant,p_crm_contact_id,v_contact.linked_user_id,p_nutritionist_id,p_appointment_type_id,v_start,v_duration,v_virtual,v_link,nullif(btrim(p_location_address),''),nullif(btrim(p_notes),''),'scheduled',p_schedule_override,nullif(btrim(p_override_reason),'')) returning id into v_id;
  return v_id;
end;$$;
grant execute on function public.staff_create_appointment(uuid,uuid,uuid,timestamp,integer,boolean,text,text,text,boolean,text) to authenticated;