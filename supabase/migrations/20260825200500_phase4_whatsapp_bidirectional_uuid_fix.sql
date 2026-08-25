-- Corrige agregação UUID na resolução de paciente/consulta do inbound WhatsApp.
create or replace function public.service_process_appointment_whatsapp_inbound(
  p_tenant_id uuid,p_phone_number_id text,p_provider_message_id text,p_from_phone text,p_message_type text,p_message_text text,p_action_id text,p_context_provider_message_id text,p_received_at timestamptz default now()
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
    where p.tenant_id=p_tenant_id and lower(coalesce(p.role,''))='patient' and regexp_replace(coalesce(p.phone,''),'\D','','g')=v_norm
    union
    select c.linked_user_id from public.crm_contacts c
    where c.tenant_id=p_tenant_id and c.linked_user_id is not null and (regexp_replace(coalesce(c.whatsapp,''),'\D','','g')=v_norm or regexp_replace(coalesce(c.phone,''),'\D','','g')=v_norm)
  ) select count(*),(array_agg(user_id))[1] into v_candidate_count,v_patient from candidates;
  insert into public.appointment_whatsapp_inbound_messages(tenant_id,provider_message_id,phone_number_id,from_phone,patient_id,context_provider_message_id,message_type,message_text,action_id,received_at)
  values(p_tenant_id,p_provider_message_id,p_phone_number_id,v_norm,case when v_candidate_count=1 then v_patient else null end,p_context_provider_message_id,coalesce(p_message_type,'unknown'),left(p_message_text,2000),left(p_action_id,500),coalesce(p_received_at,now())) returning id into v_inbound_id;
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
  select c.state,c.appointment_id,c.expires_at into v_state,v_state_appt,v_state_expires from public.appointment_whatsapp_conversations c where c.tenant_id=p_tenant_id and c.patient_id=v_patient;
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
      select case when count(*)=1 then (array_agg(a.id))[1] else null end into v_appt
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
      insert into public.appointment_whatsapp_conversations(tenant_id,patient_id,appointment_id,state,expires_at,updated_at) values(p_tenant_id,v_patient,v_appt,'awaiting_cancel_reason',now()+interval '30 minutes',now()) on conflict(tenant_id,patient_id) do update set appointment_id=excluded.appointment_id,state='awaiting_cancel_reason',expires_at=excluded.expires_at,updated_at=now();
      update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='ask_cancel_reason',processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','ask_cancel_reason','patient_id',v_patient,'appointment_id',v_appt,'reply','Certo. Antes de cancelar, me conte em uma mensagem curta o motivo do cancelamento.');
    else
      perform public.service_cancel_appointment_from_whatsapp(p_tenant_id,v_patient,v_appt,null);
      update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='cancelled',processed_at=now() where id=v_inbound_id;
      return jsonb_build_object('status','processed','action','cancelled','patient_id',v_patient,'appointment_id',v_appt,'reply','Consulta cancelada e horário liberado.');
    end if;
  else
    if not exists(select 1 from public.appointment_communication_channel_settings s where s.tenant_id=p_tenant_id and s.whatsapp_allow_reschedule=true) then raise exception 'Reagendamento por WhatsApp desabilitado'; end if;
    insert into public.appointment_whatsapp_conversations(tenant_id,patient_id,appointment_id,state,expires_at,updated_at) values(p_tenant_id,v_patient,v_appt,'awaiting_reschedule_selection',now()+interval '20 minutes',now()) on conflict(tenant_id,patient_id) do update set appointment_id=excluded.appointment_id,state='awaiting_reschedule_selection',expires_at=excluded.expires_at,updated_at=now();
    update public.appointment_whatsapp_inbound_messages set appointment_id=v_appt,processing_status='processed',result_action='show_reschedule_options',processed_at=now() where id=v_inbound_id;
    return jsonb_build_object('status','processed','action','show_reschedule_options','patient_id',v_patient,'appointment_id',v_appt);
  end if;
exception when others then
  if v_inbound_id is not null then update public.appointment_whatsapp_inbound_messages set processing_status='failed',error_message=left(sqlerrm,500),processed_at=now() where id=v_inbound_id; end if;
  raise;
end;$$;
revoke all on function public.service_process_appointment_whatsapp_inbound(uuid,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.service_process_appointment_whatsapp_inbound(uuid,text,text,text,text,text,text,text,timestamptz) to service_role;
