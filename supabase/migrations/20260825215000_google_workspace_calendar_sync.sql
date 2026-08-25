create table if not exists public.appointment_calendar_sync (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null,
  provider text not null default 'google' check (provider in ('google')),
  external_calendar_id text,
  external_event_id text,
  status text not null default 'pending' check (status in ('pending','syncing','synced','error','delete_pending','deleted')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, appointment_id, provider)
);

create index if not exists appointment_calendar_sync_queue_idx
  on public.appointment_calendar_sync(status, next_attempt_at, updated_at)
  where status in ('pending','error','delete_pending','syncing');

alter table public.appointment_calendar_sync enable row level security;
revoke all on public.appointment_calendar_sync from anon;
revoke insert, update, delete on public.appointment_calendar_sync from authenticated;
grant select on public.appointment_calendar_sync to authenticated;
grant select, insert, update, delete on public.appointment_calendar_sync to service_role;

drop policy if exists appointment_calendar_sync_staff_select on public.appointment_calendar_sync;
create policy appointment_calendar_sync_staff_select
on public.appointment_calendar_sync
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = appointment_calendar_sync.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create or replace function public.queue_google_calendar_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
  v_appointment uuid;
  v_status text;
begin
  if tg_op = 'UPDATE' then
    if row(
      old.scheduled_at, old.ends_at, old.duration_minutes, old.status,
      old.is_virtual, old.meeting_link, old.location_address,
      old.appointment_type, old.appointment_type_id, old.patient_id,
      old.crm_contact_id, old.nutritionist_id
    ) is not distinct from row(
      new.scheduled_at, new.ends_at, new.duration_minutes, new.status,
      new.is_virtual, new.meeting_link, new.location_address,
      new.appointment_type, new.appointment_type_id, new.patient_id,
      new.crm_contact_id, new.nutritionist_id
    ) then
      return new;
    end if;
  end if;

  v_tenant := case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
  v_appointment := case when tg_op='DELETE' then old.id else new.id end;
  v_status := case when tg_op='DELETE' then 'delete_pending' else 'pending' end;

  insert into public.appointment_calendar_sync(
    tenant_id, appointment_id, provider, status, attempt_count,
    next_attempt_at, locked_at, last_error, updated_at
  ) values (
    v_tenant, v_appointment, 'google', v_status, 0,
    null, null, null, now()
  )
  on conflict (tenant_id,appointment_id,provider) do update set
    status=excluded.status,
    attempt_count=0,
    next_attempt_at=null,
    locked_at=null,
    last_error=null,
    updated_at=now();

  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function public.queue_google_calendar_sync() from public, anon, authenticated;
grant execute on function public.queue_google_calendar_sync() to service_role;

drop trigger if exists trg_queue_google_calendar_sync on public.appointments;
create trigger trg_queue_google_calendar_sync
after insert or update or delete on public.appointments
for each row execute function public.queue_google_calendar_sync();

-- Backfill apenas consultas futuras/ativas; canceladas entram na fila apenas se já tiverem sido sincronizadas no futuro.
insert into public.appointment_calendar_sync(tenant_id,appointment_id,provider,status)
select a.tenant_id,a.id,'google','pending'
from public.appointments a
where a.scheduled_at >= now() - interval '1 day'
  and a.status in ('scheduled','confirmed','in_progress')
on conflict (tenant_id,appointment_id,provider) do nothing;

create or replace function public.service_claim_google_calendar_sync(p_limit integer default 25)
returns table(
  sync_id uuid,
  tenant_id uuid,
  appointment_id uuid,
  external_calendar_id text,
  external_event_id text,
  sync_status text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'privileged role required';
  end if;

  update public.appointment_calendar_sync
  set status='error', locked_at=null,
      next_attempt_at=now(),
      last_error=coalesce(last_error,'sync lock expired'),
      updated_at=now()
  where status='syncing' and locked_at < now() - interval '10 minutes';

  return query
  with candidates as (
    select s.id
    from public.appointment_calendar_sync s
    where s.status in ('pending','error','delete_pending')
      and (s.next_attempt_at is null or s.next_attempt_at <= now())
      and s.attempt_count < 8
    order by coalesce(s.next_attempt_at,s.updated_at), s.updated_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.appointment_calendar_sync s
    set status='syncing',
        locked_at=now(),
        attempt_count=s.attempt_count+1,
        updated_at=now()
    from candidates c
    where s.id=c.id
    returning s.*
  )
  select c.id,c.tenant_id,c.appointment_id,c.external_calendar_id,c.external_event_id,c.status,c.attempt_count
  from claimed c;
end;
$$;

revoke all on function public.service_claim_google_calendar_sync(integer) from public, anon, authenticated;
grant execute on function public.service_claim_google_calendar_sync(integer) to service_role;

create or replace function public.service_verify_google_calendar_dispatch_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_hash text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then return false; end if;
  if p_token is null or length(p_token) < 32 then return false; end if;
  select token_hash into v_hash from public.internal_dispatch_tokens where name='google_calendar' limit 1;
  return v_hash is not null and v_hash = encode(extensions.digest(p_token,'sha256'),'hex');
end;
$$;

revoke all on function public.service_verify_google_calendar_dispatch_token(text) from public, anon, authenticated;
grant execute on function public.service_verify_google_calendar_dispatch_token(text) to service_role;

-- Token interno do scheduler. O valor claro fica apenas no Vault; a tabela mantém somente SHA-256.
do $$
declare
  v_token text;
  v_existing uuid;
begin
  select id into v_existing from vault.secrets where name='google_calendar_dispatch_token' order by created_at desc limit 1;
  if v_existing is null then
    v_token := encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(v_token,'google_calendar_dispatch_token','Token interno do scheduler Google Calendar');
  else
    select decrypted_secret into v_token from vault.decrypted_secrets where id=v_existing;
  end if;

  insert into public.internal_dispatch_tokens(name,token_hash,created_at,rotated_at)
  values ('google_calendar',encode(extensions.digest(v_token,'sha256'),'hex'),now(),now())
  on conflict (name) do update set token_hash=excluded.token_hash,rotated_at=now();
end $$;

-- Supabase Cron, sem consumir slot de Vercel Cron.
do $$ declare r record; begin
  for r in select jobid from cron.job where jobname='google-calendar-sync' loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'google-calendar-sync',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url:='https://antszuxeairmbctwuafo.supabase.co/functions/v1/google-calendar-sync',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'x-dispatch-token',(select decrypted_secret from vault.decrypted_secrets where name='google_calendar_dispatch_token' order by created_at desc limit 1)
      ),
      body:='{"action":"dispatch","limit":25}'::jsonb,
      timeout_milliseconds:=20000
    );
  $cron$
);

comment on table public.appointment_calendar_sync is 'Fila idempotente de sincronização da agenda interna com Google Calendar/Meet.';
