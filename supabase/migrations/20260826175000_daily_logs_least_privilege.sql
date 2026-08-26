-- Remove legacy table privileges that bypass the intended least-privilege model.
revoke all on table public.daily_logs from authenticated;
grant select, insert, update, delete on table public.daily_logs to authenticated;

revoke all on table public.daily_logs from anon;
grant all on table public.daily_logs to service_role;
