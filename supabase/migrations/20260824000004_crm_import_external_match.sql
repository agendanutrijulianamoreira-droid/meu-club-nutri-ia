ALTER TABLE public.crm_import_settings ADD COLUMN IF NOT EXISTS match_external_id boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_external_source ON public.crm_contacts(tenant_id,source,external_id) WHERE external_id IS NOT NULL;
