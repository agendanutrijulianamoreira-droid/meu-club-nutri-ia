create table if not exists public.admin_dashboard_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  layout_mode text not null default 'today' check (layout_mode in ('today','clinical','management')),
  visible_widgets jsonb not null default '["today","attention","pending","commercial","summary"]'::jsonb,
  favorite_shortcuts jsonb not null default '["new_patient","new_appointment","new_meal_plan","attention"]'::jsonb,
  attention_rules jsonb not null default '{"no_checkin_days":3,"no_next_appointment_days":7,"inactive_days":21,"protocol_ending_days":3,"unanswered_message_hours":24}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create index if not exists admin_dashboard_preferences_tenant_idx on public.admin_dashboard_preferences (tenant_id);

alter table public.admin_dashboard_preferences enable row level security;

revoke all on table public.admin_dashboard_preferences from anon;
revoke all on table public.admin_dashboard_preferences from authenticated;
grant select, insert, update, delete on table public.admin_dashboard_preferences to authenticated;
grant select, insert, update, delete on table public.admin_dashboard_preferences to service_role;

drop policy if exists dashboard_preferences_select_own_staff on public.admin_dashboard_preferences;
create policy dashboard_preferences_select_own_staff
on public.admin_dashboard_preferences for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and p.role in ('admin','nutritionist')
  )
);

drop policy if exists dashboard_preferences_insert_own_staff on public.admin_dashboard_preferences;
create policy dashboard_preferences_insert_own_staff
on public.admin_dashboard_preferences for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and p.role in ('admin','nutritionist')
  )
);

drop policy if exists dashboard_preferences_update_own_staff on public.admin_dashboard_preferences;
create policy dashboard_preferences_update_own_staff
on public.admin_dashboard_preferences for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and p.role in ('admin','nutritionist')
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and p.role in ('admin','nutritionist')
  )
);

drop policy if exists dashboard_preferences_delete_own_staff on public.admin_dashboard_preferences;
create policy dashboard_preferences_delete_own_staff
on public.admin_dashboard_preferences for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_dashboard_preferences.tenant_id
      and p.role in ('admin','nutritionist')
  )
);

comment on table public.admin_dashboard_preferences is 'Preferencias pessoais do Painel 2.0 por usuario staff e tenant.';
