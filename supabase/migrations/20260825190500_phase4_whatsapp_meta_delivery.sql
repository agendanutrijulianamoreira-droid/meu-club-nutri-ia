-- Fase 4 / Bloco 5 — WhatsApp Meta Cloud API
-- Fila única: WhatsApp quando configurado + consentido; Inbox como padrão/fallback.

create table if not exists public.appointment_communication_channel_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  whatsapp_enabled boolean not null default false,
  whatsapp_provider text not null default 'meta_cloud' check (whatsapp_provider in ('meta_cloud')),
  whatsapp_phone_number_id text,
  whatsapp_waba_id text,
  whatsapp_graph_version text not null default 'v26.0',
  whatsapp_access_token_env text not null default 'WHATSAPP_ACCESS_TOKEN',
  whatsapp_verify_token_env text not null default 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  whatsapp_app_secret_env text not null default 'WHATSAPP_APP_SECRET',
  fallback_to_inbox boolean not null default true,
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start time not null default time '20:00',
  quiet_hours_end time not null default time '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint appointment_channel_env_names_chk check (
    whatsapp_access_token_env ~ '^[A-Z][A-Z0-9_]{2,127}$' and
    whatsapp_verify_token_env ~ '^[A-Z][A-Z0-9_]{2,127}$' and
    whatsapp_app_secret_env ~ '^[A-Z][A-Z0-9_]{2,127}$'
  ),
  constraint appointment_channel_graph_version_chk check (whatsapp_graph_version ~ '^v[0-9]+\.[0-9]+$')
);
alter table public.appointment_communication_channel_settings enable row level security;
drop policy if exists "Staff manages appointment channel settings" on public.appointment_communication_channel_settings;
create policy "Staff manages appointment channel settings" on public.appointment_communication_channel_settings for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_communication_channel_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_communication_channel_settings.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
revoke all on public.appointment_communication_channel_settings from anon;
grant select,insert,update,delete on public.appointment_communication_channel_settings to authenticated;
grant all on public.appointment_communication_channel_settings to service_role;
insert into public.appointment_communication_channel_settings(tenant_id) select id from public.tenants on conflict(tenant_id) do nothing;

create table if not exists public.appointment_communication_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email')),
  status text not null default 'unknown' check (status in ('unknown','opt_in','opt_out')),
  source text not null default 'staff_recorded' check (source in ('patient','staff_recorded','import','checkout','form','system')),
  captured_at timestamptz,
  revoked_at timestamptz,
  evidence text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,patient_id,channel)
);
alter table public.appointment_communication_consents enable row level security;
drop policy if exists "Patients read own communication consent" on public.appointment_communication_consents;
create policy "Patients read own communication consent" on public.appointment_communication_consents for select to authenticated using(patient_id=auth.uid());
drop policy if exists "Staff manages communication consent" on public.appointment_communication_consents;
create policy "Staff manages communication consent" on public.appointment_communication_consents for all to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_communication_consents.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_communication_consents.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
revoke all on public.appointment_communication_consents from anon;
grant select,insert,update,delete on public.appointment_communication_consents to authenticated;
grant all on public.appointment_communication_consents to service_role;

alter table public.appointment_communication_templates
  add column if not exists provider_template_name text,
  add column if not exists provider_language text,
  add column if not exists provider_parameters jsonb not null default '[]'::jsonb;
insert into public.appointment_communication_templates(tenant_id,kind,channel,title,body,active,provider_language,provider_parameters)
select t.id,'confirmation_request','whatsapp','Confirmação de consulta','Template aprovado pela Meta para confirmação de consulta.',false,'pt_BR','["patient_name","appointment_date","appointment_time","appointment_type"]'::jsonb
from public.tenants t where not exists(select 1 from public.appointment_communication_templates x where x.tenant_id=t.id and x.kind='confirmation_request' and x.channel='whatsapp');
insert into public.appointment_communication_templates(tenant_id,kind,channel,title,body,active,provider_language,provider_parameters)
select t.id,'reminder','whatsapp','Lembrete de consulta','Template aprovado pela Meta para lembrete de consulta.',false,'pt_BR','["patient_name","appointment_date","appointment_time","appointment_type"]'::jsonb
from public.tenants t where not exists(select 1 from public.appointment_communication_templates x where x.tenant_id=t.id and x.kind='reminder' and x.channel='whatsapp');

create table if not exists public.appointment_communication_delivery_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid references public.appointment_communication_jobs(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status text not null check(status in ('accepted','sent','delivered','read','failed','deleted')),
  event_at timestamptz not null default now(),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists appointment_delivery_events_job_idx on public.appointment_communication_delivery_events(job_id,event_at desc);
create index if not exists appointment_delivery_events_provider_id_idx on public.appointment_communication_delivery_events(provider,provider_message_id) where provider_message_id is not null;
alter table public.appointment_communication_delivery_events enable row level security;
drop policy if exists "Staff reads appointment delivery events" on public.appointment_communication_delivery_events;
create policy "Staff reads appointment delivery events" on public.appointment_communication_delivery_events for select to authenticated
using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=appointment_communication_delivery_events.tenant_id and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')));
revoke all on public.appointment_communication_delivery_events from anon,authenticated;
grant select on public.appointment_communication_delivery_events to authenticated;
grant all on public.appointment_communication_delivery_events to service_role;

create or replace function public.appointment_whatsapp_route_available(p_tenant_id uuid,p_patient_id uuid,p_kind text)
returns boolean language sql stable set search_path=public,pg_temp as $$
select exists(
  select 1
  from public.appointment_communication_channel_settings s
  join public.appointment_communication_templates t on t.tenant_id=s.tenant_id and t.kind=p_kind and t.channel='whatsapp'
  join public.appointment_communication_consents c on c.tenant_id=s.tenant_id and c.patient_id=p_patient_id and c.channel='whatsapp'
  join public.profiles p on p.tenant_id=s.tenant_id and p.user_id=p_patient_id
  where s.tenant_id=p_tenant_id and s.whatsapp_enabled=true
    and nullif(trim(s.whatsapp_phone_number_id),'') is not null
    and t.active=true and nullif(trim(t.provider_template_name),'') is not null
    and c.status='opt_in'
    and nullif(regexp_replace(coalesce(p.phone,''),'\D','','g'),'') is not null
    and not exists(select 1 from public.crm_contacts cc where cc.tenant_id=p_tenant_id and cc.linked_user_id=p_patient_id and cc.do_not_contact=true)
);$$;
revoke all on function public.appointment_whatsapp_route_available(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.appointment_whatsapp_route_available(uuid,uuid,text) to service_role;

create or replace function public.service_dispatch_appointment_inbox(p_limit integer default 50)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare v_job public.appointment_communication_jobs%rowtype;v_template public.appointment_communication_templates%rowtype;v_appointment public.appointments%rowtype;v_message_id uuid;v_sent int:=0;v_cancelled int:=0;v_failed int:=0;
begin
 if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
 if p_limit is null or p_limit<1 or p_limit>200 then raise exception 'Limite inválido'; end if;
 for v_job in select j.* from public.appointment_communication_jobs j
   where j.status in('ready','failed') and j.due_at<=now() and (j.next_attempt_at is null or j.next_attempt_at<=now()) and j.attempt_count<j.max_attempts
     and (j.channel='inbox' or not public.appointment_whatsapp_route_available(j.tenant_id,j.patient_id,j.kind))
   order by j.due_at,j.created_at for update skip locked limit p_limit loop
  begin
   update public.appointment_communication_jobs set locked_at=now(),updated_at=now() where id=v_job.id;
   select * into v_appointment from public.appointments a where a.id=v_job.appointment_id and a.tenant_id=v_job.tenant_id;
   if v_appointment.id is null or v_appointment.status not in('scheduled','confirmed','in_progress') then update public.appointment_communication_jobs set status='cancelled',locked_at=null,updated_at=now(),last_error=null where id=v_job.id;v_cancelled:=v_cancelled+1;continue;end if;
   if v_job.kind='confirmation_request' and v_appointment.status='confirmed' then update public.appointment_communication_jobs set status='cancelled',locked_at=null,updated_at=now(),last_error=null where id=v_job.id;v_cancelled:=v_cancelled+1;continue;end if;
   select * into v_template from public.appointment_communication_templates t where t.tenant_id=v_job.tenant_id and t.kind=v_job.kind and t.channel='inbox' and t.active=true;
   if v_template.id is null then update public.appointment_communication_jobs set status='failed',attempt_count=attempt_count+1,next_attempt_at=now()+interval '6 hours',locked_at=null,last_error='Template Inbox ativo não encontrado',failed_at=now(),updated_at=now() where id=v_job.id;v_failed:=v_failed+1;continue;end if;
   if v_job.provider='inbox' and v_job.provider_message_id is not null and exists(select 1 from public.inbox_messages im where im.id::text=v_job.provider_message_id) then update public.appointment_communication_jobs set status='sent',sent_at=coalesce(sent_at,now()),delivered_at=coalesce(delivered_at,now()),locked_at=null,last_error=null,updated_at=now() where id=v_job.id;continue;end if;
   insert into public.inbox_messages(tenant_id,user_id,agent_name,title,body,message_type,priority,cta_label,cta_url,channels,status,metadata)
   values(v_job.tenant_id,v_job.patient_id,'appointment_automation',v_template.title,v_template.body,case when v_job.kind='confirmation_request' then 'appointment_confirmation' else 'appointment_reminder' end,'high',v_template.cta_label,v_template.cta_url,array['inbox']::text[],'unread',jsonb_build_object('appointment_id',v_job.appointment_id,'communication_job_id',v_job.id,'kind',v_job.kind,'fallback_from',case when v_job.metadata ? 'whatsapp_fallback' then 'whatsapp' else null end)) returning id into v_message_id;
   update public.appointment_communication_jobs set status='sent',channel='inbox',provider='inbox',provider_message_id=v_message_id::text,attempt_count=attempt_count+1,sent_at=now(),delivered_at=now(),failed_at=null,next_attempt_at=null,locked_at=null,last_error=null,updated_at=now() where id=v_job.id;
   if v_job.kind='confirmation_request' then update public.appointments set confirmation_sent=true,updated_at=now() where id=v_job.appointment_id;elsif v_job.kind='reminder' then update public.appointments set reminder_sent=true,reminder_sent_at=now(),updated_at=now() where id=v_job.appointment_id;end if;
   v_sent:=v_sent+1;
  exception when others then update public.appointment_communication_jobs set status='failed',attempt_count=attempt_count+1,next_attempt_at=case when attempt_count+1<max_attempts then now()+interval '1 hour' else null end,failed_at=now(),locked_at=null,last_error=left(sqlerrm,500),updated_at=now() where id=v_job.id;v_failed:=v_failed+1;end;
 end loop;
 return jsonb_build_object('sent',v_sent,'cancelled',v_cancelled,'failed',v_failed);
end;$$;
revoke all on function public.service_dispatch_appointment_inbox(integer) from public,anon,authenticated;
grant execute on function public.service_dispatch_appointment_inbox(integer) to service_role;

create or replace function public.service_claim_appointment_whatsapp_jobs(p_limit integer default 25)
returns table(job_id uuid,tenant_id uuid,appointment_id uuid,patient_id uuid,kind text,phone text,patient_name text,scheduled_at timestamptz,timezone text,appointment_type text,template_name text,template_language text,parameter_keys jsonb,phone_number_id text,graph_version text,access_token_env text,verify_token_env text,app_secret_env text,fallback_to_inbox boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_user not in('postgres','service_role','supabase_admin') then raise exception 'privileged role required';end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Limite inválido';end if;
 return query with candidates as(
  select j.id from public.appointment_communication_jobs j join public.appointment_communication_channel_settings s on s.tenant_id=j.tenant_id
  where j.status in('ready','failed') and j.due_at<=now() and (j.next_attempt_at is null or j.next_attempt_at<=now()) and j.attempt_count<j.max_attempts and coalesce(j.channel,'whatsapp')='whatsapp'
    and public.appointment_whatsapp_route_available(j.tenant_id,j.patient_id,j.kind) and not(j.metadata ? 'whatsapp_fallback')
    and (not s.quiet_hours_enabled or case when s.quiet_hours_start<s.quiet_hours_end then ((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time not between s.quiet_hours_start and s.quiet_hours_end) else not(((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time>=s.quiet_hours_start) or ((now() at time zone coalesce((select tas.timezone from public.tenant_appointment_settings tas where tas.tenant_id=j.tenant_id),'America/Sao_Paulo'))::time<s.quiet_hours_end)) end)
  order by j.due_at,j.created_at for update of j skip locked limit p_limit
 ),locked as(update public.appointment_communication_jobs j set locked_at=now(),channel='whatsapp',provider='meta_cloud',updated_at=now() from candidates c where j.id=c.id returning j.*)
 select l.id,l.tenant_id,l.appointment_id,l.patient_id,l.kind,regexp_replace(coalesce(p.phone,''),'\D','','g'),coalesce(nullif(p.name,''),'Paciente'),a.scheduled_at,coalesce(tas.timezone,'America/Sao_Paulo'),coalesce(at.name,'Consulta'),tpl.provider_template_name,coalesce(nullif(tpl.provider_language,''),'pt_BR'),coalesce(tpl.provider_parameters,'[]'::jsonb),s.whatsapp_phone_number_id,s.whatsapp_graph_version,s.whatsapp_access_token_env,s.whatsapp_verify_token_env,s.whatsapp_app_secret_env,s.fallback_to_inbox
 from locked l join public.profiles p on p.user_id=l.patient_id and p.tenant_id=l.tenant_id join public.appointments a on a.id=l.appointment_id and a.tenant_id=l.tenant_id left join public.appointment_types at on at.id=a.appointment_type_id and at.tenant_id=a.tenant_id left join public.tenant_appointment_settings tas on tas.tenant_id=l.tenant_id join public.appointment_communication_channel_settings s on s.tenant_id=l.tenant_id join public.appointment_communication_templates tpl on tpl.tenant_id=l.tenant_id and tpl.kind=l.kind and tpl.channel='whatsapp' and tpl.active=true;
end;$$;
revoke all on function public.service_claim_appointment_whatsapp_jobs(integer) from public,anon,authenticated;
grant execute on function public.service_claim_appointment_whatsapp_jobs(integer) to service_role;

create or replace function public.service_complete_appointment_whatsapp_job(p_job_id uuid,p_success boolean,p_provider_message_id text default null,p_error text default null,p_retryable boolean default true,p_response_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.appointment_communication_jobs%rowtype;v_fallback boolean:=true;v_attempt int;
begin
 if current_user not in('postgres','service_role','supabase_admin') then raise exception 'privileged role required';end if;
 select * into v_job from public.appointment_communication_jobs where id=p_job_id for update;if v_job.id is null then raise exception 'job not found';end if;if v_job.provider<>'meta_cloud' or v_job.channel<>'whatsapp' then raise exception 'job is not a WhatsApp Meta claim';end if;
 select coalesce(s.fallback_to_inbox,true) into v_fallback from public.appointment_communication_channel_settings s where s.tenant_id=v_job.tenant_id;v_attempt:=v_job.attempt_count+1;
 if p_success then
  if nullif(trim(p_provider_message_id),'') is null then raise exception 'provider_message_id required';end if;
  update public.appointment_communication_jobs set status='sent',provider_message_id=p_provider_message_id,attempt_count=v_attempt,sent_at=coalesce(sent_at,now()),failed_at=null,next_attempt_at=null,locked_at=null,last_error=null,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('meta_response',coalesce(p_response_metadata,'{}'::jsonb)),updated_at=now() where id=p_job_id;
  insert into public.appointment_communication_delivery_events(tenant_id,job_id,provider,provider_message_id,status,metadata) values(v_job.tenant_id,p_job_id,'meta_cloud',p_provider_message_id,'accepted',coalesce(p_response_metadata,'{}'::jsonb));
  if v_job.kind='confirmation_request' then update public.appointments set confirmation_sent=true,updated_at=now() where id=v_job.appointment_id;elsif v_job.kind='reminder' then update public.appointments set reminder_sent=true,reminder_sent_at=now(),updated_at=now() where id=v_job.appointment_id;end if;
  return jsonb_build_object('status','sent','attempt',v_attempt);
 end if;
 if p_retryable and v_attempt<v_job.max_attempts then update public.appointment_communication_jobs set status='failed',attempt_count=v_attempt,failed_at=now(),locked_at=null,next_attempt_at=now()+case v_attempt when 1 then interval '5 minutes' when 2 then interval '30 minutes' else interval '2 hours' end,last_error=left(coalesce(p_error,'WhatsApp provider error'),500),updated_at=now() where id=p_job_id;return jsonb_build_object('status','retry','attempt',v_attempt);end if;
 if v_fallback then update public.appointment_communication_jobs set status='ready',channel='inbox',provider=null,provider_message_id=null,attempt_count=0,failed_at=now(),next_attempt_at=null,locked_at=null,last_error=left(coalesce(p_error,'WhatsApp provider error'),500),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('whatsapp_fallback',jsonb_build_object('at',now(),'attempts',v_attempt,'reason',left(coalesce(p_error,'provider_error'),300))),updated_at=now() where id=p_job_id;return jsonb_build_object('status','fallback_inbox','attempts',v_attempt);end if;
 update public.appointment_communication_jobs set status='failed',attempt_count=v_attempt,failed_at=now(),next_attempt_at=null,locked_at=null,last_error=left(coalesce(p_error,'WhatsApp provider error'),500),updated_at=now() where id=p_job_id;return jsonb_build_object('status','failed','attempts',v_attempt);
end;$$;
revoke all on function public.service_complete_appointment_whatsapp_job(uuid,boolean,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.service_complete_appointment_whatsapp_job(uuid,boolean,text,text,boolean,jsonb) to service_role;

create table if not exists public.internal_dispatch_tokens(name text primary key,token_hash text not null,created_at timestamptz not null default now(),rotated_at timestamptz);
alter table public.internal_dispatch_tokens enable row level security;
revoke all on public.internal_dispatch_tokens from public,anon,authenticated;
grant select,insert,update,delete on public.internal_dispatch_tokens to service_role;
do $$declare v_token text;begin
 if not exists(select 1 from public.internal_dispatch_tokens where name='appointment_whatsapp_dispatch') then
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.internal_dispatch_tokens(name,token_hash) values('appointment_whatsapp_dispatch',encode(extensions.digest(v_token,'sha256'),'hex'));
  perform vault.create_secret(v_token,'appointment_whatsapp_dispatch_token','Token interno do cron para dispatch WhatsApp da agenda');
 end if;
end$$;
create or replace function public.service_verify_appointment_dispatch_token(p_token text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select coalesce(encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')=(select token_hash from public.internal_dispatch_tokens where name='appointment_whatsapp_dispatch'),false)$$;
revoke all on function public.service_verify_appointment_dispatch_token(text) from public,anon,authenticated;
grant execute on function public.service_verify_appointment_dispatch_token(text) to service_role;

do $$declare v_jobid bigint;begin
 select jobid into v_jobid from cron.job where jobname='appointment-whatsapp-meta-dispatch' limit 1;
 if v_jobid is not null then perform cron.unschedule(v_jobid);end if;
 perform cron.schedule('appointment-whatsapp-meta-dispatch','*/5 * * * *',$cron$
  select net.http_post(
   url:='https://antszuxeairmbctwuafo.supabase.co/functions/v1/appointment-whatsapp-meta',
   headers:=jsonb_build_object('Content-Type','application/json','x-dispatch-token',(select decrypted_secret from vault.decrypted_secrets where name='appointment_whatsapp_dispatch_token' order by created_at desc limit 1)),
   body:='{"action":"dispatch","limit":25}'::jsonb,
   timeout_milliseconds:=20000
  );
 $cron$);
end$$;

comment on table public.appointment_communication_channel_settings is 'Configuração não-secreta de canais transacionais da agenda. Tokens reais ficam em Edge Function Secrets.';
comment on table public.appointment_communication_consents is 'Consentimento explícito por canal; WhatsApp só roteia quando status=opt_in.';
comment on table public.appointment_communication_delivery_events is 'Eventos de delivery dos provedores externos (accepted/sent/delivered/read/failed).';
