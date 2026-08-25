-- Estado intermediário evita duplicação quando a chamada externa fica incerta.
alter table public.appointment_communication_jobs drop constraint if exists appointment_communication_jobs_status_check;
alter table public.appointment_communication_jobs add constraint appointment_communication_jobs_status_check
  check (status in ('pending','ready','sending','cancelled','sent','failed'));

create or replace function public.service_claim_appointment_whatsapp_jobs(p_limit integer default 25)
returns table(
  job_id uuid,tenant_id uuid,appointment_id uuid,patient_id uuid,kind text,
  phone text,patient_name text,scheduled_at timestamptz,timezone text,
  appointment_type text,template_name text,template_language text,
  parameter_keys jsonb,phone_number_id text,graph_version text,
  access_token_env text,verify_token_env text,app_secret_env text,
  fallback_to_inbox boolean
)
language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Limite inválido'; end if;

  return query
  with candidates as (
    select j.id
    from public.appointment_communication_jobs j
    join public.appointment_communication_channel_settings s on s.tenant_id=j.tenant_id
    where j.status in ('ready','failed')
      and j.due_at<=now()
      and (j.next_attempt_at is null or j.next_attempt_at<=now())
      and j.attempt_count<j.max_attempts
      and (j.locked_at is null or j.locked_at < now()-interval '10 minutes')
      and coalesce(j.channel,'whatsapp')='whatsapp'
      and public.appointment_whatsapp_route_available(j.tenant_id,j.patient_id,j.kind)
      and not (j.metadata ? 'whatsapp_fallback')
      and (
        not s.quiet_hours_enabled
        or case
          when s.quiet_hours_start<s.quiet_hours_end then
            ((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time not between s.quiet_hours_start and s.quiet_hours_end)
          else
            not (
              ((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time >= s.quiet_hours_start)
              or ((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time < s.quiet_hours_end)
            )
        end
      )
    order by j.due_at,j.created_at
    for update of j skip locked
    limit p_limit
  ), locked as (
    update public.appointment_communication_jobs j
       set locked_at=now(),status='sending',channel='whatsapp',provider='meta_cloud',updated_at=now()
      from candidates c
     where j.id=c.id
    returning j.*
  )
  select l.id,l.tenant_id,l.appointment_id,l.patient_id,l.kind,
         regexp_replace(coalesce(p.phone,''),'\D','','g'),
         coalesce(nullif(p.name,''),'Paciente'),a.scheduled_at,
         coalesce(tas.timezone,'America/Sao_Paulo'),coalesce(at.name,'Consulta'),
         tpl.provider_template_name,coalesce(nullif(tpl.provider_language,''),'pt_BR'),
         coalesce(tpl.provider_parameters,'[]'::jsonb),s.whatsapp_phone_number_id,
         s.whatsapp_graph_version,s.whatsapp_access_token_env,s.whatsapp_verify_token_env,
         s.whatsapp_app_secret_env,s.fallback_to_inbox
  from locked l
  join public.profiles p on p.user_id=l.patient_id and p.tenant_id=l.tenant_id
  join public.appointments a on a.id=l.appointment_id and a.tenant_id=l.tenant_id
  left join public.appointment_types at on at.id=a.appointment_type_id and at.tenant_id=a.tenant_id
  left join public.tenant_appointment_settings tas on tas.tenant_id=l.tenant_id
  join public.appointment_communication_channel_settings s on s.tenant_id=l.tenant_id
  join public.appointment_communication_templates tpl on tpl.tenant_id=l.tenant_id and tpl.kind=l.kind and tpl.channel='whatsapp' and tpl.active=true;
end;
$$;
revoke all on function public.service_claim_appointment_whatsapp_jobs(integer) from public,anon,authenticated;
grant execute on function public.service_claim_appointment_whatsapp_jobs(integer) to service_role;

comment on column public.appointment_communication_jobs.status is 'pending/ready/sending/cancelled/sent/failed. sending representa chamada externa em voo e não é reprocessada automaticamente.';
