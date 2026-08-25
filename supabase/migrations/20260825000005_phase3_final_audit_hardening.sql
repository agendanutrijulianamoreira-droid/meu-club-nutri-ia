-- Fase 3 final audit hardening

alter table public.crm_contact_outcomes
  add column if not exists outcome_code_snapshot text,
  add column if not exists outcome_name_snapshot text,
  add column if not exists counts_as_response_snapshot boolean,
  add column if not exists counts_as_conversion_snapshot boolean,
  add column if not exists owner_name_snapshot text,
  add column if not exists stage_name_snapshot text;

update public.crm_contact_outcomes o
set outcome_code_snapshot=coalesce(o.outcome_code_snapshot,(select t.code from public.crm_outcome_types t where t.id=o.outcome_type_id and t.tenant_id=o.tenant_id)),
    outcome_name_snapshot=coalesce(o.outcome_name_snapshot,(select t.name from public.crm_outcome_types t where t.id=o.outcome_type_id and t.tenant_id=o.tenant_id)),
    counts_as_response_snapshot=coalesce(o.counts_as_response_snapshot,(select t.counts_as_response from public.crm_outcome_types t where t.id=o.outcome_type_id and t.tenant_id=o.tenant_id)),
    counts_as_conversion_snapshot=coalesce(o.counts_as_conversion_snapshot,(select t.counts_as_conversion from public.crm_outcome_types t where t.id=o.outcome_type_id and t.tenant_id=o.tenant_id)),
    owner_name_snapshot=coalesce(o.owner_name_snapshot,(select coalesce(p.display_name,p.name) from public.profiles p where p.user_id=o.owner_user_id_snapshot and p.tenant_id=o.tenant_id limit 1)),
    stage_name_snapshot=coalesce(o.stage_name_snapshot,(select s.name from public.crm_stages s where s.id=o.stage_id_snapshot and s.tenant_id=o.tenant_id limit 1));

alter table public.crm_contact_outcomes
  alter column outcome_code_snapshot set not null,
  alter column outcome_name_snapshot set not null,
  alter column counts_as_response_snapshot set not null,
  alter column counts_as_conversion_snapshot set not null;

create table if not exists public.crm_stage_mapping_rules(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_kind text not null check(source_kind in('lifecycle','operational','default')),
  source_value text not null,
  stage_id uuid not null references public.crm_stages(id) on delete cascade,
  priority integer not null default 100 check(priority between 1 and 9999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,source_kind,source_value)
);
alter table public.crm_stage_mapping_rules enable row level security;
create policy "Staff reads CRM stage mapping rules" on public.crm_stage_mapping_rules for select to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_stage_mapping_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));
create policy "Staff manages CRM stage mapping rules" on public.crm_stage_mapping_rules for all to authenticated using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_stage_mapping_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri'))) with check(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_stage_mapping_rules.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));

create or replace function public.validate_crm_tenant_links() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='crm_contacts' then
    if new.stage_id is not null and not exists(select 1 from public.crm_stages s where s.id=new.stage_id and s.tenant_id=new.tenant_id) then raise exception 'Etapa pertence a outra clínica';end if;
    if new.last_import_id is not null and not exists(select 1 from public.crm_imports i where i.id=new.last_import_id and i.tenant_id=new.tenant_id) then raise exception 'Importação pertence a outra clínica';end if;
    if new.linked_user_id is not null and not exists(select 1 from public.profiles p where p.user_id=new.linked_user_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,''))='patient') then raise exception 'Paciente vinculada pertence a outra clínica';end if;
    if new.owner_user_id is not null and not exists(select 1 from public.profiles p where p.user_id=new.owner_user_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')) then raise exception 'Responsável pertence a outra clínica';end if;
  elsif tg_table_name='crm_outcome_types' then
    if new.next_stage_id is not null and not exists(select 1 from public.crm_stages s where s.id=new.next_stage_id and s.tenant_id=new.tenant_id) then raise exception 'Etapa de destino pertence a outra clínica';end if;
  elsif tg_table_name='crm_contact_events' then
    if not exists(select 1 from public.crm_contacts c where c.id=new.contact_id and c.tenant_id=new.tenant_id) then raise exception 'Contato pertence a outra clínica';end if;
    if new.actor_user_id is not null and not exists(select 1 from public.profiles p where p.user_id=new.actor_user_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')) then raise exception 'Autor pertence a outra clínica';end if;
  elsif tg_table_name='crm_import_rows' then
    if not exists(select 1 from public.crm_imports i where i.id=new.import_id and i.tenant_id=new.tenant_id) then raise exception 'Lote pertence a outra clínica';end if;
    if new.contact_id is not null and not exists(select 1 from public.crm_contacts c where c.id=new.contact_id and c.tenant_id=new.tenant_id) then raise exception 'Contato pertence a outra clínica';end if;
  elsif tg_table_name='crm_contact_outcomes' then
    if not exists(select 1 from public.crm_contacts c where c.id=new.contact_id and c.tenant_id=new.tenant_id) then raise exception 'Contato pertence a outra clínica';end if;
    if not exists(select 1 from public.crm_outcome_types t where t.id=new.outcome_type_id and t.tenant_id=new.tenant_id) then raise exception 'Resultado pertence a outra clínica';end if;
    if new.actor_user_id is not null and not exists(select 1 from public.profiles p where p.user_id=new.actor_user_id and p.tenant_id=new.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')) then raise exception 'Autor pertence a outra clínica';end if;
  elsif tg_table_name='crm_stage_mapping_rules' then
    if not exists(select 1 from public.crm_stages s where s.id=new.stage_id and s.tenant_id=new.tenant_id) then raise exception 'Etapa mapeada pertence a outra clínica';end if;
  end if;
  return new;
end$$;
revoke all on function public.validate_crm_tenant_links() from public,anon,authenticated;

drop trigger if exists trg_validate_crm_contacts_tenant_links on public.crm_contacts;create trigger trg_validate_crm_contacts_tenant_links before insert or update on public.crm_contacts for each row execute function public.validate_crm_tenant_links();
drop trigger if exists trg_validate_crm_outcome_types_tenant_links on public.crm_outcome_types;create trigger trg_validate_crm_outcome_types_tenant_links before insert or update on public.crm_outcome_types for each row execute function public.validate_crm_tenant_links();
drop trigger if exists trg_validate_crm_contact_events_tenant_links on public.crm_contact_events;create trigger trg_validate_crm_contact_events_tenant_links before insert or update on public.crm_contact_events for each row execute function public.validate_crm_tenant_links();
drop trigger if exists trg_validate_crm_import_rows_tenant_links on public.crm_import_rows;create trigger trg_validate_crm_import_rows_tenant_links before insert or update on public.crm_import_rows for each row execute function public.validate_crm_tenant_links();
drop trigger if exists trg_validate_crm_contact_outcomes_tenant_links on public.crm_contact_outcomes;create trigger trg_validate_crm_contact_outcomes_tenant_links before insert or update on public.crm_contact_outcomes for each row execute function public.validate_crm_tenant_links();
drop trigger if exists trg_validate_crm_stage_mapping_tenant_links on public.crm_stage_mapping_rules;create trigger trg_validate_crm_stage_mapping_tenant_links before insert or update on public.crm_stage_mapping_rules for each row execute function public.validate_crm_tenant_links();

drop policy if exists "Staff creates CRM contact events" on public.crm_contact_events;
create policy "Staff creates CRM contact events" on public.crm_contact_events for insert to authenticated with check(actor_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=crm_contact_events.tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri')));

create or replace function public.ensure_default_crm_stage_mapping_rules(p_tenant_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare v_rows integer:=0;
begin
  perform public.ensure_default_crm_stages(p_tenant_id);
  insert into public.crm_stage_mapping_rules(tenant_id,source_kind,source_value,stage_id,priority)
  select p_tenant_id,x.kind,x.value,s.id,x.priority from(values('lifecycle','reactivation','reactivation',10),('lifecycle','care_completed','care_completed',10),('operational','inactive','attention',20),('operational','at_risk','attention',20),('operational','oscillating','attention',20),('default','*','active_patient',999))x(kind,value,stage_code,priority)
  join public.crm_stages s on s.tenant_id=p_tenant_id and s.code=x.stage_code on conflict(tenant_id,source_kind,source_value)do nothing;
  get diagnostics v_rows=row_count;return v_rows;
end$$;
revoke all on function public.ensure_default_crm_stage_mapping_rules(uuid) from public,anon,authenticated;grant execute on function public.ensure_default_crm_stage_mapping_rules(uuid) to service_role;
select public.ensure_default_crm_stage_mapping_rules(id) from public.tenants;

create or replace function public.resolve_crm_stage_id(p_tenant_id uuid,p_lifecycle_status text,p_operational_status text) returns uuid language sql stable security definer set search_path=public as $$select r.stage_id from public.crm_stage_mapping_rules r join public.crm_stages s on s.id=r.stage_id and s.tenant_id=r.tenant_id and s.active where r.tenant_id=p_tenant_id and r.active and((r.source_kind='lifecycle' and r.source_value=coalesce(p_lifecycle_status,''))or(r.source_kind='operational' and r.source_value=coalesce(p_operational_status,''))or(r.source_kind='default' and r.source_value='*'))order by r.priority,case r.source_kind when'lifecycle'then 0 when'operational'then 1 else 2 end limit 1$$;
revoke all on function public.resolve_crm_stage_id(uuid,text,text) from public,anon,authenticated;grant execute on function public.resolve_crm_stage_id(uuid,text,text) to service_role;

create or replace function public.capture_crm_outcome_snapshot() returns trigger language plpgsql set search_path=public as $$
declare v_contact public.crm_contacts%rowtype;v_type public.crm_outcome_types%rowtype;
begin
  select*into v_contact from public.crm_contacts where id=new.contact_id and tenant_id=new.tenant_id;if v_contact.id is null then raise exception 'Contato inválido para esta clínica';end if;
  select*into v_type from public.crm_outcome_types where id=new.outcome_type_id and tenant_id=new.tenant_id;if v_type.id is null then raise exception 'Resultado inválido para esta clínica';end if;
  new.recency_segment_snapshot:=v_contact.recency_segment;new.stage_id_snapshot:=v_contact.stage_id;new.owner_user_id_snapshot:=v_contact.owner_user_id;new.owner_name_snapshot:=(select coalesce(p.display_name,p.name) from public.profiles p where p.user_id=v_contact.owner_user_id and p.tenant_id=new.tenant_id limit 1);new.stage_name_snapshot:=(select s.name from public.crm_stages s where s.id=v_contact.stage_id and s.tenant_id=new.tenant_id limit 1);new.outcome_code_snapshot:=v_type.code;new.outcome_name_snapshot:=v_type.name;new.counts_as_response_snapshot:=v_type.counts_as_response;new.counts_as_conversion_snapshot:=v_type.counts_as_conversion;new.scheduled_action_at_snapshot:=v_contact.next_action_at;
  if v_contact.next_action_at is not null and new.occurred_at>v_contact.next_action_at then new.minutes_late_snapshot:=floor(extract(epoch from(new.occurred_at-v_contact.next_action_at))/60)::integer;else new.minutes_late_snapshot:=0;end if;return new;
end$$;
revoke all on function public.capture_crm_outcome_snapshot() from public,anon,authenticated;

create or replace function public.get_crm_metrics(p_tenant_id uuid) returns jsonb language plpgsql set search_path=public as $$
declare v_days integer;v_since timestamptz;v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=p_tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri'))then raise exception 'Acesso negado';end if;
  select coalesce(s.window_days,30)into v_days from public.crm_metric_settings s where s.tenant_id=p_tenant_id;v_days:=coalesce(v_days,30);v_since:=now()-make_interval(days=>v_days);
  with base as(select o.contact_id,o.owner_user_id_snapshot,o.owner_name_snapshot,o.recency_segment_snapshot,o.minutes_late_snapshot,o.scheduled_action_at_snapshot,o.outcome_code_snapshot code,o.counts_as_response_snapshot counts_as_response,o.counts_as_conversion_snapshot counts_as_conversion from public.crm_contact_outcomes o where o.tenant_id=p_tenant_id and o.occurred_at>=v_since),totals as(select count(distinct contact_id)::int approached,count(distinct contact_id)filter(where counts_as_response)::int responded,count(distinct contact_id)filter(where counts_as_conversion)::int converted,count(*)filter(where code='appointment_booked')::int appointments,count(*)filter(where code='protocol_purchased')::int protocols,count(*)filter(where code='no_response')::int no_response,coalesce(avg(minutes_late_snapshot)filter(where scheduled_action_at_snapshot is not null and minutes_late_snapshot>0),0)::numeric avg_minutes_late from base),segments as(select coalesce(jsonb_agg(jsonb_build_object('segment',segment,'approached',approached,'responded',responded,'converted',converted)order by segment),'[]'::jsonb)data from(select coalesce(recency_segment_snapshot,'unknown')segment,count(distinct contact_id)::int approached,count(distinct contact_id)filter(where counts_as_response)::int responded,count(distinct contact_id)filter(where counts_as_conversion)::int converted from base group by coalesce(recency_segment_snapshot,'unknown'))s),owners as(select coalesce(jsonb_agg(jsonb_build_object('owner_user_id',owner_user_id,'owner_name',owner_name,'contacts',contacts,'attempts',attempts,'responded',responded,'converted',converted)order by attempts desc),'[]'::jsonb)data from(select owner_user_id_snapshot owner_user_id,max(owner_name_snapshot)owner_name,count(distinct contact_id)::int contacts,count(*)::int attempts,count(distinct contact_id)filter(where counts_as_response)::int responded,count(distinct contact_id)filter(where counts_as_conversion)::int converted from base group by owner_user_id_snapshot)o),overdue as(select count(*)::int value from public.crm_contacts c where c.tenant_id=p_tenant_id and not c.do_not_contact and c.next_action_at is not null and c.next_action_at<=now())select jsonb_build_object('window_days',v_days,'approached',t.approached,'responded',t.responded,'converted',t.converted,'appointments',t.appointments,'protocols',t.protocols,'no_response',t.no_response,'avg_minutes_late',t.avg_minutes_late,'overdue_now',d.value,'segments',s.data,'owners',o.data)into v_result from totals t cross join segments s cross join owners o cross join overdue d;return coalesce(v_result,'{}'::jsonb);
end$$;
grant execute on function public.get_crm_metrics(uuid) to authenticated;

create or replace function public.sync_app_patients_to_crm(p_tenant_id uuid,p_reference_date date default(now()at time zone'America/Sao_Paulo')::date) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_inserted integer:=0;v_updated integer:=0;v_linked integer:=0;v_country text:='55';
begin
 if p_tenant_id is null then raise exception 'tenant_id é obrigatório';end if;select coalesce(nullif(default_country_code,''),'55')into v_country from public.crm_import_settings where tenant_id=p_tenant_id;v_country:=coalesce(v_country,'55');perform public.ensure_default_crm_stage_mapping_rules(p_tenant_id);
 with latest_risk as(select distinct on(rs.user_id)rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date from public.patient_risk_scores rs where rs.tenant_id=p_tenant_id and rs.calculated_date<=p_reference_date order by rs.user_id,rs.calculated_date desc),src0 as(select p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,lower(nullif(trim(p.email),''))email_norm,regexp_replace(coalesce(p.phone,''),'\D','','g')phone_digits,public.resolve_crm_stage_id(p_tenant_id,lr.lifecycle_status,lr.operational_status)stage_id from public.profiles p left join latest_risk lr on lr.user_id=p.user_id where p.tenant_id=p_tenant_id and lower(coalesce(p.role,''))='patient'),source_rows as(select s.*,case when length(s.phone_digits)in(10,11)then v_country||s.phone_digits else nullif(s.phone_digits,'')end phone_norm from src0 s),candidates as(select s.user_id,c.id,count(*)over(partition by s.user_id)matches from source_rows s join public.crm_contacts c on c.tenant_id=p_tenant_id and c.linked_user_id is null and((s.email_norm is not null and c.email_normalized=s.email_norm)or(s.phone_norm is not null and c.phone_normalized=s.phone_norm))),linked as(update public.crm_contacts c set linked_user_id=x.user_id,last_import_id=null,metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('linked_from','app'),updated_at=now() from candidates x where x.matches=1 and c.id=x.id returning c.id)select count(*)into v_linked from linked;
 with latest_risk as(select distinct on(rs.user_id)rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date from public.patient_risk_scores rs where rs.tenant_id=p_tenant_id and rs.calculated_date<=p_reference_date order by rs.user_id,rs.calculated_date desc),src0 as(select p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,lower(nullif(trim(p.email),''))email_norm,regexp_replace(coalesce(p.phone,''),'\D','','g')phone_digits,public.resolve_crm_stage_id(p_tenant_id,lr.lifecycle_status,lr.operational_status)stage_id from public.profiles p left join latest_risk lr on lr.user_id=p.user_id where p.tenant_id=p_tenant_id and lower(coalesce(p.role,''))='patient'),source_rows as(select s.*,case when length(s.phone_digits)in(10,11)then v_country||s.phone_digits else nullif(s.phone_digits,'')end phone_norm from src0 s),ins as(insert into public.crm_contacts(tenant_id,linked_user_id,stage_id,source,name,email,phone,whatsapp,birth_date,primary_goal,last_activity_at,email_normalized,phone_normalized,metadata)select p_tenant_id,s.user_id,s.stage_id,'app',coalesce(nullif(s.name,''),coalesce(s.email,'Paciente')),s.email,s.phone,s.phone,s.birth_date,s.primary_goal,case when s.last_activity_date is not null then(s.last_activity_date::timestamp at time zone'America/Sao_Paulo')else null end,s.email_norm,s.phone_norm,jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status)from source_rows s where s.stage_id is not null and not exists(select 1 from public.crm_contacts c where c.tenant_id=p_tenant_id and c.linked_user_id=s.user_id)returning id)select count(*)into v_inserted from ins;
 with latest_risk as(select distinct on(rs.user_id)rs.user_id,rs.lifecycle_status,rs.operational_status,rs.last_activity_date from public.patient_risk_scores rs where rs.tenant_id=p_tenant_id and rs.calculated_date<=p_reference_date order by rs.user_id,rs.calculated_date desc),src0 as(select p.user_id,p.name,p.email,p.phone,p.birth_date,p.primary_goal,lr.lifecycle_status,lr.operational_status,lr.last_activity_date,lower(nullif(trim(p.email),''))email_norm,regexp_replace(coalesce(p.phone,''),'\D','','g')phone_digits,public.resolve_crm_stage_id(p_tenant_id,lr.lifecycle_status,lr.operational_status)stage_id from public.profiles p left join latest_risk lr on lr.user_id=p.user_id where p.tenant_id=p_tenant_id and lower(coalesce(p.role,''))='patient'),source_rows as(select s.*,case when length(s.phone_digits)in(10,11)then v_country||s.phone_digits else nullif(s.phone_digits,'')end phone_norm from src0 s),upd as(update public.crm_contacts c set name=coalesce(nullif(s.name,''),c.name),email=coalesce(s.email,c.email),phone=coalesce(s.phone,c.phone),whatsapp=coalesce(s.phone,c.whatsapp),birth_date=coalesce(s.birth_date,c.birth_date),primary_goal=coalesce(s.primary_goal,c.primary_goal),email_normalized=coalesce(s.email_norm,c.email_normalized),phone_normalized=coalesce(s.phone_norm,c.phone_normalized),stage_id=case when c.do_not_contact or s.stage_id is null then c.stage_id else s.stage_id end,last_activity_at=case when s.last_activity_date is not null then(s.last_activity_date::timestamp at time zone'America/Sao_Paulo')else c.last_activity_at end,last_import_id=null,metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('synced_from','profiles','lifecycle_status',s.lifecycle_status,'operational_status',s.operational_status),updated_at=now() from source_rows s where c.tenant_id=p_tenant_id and c.linked_user_id=s.user_id returning c.id)select count(*)into v_updated from upd;
 return jsonb_build_object('inserted',v_inserted,'linked',v_linked,'updated',v_updated,'reference_date',p_reference_date);
end$$;
revoke all on function public.sync_app_patients_to_crm(uuid,date) from public,anon,authenticated;grant execute on function public.sync_app_patients_to_crm(uuid,date) to service_role;
