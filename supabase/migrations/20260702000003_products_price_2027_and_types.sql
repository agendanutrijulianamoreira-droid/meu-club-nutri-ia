-- ============================================================
-- Migration: Preço 2027 e novos tipos de produto no catálogo
-- Permite cadastrar o valor que passa a valer em 2027 desde já,
-- e amplia os tipos de produto para Protocolo e Ebook.
-- 2026-07-02
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS price_cents_2027 integer;

COMMENT ON COLUMN products.price_cents_2027 IS
  'Preço em centavos que passa a valer a partir de 2027 (reajuste anual). Editável na UI; nulo = mantém price_cents.';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check;
ALTER TABLE products ADD CONSTRAINT products_type_check
  CHECK (type IN ('consultation', 'method_90d', 'genetic_test', 'subscription', 'custom', 'protocol', 'ebook'));
