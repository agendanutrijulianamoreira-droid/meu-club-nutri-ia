UPDATE public.tenant_followup_settings
SET schema_version=GREATEST(COALESCE(schema_version,1),2)
WHERE schema_version IS DISTINCT FROM 2;
