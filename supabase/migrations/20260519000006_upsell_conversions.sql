-- ============================================================
-- BLOCO 6 — AGENTE DE UPSELL + CONVERSÕES
-- Rastreia ofertas enviadas e conversões para o agente aprender
-- ============================================================

CREATE TABLE IF NOT EXISTS upsell_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,

  -- Origem
  approval_id     uuid REFERENCES agent_approval_queue(id) ON DELETE SET NULL,
  trigger_reason  text,              -- 'streak_milestone', 'high_engagement', 'plan_age', etc.
  days_on_plan    integer,
  streak_at_offer integer,
  engagement_score integer,          -- 0-100

  -- Oferta enviada
  offer_title     text,
  offer_body      text,
  product_name    text,

  -- Resultado
  event_type      text NOT NULL DEFAULT 'sent'
    CHECK (event_type IN ('sent', 'viewed', 'clicked', 'converted', 'dismissed')),
  converted_at    timestamptz,

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsell_events_tenant ON upsell_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upsell_events_user ON upsell_events(user_id);
CREATE INDEX IF NOT EXISTS idx_upsell_events_type ON upsell_events(tenant_id, event_type);

ALTER TABLE upsell_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin views own upsell events"
  ON upsell_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = upsell_events.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- Anti-spam: impede reoferta em menos de 14 dias
CREATE OR REPLACE FUNCTION was_recently_offered(
  p_user_id uuid,
  p_product_id uuid,
  p_days integer DEFAULT 14
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM upsell_events
    WHERE user_id = p_user_id
      AND (product_id = p_product_id OR p_product_id IS NULL)
      AND event_type = 'sent'
      AND created_at > now() - (p_days || ' days')::interval
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
