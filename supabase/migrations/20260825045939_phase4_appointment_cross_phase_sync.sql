create or replace function public.sync_appointments_after_crm_link()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.linked_user_id is distinct from old.linked_user_id then
    update public.appointments a
       set patient_id=new.linked_user_id,updated_at=now()
     where a.tenant_id=new.tenant_id and a.crm_contact_id=new.id and a.patient_id is distinct from new.linked_user_id;
  end if;
  return new;
end;$$;
revoke all on function public.sync_appointments_after_crm_link() from public,anon,authenticated;
drop trigger if exists crm_contacts_sync_appointments_link on public.crm_contacts;
create trigger crm_contacts_sync_appointments_link after update of linked_user_id on public.crm_contacts
for each row execute function public.sync_appointments_after_crm_link();

create or replace function public.sync_crm_after_appointment_completion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_when timestamptz;
begin
  if new.status='completed' and old.status is distinct from new.status and new.crm_contact_id is not null then
    v_when:=coalesce(new.completed_at,now());
    update public.crm_contacts c
       set last_consultation_at=case when c.last_consultation_at is null or c.last_consultation_at<v_when then v_when else c.last_consultation_at end,
           last_activity_at=case when c.last_activity_at is null or c.last_activity_at<v_when then v_when else c.last_activity_at end,
           updated_at=now()
     where c.id=new.crm_contact_id and c.tenant_id=new.tenant_id;
  end if;
  return new;
end;$$;
revoke all on function public.sync_crm_after_appointment_completion() from public,anon,authenticated;
drop trigger if exists appointments_sync_crm_completion on public.appointments;
create trigger appointments_sync_crm_completion after update of status on public.appointments
for each row execute function public.sync_crm_after_appointment_completion();

revoke all on function public.staff_create_appointment(uuid,uuid,uuid,timestamp,integer,boolean,text,text,text,boolean,text) from public,anon;
revoke all on function public.staff_reschedule_appointment(uuid,timestamp,integer,boolean,text) from public,anon;
revoke all on function public.staff_update_appointment_details(uuid,uuid,integer,boolean,text,text,text) from public,anon;
revoke all on function public.staff_transition_appointment(uuid,text,text) from public,anon;
revoke all on function public.staff_create_schedule_block(uuid,timestamp,timestamp,text,text) from public,anon;
grant execute on function public.staff_create_appointment(uuid,uuid,uuid,timestamp,integer,boolean,text,text,text,boolean,text) to authenticated;
grant execute on function public.staff_reschedule_appointment(uuid,timestamp,integer,boolean,text) to authenticated;
grant execute on function public.staff_update_appointment_details(uuid,uuid,integer,boolean,text,text,text) to authenticated;
grant execute on function public.staff_transition_appointment(uuid,text,text) to authenticated;
grant execute on function public.staff_create_schedule_block(uuid,timestamp,timestamp,text,text) to authenticated;