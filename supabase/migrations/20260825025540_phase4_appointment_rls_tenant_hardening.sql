drop policy if exists appointment_settings_members_read on public.tenant_appointment_settings;
drop policy if exists appointment_settings_staff_manage on public.tenant_appointment_settings;
create policy appointment_settings_members_read on public.tenant_appointment_settings for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_appointment_settings.tenant_id));
create policy appointment_settings_staff_manage on public.tenant_appointment_settings for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_appointment_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=tenant_appointment_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

drop policy if exists appointment_types_members_read on public.appointment_types;
drop policy if exists appointment_types_staff_manage on public.appointment_types;
create policy appointment_types_members_read on public.appointment_types for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_types.tenant_id));
create policy appointment_types_staff_manage on public.appointment_types for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_types.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_types.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

drop policy if exists appointment_status_events_staff_read on public.appointment_status_events;
create policy appointment_status_events_staff_read on public.appointment_status_events for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_status_events.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));

drop policy if exists "Nutritionists can update appointments" on public.appointments;
drop policy if exists "Nutritionists see own appointments" on public.appointments;
drop policy if exists "Patients can cancel appointments" on public.appointments;
drop policy if exists "Patients can create appointments" on public.appointments;
drop policy if exists "Patients see own appointments" on public.appointments;
drop policy if exists "Tenant admins see all appointments" on public.appointments;
drop policy if exists appointments_staff_read on public.appointments;
drop policy if exists appointments_staff_insert on public.appointments;
drop policy if exists appointments_staff_update on public.appointments;
drop policy if exists appointments_staff_delete on public.appointments;
drop policy if exists appointments_patient_read on public.appointments;

create policy appointments_staff_read on public.appointments for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointments.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_insert on public.appointments for insert to authenticated
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointments.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_update on public.appointments for update to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointments.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointments.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_staff_delete on public.appointments for delete to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointments.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
create policy appointments_patient_read on public.appointments for select to authenticated using (patient_id=auth.uid());
