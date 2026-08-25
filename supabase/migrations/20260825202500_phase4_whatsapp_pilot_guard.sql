-- Fase 4 / Bloco 7 — go-live controlado do WhatsApp
alter table public.appointment_communication_channel_settings
  add column if not exists whatsapp_pilot_mode boolean not null default true,
  add column if not exists whatsapp_pilot_allowed_phones text[] not null default '{}',
  add column if not exists whatsapp_activation_state text not null default 'draft';

do $$ begin
  alter table public.appointment_communication_channel_settings
    add constraint appointment_communication_channel_settings_activation_state_check
    check (whatsapp_activation_state in ('draft','configured','verified','live'));
exception when duplicate_object then null; end $$;

create or replace function public.appointment_whatsapp_route_available(p_tenant_id uuid,p_patient_id uuid,p_kind text)
returns boolean
language sql stable
set search_path to 'public','pg_temp'
as $function$
select exists(
  select 1
  from public.appointment_communication_channel_settings s
  join public.appointment_communication_templates t
    on t.tenant_id=s.tenant_id and t.kind=p_kind and t.channel='whatsapp'
  join public.appointment_communication_consents c
    on c.tenant_id=s.tenant_id and c.patient_id=p_patient_id and c.channel='whatsapp'
  join public.profiles p
    on p.tenant_id=s.tenant_id and p.user_id=p_patient_id
  where s.tenant_id=p_tenant_id
    and s.whatsapp_enabled=true
    and s.whatsapp_activation_state in ('verified','live')
    and nullif(trim(s.whatsapp_phone_number_id),'') is not null
    and t.active=true
    and nullif(trim(t.provider_template_name),'') is not null
    and c.status='opt_in'
    and nullif(regexp_replace(coalesce(p.phone,''),'\D','','g'),'') is not null
    and (
      s.whatsapp_pilot_mode=false
      or exists (
        select 1
        from unnest(s.whatsapp_pilot_allowed_phones) x(phone)
        where regexp_replace(coalesce(x.phone,''),'\D','','g') = regexp_replace(coalesce(p.phone,''),'\D','','g')
           or regexp_replace(coalesce(x.phone,''),'\D','','g') = case when length(regexp_replace(coalesce(p.phone,''),'\D','','g')) in (10,11) then '55'||regexp_replace(coalesce(p.phone,''),'\D','','g') else regexp_replace(coalesce(p.phone,''),'\D','','g') end
      )
    )
    and not exists(
      select 1 from public.crm_contacts cc
      where cc.tenant_id=p_tenant_id and cc.linked_user_id=p_patient_id and cc.do_not_contact=true
    )
);
$function$;

revoke all on function public.appointment_whatsapp_route_available(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.appointment_whatsapp_route_available(uuid,uuid,text) to service_role;
