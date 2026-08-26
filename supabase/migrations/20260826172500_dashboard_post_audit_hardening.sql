-- Post-audit hardening for Painel 2.x

-- 1) Dashboard preferences: keep per-user/per-tenant isolation and include the
-- legacy staff role alias `nutri`, which is accepted by the admin route.
drop policy if exists dashboard_preferences_select_own_staff on public.admin_dashboard_preferences;
drop policy if exists dashboard_preferences_insert_own_staff on public.admin_dashboard_preferences;
drop policy if exists dashboard_preferences_update_own_staff on public.admin_dashboard_preferences;
drop policy if exists dashboard_preferences_delete_own_staff on public.admin_dashboard_preferences;

create policy dashboard_preferences_select_own_staff
on public.admin_dashboard_preferences
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy dashboard_preferences_insert_own_staff
on public.admin_dashboard_preferences
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy dashboard_preferences_update_own_staff
on public.admin_dashboard_preferences
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy dashboard_preferences_delete_own_staff
on public.admin_dashboard_preferences
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

-- 2) daily_logs: staff can aggregate logs from patients in their own tenant.
-- This removes the need to send thousands of patient IDs through PostgREST.
drop policy if exists daily_logs_admin_select on public.daily_logs;
drop policy if exists daily_logs_user_select on public.daily_logs;
drop policy if exists daily_logs_staff_select on public.daily_logs;

create policy daily_logs_user_select
on public.daily_logs
for select
to authenticated
using (user_id = (select auth.uid()));

create policy daily_logs_staff_select
on public.daily_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles target
    join public.profiles viewer
      on viewer.user_id = (select auth.uid())
     and viewer.tenant_id = target.tenant_id
    where target.user_id = daily_logs.user_id
      and lower(coalesce(viewer.role,'')) in ('admin','nutritionist','nutri')
  )
);

-- 3) Latest risk per patient. security_invoker preserves patient_risk_scores RLS.
drop view if exists public.latest_patient_risk_scores;
create view public.latest_patient_risk_scores
with (security_invoker = true)
as
select distinct on (tenant_id, user_id)
  id,
  tenant_id,
  user_id,
  overall_risk,
  attention_bucket,
  days_since_activity,
  checkin_overdue,
  consultation_overdue,
  protocol_ending,
  lifecycle_next_action,
  calculated_at,
  calculated_date
from public.patient_risk_scores
order by tenant_id, user_id, calculated_at desc nulls last, calculated_date desc;

revoke all on public.latest_patient_risk_scores from public, anon;
grant select on public.latest_patient_risk_scores to authenticated;
grant select on public.latest_patient_risk_scores to service_role;
