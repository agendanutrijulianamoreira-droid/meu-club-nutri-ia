-- Fase 4 / Bloco 4: scheduler transacional no próprio Postgres.
-- Evita depender dos limites de Cron do plano Hobby da Vercel.

create or replace function public.run_appointment_communication_cycle()
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_tenant record;
  v_materialized jsonb;
  v_dispatch jsonb;
  v_tenants integer:=0;
  v_confirmation_created integer:=0;
  v_reminder_created integer:=0;
  v_cancelled integer:=0;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'privileged role required';
  end if;

  for v_tenant in select id from public.tenants order by created_at loop
    v_materialized:=public.materialize_appointment_communication_jobs(v_tenant.id,now());
    v_tenants:=v_tenants+1;
    v_confirmation_created:=v_confirmation_created+coalesce((v_materialized->>'confirmation_created')::integer,0);
    v_reminder_created:=v_reminder_created+coalesce((v_materialized->>'reminder_created')::integer,0);
    v_cancelled:=v_cancelled+coalesce((v_materialized->>'cancelled')::integer,0);
  end loop;

  v_dispatch:=public.service_dispatch_appointment_inbox(200);

  return jsonb_build_object(
    'tenants',v_tenants,
    'confirmation_created',v_confirmation_created,
    'reminder_created',v_reminder_created,
    'cancelled',v_cancelled,
    'dispatch',v_dispatch
  );
end;$$;

revoke all on function public.run_appointment_communication_cycle() from public,anon,authenticated;
grant execute on function public.run_appointment_communication_cycle() to service_role;

-- Nome estável: cron.schedule atualiza o job se já existir com o mesmo nome.
select cron.schedule(
  'appointment-communication-cycle',
  '*/15 * * * *',
  $$select public.run_appointment_communication_cycle();$$
);
