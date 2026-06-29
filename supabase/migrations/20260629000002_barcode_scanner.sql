-- ============================================
-- Fase 5: Scanner de Código de Barras com Avaliação Hormonal
-- ============================================

-- Cache de produtos consultados via Open Food Facts
CREATE TABLE IF NOT EXISTS cache_produtos_barcode (
    ean             TEXT PRIMARY KEY,
    nome            TEXT,
    marca           TEXT,
    ingredientes    TEXT,
    dados_nutricionais JSONB DEFAULT '{}',
    imagem_url      TEXT,
    consultado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Sem RLS: produto e publico, qualquer usuario pode consultar
