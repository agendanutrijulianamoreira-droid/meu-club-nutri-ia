create or replace function public.log_crm_contact_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_source text := case when auth.uid() is null then 'system' else 'staff' end;
begin
  if new.stage_id is distinct from old.stage_id then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'stage_changed','Etapa alterada',jsonb_build_object('stage_id',old.stage_id),jsonb_build_object('stage_id',new.stage_id),v_source,v_actor);
  end if;
  if new.stage_sync_mode is distinct from old.stage_sync_mode then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'stage_authority_changed','Controle da etapa alterado',jsonb_build_object('stage_sync_mode',old.stage_sync_mode),jsonb_build_object('stage_sync_mode',new.stage_sync_mode),v_source,v_actor);
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'owner_changed','Responsável alterado',jsonb_build_object('owner_user_id',old.owner_user_id),jsonb_build_object('owner_user_id',new.owner_user_id),v_source,v_actor);
  end if;
  if new.next_action_at is distinct from old.next_action_at then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'next_action_changed','Próxima ação alterada',jsonb_build_object('next_action_at',old.next_action_at),jsonb_build_object('next_action_at',new.next_action_at),v_source,v_actor);
  end if;
  if new.last_contact_at is distinct from old.last_contact_at then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'contact_recorded','Contato registrado',jsonb_build_object('last_contact_at',old.last_contact_at),jsonb_build_object('last_contact_at',new.last_contact_at),v_source,v_actor);
  end if;
  if new.do_not_contact is distinct from old.do_not_contact then
    insert into public.crm_contact_events(tenant_id,contact_id,event_type,title,from_value,to_value,source,actor_user_id)
    values(new.tenant_id,new.id,'contact_permission_changed',case when new.do_not_contact then 'Contato bloqueado' else 'Contato liberado' end,jsonb_build_object('do_not_contact',old.do_not_contact),jsonb_build_object('do_not_contact',new.do_not_contact),v_source,v_actor);
  end if;
  return new;
end $$;
revoke all on function public.log_crm_contact_changes() from public,anon,authenticated;
