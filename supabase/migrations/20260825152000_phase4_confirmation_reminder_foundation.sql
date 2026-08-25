alter table public.tenant_appointment_settings
  add column appointment_confirmation_enabled boolean not null default true,
  add column appointment_confirmation_lead_hours integer not null default 72,
  add column appointment_reminder_enabled boolean not null default true,
  add column appointment_reminder_lead_hours integer not null default 24;

alter table public.tenant_appointment_settings
  add constraint tenant_appointment_confirmation_lead_hours_check
    check (appointment_confirmation_lead_hours between 1 and 336),
  add constraint tenant_appointment_reminder_lead_hours_check
    check (appointment_reminder_lead_hours between 1 and 336);

create table public.appointment_communication_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('confirmation_request','reminder')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','ready','cancelled','sent','failed')),
  channel text,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_communication_jobs_unique unique (appointment_id, kind, due_at)
);

create index appointment_communication_jobs_due_idx
  on public.appointment_communication_jobs(status, due_at)
  where status in ('pending','ready');
create index appointment_communication_jobs_appointment_idx
  on public.appointment_communication_jobs(appointment_id, created_at desc);

alter table public.appointment_communication_jobs enable row level security;

grant select on table public.appointment_communication_jobs to authenticated;
grant select,insert,update,delete on table public.appointment_communication_jobs to service_role;

create policy appointment_communication_jobs_staff_read
on public.appointment_communication_jobs for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.tenant_id=tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy appointment_communication_jobs_patient_read
on public.appointment_communication_jobs for select to authenticated
using (patient_id=(select auth.uid()));

create or replace function public.service_patient_confirm_appointment(
  p_user_id uuid,
  p_appointment_id uuid
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_tenant uuid;
  v_role text;
  v_status text;
  v_scheduled_at timestamptz;
begin
  if p_user_id is null or p_appointment_id is null then raise exception 'Dados obrigatórios ausentes'; end if;

  select p.tenant_id, lower(coalesce(p.role,''))
    into v_tenant, v_role
  from public.profiles p
  where p.user_id=p_user_id;

  if v_tenant is null or v_role <> 'patient' then raise exception 'Acesso de paciente necessário'; end if;

  select a.status, a.scheduled_at
    into v_status, v_scheduled_at
  from public.appointments a
  where a.id=p_appointment_id
    and a.tenant_id=v_tenant
    and a.patient_id=p_user_id
  for update;

  if v_status is null then raise exception 'Consulta não encontrada'; end if;
  if v_status='confirmed' then return p_appointment_id; end if;
  if v_status<>'scheduled' then raise exception 'Esta consulta não pode ser confirmada neste estado'; end if;
  if v_scheduled_at<=now() then raise exception 'Consultas passadas não podem ser confirmadas'; end if;

  update public.appointments
  set status='confirmed', updated_at=now()
  where id=p_appointment_id;

  update public.appointment_status_events e
  set source='patient', actor_user_id=p_user_id,
      metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('action','patient_confirmation')
  where e.id=(
    select x.id from public.appointment_status_events x
    where x.appointment_id=p_appointment_id
      and x.to_status='confirmed'
    order by x.created_at desc
    limit 1
  );

  update public.appointment_communication_jobs
  set status='cancelled', updated_at=now(), metadata=metadata||jsonb_build_object('cancel_reason','already_confirmed')
  where appointment_id=p_appointment_id and kind='confirmation_request' and status in ('pending','ready');

  return p_appointment_id;
end;
$$;

revoke all on function public.service_patient_confirm_appointment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_patient_confirm_appointment(uuid,uuid) to service_role;

create or replace function public.materialize_appointment_communication_jobs(
  p_tenant_id uuid,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_confirmation integer:=0;
  v_reminder integer:=0;
  v_cancelled integer:=0;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'service_role required';
  end if;

  insert into public.appointment_communication_jobs(tenant_id,appointment_id,patient_id,kind,due_at,metadata)
  select a.tenant_id,a.id,a.patient_id,'confirmation_request',
         greatest(p_now,a.scheduled_at-(s.appointment_confirmation_lead_hours*interval '1 hour')),
         jsonb_build_object('scheduled_at',a.scheduled_at,'lead_hours',s.appointment_confirmation_lead_hours)
  from public.appointments a
  join public.tenant_appointment_settings s on s.tenant_id=a.tenant_id
  where a.tenant_id=p_tenant_id
    and s.appointment_confirmation_enabled=true
    and a.status='scheduled'
    and a.scheduled_at>p_now
  on conflict (appointment_id,kind,due_at) do nothing;
  get diagnostics v_confirmation=row_count;

  insert into public.appointment_communication_jobs(tenant_id,appointment_id,patient_id,kind,due_at,metadata)
  select a.tenant_id,a.id,a.patient_id,'reminder',
         greatest(p_now,a.scheduled_at-(s.appointment_reminder_lead_hours*interval '1 hour')),
         jsonb_build_object('scheduled_at',a.scheduled_at,'lead_hours',s.appointment_reminder_lead_hours)
  from public.appointments a
  join public.tenant_appointment_settings s on s.tenant_id=a.tenant_id
  where a.tenant_id=p_tenant_id
    and s.appointment_reminder_enabled=true
    and a.status in ('scheduled','confirmed')
    and a.scheduled_at>p_now
  on conflict (appointment_id,kind,due_at) do nothing;
  get diagnostics v_reminder=row_count;

  update public.appointment_communication_jobs j
  set status='cancelled',updated_at=now(),metadata=j.metadata||jsonb_build_object('cancel_reason','appointment_inactive')
  where j.tenant_id=p_tenant_id
    and j.status in ('pending','ready')
    and exists(
      select 1 from public.appointments a
      where a.id=j.appointment_id and a.status in ('cancelled','completed','no_show')
    );
  get diagnostics v_cancelled=row_count;

  update public.appointment_communication_jobs
  set status='ready',updated_at=now()
  where tenant_id=p_tenant_id and status='pending' and due_at<=p_now;

  return jsonb_build_object('confirmation_created',v_confirmation,'reminder_created',v_reminder,'cancelled',v_cancelled);
end;
$$;

revoke all on function public.materialize_appointment_communication_jobs(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.materialize_appointment_communication_jobs(uuid,timestamptz) to service_role;
