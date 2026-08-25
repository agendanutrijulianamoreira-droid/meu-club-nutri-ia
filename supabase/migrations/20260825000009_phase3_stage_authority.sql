alter table public.crm_contacts
  add column if not exists stage_sync_mode text not null default 'automatic'
  check (stage_sync_mode in ('automatic','manual'));
