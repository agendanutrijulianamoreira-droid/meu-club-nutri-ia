revoke all on table public.appointment_communication_jobs from anon;
revoke insert,update,delete on table public.appointment_communication_jobs from authenticated;
grant select on table public.appointment_communication_jobs to authenticated;
grant select,insert,update,delete on table public.appointment_communication_jobs to service_role;
