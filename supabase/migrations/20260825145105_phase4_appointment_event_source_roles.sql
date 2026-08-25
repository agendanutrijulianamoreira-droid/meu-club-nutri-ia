create or replace function public.log_appointment_status_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid;
  v_role text;
  v_source text;
begin
  select u.id into v_actor from auth.users u where u.id=auth.uid();
  if v_actor is not null then
    select lower(coalesce(p.role,'')) into v_role from public.profiles p where p.user_id=v_actor and p.tenant_id=new.tenant_id;
  end if;
  v_source:=case
    when v_actor is null then 'system'
    when v_role='patient' then 'patient'
    when v_role in ('admin','nutritionist','nutri') then 'staff'
    else 'authenticated'
  end;
  if tg_op='INSERT' then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,null,new.status,v_source,v_actor,'created',jsonb_build_object('scheduled_at',new.scheduled_at,'duration_minutes',new.duration_minutes,'appointment_type_id',new.appointment_type_id));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,v_actor,'status_changed',jsonb_build_object('scheduled_at',new.scheduled_at,'reason',new.cancellation_reason));
  end if;
  if new.scheduled_at is distinct from old.scheduled_at then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,v_actor,'rescheduled',jsonb_build_object('from',old.scheduled_at,'to',new.scheduled_at,'override',new.schedule_override,'override_reason',new.override_reason));
  end if;
  if new.appointment_type_id is distinct from old.appointment_type_id or new.duration_minutes is distinct from old.duration_minutes or new.is_virtual is distinct from old.is_virtual then
    insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
    values(new.tenant_id,new.id,old.status,new.status,v_source,v_actor,'details_changed',jsonb_build_object('appointment_type_id',new.appointment_type_id,'duration_minutes',new.duration_minutes,'is_virtual',new.is_virtual));
  end if;
  return new;
end;$$;
revoke all on function public.log_appointment_status_event() from public,anon,authenticated;