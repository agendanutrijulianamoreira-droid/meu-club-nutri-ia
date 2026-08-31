-- Release v1 compatibility shim for legacy workers/Edge Functions that still
-- read subscriptions.created_at. The canonical lifecycle fields remain
-- started_at/updated_at; created_at is backfilled once and maintained on insert.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.subscriptions
SET created_at = COALESCE(created_at, started_at, updated_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

COMMENT ON COLUMN public.subscriptions.created_at IS
  'Compatibility creation timestamp for legacy consumers; prefer started_at for subscription lifecycle semantics.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_created_at
  ON public.subscriptions (tenant_id, created_at DESC);
