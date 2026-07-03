-- Unifica os dois catálogos de produto duplicados (ver auditoria de sistema Jul/2026):
--   products          — usado por ProductsView / /api/admin/products
--   gateway_products  — usado por ProductGatewayView / /api/admin/gateway-products
--
-- Ambos modelam o mesmo conceito de negócio ("oferta extra para a paciente")
-- com schemas divergentes. Esta migration:
--   1. Estende `products` com as colunas exclusivas de gateway_products
--      (gatilho de exibição, planos visíveis, CTA, link externo)
--   2. Copia as linhas de gateway_products para products, preservando o
--      mesmo id (necessário para não quebrar gateway_product_interactions)
--   3. Repointa a FK de gateway_product_interactions para products
--
-- gateway_products NÃO é dropada nesta migration — fica como tabela legada
-- (deprecated) até o código de aplicação parar de referenciá-la e um ciclo
-- de validação em produção confirmar que a migração foi bem-sucedida.
--
-- ⚠️ ATENÇÃO PREÇO: gateway_products.price_label é texto livre (ex: "R$ 297"
-- ou "A partir de R$97"), incompatível com products.price_cents (inteiro).
-- NÃO convertemos esse texto automaticamente — arriscaria gravar um preço
-- errado silenciosamente em dado financeiro. Linhas migradas ficam com
-- price_cents = 0 e o texto original preservado em price_label_legacy, para
-- a nutricionista revisar e preencher o preço real manualmente em
-- Catálogo de Produtos após esta migration.

ALTER TABLE products ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual'
  CHECK (trigger_type IN ('manual', 'after_days', 'after_checkins', 'low_adherence', 'high_engagement'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS trigger_value integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS visible_to_plans text[] DEFAULT ARRAY['community', 'tech_diet', 'vip'];
ALTER TABLE products ADD COLUMN IF NOT EXISTS cta_text text DEFAULT 'Quero saber mais';
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_label_legacy text;

INSERT INTO products (
  id, tenant_id, name, slug, type, description, short_description,
  price_cents, price_label_legacy, badge_text, is_active, sort_order,
  trigger_type, trigger_value, visible_to_plans, cta_text, external_url,
  created_at, updated_at
)
SELECT
  gp.id,
  gp.tenant_id,
  gp.name,
  lower(regexp_replace(gp.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-gw-' || substr(gp.id::text, 1, 8),
  CASE gp.product_type WHEN 'program_90d' THEN 'method_90d' ELSE gp.product_type END,
  gp.description,
  gp.short_pitch,
  0,
  gp.price_label,
  gp.badge_text,
  gp.is_active,
  gp.display_order,
  gp.trigger_type,
  gp.trigger_value,
  gp.visible_to_plans,
  gp.cta_text,
  gp.external_url,
  gp.created_at,
  gp.updated_at
FROM gateway_products gp
ON CONFLICT (id) DO NOTHING;

ALTER TABLE gateway_product_interactions DROP CONSTRAINT IF EXISTS gateway_product_interactions_product_id_fkey;
ALTER TABLE gateway_product_interactions ADD CONSTRAINT gateway_product_interactions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

COMMENT ON TABLE gateway_products IS 'DEPRECATED — migrado para products (ver 20260703000003_unify_product_catalog.sql). Não usar em código novo.';
