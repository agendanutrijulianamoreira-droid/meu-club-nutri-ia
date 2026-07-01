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

-- Dados públicos (produtos de mercado), mas RLS habilitado por padrão de segurança,
-- com leitura liberada para qualquer usuário e escrita por usuários autenticados
-- (o endpoint /api/patient/scanner grava o cache usando a sessão da paciente).
ALTER TABLE cache_produtos_barcode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_barcode_leitura_publica" ON cache_produtos_barcode
  FOR SELECT USING (true);

CREATE POLICY "produtos_barcode_insert_autenticado" ON cache_produtos_barcode
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "produtos_barcode_service_role" ON cache_produtos_barcode
  FOR ALL TO service_role USING (true);
