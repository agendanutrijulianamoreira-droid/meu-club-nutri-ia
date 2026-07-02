-- ============================================================
-- PROTOCOLOS SAZONAIS — venda avulsa, cardápio qualitativo com fotos,
-- metas, upsell no último dia e lista de compras automática
-- ============================================================

-- 1. Campos novos em 'protocols'
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS goals text[] DEFAULT '{}';
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS shopping_list jsonb DEFAULT '[]';

-- Upsell exibido no último dia do protocolo (próximo passo: consulta avulsa, VIP, etc)
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS upsell_title text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS upsell_message text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS upsell_cta_label text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS upsell_cta_url text;

-- Venda avulsa (isca / lead magnet) para não-assinantes
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS is_standalone boolean DEFAULT false;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS standalone_slug text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS standalone_price_cents integer;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS sales_headline text;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS sales_description text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocols_standalone_slug
  ON protocols(standalone_slug) WHERE standalone_slug IS NOT NULL;

-- 2. Foto por opção de refeição no cardápio qualitativo
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Leads capturados na página pública de venda avulsa
-- (a pessoa ainda não é paciente/assinante — fechamento é manual pela nutricionista)
CREATE TABLE IF NOT EXISTS protocol_leads (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  protocol_id   uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  name          text NOT NULL,
  whatsapp      text,
  email         text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'dismissed')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocol_leads_tenant ON protocol_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocol_leads_protocol ON protocol_leads(protocol_id);

ALTER TABLE protocol_leads ENABLE ROW LEVEL SECURITY;

-- Inserção de leads da página pública é feita via rota de servidor (service role),
-- que valida is_standalone antes de gravar — não há policy pública de INSERT aqui.
CREATE POLICY "Admin manages own tenant leads"
  ON protocol_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.tenant_id = protocol_leads.tenant_id
        AND profiles.role IN ('admin', 'nutritionist')
    )
  );

-- 4. A leitura pública do protocolo avulso (página de vendas) também é feita
-- via rota de servidor com service role — não expõe a tabela via RLS anônima.
