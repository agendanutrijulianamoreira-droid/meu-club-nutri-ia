-- Restore a database-native, idempotent daily follow-up refresh and harden daily_logs.

-- daily_logs is patient-owned for writes; staff receives SELECT only via the
-- policies created in dashboard_post_audit_hardening.
drop policy if exists daily_logs_user_insert on public.daily_logs;
drop policy if exists daily_logs_user_update on public.daily_logs;
drop policy if exists daily_logs_user_delete on public.daily_logs;

create policy daily_logs_user_insert
on public.daily_logs
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy daily_logs_user_update
on public.daily_logs
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy daily_logs_user_delete
on public.daily_logs
for delete
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.daily_logs from anon;
grant select, insert, update, delete on table public.daily_logs to authenticated;
grant all on table public.daily_logs to service_role;

-- The Vercel cron remains a valid entry point, but this database-native runner
-- ensures operational snapshots keep advancing even when that external cron is
-- delayed or misconfigured. All called functions are idempotent for a given date.
create or replace function public.service_run_daily_followup_refresh(
  p_reference_date date default ((now() at time zone 'America/Sao_Paulo')::date)
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant record;
  v_snapshot integer;
  v_lifecycle integer;
  v_risk_tasks jsonb;
  v_phase_tasks jsonb;
  v_feedback_tasks jsonb;
  v_lifecycle_tasks jsonb;
  v_exit_rules jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  for v_tenant in select id from public.tenants order by created_at loop
    begin
      v_snapshot := public.refresh_patient_operational_snapshot(v_tenant.id, p_reference_date);
      v_lifecycle := public.refresh_patient_lifecycle_states(v_tenant.id, p_reference_date);
      v_risk_tasks := public.sync_patient_followup_tasks(v_tenant.id, p_reference_date);
      v_phase_tasks := public.sync_phase_review_tasks(v_tenant.id, p_reference_date);
      v_feedback_tasks := public.sync_checkin_feedback_tasks(v_tenant.id, p_reference_date);
      v_lifecycle_tasks := public.sync_lifecycle_followup_tasks(v_tenant.id, p_reference_date);
      v_exit_rules := public.apply_followup_exit_rules(v_tenant.id);

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'tenant_id', v_tenant.id,
        'ok', true,
        'snapshot_rows', v_snapshot,
        'lifecycle_rows', v_lifecycle,
        'risk_tasks', v_risk_tasks,
        'phase_tasks', v_phase_tasks,
        'feedback_tasks', v_feedback_tasks,
        'lifecycle_tasks', v_lifecycle_tasks,
        'exit_rules', v_exit_rules
      ));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'tenant_id', v_tenant.id,
        'ok', false,
        'error', sqlerrm
      ));
    end;
  end loop;

  return jsonb_build_object('reference_date', p_reference_date, 'tenants', v_results);
end;
$$;

revoke all on function public.service_run_daily_followup_refresh(date) from public, anon, authenticated;
grant execute on function public.service_run_daily_followup_refresh(date) to service_role;

-- Replace only this job name if it already exists, keeping the schedule explicit.
select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-followup-refresh';

select cron.schedule(
  'daily-followup-refresh',
  '10 12 * * *',
  $$select public.service_run_daily_followup_refresh(((now() at time zone 'America/Sao_Paulo')::date));$$
);
