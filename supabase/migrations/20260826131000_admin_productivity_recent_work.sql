create table if not exists public.admin_recent_work (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  title text not null,
  work_type text not null default 'navigation',
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_recent_work_route_not_blank check (length(trim(route)) > 0),
  constraint admin_recent_work_title_not_blank check (length(trim(title)) > 0),
  constraint admin_recent_work_user_tenant_route_key unique (user_id, tenant_id, route)
);

create index if not exists admin_recent_work_user_tenant_recent_idx
  on public.admin_recent_work(user_id, tenant_id, last_opened_at desc);

alter table public.admin_recent_work enable row level security;

revoke all on table public.admin_recent_work from anon;
revoke all on table public.admin_recent_work from authenticated;
grant select, insert, update, delete on table public.admin_recent_work to authenticated;
grant select, insert, update, delete on table public.admin_recent_work to service_role;

create policy admin_recent_work_select_own_staff
on public.admin_recent_work for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_recent_work.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy admin_recent_work_insert_own_staff
on public.admin_recent_work for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_recent_work.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy admin_recent_work_update_own_staff
on public.admin_recent_work for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_recent_work.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_recent_work.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy admin_recent_work_delete_own_staff
on public.admin_recent_work for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.tenant_id = admin_recent_work.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

comment on table public.admin_recent_work is 'Recent administrative work destinations used by the productivity layer. Scoped to the signed-in staff member and tenant.';
