-- Phase 3 CRM import batches, settings and reversible row history.

CREATE TABLE IF NOT EXISTS public.crm_import_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_country_code text NOT NULL DEFAULT '55',
  match_email boolean NOT NULL DEFAULT true,
  match_phone boolean NOT NULL DEFAULT true,
  overwrite_blank_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.crm_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  source text NOT NULL DEFAULT 'import',
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','imported','rolled_back','failed')),
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  rolled_back_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.crm_imports(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('inserted','updated','duplicate','rejected')),
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  before_snapshot jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(import_id,row_number)
);

ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS email_normalized text;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS phone_normalized text;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS last_import_id uuid REFERENCES public.crm_imports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_normalized ON public.crm_contacts(tenant_id,email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone_normalized ON public.crm_contacts(tenant_id,phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_imports_tenant_created ON public.crm_imports(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_import_rows_import ON public.crm_import_rows(import_id,row_number);

ALTER TABLE public.crm_import_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manages CRM import settings" ON public.crm_import_settings;
CREATE POLICY "Staff manages CRM import settings" ON public.crm_import_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_import_settings.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_import_settings.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')));

DROP POLICY IF EXISTS "Staff manages CRM imports" ON public.crm_imports;
CREATE POLICY "Staff manages CRM imports" ON public.crm_imports FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_imports.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_imports.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')));

DROP POLICY IF EXISTS "Staff manages CRM import rows" ON public.crm_import_rows;
CREATE POLICY "Staff manages CRM import rows" ON public.crm_import_rows FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_import_rows.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=crm_import_rows.tenant_id AND lower(COALESCE(p.role,'')) IN ('admin','nutritionist','nutri')));
