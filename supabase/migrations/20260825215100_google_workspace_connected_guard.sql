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

  -- Sem refresh token não existe integração ativa e nenhuma fila é criada.
  -- Para DELETE, uma linha já sincronizada continua sendo tombstonada mesmo
  -- se a credencial tiver sido temporariamente desativada.
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.tenant_vital_settings s
    where s.tenant_id=v_tenant
      and s.provider='google_workspace'
      and s.setting_key='REFRESH_TOKEN'
      and s.enabled=true
      and s.secret_id is not null
  ) then
    return new;
  end if;

  if tg_op='DELETE' and not exists (
    select 1 from public.appointment_calendar_sync s
    where s.tenant_id=v_tenant and s.appointment_id=v_appointment and s.provider='google'
  ) then
    return old;
  end if;

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
      and exists (
        select 1 from public.tenant_vital_settings v
        where v.tenant_id=s.tenant_id
          and v.provider='google_workspace'
          and v.setting_key='REFRESH_TOKEN'
          and v.enabled=true
          and v.secret_id is not null
      )
      and exists (
        select 1 from public.tenant_vital_settings v
        where v.tenant_id=s.tenant_id
          and v.provider='google_workspace'
          and v.setting_key='CLIENT_ID'
          and v.enabled=true
          and nullif(v.config_value,'') is not null
      )
      and exists (
        select 1 from public.tenant_vital_settings v
        where v.tenant_id=s.tenant_id
          and v.provider='google_workspace'
          and v.setting_key='CLIENT_SECRET'
          and v.enabled=true
          and v.secret_id is not null
      )
    order by coalesce(s.next_attempt_at,s.updated_at), s.updated_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.appointment_calendar_sync s
    set status='syncing', locked_at=now(), attempt_count=s.attempt_count+1, updated_at=now()
    from candidates c
    where s.id=c.id
    returning s.*
  )
  select c.id,c.tenant_id,c.appointment_id,c.external_calendar_id,c.external_event_id,c.status,c.attempt_count
  from claimed c;
end;
$$;

revoke all on function public.queue_google_calendar_sync() from public, anon, authenticated;
grant execute on function public.queue_google_calendar_sync() to service_role;
revoke all on function public.service_claim_google_calendar_sync(integer) from public, anon, authenticated;
grant execute on function public.service_claim_google_calendar_sync(integer) to service_role;
