CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  category text NOT NULL DEFAULT 'custom',
  active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  name text NOT NULL,
  email text,
  phone text,
  whatsapp text,
  birth_date date,
  primary_goal text,
  last_consultation_at timestamptz,
  last_activity_at timestamptz,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  do_not_contact boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_metadata_object CHECK (jsonb_typeof(metadata)='object'),
  CONSTRAINT crm_contacts_tags_array CHECK (jsonb_typeof(tags)='array')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_contacts_linked_user ON public.crm_contacts(tenant_id, linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_contacts_external_source ON public.crm_contacts(tenant_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON public.crm_contacts(tenant_id, stage_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_action ON public.crm_contacts(tenant_id, next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_activity ON public.crm_contacts(tenant_id, last_activity_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text,
  outcome text,
  note text,
  from_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_events_metadata_object CHECK (jsonb_typeof(metadata)='object')
);
CREATE INDEX IF NOT EXISTS idx_crm_events_contact ON public.crm_events(tenant_id, contact_id, created_at DESC);

ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
