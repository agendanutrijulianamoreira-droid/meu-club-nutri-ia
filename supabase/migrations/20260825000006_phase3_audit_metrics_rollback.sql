-- Fase 3 audit: explicit recovery, queue lead time, and rollback evolution guard.

alter table public.crm_outcome_types add column if not exists counts_as_recovery boolean not null default false;
update public.crm_outcome_types set counts_as_recovery=true where code in('appointment_booked','protocol_purchased');

alter table public.crm_contacts add column if not exists next_action_set_at timestamptz;
update public.crm_contacts set next_action_set_at=coalesce(next_action_set_at,updated_at) where next_action_at is not null and next_action_set_at is null;

alter table public.crm_contact_outcomes
  add column if not exists counts_as_recovery_snapshot boolean,
  add column if not exists queue_entered_at_snapshot timestamptz,
  add column if not exists minutes_to_approach_snapshot integer;
update public.crm_contact_outcomes o set counts_as_recovery_snapshot=coalesce(o.counts_as_recovery_snapshot,(select t.counts_as_recovery from public.crm_outcome_types t where t.id=o.outcome_type_id and t.tenant_id=o.tenant_id));
alter table public.crm_contact_outcomes alter column counts_as_recovery_snapshot set not null;

create or replace function public.track_crm_next_action_set_at() returns trigger language plpgsql set search_path=public as $$
begin
 if new.next_action_at is distinct from old.next_action_at then new.next_action_set_at=case when new.next_action_at is null then null else now() end;end if;
 return new;
end$$;
revoke all on function public.track_crm_next_action_set_at() from public,anon,authenticated;
drop trigger if exists trg_track_crm_next_action_set_at on public.crm_contacts;
create trigger trg_track_crm_next_action_set_at before update of next_action_at on public.crm_contacts for each row execute function public.track_crm_next_action_set_at();

create or replace function public.capture_crm_outcome_snapshot() returns trigger language plpgsql set search_path=public as $$
declare v_contact public.crm_contacts%rowtype;v_type public.crm_outcome_types%rowtype;
begin
 select*into v_contact from public.crm_contacts where id=new.contact_id and tenant_id=new.tenant_id;if v_contact.id is null then raise exception 'Contato inválido para esta clínica';end if;
 select*into v_type from public.crm_outcome_types where id=new.outcome_type_id and tenant_id=new.tenant_id;if v_type.id is null then raise exception 'Resultado inválido para esta clínica';end if;
 new.recency_segment_snapshot:=v_contact.recency_segment;new.stage_id_snapshot:=v_contact.stage_id;new.owner_user_id_snapshot:=v_contact.owner_user_id;new.owner_name_snapshot:=(select coalesce(p.display_name,p.name) from public.profiles p where p.user_id=v_contact.owner_user_id and p.tenant_id=new.tenant_id limit 1);new.stage_name_snapshot:=(select s.name from public.crm_stages s where s.id=v_contact.stage_id and s.tenant_id=new.tenant_id limit 1);new.outcome_code_snapshot:=v_type.code;new.outcome_name_snapshot:=v_type.name;new.counts_as_response_snapshot:=v_type.counts_as_response;new.counts_as_conversion_snapshot:=v_type.counts_as_conversion;new.counts_as_recovery_snapshot:=v_type.counts_as_recovery;new.scheduled_action_at_snapshot:=v_contact.next_action_at;new.queue_entered_at_snapshot:=v_contact.next_action_set_at;
 if v_contact.next_action_at is not null and new.occurred_at>v_contact.next_action_at then new.minutes_late_snapshot:=floor(extract(epoch from(new.occurred_at-v_contact.next_action_at))/60)::integer;else new.minutes_late_snapshot:=0;end if;
 if v_contact.next_action_set_at is not null and new.occurred_at>=v_contact.next_action_set_at then new.minutes_to_approach_snapshot:=floor(extract(epoch from(new.occurred_at-v_contact.next_action_set_at))/60)::integer;else new.minutes_to_approach_snapshot:=null;end if;
 return new;
end$$;
revoke all on function public.capture_crm_outcome_snapshot() from public,anon,authenticated;

create or replace function public.get_crm_metrics(p_tenant_id uuid) returns jsonb language plpgsql set search_path=public as $$
declare v_days integer;v_since timestamptz;v_result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.tenant_id=p_tenant_id and lower(coalesce(p.role,'')) in('admin','nutritionist','nutri'))then raise exception 'Acesso negado';end if;
 select coalesce(s.window_days,30)into v_days from public.crm_metric_settings s where s.tenant_id=p_tenant_id;v_days:=coalesce(v_days,30);v_since:=now()-make_interval(days=>v_days);
 with base as(select o.contact_id,o.owner_user_id_snapshot,o.owner_name_snapshot,o.recency_segment_snapshot,o.minutes_late_snapshot,o.minutes_to_approach_snapshot,o.scheduled_action_at_snapshot,o.outcome_code_snapshot code,o.counts_as_response_snapshot response,o.counts_as_conversion_snapshot conversion,o.counts_as_recovery_snapshot recovery from public.crm_contact_outcomes o where o.tenant_id=p_tenant_id and o.occurred_at>=v_since),totals as(select count(distinct contact_id)::int approached,count(distinct contact_id)filter(where response)::int responded,count(distinct contact_id)filter(where conversion)::int converted,count(distinct contact_id)filter(where recovery)::int recovered,count(*)filter(where code='appointment_booked')::int appointments,count(*)filter(where code='protocol_purchased')::int protocols,count(*)filter(where code='no_response')::int no_response,coalesce(avg(minutes_late_snapshot)filter(where scheduled_action_at_snapshot is not null and minutes_late_snapshot>0),0)::numeric avg_minutes_late,coalesce(avg(minutes_to_approach_snapshot)filter(where minutes_to_approach_snapshot is not null),0)::numeric avg_minutes_to_approach from base),segments as(select coalesce(jsonb_agg(jsonb_build_object('segment',segment,'approached',approached,'responded',responded,'converted',converted,'recovered',recovered)order by segment),'[]'::jsonb)data from(select coalesce(recency_segment_snapshot,'unknown')segment,count(distinct contact_id)::int approached,count(distinct contact_id)filter(where response)::int responded,count(distinct contact_id)filter(where conversion)::int converted,count(distinct contact_id)filter(where recovery)::int recovered from base group by coalesce(recency_segment_snapshot,'unknown'))s),owners as(select coalesce(jsonb_agg(jsonb_build_object('owner_user_id',owner_user_id,'owner_name',owner_name,'contacts',contacts,'attempts',attempts,'responded',responded,'converted',converted,'recovered',recovered)order by attempts desc),'[]'::jsonb)data from(select owner_user_id_snapshot owner_user_id,max(owner_name_snapshot)owner_name,count(distinct contact_id)::int contacts,count(*)::int attempts,count(distinct contact_id)filter(where response)::int responded,count(distinct contact_id)filter(where conversion)::int converted,count(distinct contact_id)filter(where recovery)::int recovered from base group by owner_user_id_snapshot)o),overdue as(select count(*)::int value from public.crm_contacts c where c.tenant_id=p_tenant_id and not c.do_not_contact and c.next_action_at is not null and c.next_action_at<=now())select jsonb_build_object('window_days',v_days,'approached',t.approached,'responded',t.responded,'converted',t.converted,'recovered',t.recovered,'appointments',t.appointments,'protocols',t.protocols,'no_response',t.no_response,'avg_minutes_late',t.avg_minutes_late,'avg_minutes_to_approach',t.avg_minutes_to_approach,'overdue_now',d.value,'segments',s.data,'owners',o.data)into v_result from totals t cross join segments s cross join owners o cross join overdue d;return coalesce(v_result,'{}'::jsonb);
end$$;
grant execute on function public.get_crm_metrics(uuid) to authenticated;

create or replace function public.rollback_crm_import(p_import_id uuid) returns jsonb language plpgsql set search_path=public as $$
declare v_tenant uuid;v_status text;v_imported_at timestamptz;v_deleted int:=0;v_restored int:=0;v_skipped int:=0;
begin
 select tenant_id,status,imported_at into v_tenant,v_status,v_imported_at from public.crm_imports where id=p_import_id;
 if v_tenant is null or v_status<>'imported' then raise exception 'Import unavailable for rollback';end if;
 if not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tenant_id=v_tenant and lower(coalesce(p.role,''))in('admin','nutritionist','nutri'))then raise exception 'Forbidden';end if;
 select count(*) into v_skipped from public.crm_import_rows r join public.crm_contacts c on c.id=r.contact_id and c.tenant_id=v_tenant where r.import_id=p_import_id and r.tenant_id=v_tenant and r.outcome in('inserted','updated') and c.last_import_id=p_import_id and(c.updated_at>coalesce(v_imported_at,'epoch'::timestamptz) or exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce(v_imported_at,'epoch'::timestamptz)) or exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.created_at>coalesce(v_imported_at,'epoch'::timestamptz)));
 delete from public.crm_contacts c using public.crm_import_rows r where r.import_id=p_import_id and r.tenant_id=v_tenant and r.outcome='inserted' and r.contact_id=c.id and c.last_import_id=p_import_id and c.tenant_id=v_tenant and c.updated_at<=coalesce(v_imported_at,now()) and not exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce(v_imported_at,'epoch'::timestamptz)) and not exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.created_at>coalesce(v_imported_at,'epoch'::timestamptz));get diagnostics v_deleted=row_count;
 update public.crm_contacts c set name=r.before_snapshot->>'name',email=r.before_snapshot->>'email',phone=r.before_snapshot->>'phone',whatsapp=r.before_snapshot->>'whatsapp',external_id=r.before_snapshot->>'external_id',last_activity_at=nullif(r.before_snapshot->>'last_activity_at','')::timestamptz,last_consultation_at=nullif(r.before_snapshot->>'last_consultation_at','')::timestamptz,primary_goal=r.before_snapshot->>'primary_goal',email_normalized=r.before_snapshot->>'email_normalized',phone_normalized=r.before_snapshot->>'phone_normalized',source=coalesce(r.before_snapshot->>'source',c.source),stage_id=nullif(r.before_snapshot->>'stage_id','')::uuid,metadata=coalesce(r.before_snapshot->'metadata','{}'::jsonb),last_import_id=nullif(r.before_snapshot->>'last_import_id','')::uuid,updated_at=now() from public.crm_import_rows r where r.import_id=p_import_id and r.tenant_id=v_tenant and r.outcome='updated' and r.contact_id=c.id and c.last_import_id=p_import_id and c.tenant_id=v_tenant and r.before_snapshot is not null and c.updated_at<=coalesce(v_imported_at,now()) and not exists(select 1 from public.crm_contact_events e where e.contact_id=c.id and e.tenant_id=v_tenant and e.created_at>coalesce(v_imported_at,'epoch'::timestamptz)) and not exists(select 1 from public.crm_contact_outcomes o where o.contact_id=c.id and o.tenant_id=v_tenant and o.created_at>coalesce(v_imported_at,'epoch'::timestamptz));get diagnostics v_restored=row_count;
 update public.crm_imports set status='rolled_back',rolled_back_at=now() where id=p_import_id and tenant_id=v_tenant;
 return jsonb_build_object('deleted',v_deleted,'restored',v_restored,'skipped_evolved',v_skipped);
end$$;
grant execute on function public.rollback_crm_import(uuid) to authenticated;
