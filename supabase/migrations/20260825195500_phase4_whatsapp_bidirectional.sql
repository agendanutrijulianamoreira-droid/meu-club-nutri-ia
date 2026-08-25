-- Fase 4 / Bloco 6 — WhatsApp bidirecional para agenda
-- Respostas da paciente -> confirmação, cancelamento e reagendamento auditáveis.

alter table public.appointment_communication_channel_settings
  add column if not exists whatsapp_allow_confirm boolean not null default true,
  add column if not exists whatsapp_allow_cancel boolean not null default true,
  add column if not exists whatsapp_allow_reschedule boolean not null default true;

alter table public.appointment_communication_templates
  add column if not exists provider_quick_reply_actions jsonb not null default '[]'::jsonb;

create table if not exists public.appointment_whatsapp_conversations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  state text not null default 'idle' check (state in ('idle','awaiting_cancel_reason','awaiting_reschedule_selection')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, patient_id)
);
alter table public.appointment_whatsapp_conversations enable row level security;

drop policy if exists "Staff reads WhatsApp appointment conversations" on public.appointment_whatsapp_conversations;
create policy "Staff reads WhatsApp appointment conversations"
on public.appointment_whatsapp_conversations for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=auth.uid() and p.tenant_id=appointment_whatsapp_conversations.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));
revoke all on public.appointment_whatsapp_conversations from anon,authenticated;
grant select on public.appointment_whatsapp_conversations to authenticated;
grant all on public.appointment_whatsapp_conversations to service_role;

create table if not exists public.appointment_whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_message_id text not null,
  phone_number_id text not null,
  from_phone text not null,
  patient_id uuid references auth.users(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  context_provider_message_id text,
  message_type text not null,
  message_text text,
  action_id text,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','needs_staff','failed')),
  result_action text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_message_id)
);
create index if not exists appointment_whatsapp_inbound_patient_idx on public.appointment_whatsapp_inbound_messages(tenant_id,patient_id,received_at desc);
create index if not exists appointment_whatsapp_inbound_appointment_idx on public.appointment_whatsapp_inbound_messages(appointment_id,received_at desc);
alter table public.appointment_whatsapp_inbound_messages enable row level security;

drop policy if exists "Staff reads WhatsApp inbound messages" on public.appointment_whatsapp_inbound_messages;
create policy "Staff reads WhatsApp inbound messages"
on public.appointment_whatsapp_inbound_messages for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=auth.uid() and p.tenant_id=appointment_whatsapp_inbound_messages.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));
revoke all on public.appointment_whatsapp_inbound_messages from anon,authenticated;
grant select on public.appointment_whatsapp_inbound_messages to authenticated;
grant all on public.appointment_whatsapp_inbound_messages to service_role;

create table if not exists public.appointment_whatsapp_reschedule_options (
  token uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  local_start timestamp without time zone not null,
  local_end timestamp without time zone not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists appointment_wa_reschedule_appt_idx on public.appointment_whatsapp_reschedule_options(appointment_id,created_at desc);
alter table public.appointment_whatsapp_reschedule_options enable row level security;

drop policy if exists "Staff reads WhatsApp reschedule options" on public.appointment_whatsapp_reschedule_options;
create policy "Staff reads WhatsApp reschedule options"
on public.appointment_whatsapp_reschedule_options for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=auth.uid() and p.tenant_id=appointment_whatsapp_reschedule_options.tenant_id
    and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
));
revoke all on public.appointment_whatsapp_reschedule_options from anon,authenticated;
grant select on public.appointment_whatsapp_reschedule_options to authenticated;
grant all on public.appointment_whatsapp_reschedule_options to service_role;

create or replace function public.service_cancel_appointment_from_whatsapp(
  p_tenant_id uuid, p_patient_id uuid, p_appointment_id uuid, p_reason text
) returns uuid
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_status text; v_scheduled timestamptz; v_require_reason boolean; v_reason text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  select a.status,a.scheduled_at into v_status,v_scheduled
  from public.appointments a
  where a.id=p_appointment_id and a.tenant_id=p_tenant_id and a.patient_id=p_patient_id
  for update;
  if v_status is null then raise exception 'Consulta não encontrada'; end if;
  if v_status='cancelled' then return p_appointment_id; end if;
  if v_status not in ('scheduled','confirmed') or v_scheduled<=now() then raise exception 'Esta consulta não pode ser cancelada pelo WhatsApp'; end if;
  select coalesce(s.require_cancellation_reason,true) into v_require_reason
  from public.tenant_appointment_settings s where s.tenant_id=p_tenant_id;
  v_reason:=nullif(trim(coalesce(p_reason,'')),'');
  if coalesce(v_require_reason,true) and v_reason is null then raise exception 'Motivo do cancelamento é obrigatório'; end if;
  v_reason:=coalesce(v_reason,'Cancelada pela paciente via WhatsApp');
  update public.appointments
  set status='cancelled', cancellation_reason=v_reason, cancelled_at=now(), cancelled_by=p_patient_id, updated_at=now()
  where id=p_appointment_id;
  update public.appointment_status_events e
  set source='whatsapp', actor_user_id=p_patient_id,
      metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('action','patient_cancelled_whatsapp','reason',v_reason)
  where e.id=(select x.id from public.appointment_status_events x where x.appointment_id=p_appointment_id and x.to_status='cancelled' order by x.created_at desc limit 1);
  update public.appointment_communication_jobs
  set status='cancelled',locked_at=null,next_attempt_at=null,updated_at=now(),metadata=metadata||jsonb_build_object('cancel_reason','appointment_cancelled_whatsapp')
  where appointment_id=p_appointment_id and status in ('pending','ready','failed');
  return p_appointment_id;
end;$$;
revoke all on function public.service_cancel_appointment_from_whatsapp(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.service_cancel_appointment_from_whatsapp(uuid,uuid,uuid,text) to service_role;

create or replace function public.service_prepare_whatsapp_reschedule_options(
  p_tenant_id uuid, p_patient_id uuid, p_appointment_id uuid, p_limit integer default 8
) returns table(option_token uuid, option_label text, option_description text, local_start timestamp without time zone)
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_appt public.appointments%rowtype; v_type public.appointment_types%rowtype; v_avail public.nutritionist_availability_settings%rowtype;
  v_settings public.tenant_appointment_settings%rowtype; v_timezone text; v_day date; v_slot timestamp; v_slot_end timestamp;
  v_start timestamptz; v_end timestamptz; v_inserted integer:=0; v_token uuid; v_label text; v_desc text; v_nutri_name text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  if p_limit is null or p_limit<1 or p_limit>10 then raise exception 'Limite inválido'; end if;
  select * into v_appt from public.appointments a
  where a.id=p_appointment_id and a.tenant_id=p_tenant_id and a.patient_id=p_patient_id
    and a.status in ('scheduled','confirmed') and a.scheduled_at>now();
  if v_appt.id is null then raise exception 'Consulta indisponível para reagendamento'; end if;
  if not exists(select 1 from public.appointment_communication_channel_settings s where s.tenant_id=p_tenant_id and s.whatsapp_allow_reschedule=true) then raise exception 'Reagendamento por WhatsApp desabilitado'; end if;
  select * into v_settings from public.tenant_appointment_settings s where s.tenant_id=p_tenant_id;
  select * into v_type from public.appointment_types t where t.id=v_appt.appointment_type_id and t.tenant_id=p_tenant_id and t.active=true;
  select * into v_avail from public.nutritionist_availability_settings s where s.tenant_id=p_tenant_id and s.nutritionist_id=v_appt.nutritionist_id and s.enabled=true;
  if v_type.id is null or v_avail.nutritionist_id is null then raise exception 'Agenda do profissional indisponível para reagendamento'; end if;
  v_timezone:=coalesce(v_settings.timezone,'America/Sao_Paulo');
  select n.name into v_nutri_name from public.nutritionists n where n.id=v_appt.nutritionist_id;
  delete from public.appointment_whatsapp_reschedule_options o where o.appointment_id=p_appointment_id and o.used_at is null;
  v_day:=(now() at time zone v_timezone)::date;
  while v_day<=least((now() at time zone v_timezone)::date+30,(now() at time zone v_timezone)::date+v_avail.max_advance_days) and v_inserted<p_limit loop
    if extract(isodow from v_day)::integer=any(v_avail.work_days::integer[]) then
      v_slot:=v_day+v_avail.work_hours_start;
      while v_slot+(v_type.duration_minutes*interval '1 minute')<=v_day+v_avail.work_hours_end and v_inserted<p_limit loop
        v_slot_end:=v_slot+(v_type.duration_minutes*interval '1 minute');
        v_start:=v_slot at time zone v_timezone; v_end:=v_slot_end at time zone v_timezone;
        if v_start>=now()+(v_avail.min_notice_minutes*interval '1 minute')
          and v_start<>v_appt.scheduled_at
          and not exists(select 1 from public.nutritionist_schedule_blocks b where b.nutritionist_id=v_appt.nutritionist_id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(v_start,v_end,'[)'))
          and not exists(select 1 from public.appointments a where a.nutritionist_id=v_appt.nutritionist_id and a.id<>p_appointment_id and a.status in ('scheduled','confirmed','in_progress') and tstzrange(a.scheduled_at,a.blocked_ends_at,'[)') && tstzrange(v_start,v_end+(v_avail.buffer_minutes*interval '1 minute'),'[)')) then
          insert into public.appointment_whatsapp_reschedule_options(tenant_id,patient_id,appointment_id,nutritionist_id,local_start,local_end,expires_at)
          values(p_tenant_id,p_patient_id,p_appointment_id,v_appt.nutritionist_id,v_slot,v_slot_end,now()+interval '20 minutes') returning token into v_token;
          v_label:=to_char(v_slot,'DD/MM HH24:MI');
          v_desc:=left(coalesce(v_nutri_name,'Profissional'),72);
          option_token:=v_token; option_label:=v_label; option_description:=v_desc; local_start:=v_slot; return next;
          v_inserted:=v_inserted+1;
        end if;
        v_slot:=v_slot+(v_avail.slot_interval_minutes*interval '1 minute');
      end loop;
    end if;
    v_day:=v_day+1;
  end loop;
  update public.appointment_whatsapp_conversations
  set state='awaiting_reschedule_selection',appointment_id=p_appointment_id,expires_at=now()+interval '20 minutes',updated_at=now()
  where tenant_id=p_tenant_id and patient_id=p_patient_id;
end;$$;
revoke all on function public.service_prepare_whatsapp_reschedule_options(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.service_prepare_whatsapp_reschedule_options(uuid,uuid,uuid,integer) to service_role;

create or replace function public.service_apply_whatsapp_reschedule_option(
  p_tenant_id uuid, p_patient_id uuid, p_option_token uuid
) returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_opt public.appointment_whatsapp_reschedule_options%rowtype; v_appt public.appointments%rowtype;
  v_type public.appointment_types%rowtype; v_avail public.nutritionist_availability_settings%rowtype; v_timezone text;
  v_new_start timestamptz; v_new_end timestamptz; v_old_start timestamptz; v_old_status text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  select * into v_opt from public.appointment_whatsapp_reschedule_options o
  where o.token=p_option_token and o.tenant_id=p_tenant_id and o.patient_id=p_patient_id and o.used_at is null and o.expires_at>now() for update;
  if v_opt.token is null then raise exception 'Opção de horário inválida ou expirada'; end if;
  select * into v_appt from public.appointments a where a.id=v_opt.appointment_id and a.tenant_id=p_tenant_id and a.patient_id=p_patient_id for update;
  if v_appt.id is null or v_appt.status not in ('scheduled','confirmed') or v_appt.scheduled_at<=now() then raise exception 'Consulta indisponível para reagendamento'; end if;
  select * into v_type from public.appointment_types t where t.id=v_appt.appointment_type_id;
  select * into v_avail from public.nutritionist_availability_settings s where s.tenant_id=p_tenant_id and s.nutritionist_id=v_opt.nutritionist_id and s.enabled=true;
  if v_type.id is null or v_avail.nutritionist_id is null then raise exception 'Agenda indisponível'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=p_tenant_id;
  v_new_start:=v_opt.local_start at time zone v_timezone;
  v_new_end:=v_opt.local_end at time zone v_timezone;
  perform pg_advisory_xact_lock(hashtextextended(v_opt.nutritionist_id::text,0));
  if v_new_start<now()+(v_avail.min_notice_minutes*interval '1 minute')
     or exists(select 1 from public.nutritionist_schedule_blocks b where b.nutritionist_id=v_opt.nutritionist_id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(v_new_start,v_new_end,'[)'))
     or exists(select 1 from public.appointments a where a.nutritionist_id=v_opt.nutritionist_id and a.id<>v_appt.id and a.status in ('scheduled','confirmed','in_progress') and tstzrange(a.scheduled_at,a.blocked_ends_at,'[)') && tstzrange(v_new_start,v_new_end+(v_avail.buffer_minutes*interval '1 minute'),'[)')) then
    raise exception 'Este horário acabou de ficar indisponível';
  end if;
  v_old_start:=v_appt.scheduled_at; v_old_status:=v_appt.status;
  update public.appointments
  set nutritionist_id=v_opt.nutritionist_id, scheduled_at=v_new_start, duration_minutes=v_type.duration_minutes,
      status='scheduled', confirmed_at=null, confirmation_sent=false, reminder_sent=false, reminder_sent_at=null,
      meeting_link=case when v_type.default_is_virtual then v_avail.default_meeting_link else null end,
      updated_at=now()
  where id=v_appt.id;
  update public.appointment_whatsapp_reschedule_options set used_at=now() where token=p_option_token;
  update public.appointment_whatsapp_reschedule_options set used_at=coalesce(used_at,now()) where appointment_id=v_appt.id and token<>p_option_token and used_at is null;
  insert into public.appointment_status_events(tenant_id,appointment_id,from_status,to_status,source,actor_user_id,event_type,metadata)
  values(p_tenant_id,v_appt.id,v_old_status,'scheduled','whatsapp',p_patient_id,'rescheduled',jsonb_build_object('old_scheduled_at',v_old_start,'new_scheduled_at',v_new_start,'action','patient_rescheduled_whatsapp'));
  update public.appointment_communication_jobs
  set status='cancelled',locked_at=null,next_attempt_at=null,updated_at=now(),metadata=metadata||jsonb_build_object('cancel_reason','appointment_rescheduled_whatsapp')
  where appointment_id=v_appt.id and status in ('pending','ready','failed');
  update public.appointment_whatsapp_conversations
  set state='idle',appointment_id=v_appt.id,expires_at=null,metadata='{}'::jsonb,updated_at=now()
  where tenant_id=p_tenant_id and patient_id=p_patient_id;
  return jsonb_build_object('appointment_id',v_appt.id,'scheduled_at',v_new_start,'timezone',v_timezone);
end;$$;
revoke all on function public.service_apply_whatsapp_reschedule_option(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_apply_whatsapp_reschedule_option(uuid,uuid,uuid) to service_role;

create or replace function public.service_process_appointment_whatsapp_inbound(
  p_tenant_id uuid,
  p_phone_number_id text,
  p_provider_message_id text,
  p_from_phone text,
  p_message_type text,
  p_message_text text,
  p_action_id text,
  p_context_provider_message_id text,
  p_received_at timestamptz default now()
) returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_norm text; v_patient uuid; v_candidate_count integer; v_appt uuid; v_state text; v_state_appt uuid; v_state_expires timestamptz;
  v_text text; v_action text; v_reason_required boolean; v_inbound_id uuid; v_status text; v_result jsonb;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  if p_tenant_id is null or nullif(trim(p_provider_message_id),'') is null then raise exception 'Dados obrigatórios ausentes'; end if;
  select id into v_inbound_id from public.appointment_whatsapp_inbound_messages where tenant_id=p_tenant_id and provider_message_id=p_provider_message_id;
  if v_inbound_id is not null then
    select jsonb_build_object('duplicate',true,'patient_id',patient_id,'appointment_id',appointment_id,'action',result_action,'status',processing_status)
      into v_result from public.appointment_whatsapp_inbound_messages where id=v_inbound_id;
    return v_result;
  end if;
  v_norm:=regexp_replace(coalesce(p_from_phone,''),'\D','','g');
  with candidates as (
    select p.user_id from public.profiles p
    where p.tenant_id=p_tenant_id and lower(coalesce(p.role,''))='patient'
      and regexp_replace(coalesce(p.phone,''),'\D','','g')=v_norm
    union
    select c.linked_user_id from public.crm_contacts c
    where c.tenant_id=p_tenant_id and c.linked_user_id is not null and (
      regexp_replace(coalesce(c.whatsapp,''),'\D','','g')=v_norm or regexp_replace(coalesce(c.phone,''),'\D','','g')=v_norm
    )
  ) select count(*),min(user_id) into v_candidate_count,v_patient from candidates;
  insert into public.appointment_whatsapp_inbound_messages(tenant_id,provider_message_id,phone_number_id,from_phone,patient_id,context_provider_message_id,message_type,message_text,action_id,received_at)
  values(p_tenant_id,p_provider_message_id,p_phone_number_id,v_norm,case when v_candidate_count=1 then v_patient else null end,p_context_provider_message_id,coalesce(p_message_type,'unknown'),left(p_message_text,2000),left(p_action_id,500),coalesce(p_received_at,now()))
  returning id into v_inbound_id;
  if v_candidate_count<>1 then
    update public.appointment_whatsapp_inbound_messages set processing_status='needs_staff',result_action='patient_not_uniquely_resolved',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','needs_staff','action','patient_not_uniquely_resolved');
  end if;
  v_text:=lower(trim(coalesce(p_message_text,'')));
  if v_text in ('sair','parar','stop','não quero receber','nao quero receber') then
    insert into public.appointment_communication_consents(tenant_id,patient_id,channel,status,source,revoked_at,evidence,updated_at)
    values(p_tenant_id,v_patient,'whatsapp','opt_out','patient',now(),'Opt-out recebido via WhatsApp',now())
    on conflict(tenant_id,patient_id,channel) do update set status='opt_out',source='patient',revoked_at=now(),evidence='Opt-out recebido via WhatsApp',updated_at=now();
    update public.appointment_whatsapp_inbound_messages set processing_status='processed',result_action='opt_out',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','opt_out','patient_id',v_patient,'reply','Tudo certo. Você não receberá novos avisos de consulta por WhatsApp.');
  end if;
  select c.state,c.appointment_id,c.expires_at into v_state,v_state_appt,v_state_expires
  from public.appointment_whatsapp_conversations c where c.tenant_id=p_tenant_id and c.patient_id=v_patient;
  if v_state_expires is not null and v_state_expires<=now() then v_state:='idle'; v_state_appt:=null; end if;
  if v_state='awaiting_cancel_reason' and nullif(trim(coalesce(p_message_text,'')),'') is not null then
    perform public.service_cancel_appointment_from_whatsapp(p_tenant_id,v_patient,v_state_appt,p_message_text);
    update public.appointment_whatsapp_conversations set state='idle',expires_at=null,updated_at=now() where tenant_id=p_tenant_id and patient_id=v_patient;
    update public.appointment_whatsapp_inbound_messages set appointment_id=v_state_appt,processing_status='processed',result_action='cancelled',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','cancelled','patient_id',v_patient,'appointment_id',v_state_appt,'reply','Consulta cancelada. A clínica recebeu seu motivo e o horário foi liberado.');
  end if;
  if coalesce(p_action_id,'') ~ '^APPT_SLOT:[0-9a-fA-F-]{36}$' then
    begin
      v_result:=public.service_apply_whatsapp_reschedule_option(p_tenant_id,v_patient,substring(p_action_id from 11)::uuid);
      v_appt:=(v_result->>'appointment_id')::uuid;
      update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='rescheduled',processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','rescheduled','patient_id',v_patient,'appointment_id',v_appt,'scheduled_at',v_result->>'scheduled_at','timezone',v_result->>'timezone');
    exception when others then
      update public.appointment_whatsapp_inbound_messages set processing_status='processed',result_action='reschedule_option_unavailable',error_message=left(sqlerrm,500),processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','reschedule_option_unavailable','patient_id',v_patient,'reply','Esse horário não está mais disponível. Responda REAGENDAR para eu buscar novas opções.');
    end;
  end if;
  if coalesce(p_action_id,'') ~ '^APPT_(CONFIRM|CANCEL|RESCHEDULE):[0-9a-fA-F-]{36}$' then
    v_appt:=split_part(p_action_id,':',2)::uuid;
    v_action:=case when p_action_id like 'APPT_CONFIRM:%' then 'confirm' when p_action_id like 'APPT_CANCEL:%' then 'cancel' else 'reschedule' end;
  elsif nullif(p_context_provider_message_id,'') is not null then
    select j.appointment_id into v_appt from public.appointment_communication_jobs j where j.tenant_id=p_tenant_id and j.provider='meta_cloud' and j.provider_message_id=p_context_provider_message_id order by j.created_at desc limit 1;
    if v_text ~ 'confirm' then v_action:='confirm'; elsif v_text ~ 'cancel|desmar' then v_action:='cancel'; elsif v_text ~ 'reagend|remarc' then v_action:='reschedule'; end if;
  else
    if v_text ~ 'confirm' then v_action:='confirm'; elsif v_text ~ 'cancel|desmar' then v_action:='cancel'; elsif v_text ~ 'reagend|remarc' then v_action:='reschedule'; end if;
    if v_action is not null then
      select case when count(*)=1 then min(a.id) else null end into v_appt
      from public.appointments a where a.tenant_id=p_tenant_id and a.patient_id=v_patient and a.status in ('scheduled','confirmed') and a.scheduled_at between now() and now()+interval '14 days';
    end if;
  end if;
  if v_action is null or v_appt is null then
    update public.appointment_whatsapp_inbound_messages set processing_status='processed',result_action='help',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','help','patient_id',v_patient,'reply','Posso ajudar com sua próxima consulta. Responda CONFIRMAR, CANCELAR ou REAGENDAR.');
  end if;
  select a.status into v_status from public.appointments a where a.id=v_appt and a.tenant_id=p_tenant_id and a.patient_id=v_patient and a.scheduled_at>now();
  if v_status is null then
    update public.appointment_whatsapp_inbound_messages set processing_status='processed',result_action='appointment_unavailable',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','appointment_unavailable','patient_id',v_patient,'reply','Não encontrei uma consulta futura válida para essa ação.');
  end if;
  if v_action='confirm' then
    if not exists(select 1 from public.appointment_communication_channel_settings s where s.tenant_id=p_tenant_id and s.whatsapp_allow_confirm=true) then raise exception 'Confirmação por WhatsApp desabilitada'; end if;
    perform public.service_patient_confirm_appointment(v_patient,v_appt);
    update public.appointment_status_events e set source='whatsapp',metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('action','patient_confirmation_whatsapp') where e.id=(select x.id from public.appointment_status_events x where x.appointment_id=v_appt and x.to_status='confirmed' order by x.created_at desc limit 1);
    update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='confirmed',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','confirmed','patient_id',v_patient,'appointment_id',v_appt,'reply','Consulta confirmada. Seu horário está reservado.');
  elsif v_action='cancel' then
    if not exists(select 1 from public.appointment_communication_channel_settings s where s.tenant_id=p_tenant_id and s.whatsapp_allow_cancel=true) then raise exception 'Cancelamento por WhatsApp desabilitado'; end if;
    select coalesce(s.require_cancellation_reason,true) into v_reason_required from public.tenant_appointment_settings s where s.tenant_id=p_tenant_id;
    if coalesce(v_reason_required,true) then
      insert into public.appointment_whatsapp_conversations(tenant_id,patient_id,appointment_id,state,expires_at,updated_at)
      values(p_tenant_id,v_patient,v_appt,'awaiting_cancel_reason',now()+interval '30 minutes',now())
      on conflict(tenant_id,patient_id) do update set appointment_id=excluded.appointment_id,state='awaiting_cancel_reason',expires_at=excluded.expires_at,updated_at=now();
      update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='ask_cancel_reason',processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','ask_cancel_reason','patient_id',v_patient,'appointment_id',v_appt,'reply','Certo. Antes de cancelar, me conte em uma mensagem curta o motivo do cancelamento.');
    else
      perform public.service_cancel_appointment_from_whatsapp(p_tenant_id,v_patient,v_appt,null);
      update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='cancelled',processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','cancelled','patient_id',v_patient,'appointment_id',v_appt,'reply','Consulta cancelada e horário liberado.');
    end if;
  else
    if not exists(select 1 from public.appointment_communication_channel_settings s where s.tenant_id=p_tenant_id and s.whatsapp_allow_reschedule=true) then raise exception 'Reagendamento por WhatsApp desabilitado'; end if;
    insert into public.appointment_whatsapp_conversations(tenant_id,patient_id,appointment_id,state,expires_at,updated_at)
    values(p_tenant_id,v_patient,v_appt,'awaiting_reschedule_selection',now()+interval '20 minutes',now())
    on conflict(tenant_id,patient_id) do update set appointment_id=excluded.appointment_id,state='awaiting_reschedule_selection',expires_at=excluded.expires_at,updated_at=now();
    update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='show_reschedule_options',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','show_reschedule_options','patient_id',v_patient,'appointment_id',v_appt);
  end if;
exception when others then
  if v_inbound_id is not null then update public.appointment_whatsapp_inbound_messages set processing_status='failed',error_message=left(sqlerrm,500),processed_at=now() where id=v_inbound_id; end if;
  raise;
end;$$;
revoke all on function public.service_process_appointment_whatsapp_inbound(uuid,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.service_process_appointment_whatsapp_inbound(uuid,text,text,text,text,text,text,text,timestamptz) to service_role;

comment on table public.appointment_whatsapp_inbound_messages is 'Auditoria de mensagens recebidas do WhatsApp relacionadas à agenda. Conteúdo limitado e sem payload bruto do provedor.';
comment on table public.appointment_whatsapp_reschedule_options is 'Opções de reagendamento efêmeras e revalidadas atomicamente antes do uso.';
