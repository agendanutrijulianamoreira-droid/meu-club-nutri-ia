drop trigger if exists trg_log_crm_contact_changes on public.crm_contacts;
create trigger trg_log_crm_contact_changes
after update of stage_id,stage_sync_mode,owner_user_id,next_action_at,last_contact_at,do_not_contact
on public.crm_contacts
for each row execute function public.log_crm_contact_changes();
