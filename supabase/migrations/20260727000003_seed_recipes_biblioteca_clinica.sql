-- ============================================================
-- Receitas reais da prescrição da nutricionista (PDF fornecido em
-- 26/07/2026) — importadas para a Biblioteca Clínica (recipes +
-- recipe_components), camada "Ativo Clínico" do Método Clínico.
--
-- Objetivo: reduzir custo de IA. Hoje toda receita/cardápio que a
-- nutricionista quer reutilizar precisa ser regerada via Gemini.
-- Estas ~66 receitas (bolos, bolinhos, pães, tortas, patês, saladas
-- e pratos principais que já fazem parte do protocolo real dela)
-- viram conteúdo salvo uma única vez — zero chamada de IA para
-- reutilizá-las em futuros planos de pacientes.
--
-- Ingredientes: seguindo ADR-0003, cada receita é composta via
-- `recipe_components` apontando para `foods` (nunca JSON solto). A
-- maioria dos alimentos genéricos (cebola, alho, farinha de trigo,
-- ovo cru etc.) não existia na tabela `foods` com dados nutricionais
-- reais — só como tags de texto livre (nutrição nula, usadas em outro
-- contexto do produto) — por isso foram cadastrados aqui como
-- entradas novas de qualidade TACO/TBCA (`source='taco'`) ou estimativa
-- de rótulo típico para itens sem tabela oficial, tipo "Farinha de
-- amêndoa", "Psyllium", "Xylitol", "Farinha de coco" (`source='custom'`).
-- Valores aproximados sempre que não há fonte oficial — não são laudo
-- nutricional de precisão, servem para o cálculo agregado de macros.
--
-- Simplificações deliberadas (para não multiplicar `foods` sem necessidade):
--   - "Filé de peito de frango" (cru ou cozido, em qualquer receita)
--     aponta para o `foods` já existente "Frango peito grelhado".
--   - Ricota / creme de ricota apontam para o `foods` já existente "Ricota".
--   - Cebola branca/roxa apontam para o novo "Cebola crua" único.
--   - Ingredientes "a gosto" (sal, pimenta, ervas) viram um componente
--     com quantity=1, unit=NULL e o texto original em serving_label,
--     porque o modelo relacional exige um food_id (sem free-text puro).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Alimentos novos (genéricos faltantes com nutrição real +
--    itens de especialidade/estimativa de rótulo)
-- ------------------------------------------------------------

INSERT INTO foods (name, name_search, category, source, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, serving_size_g, serving_label)
VALUES
  ('Cebola crua', 'cebola crua', 'Verduras e Legumes', 'taco', 39, 1.7, 0.1, 8.9, 1.4, 70.0, '1 unidade média'),
  ('Alho cru', 'alho cru', 'Verduras e Legumes', 'taco', 113, 4.3, 0.2, 23.9, 2.1, 3.0, '1 dente'),
  ('Ovo de galinha cru', 'ovo de galinha cru', 'Ovos', 'taco', 146, 13.0, 8.9, 1.6, 0.0, 50.0, '1 unidade média'),
  ('Gema de ovo', 'gema de ovo', 'Ovos', 'taco', 322, 15.9, 26.5, 3.6, 0.0, 15.0, '1 gema'),
  ('Farinha de trigo branca', 'farinha de trigo branca', 'Cereais', 'taco', 360, 10.0, 1.0, 75.0, 2.3, 15.0, '1 colher de sopa'),
  ('Farinha de trigo integral', 'farinha de trigo integral', 'Cereais', 'taco', 359, 13.0, 2.0, 69.0, 9.0, 15.0, '1 colher de sopa'),
  ('Batata baroa cozida', 'batata baroa cozida', 'Verduras e Legumes', 'taco', 80, 1.5, 0.3, 18.0, 1.5, 80.0, '1 unidade média'),
  ('Creme de leite de soja', 'creme de leite de soja', 'Laticínios', 'custom', 157, 2.0, 15.0, 4.0, 0.5, 30.0, '1 colher de servir'),
  ('Azeitona verde', 'azeitona verde', 'Outros', 'taco', 115, 1.0, 11.0, 4.0, 3.0, 4.0, '1 unidade média'),
  ('Leite em pó integral', 'leite em po integral', 'Laticínios', 'taco', 496, 25.0, 26.0, 38.0, 0.0, 16.0, '1 colher de sopa'),
  ('Leite em pó desnatado', 'leite em po desnatado', 'Laticínios', 'custom', 362, 35.0, 1.0, 52.0, 0.0, 7.0, '1 colher de sobremesa'),
  ('Filé de abadejo cru', 'file de abadejo cru', 'Carnes', 'taco', 85, 18.0, 1.0, 0.0, 0.0, 100.0, '1 filé pequeno'),
  ('Leite de coco', 'leite de coco', 'Bebidas', 'taco', 152, 1.5, 15.0, 3.0, 0.0, 200.0, '1 garrafinha'),
  ('Creme de leite', 'creme de leite', 'Laticínios', 'taco', 199, 2.5, 20.0, 3.0, 0.0, 15.0, '1 colher de sopa'),
  ('Xylitol', 'xylitol', 'Outros', 'custom', 240, 0.0, 0.0, 100.0, 0.0, 10.0, '1 colher de sopa'),
  ('Extrato de baunilha', 'extrato de baunilha', 'Outros', 'custom', 130, 0.1, 0.1, 12.0, 0.0, 5.0, '1 colher de chá'),
  ('Farinha de amêndoa', 'farinha de amendoa', 'Oleaginosas', 'custom', 571, 21.0, 50.0, 20.0, 10.0, 15.0, '1 colher de sopa'),
  ('Psyllium (casca em pó)', 'psyllium casca em po', 'Outros', 'custom', 20, 1.0, 0.0, 89.0, 85.0, 5.0, '1 colher de sopa'),
  ('Fermento em pó (fermento químico)', 'fermento em po fermento quimico', 'Outros', 'custom', 12, 0.0, 0.0, 2.8, 0.0, 3.0, '1 colher de chá'),
  ('Fermento biológico seco', 'fermento biologico seco', 'Outros', 'custom', 325, 40.0, 7.0, 36.0, 27.0, 5.0, '1 colher de sopa'),
  ('Vinagre de maçã', 'vinagre de maca', 'Outros', 'custom', 22, 0.0, 0.0, 1.0, 0.0, 11.0, '1 colher de sopa'),
  ('Cream cheese light', 'cream cheese light', 'Laticínios', 'custom', 155, 8.0, 12.0, 4.0, 0.0, 30.0, '1 colher de sopa'),
  ('Alho-poró cru', 'alho poro cru', 'Verduras e Legumes', 'taco', 61, 1.5, 0.3, 14.0, 1.8, 19.0, '1 colher de sopa'),
  ('Damasco seco', 'damasco seco', 'Frutas', 'custom', 241, 3.4, 0.5, 63.0, 7.0, 7.0, '1 unidade'),
  ('Sal refinado', 'sal refinado', 'Outros', 'custom', 0, 0.0, 0.0, 0.0, 0.0, 1.0, 'a gosto'),
  ('Pimenta do reino', 'pimenta do reino', 'Outros', 'custom', 251, 11.0, 3.3, 64.0, 26.0, 1.0, 'a gosto'),
  ('Salsa crua', 'salsa crua', 'Verduras e Legumes', 'taco', 24, 3.7, 0.5, 4.4, 2.0, 5.0, '1 colher de sopa'),
  ('Coentro cru', 'coentro cru', 'Verduras e Legumes', 'custom', 23, 2.1, 0.5, 3.7, 2.8, 5.0, '1 colher de sopa'),
  ('Cebolinha verde crua', 'cebolinha verde crua', 'Verduras e Legumes', 'custom', 15, 1.3, 0.2, 2.6, 1.3, 2.5, '1 colher de sopa'),
  ('Polvilho doce', 'polvilho doce', 'Cereais', 'custom', 351, 0.6, 0.3, 86.0, 1.0, 20.0, '1 colher de sopa'),
  ('Polvilho azedo', 'polvilho azedo', 'Cereais', 'custom', 350, 0.4, 0.2, 85.0, 1.0, 20.0, '1 colher de sopa'),
  ('Farinha de linhaça dourada', 'farinha de linhaca dourada', 'Cereais', 'custom', 495, 18.0, 42.0, 29.0, 27.0, 15.0, '1 colher de sopa'),
  ('Orégano seco', 'oregano seco', 'Outros', 'custom', 265, 9.0, 4.0, 69.0, 43.0, 1.0, 'a gosto'),
  ('Óleo de girassol', 'oleo de girassol', 'Óleos', 'custom', 884, 0.0, 100.0, 0.0, 0.0, 8.0, '1 colher de sopa'),
  ('Quinoa em grãos crua', 'quinoa em graos crua', 'Cereais', 'taco', 368, 14.0, 6.0, 64.0, 7.0, 25.0, '1 colher de sopa cheia'),
  ('Cogumelo Shimeji fresco', 'cogumelo shimeji fresco', 'Verduras e Legumes', 'custom', 34, 2.7, 0.3, 6.0, 2.5, 6.0, '1 unidade'),
  ('Farinha de arroz', 'farinha de arroz', 'Cereais', 'custom', 366, 6.0, 1.4, 80.0, 2.4, 17.0, '1 colher de sopa'),
  ('Queijo minas padrão', 'queijo minas padrao', 'Laticínios', 'taco', 264, 17.4, 20.0, 3.0, 0.0, 60.0, '1 fatia'),
  ('Suco de limão tahiti', 'suco de limao tahiti', 'Bebidas', 'custom', 25, 0.4, 0.2, 8.0, 0.3, 10.0, '1 colher de sopa'),
  ('Farinha de coco', 'farinha de coco', 'Cereais', 'custom', 400, 19.0, 13.0, 58.0, 39.0, 12.0, '1 colher de sopa'),
  ('Uva passa', 'uva passa', 'Frutas', 'taco', 299, 3.1, 0.5, 79.0, 3.7, 15.0, '1 colher de sopa'),
  ('Tâmara', 'tamara', 'Frutas', 'custom', 277, 1.8, 0.2, 75.0, 6.7, 8.0, '1 unidade'),
  ('Mix de grãos e sementes', 'mix de graos e sementes', 'Cereais', 'custom', 450, 15.0, 30.0, 30.0, 10.0, 15.0, '1 colher de sopa'),
  ('Amaranto em grão', 'amaranto em grao', 'Cereais', 'custom', 371, 14.0, 7.0, 65.0, 7.0, 15.0, '1 colher de sopa'),
  ('Farelo de trigo', 'farelo de trigo', 'Cereais', 'custom', 216, 15.6, 4.3, 64.0, 42.0, 9.0, '1 colher de sopa'),
  ('Molho de tomate caseiro', 'molho de tomate caseiro', 'Verduras e Legumes', 'custom', 35, 1.5, 1.0, 6.0, 1.5, 60.0, '1 concha'),
  ('Queijo prato', 'queijo prato', 'Laticínios', 'taco', 360, 23.0, 29.0, 1.9, 0.0, 20.0, '1 fatia'),
  ('Pão de hambúrguer', 'pao de hamburguer', 'Pães', 'custom', 280, 9.0, 5.0, 50.0, 2.0, 50.0, '1 unidade'),
  ('Flocos de milho (cornflakes)', 'flocos de milho cornflakes', 'Cereais', 'custom', 357, 7.0, 0.4, 84.0, 3.0, 30.0, '1 xícara'),
  ('Trigo para quibe cru', 'trigo para quibe cru', 'Cereais', 'custom', 342, 12.0, 1.3, 76.0, 18.0, 30.0, '1 xícara'),
  ('Hortelã fresca', 'hortela fresca', 'Verduras e Legumes', 'custom', 44, 3.3, 0.7, 8.0, 6.8, 5.0, '1 ramo'),
  ('Figo fresco', 'figo fresco', 'Frutas', 'taco', 41, 0.8, 0.2, 10.0, 1.4, 55.0, '1 unidade'),
  ('Açúcar de confeiteiro', 'acucar de confeiteiro', 'Outros', 'custom', 389, 0.0, 0.0, 99.8, 0.0, 10.0, '1 colher de sopa'),
  ('Açúcar refinado', 'acucar refinado', 'Outros', 'taco', 387, 0.0, 0.0, 99.8, 0.0, 10.0, '1 colher de sopa'),
  ('Alecrim seco', 'alecrim seco', 'Outros', 'custom', 131, 3.0, 6.0, 20.0, 14.0, 1.0, 'a gosto'),
  ('Louro (folha seca)', 'louro folha seca', 'Outros', 'custom', 313, 7.6, 8.4, 75.0, 26.0, 0.2, '1 folha'),
  ('Cominho em pó', 'cominho em po', 'Outros', 'custom', 375, 18.0, 22.0, 44.0, 11.0, 1.5, 'a gosto'),
  ('Massa Konjac (macarrão shirataki)', 'massa konjac macarrao shirataki', 'Cereais', 'custom', 9, 0.2, 0.0, 3.0, 3.0, 100.0, '1 porção'),
  ('Shoyu (molho de soja)', 'shoyu molho de soja', 'Outros', 'custom', 60, 6.0, 0.0, 6.0, 0.0, 15.0, '1 colher de sopa'),
  ('Shoyu light', 'shoyu light', 'Outros', 'custom', 53, 5.5, 0.0, 5.0, 0.0, 15.0, '1 colher de sopa'),
  ('Semente de gergelim', 'semente de gergelim', 'Oleaginosas', 'taco', 573, 17.0, 50.0, 23.0, 12.0, 9.0, '1 colher de sopa'),
  ('Páprica em pó', 'paprica em po', 'Outros', 'custom', 282, 14.0, 13.0, 34.0, 0.0, 2.0, 'a gosto'),
  ('Maionese tradicional', 'maionese tradicional', 'Outros', 'custom', 680, 1.0, 75.0, 3.0, 0.0, 10.0, '1 colher de sopa'),
  ('Agrião cru', 'agriao cru', 'Verduras e Legumes', 'taco', 22, 2.3, 0.3, 3.0, 1.6, 30.0, '1 punhado'),
  ('Mirtilo', 'mirtilo', 'Frutas', 'custom', 57, 0.7, 0.3, 14.0, 2.4, 10.0, '1 unidade'),
  ('Amido de milho', 'amido de milho', 'Cereais', 'custom', 381, 0.3, 0.1, 91.0, 0.0, 10.0, '1 colher de sopa'),
  ('Canela em pó', 'canela em po', 'Outros', 'taco', 247, 4.0, 1.2, 81.0, 53.0, 2.0, 'a gosto'),
  ('Leite de amêndoa (bebida vegetal)', 'leite de amendoa bebida vegetal', 'Bebidas', 'custom', 24, 0.4, 2.0, 0.3, 0.3, 200.0, '1 copo'),
  ('Couve-flor cozida', 'couve flor cozida', 'Verduras e Legumes', 'taco', 23, 1.9, 0.2, 4.3, 2.0, 100.0, '1 xícara'),
  ('Noz-moscada em pó', 'noz moscada em po', 'Outros', 'custom', 525, 6.0, 36.0, 49.0, 21.0, 1.0, 'a gosto'),
  ('Farinha de aveia', 'farinha de aveia', 'Cereais', 'custom', 389, 17.0, 7.0, 66.0, 7.0, 15.0, '1 colher de sopa'),
  ('Farinha da casca do maracujá', 'farinha da casca do maracuja', 'Outros', 'custom', 211, 7.0, 1.0, 54.0, 45.0, 10.0, '1 colher de sopa'),
  ('Farinha de centeio', 'farinha de centeio', 'Cereais', 'custom', 336, 8.8, 1.6, 69.0, 14.0, 15.0, '1 colher de sopa'),
  ('Creme de leite light', 'creme de leite light', 'Laticínios', 'custom', 120, 2.5, 10.0, 4.0, 0.0, 15.0, '1 colher de sopa'),
  ('Lentilha crua', 'lentilha crua', 'Leguminosas', 'taco', 336, 24.0, 1.0, 60.0, 11.0, 25.0, '1 xícara'),
  ('Semente de girassol torrada', 'semente de girassol torrada', 'Oleaginosas', 'taco', 584, 21.0, 51.0, 20.0, 8.6, 15.0, '1 colher de sopa'),
  ('Tomilho seco', 'tomilho seco', 'Outros', 'custom', 276, 9.0, 7.0, 64.0, 37.0, 1.0, 'a gosto')
ON CONFLICT (name, source) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Funções auxiliares temporárias (apenas para esta migration —
--    removidas na seção final). Evitam repetir 300+ vezes o mesmo
--    boilerplate de "insere se não existir" por receita/ingrediente.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION _seed_recipe(
  p_tenant_id uuid,
  p_title text,
  p_description text,
  p_category_name text,
  p_servings int,
  p_instructions text
) RETURNS uuid AS $$
DECLARE
  v_recipe_id uuid;
  v_category_id uuid;
BEGIN
  SELECT id INTO v_category_id FROM clinical_categories
  WHERE tenant_id = p_tenant_id AND entity_type = 'recipe' AND name = p_category_name;

  INSERT INTO recipes (tenant_id, title, description, category_id, servings, instructions, is_active, is_ai_generated)
  SELECT p_tenant_id, p_title, p_description, v_category_id, p_servings, p_instructions, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM recipes WHERE tenant_id = p_tenant_id AND title = p_title
  );

  SELECT id INTO v_recipe_id FROM recipes
  WHERE tenant_id = p_tenant_id AND title = p_title
  ORDER BY created_at DESC LIMIT 1;

  RETURN v_recipe_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _seed_recipe_component(
  p_recipe_id uuid,
  p_tenant_id uuid,
  p_food_name text,
  p_qty numeric,
  p_unit text,
  p_label text,
  p_sort int
) RETURNS void AS $$
DECLARE
  v_food_id uuid;
BEGIN
  SELECT id INTO v_food_id FROM foods WHERE name = p_food_name
  ORDER BY (source = 'taco') DESC, created_at ASC LIMIT 1;

  IF v_food_id IS NULL THEN
    RAISE EXCEPTION 'Alimento não encontrado ao importar receitas da Biblioteca Clínica: %', p_food_name;
  END IF;

  INSERT INTO recipe_components (recipe_id, tenant_id, food_id, quantity, unit, serving_label, sort_order)
  VALUES (p_recipe_id, p_tenant_id, v_food_id, p_qty, p_unit, p_label, p_sort);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 3. Receitas (66 no total, extraídas da prescrição real)
-- ------------------------------------------------------------

-- 1. Bolo de batata baroa com carne
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolo de batata baroa com carne',
    'Bolo salgado de carne moída com cobertura cremosa de batata baroa, ótimo para marmita da semana.',
    'almoço', 4,
    'Refogue a cebola com o azeite e adicione a carne moída. Mexa até dourar. Adicione os tomates, a vagem, o sal e deixe cozinhar. Retire a carne, polvilhe a salsa e reserve. Bata as claras em neve e misture o restante dos ingredientes da cobertura. Coloque sobre a carne moída em uma travessa de vidro e leve ao forno pré-aquecido (180ºC) até dourar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Carne moída refogada', 300, 'g', '5 colheres de servir cheias', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '1 unidade média', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Vagem cozida', 100, 'g', '5 colheres de sopa cheias', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 200, 'g', '2 unidades médias', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 6, 'g', '1 colher de sopa cheia', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 5, 'g', '1 colher de sobremesa rasa', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 30, 'g', '2 unidades médias', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Batata baroa cozida', 400, 'g', '5 unidades médias, amassada', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 30, 'g', '2 colheres de sopa cheias, light ralado', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto (cobertura)', 10);
  END IF;
END $$;

-- 2. Torta integral de frango com ricota
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta integral de frango com ricota',
    'Torta salgada de massa integral com recheio cremoso de frango desfiado e ricota.',
    'almoço', 10,
    'Para a massa: reserve parte da gema para pincelar a torta no fim do preparo. Misture os ingredientes até formar uma massa firme. Deixe descansar enquanto prepara o recheio. Para o recheio: coloque o peito de frango, o tomate e a cebola em uma panela e deixe cozinhar até amaciar. Desfie o frango. Leve-o novamente à panela, com o restante dos ingredientes, até engrossar. Divida a massa em duas partes, forre a forma, coloque o recheio e a cebolinha, cubra com a outra parte da massa, pincele com a gema e leve ao forno pré-aquecido (180ºC) até assar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 unidade média', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Creme de leite de soja', 120, 'g', '4 colheres de servir cheias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 32, 'g', '4 colheres de sopa rasas', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 300, 'g', '20 colheres de sopa cheias (massa)', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 500, 'g', '5 filés médios', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 100, 'g', '1 unidade média', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '1 unidade média', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeitona verde', 20, 'g', '5 unidades médias', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 100, 'g', '5 colheres de sopa (creme de ricota)', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 45, 'g', '3 colheres de sopa cheias (recheio)', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite desnatado', 165, 'ml', '1 copo americano pequeno', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebolinha verde crua', 2.5, 'g', '1 colher de sopa', 11);
  END IF;
END $$;

-- 3. Bolinhos de peixe
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinhos de peixe',
    'Bolinhos assados de peixe processado com pão integral e ervas frescas.',
    'lanche', 10,
    'Coloque todos os ingredientes em um processador, exceto o azeite, e processe até virar uma massa homogênea. Faça 10 bolinhos com a massa. Forre uma travessa com papel laminado e unte com azeite. Leve ao forno durante 15 minutos e vire os bolinhos para assar dos dois lados.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Filé de abadejo cru', 200, 'g', '2 filés pequenos', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pão integral', 125, 'g', '5 fatias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 unidade média', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, 'g', '1 colher de café', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 35, 'g', '1/2 unidade média, em pedaços', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Coentro cru', 5, 'g', '1 colher de sopa cheia', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 8, 'g', '2 colheres de sopa cheias (salsinha)', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite integral', 50, 'ml', '1 xícara de café', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '1 colher de sopa rasa, para untar', 9);
  END IF;
END $$;

-- 4. Beijinho low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Beijinho low carb',
    'Versão sem açúcar do docinho clássico de coco, adoçada com xylitol.',
    'sobremesa', 10,
    'Aqueça o óleo de coco em fogo baixo. Acrescente o creme de leite e misture. Adicione o xylitol, metade do coco ralado e misture. Adicione o leite de coco e o restante do coco ralado, continue mexendo. Retire do fogo, deixe resfriar e enrole as bolinhas.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Coco ralado', 99, 'g', '11 colheres de sopa cheias', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 16, 'ml', '2 colheres de sopa', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite de coco', 200, 'ml', '1 garrafa', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Creme de leite', 90, 'g', '6 colheres de sopa rasas', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Xylitol', 20, 'g', '2 colheres de sopa', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Extrato de baunilha', 7.5, 'g', '1/2 colher de sopa rasa', 5);
  END IF;
END $$;

-- 5. Pão low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão low carb',
    'Pãozinho sem farinha de trigo, à base de farinha de amêndoa e psyllium.',
    'lanche', 6,
    'Pré-aqueça o forno (180ºC). Misture farinha de amêndoa, psyllium, sal e fermento. Ferva a água, acrescente com as claras e o vinagre. Bata com mixer. Modele 6 bolinhos e asse por aproximadamente 50 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de amêndoa', 150, 'g', '10 colheres de sopa', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Psyllium (casca em pó)', 20, 'g', '5 colheres de sopa', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 6, 'g', '2 colheres de chá cheias', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 6, 'g', '1 colher de chá cheia', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Vinagre de maçã', 11, 'g', '1 colher de sopa rasa', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 45, 'g', '3 unidades médias', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '1 copo americano duplo, fervente', 6);
  END IF;
END $$;

-- 6. Pão de queijo fit
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão de queijo fit',
    'Pão de queijo simplificado sem forno de goma de tapioca, cream cheese light e parmesão.',
    'lanche', 5,
    'Misture tudo, faça bolinhas e coloque em forminhas de cupcake. Asse a 200ºC por aproximadamente 30 minutos ou na air fryer a 200ºC por 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tapioca (goma hidratada)', 120, 'g', '6 colheres de sopa cheias', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cream cheese light', 150, 'g', '5 colheres de sopa cheias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 105, 'g', '7 colheres de sopa cheias, ralado', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de chia', 30, 'g', '2 colheres de sopa cheias', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto (opcional)', 4);
  END IF;
END $$;

-- 7. Creme de abóbora low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Creme de abóbora low carb',
    'Sopa cremosa de abóbora moranga refogada no azeite com alho-poró.',
    'refeição', 4,
    'Refogue o alho e o alho-poró no azeite. Adicione a abóbora, água e temperos até amolecer. Bata no liquidificador, ferva novamente e sirva.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 24, 'ml', '3 colheres de sopa, extravirgem', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho-poró cru', 57, 'g', '3 colheres de sopa cheias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Abóbora moranga cozida', 100, 'g', '2 pedaços médios', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '2 dentes', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, 'g', '1 colher de café', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 5);
  END IF;
END $$;

-- 8. Geléia de damasco low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Geléia de damasco low carb',
    'Geleia sem açúcar de damasco seco hidratado em suco de laranja.',
    'sobremesa', 10,
    'Esprema as laranjas e hidrate o damasco no suco por 4 horas. Processe tudo com sal a gosto até ficar cremoso.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Damasco seco', 140, 'g', '20 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Laranja pera', 180, 'g', '2 unidades pequenas', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'sal rosa a gosto', 2);
  END IF;
END $$;

-- 9. Pão de batata doce
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão de batata doce',
    'Pão simples de batata doce cozida com polvilho doce e azedo.',
    'lanche', 20,
    'Amasse a batata doce cozida, misture os demais ingredientes, modele os pães e asse a 200ºC por 30 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Batata-doce cozida', 355, 'g', '1 unidade média', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Polvilho doce', 100, 'g', '5 colheres de sopa cheias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Polvilho azedo', 100, 'g', '5 colheres de sopa cheias', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 24, 'ml', '3 colheres de sopa, extravirgem', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 4);
  END IF;
END $$;

-- 10. Pão de aveia de micro-ondas
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão de aveia de micro-ondas',
    'Pãozinho individual de aveia e linhaça pronto em minutos no micro-ondas.',
    'lanche', 2,
    'Misture tudo exceto o fermento, depois acrescente o fermento. Leve ao micro-ondas em potência alta por 3 a 5 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 90, 'g', '2 unidades médias', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 120, 'g', '8 colheres de sopa cheias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 30, 'g', '2 colheres de sopa cheias (farinha de linhaça)', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '1 colher de sopa rasas', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Orégano seco', 1, NULL, 'a gosto', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 5);
  END IF;
END $$;

-- 11. Iogurte natural caseiro
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Iogurte natural caseiro',
    'Iogurte caseiro fermentado a partir de leite integral, leite em pó e um iogurte natural como fermento.',
    'café da manhã', 5,
    'Aqueça o leite até morno. Adicione o leite em pó e o iogurte, misture. Deixe descansando de 8 a 10 horas coberto, depois leve à geladeira.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural integral', 100, 'g', '1 unidade', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite integral', 1080, 'ml', '4 1/2 copos americano duplos', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite em pó integral', 96, 'g', '6 colheres de sopa cheias', 2);
  END IF;
END $$;

-- 12. Bolinho vegano de quinoa com shimeji
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho vegano de quinoa com shimeji',
    'Bolinho assado 100% vegetal de quinoa com cogumelo shimeji salteado.',
    'refeição', 3,
    'Refogue cebola e alho, cozinhe a quinoa com água e sal. Salteie o shimeji no óleo de coco. Misture a quinoa com tomate, shimeji, farinhas e temperos. Molde bolinhas, empane na farinha de linhaça e asse a 200ºC por 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 165, 'ml', '1 copo americano pequeno', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 35, 'g', '1/2 unidade média, roxa', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '2 dentes', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de girassol', 8, 'g', '1 colher de sopa rasa', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Quinoa em grãos crua', 125, 'g', '5 colheres de sopa cheias', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cogumelo Shimeji fresco', 60, 'g', '10 unidades', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 5, 'ml', '1 colher de sobremesa', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 100, 'g', '1 unidade média', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de arroz', 17, 'g', '1 colher de sopa cheia', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 45, 'g', '3 colheres de sopa cheias, para empanar', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Orégano seco', 1, NULL, 'a gosto', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 1, NULL, 'salsinha a gosto', 11);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebolinha verde crua', 1, NULL, 'a gosto', 12);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 13);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 14);
  END IF;
END $$;

-- 13. Arroz com lentilha e legumes
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Arroz com lentilha e legumes',
    'Arroz integral cozido junto com lentilha, espinafre e legumes, ao estilo de um mujadara temperado com açafrão.',
    'almoço', 6,
    'Deixar a lentilha de molho por 1 hora. Refogar cebola, alho, alho-poró e gengibre no azeite por cerca de 10 minutos. Misturar açafrão e canela. Adicionar arroz e água, cozinhar até reduzir pela metade. Adicionar a lentilha peneirada e a cenoura em cubos. Após 10 minutos, adicionar espinafre e tomate cereja. Ajustar sal, pimenta e tomilho. Finalizar com semente de girassol tostada.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Lentilha crua', 380, 'g', '2 xícaras', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Arroz integral cozido', 1, NULL, '1 xícara (arroz integral cru)', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 1, NULL, '4 xícaras', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Espinafre refogado', 1, NULL, '1 xícara de folhas', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '1 unidade', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 100, 'g', '1 unidade', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 150, 'g', '15 tomates cereja', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '2 dentes', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gengibre', 1, NULL, '1 rodela', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho-poró cru', 57, 'g', '1/2 xícara picado', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de girassol torrada', 1, NULL, '1/3 xícara', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 16, 'g', '2 colheres de sopa', 11);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cúrcuma em pó', 1, NULL, '1 colher de chá (açafrão da terra)', 12);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 1, NULL, '1/4 colher de chá', 13);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 14);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 15);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomilho seco', 1, NULL, 'a gosto', 16);
  END IF;
END $$;

-- 14. Bolinho crocante de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho crocante de frango',
    'Discos de frango batido recheados com queijo minas, empanados em farinha de linhaça e assados.',
    'lanche', 8,
    'Bata os filés até virar massa. Abra discos, recheie com queijo, feche em formato redondo. Empane no ovo e na farinha de linhaça. Asse na air fryer ou no forno até dourar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 270, 'g', '3 filés médios, cru', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo minas padrão', 60, 'g', '60g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades médias', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 45, 'g', '3 colheres de sopa cheia', 3);
  END IF;
END $$;

-- 15. Bolinho de amendoim
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de amendoim',
    'Bolinho individual de micro-ondas com pasta de amendoim, aveia e leite em pó desnatado.',
    'sobremesa', 1,
    'Bata o ovo, misture o leite em pó, a aveia, 1 colher de pasta de amendoim, 3 colheres de água e o fermento por último. Leve ao micro-ondas por 20 segundos, mexa, e mais 30 segundos. Cubra com a outra colher de pasta de amendoim.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo cozido', 45, 'g', '1 unidade média', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite em pó desnatado', 7, 'g', '1 colher de sobremesa cheia', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 10, 'g', '1 colher de sopa', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pasta de amendoim integral', 32, 'g', '2 colheres de sopa', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Adoçante sucralose/stévia (Linea)', 4, 'g', '1 colher de café cheia, adoçante em pó', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 3, 'g', '1 colher de chá cheia', 5);
  END IF;
END $$;

-- 16. Bolinho de banana com cacau
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de banana com cacau',
    'Bolinho rápido de micro-ondas de banana amassada com cacau em pó e farelo de aveia.',
    'sobremesa', 6,
    'Amasse a banana, misture os demais ingredientes deixando o fermento por último. Leve ao micro-ondas por 2 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 55, 'g', '1 unidade grande', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 90, 'g', '2 unidades médias', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cacau em pó', 15, 'g', '1 colher de sopa cheia', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 3, 'g', '1 colher de chá cheia', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 30, 'g', '3 colheres de sopa', 4);
  END IF;
END $$;

-- 17. Bolinho de frango low carb proteico
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de frango low carb proteico',
    'Bolinho assado só de frango, cenoura, salsinha e cream cheese, alto em proteína.',
    'lanche', 3,
    'Bata no processador, divida em 3 porções e asse a 220ºC por 20 minutos ou até dourar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cream cheese', 30, 'g', '1 colher de sopa cheia', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 10, 'g', '1 ramo, salsinha', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 100, 'g', '100g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 300, 'g', '300g, cru, sem pele', 3);
  END IF;
END $$;

-- 18. Bolinho de limão
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de limão',
    'Bolinho individual de micro-ondas com farinha de aveia e suco de limão tahiti.',
    'sobremesa', 1,
    'Bata o ovo, misture a farinha, a manteiga, o limão, o adoçante e o fermento. Leve ao micro-ondas por 1 minuto.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Suco de limão tahiti', 10, 'ml', '2 colheres de sopa', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 10, 'g', '1 colher de sopa', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 18, 'g', '1 colher de sopa cheia', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 8, 'g', '1 colher de chá cheia', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 ovo inteiro', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 15, 'g', '1 clara', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Adoçante sucralose/stévia (Linea)', 1, NULL, 'a gosto', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 1, NULL, 'a gosto', 7);
  END IF;
END $$;

-- 19. Granola caseira
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Granola caseira',
    'Granola assada de aveia em flocos grossos, castanha do Brasil e mel, adoçada com banana.',
    'lanche', 25,
    'Pré-aqueça o forno a 180ºC. Misture os secos numa tigela. Aqueça óleo de coco, mel e baunilha; acrescente a banana amassada. Misture os líquidos aos secos, espalhe na assadeira e asse por 25 minutos ou até dourar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 270, 'g', '3 xícaras, flocos grossos', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Castanha-do-pará', 140, 'g', '1 xícara', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Açúcar mascavo', 24, 'g', '2 colheres de sobremesa cheia', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1.5, 'g', '0,5 colher de café cheia', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 4, 'g', '1 colher de café cheia', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 16, 'ml', '2 colheres de sopa', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Mel', 45, 'g', '3 colheres de sopa rasa', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Extrato de baunilha', 7.5, 'g', '0,5 colher de sopa rasa', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 55, 'g', '1 unidade grande, madura', 8);
  END IF;
END $$;

-- 20. (Low) Filé de Frango ao molho de limão
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, '(Low) Filé de Frango ao molho de limão',
    'Filé de frango grelhado servido com molho cremoso de limão galego e creme de leite.',
    'jantar', 4,
    'Tempere os filés com alho, pimenta e sal por 20 minutos. Frite na frigideira até dourar. Para o molho, refogue a cebolinha no azeite, adicione o suco de limão, o creme de leite e as raspas. Regue os filés.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 480, 'g', '4 porções médias, cru', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 3, 'g', '1 dente', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '1 colher de chá cheia', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Suco de limão tahiti', 82.5, 'ml', '0,5 copo americano pequeno, limão galego', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Creme de leite', 45, 'g', '3 colheres de sopa rasa, enlatado UHT', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '1 colher de chá cheia (molho)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebolinha verde crua', 2.5, 'g', '1 colher de sopa', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Limão', 1, NULL, 'raspas a gosto', 9);
  END IF;
END $$;

-- 21. Bolinho de Abobrinha
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de Abobrinha',
    'Bolinho assado de abobrinha ralada com ricota e um toque de iogurte natural.',
    'lanche', 20,
    'Ralar as abobrinhas, misturar todos os ingredientes, modelar as bolinhas e assar a 200ºC por 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Abobrinha cozida', 400, 'g', '2 abobrinhas médias, raladas', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 200, 'g', '200g, amassada', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 unidade', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural desnatado', 170, 'g', '1 unidade', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo branca', 120, 'g', '1 xícara', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 6, 'g', '1 colher de chá', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '2 colheres de chá', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 8, 'g', '2 colheres de sopa, salsinha', 7);
  END IF;
END $$;

-- 22. Bolinho de coco (sem açúcar e sem lactose)
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de coco (sem açúcar e sem lactose)',
    'Bolinho assado sem açúcar e sem lactose, feito com coco fresco ralado e banana.',
    'sobremesa', 10,
    'Misture tudo e asse a aproximadamente 180ºC por 30 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades médias', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Coco ralado', 150, 'g', '150g, coco fresco', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 8, 'ml', '1 colher de sopa', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 3, 'g', '1 colher de chá cheia', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 40, 'g', '1 unidade média', 4);
  END IF;
END $$;

-- 23. Bolo de Banana Funcional (sem farinha e sem açúcar)
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolo de Banana Funcional (sem farinha e sem açúcar)',
    'Bolo funcional batido no liquidificador com banana, aveia e uva passas, sem farinha e sem açúcar.',
    'sobremesa', 10,
    'Misture aveia e canela reservando. Bata a banana, o óleo e os ovos no liquidificador. Acrescente as passas, bata. Junte aos secos, misture. Asse a 200ºC por aproximadamente 30 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 220, 'g', '4 bananas', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de girassol', 110, 'ml', '1/2 xícara (óleo ou aveia)', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 200, 'g', '4 ovos', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Uva passa', 145, 'g', '1 xícara', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 180, 'g', '2 xícaras, flocos finos', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 20, 'g', '2 colheres de sopa', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 1, NULL, 'a gosto', 6);
  END IF;
END $$;

-- 24. Cuca Low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Cuca Low carb',
    'Cuca alemã reinterpretada sem açúcar e sem farinha de trigo, com farofa de farinha de amendoim.',
    'sobremesa', 24,
    'Aqueça os ovos com o xilitol em fogo baixo até morno, bata em ponto de neve, adicione a baunilha, as farinhas e a manteiga. Para a farofa: misture tudo à mão. Monte, cubra com a farofa e asse por aproximadamente 40 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de coco', 48, 'g', '48g (massa)', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de amêndoa', 90, 'g', '90g (massa)', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Adoçante sucralose/stévia (Linea)', 8, 'g', '8g, sacarina', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 200, 'g', '4 unidades', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 76, 'g', '76g (massa)', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Amendoim torrado', 60, 'g', '60g, farinha de amendoim (farofa)', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Coco ralado', 27, 'g', '27g, coco fresco ralado (farofa)', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 19, 'g', '19g, gelada (farofa)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Xylitol', 20, 'g', '20g (farofa)', 8);
  END IF;
END $$;

-- 25. Geleia de morango low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Geleia de morango low carb',
    'Geleia sem açúcar de morango, adoçada com xylitol.',
    'sobremesa', 20,
    'Pique os morangos, adicione o adoçante e o suco de limão, ferva mexendo por aproximadamente 15 minutos, esfrie e armazene.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Morango', 288, 'g', '288g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Xylitol', 30, 'g', '30g', 1);
  END IF;
END $$;

-- 26. Pão com pó de casca de maracujá e farinha de centeio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão com pó de casca de maracujá e farinha de centeio',
    'Pão fermentado rico em fibras com farinha de centeio, linhaça e pó da casca do maracujá.',
    'lanche', 6,
    'Peneire as farinhas e o sal, misture com o maracujá e a linhaça, adicione o óleo, o ovo, o adoçante e o fermento dissolvido em água morna. Sove, deixe crescer 60 minutos, divida, deixe crescer mais 1h30, asse a 150ºC por 50 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '1 copo', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 ovo', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 6, 'g', '1 colher de chá', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Adoçante sucralose/stévia (Linea)', 1, NULL, '2 colheres de sopa, adoçante culinário', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo branca', 300, 'g', '2 copos, farinha especial', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha da casca do maracujá', 30, 'g', '3 colheres de sopa', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de centeio', 120, 'g', '1 copo', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de linhaça', 30, 'g', '1/4 copo', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento biológico seco', 12, 'g', '2 1/2 colheres', 8);
  END IF;
END $$;

-- 27. Pão de forma low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão de forma low carb',
    'Pão de forma batido no liquidificador, sem farinha de trigo, à base de farinha de amêndoa e ovos.',
    'lanche', 10,
    'Bata tudo no liquidificador exceto o fermento, incorpore o fermento na massa e asse em forno pré-aquecido até dourar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 150, 'g', '3 ovos', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 45, 'g', '45g, ralado', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Creme de leite light', 45, 'ml', '45ml', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 60, 'ml', '60ml', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de amêndoa', 180, 'g', '90g + 90g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 5);
  END IF;
END $$;

-- 28. Pão low carb de liquidificador
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão low carb de liquidificador',
    'Pão prático batido no liquidificador e assado no micro-ondas, com farinha de amêndoa e cenoura.',
    'lanche', 10,
    'Misture tudo exceto o queijo, coloque em forma de silicone, salpique o queijo e leve ao micro-ondas por 6 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de amêndoa', 45, 'g', '45g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de linhaça', 30, 'g', '30g, dourada', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 200, 'g', '4 unidades', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural integral', 30, 'g', '30g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 17, 'g', '17g, ralada', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 15, 'g', '15g, ralado', 6);
  END IF;
END $$;

-- 29. Torta de Banana com aveia
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de Banana com aveia',
    'Torta doce de banana e aveia sem açúcar, adoçada com xilitol e leite de amêndoa.',
    'sobremesa', 10,
    'Misture banana, aveia, nozes, canela, linhaça e fermento numa tigela. Bata o leite, o óleo, o xilitol e a baunilha no liquidificador. Misture os líquidos aos secos, asse em forma untada a 180ºC por 30 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 80, 'g', '2 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 160, 'g', '160g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 75, 'g', '75g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite de amêndoa (bebida vegetal)', 220, 'ml', '220ml', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Castanha-do-pará', 32, 'g', '32g, castanha do Brasil ou nozes', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Xylitol', 100, 'g', '1/2 xícara', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 16, 'ml', '16ml', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 20, 'g', '20g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Extrato de baunilha', 15, 'g', '15g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 3, 'g', '3g', 9);
  END IF;
END $$;

-- 30. Torta de Couve flor Proteica
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de Couve flor Proteica',
    'Torta salgada de base de couve-flor e ricota recheada com frango desfiado e coberta de muçarela.',
    'almoço', 10,
    'Bata a couve-flor, os ovos, a ricota, a noz-moscada, o sal, a pimenta e a farinha até virar massa homogênea. Refogue o alho, a cebola, a cenoura, o tomate, o frango desfiado e os temperos; misture à massa. Cubra com mussarela e asse a 180ºC por 35 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Couve-flor cozida', 600, 'g', '600g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 180, 'g', '4 unidades', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Noz-moscada em pó', 4, 'g', '4g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, 'g', '1g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 160, 'g', '160g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, branca', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 9, 'g', '9g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 120, 'g', '120g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 1000, 'g', '1000g, sem pele, cozido', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 32, 'g', '32g, picado', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo muçarela', 80, 'g', '80g', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 150, 'g', '150g', 11);
  END IF;
END $$;

-- 31. Torta de legumes de liquidificador
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de legumes de liquidificador',
    'Torta salgada batida no liquidificador com camadas de cenoura, brócolis e tomate refogados.',
    'jantar', 10,
    'Bata os ovos, a água, a ricota e o azeite no liquidificador. Refogue a cenoura, o brócolis e o tomate. Misture o creme com a aveia, a farinha de arroz e o fermento. Monte em camadas com os legumes, cubra com parmesão e orégano, asse a 180ºC por 40 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 150, 'g', '3 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 165, 'ml', '165ml', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 40, 'g', '40g, creme de ricota', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 16, 'g', '16g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 34, 'g', '34g, ralada', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Brócolis cozido', 90, 'g', '90g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 50, 'g', '50g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 30, 'g', '30g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de arroz', 102, 'g', '102g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 30, 'g', '30g', 10);
  END IF;
END $$;

-- 32. Pão Integral Caseiro Fácil
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão Integral Caseiro Fácil',
    'Pão de forma integral simples batido no liquidificador com farinha de trigo integral e aveia.',
    'lanche', 12,
    'Misture as farinhas e o fermento. Esquente o leite morno, bata com os ovos, o açúcar, o óleo e o sal no liquidificador. Junte às farinhas, misture e descanse 1 hora. Unte a forma, pincele gema, asse a 200ºC por 25 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 330, 'g', '330g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 220, 'g', '220g, integral', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite integral', 480, 'ml', '480ml, UHT', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 3, 'g', '3g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 80, 'ml', '80ml', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento biológico seco', 10, 'g', '10g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Açúcar mascavo', 24, 'g', '24g', 7);
  END IF;
END $$;

-- 33. Arroz ao forno com espinafre
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Arroz ao forno com espinafre',
    'Arroz integral gratinado em banho-maria com espinafre, ovos e parmesão.',
    'jantar', 4,
    'Bata os ovos, misture o azeite, o queijo e o leite. Tempere com pimenta, acrescente o espinafre. Adicione o arroz, misture. Asse em banho-maria por 35 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '8g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite desnatado', 120, 'ml', '120ml, UHT', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 30, 'g', '30g, ralado', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Espinafre refogado', 72, 'g', '72g, cozido', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Arroz integral cozido', 275, 'g', '275g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 12, 'g', '12g, picada', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 8);
  END IF;
END $$;

-- 34. Creme de chuchu
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Creme de chuchu',
    'Suflê individual de chuchu batido com leite desnatado e clara de ovo.',
    'refeição', 4,
    'Bata tudo no liquidificador, distribua em 4 refratários untados, asse a 180ºC por 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Chuchu cozido', 225, 'g', '225g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite desnatado', 120, 'ml', '120ml, UHT', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 68, 'g', '68g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Amido de milho', 20, 'g', '20g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 3, 'g', '3g', 4);
  END IF;
END $$;

-- 35. Hambúrguer caseiro
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Hambúrguer caseiro',
    'Hambúrguer caseiro de carne moída com cottage e aveia, montado com pão, queijo prato e salada.',
    'almoço', 4,
    'Misture a carne, a cebola, a aveia, o cottage e o sal. Modele 4 hambúrgueres, asse por aproximadamente 30 minutos virando na metade. Monte com pão, queijo, alface, tomate e milho.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Carne moída refogada', 200, 'g', '200g, crua', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 30, 'g', '30g, ralada', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 37.5, 'g', '37,5g, flocos finos', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 2, 'g', '2g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo cottage', 25, 'g', '25g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo prato', 60, 'g', '4 fatias', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pão de hambúrguer', 200, 'g', '4 unidades', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alface americana', 20, 'g', '20g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 100, 'g', '100g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Milho verde cozido', 56, 'g', '56g', 9);
  END IF;
END $$;

-- 36. Nhoque de aveia
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Nhoque de aveia',
    'Nhoque proteico de ricota e aveia, gratinado com parmesão e servido com molho de tomate caseiro.',
    'jantar', 6,
    'Misture a ricota, os ovos, a noz-moscada, a aveia, o farelo, a cebola, a salsa e o sal. Faça bolinhas, cozinhe em água fervente até subirem. Polvilhe parmesão, gratine no forno por aproximadamente 10 minutos. Sirva com molho de tomate.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 315, 'g', '315g, fresca amassada', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Noz-moscada em pó', 4, 'g', '4g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 120, 'g', '120g, flocos finos', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de trigo', 9, 'g', '9g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, picada', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 8, 'g', '8g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 2, 'g', '2g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 30, 'g', '30g, ralado', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Molho de tomate caseiro', 450, 'g', '450g', 9);
  END IF;
END $$;

-- 37. Nugget de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Nugget de frango',
    'Nugget assado de frango moído empanado em clara de ovo e mistura de amaranto com linhaça.',
    'jantar', 16,
    'Misture o frango, a cebola, o farelo, a clara, a salsa e o sal, leve à geladeira para firmar, corte em quadrados, empane em clara e na mistura de amaranto/linhaça, pincele azeite e asse por aproximadamente 30 minutos virando na metade.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 360, 'g', '360g, cru', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de trigo', 18, 'g', '18g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 30, 'g', '30g, picada', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 34, 'g', '34g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 12, 'g', '12g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 2, 'g', '2g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Clara de ovo', 68, 'g', '68g (empanar)', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Amaranto em grão', 87.5, 'g', '87,5g (empanar)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 75, 'g', '75g (empanar)', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'ml', '8ml, para pincelar', 9);
  END IF;
END $$;

-- 38. Panqueca de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Panqueca de frango',
    'Panqueca de massa mista de trigo branco e integral recheada com frango desfiado ao molho de tomate.',
    'jantar', 6,
    'Bata os ovos, a água, o leite, as farinhas e o sal no liquidificador; separe em 3 partes, bata uma com a cenoura. Prepare as panquecas na frigideira. Refogue o frango desfiado com azeite, alho, cebola e tomate. Recheie, cubra com molho e queijo ralado, gratine no forno.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo branca', 175, 'g', '175g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 175, 'g', '175g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 85, 'g', '85g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite integral', 240, 'ml', '240ml, UHT', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '240ml', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, '1 pitada', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 500, 'g', '500g, cozido', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '8g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 30, 'g', '30g', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 140, 'g', '140g, branca', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 9, 'g', '9g', 11);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Molho de tomate caseiro', 120, 'g', '120g', 12);
  END IF;
END $$;

-- 39. Torta de maçã
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de maçã',
    'Torta doce clássica de maçã com massa amanteigada e recheio de canela.',
    'sobremesa', 10,
    'Descasque e corte as maçãs, deixe de molho com limão. Misture as farinhas, a gema, o açúcar, a canela e a manteiga; adicione o iogurte até dar liga. Forre a forma, polvilhe açúcar/canela, arrume as maçãs, polvilhe o restante. Asse por aproximadamente 40 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo branca', 120, 'g', '120g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 120, 'g', '120g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural desnatado', 45, 'g', '45g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 38, 'g', '38g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gema de ovo', 15, 'g', '1 gema', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Açúcar refinado', 60, 'g', '60g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 40, 'g', '40g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Suco de limão tahiti', 165, 'ml', '165ml', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Maçã', 520, 'g', '4 unidades', 8);
  END IF;
END $$;

-- 40. Nugget de peixe
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Nugget de peixe',
    'Nugget assado de peixe processado, empanado em flocos de milho.',
    'jantar', 6,
    'Bata os filés no processador. Bata a cebola, o alho e a cebolinha, misture ao peixe. Faça bolinhas, empane nos flocos de milho, asse até dourar dos dois lados (aproximadamente 10 minutos virando).');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Filé de abadejo cru', 600, 'g', '600g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebolinha verde crua', 2.5, 'g', '2,5g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Flocos de milho (cornflakes)', 200, 'g', '200g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 3, 'g', '3g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, 'g', '1g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 30, 'g', '30g, branca', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 3, 'g', '3g', 6);
  END IF;
END $$;

-- 41. Quibe de forno
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Quibe de forno',
    'Quibe assado de carne moída e trigo para quibe com hortelã, sem fritura.',
    'jantar', 10,
    'Deixe o trigo de molho por 15 minutos, escorra. Bata a carne, o trigo, a cebola, os temperos e o gelo no processador. Espalhe numa forma, risque quadrados, regue com azeite, asse a 200ºC por 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Carne moída refogada', 540, 'g', '540g, crua', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Trigo para quibe cru', 180, 'g', '180g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Hortelã fresca', 40, 'g', '40g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 30, 'g', '30g, branca', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1.3, 'g', '1,3g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 4.5, 'g', '4,5g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 82.5, 'ml', '82,5ml', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 1, NULL, '5 pedras de gelo', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '8g', 8);
  END IF;
END $$;

-- 42. Torta de figo
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de figo',
    'Torta doce amanteigada com creme de cream cheese e cobertura de figos frescos.',
    'sobremesa', 8,
    'Misture a farinha, o açúcar, o fermento e a manteiga até virar farofa, adicione o ovo e a gema, descanse na geladeira 30 minutos. Forre a forma, asse com peso (feijão cru) por 25 minutos. Bata o cream cheese, a manteiga e o açúcar, adicione a baunilha. Cubra a base fria com o creme, decore com figos fatiados, alecrim e mel.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo branca', 180, 'g', '180g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 112, 'g', '112g, gelada', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Açúcar refinado', 60, 'g', '60g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '1 unidade', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gema de ovo', 15, 'g', '1 gema', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 1.5, 'g', '1,5g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cream cheese', 300, 'g', '300g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Manteiga', 46, 'g', '46g (recheio)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Açúcar de confeiteiro', 120, 'g', '120g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Extrato de baunilha', 15, 'g', '15g', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Figo fresco', 330, 'g', '6 unidades', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alecrim seco', 12, 'g', '12g', 11);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Mel', 15, 'g', '15g', 12);
  END IF;
END $$;

-- 43. Rocambole vegano de quinoa e lentilha
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Rocambole vegano de quinoa e lentilha',
    'Rocambole 100% vegetal de lentilha e quinoa recheado com vagem e cenoura, coberto com molho de tomate.',
    'almoço', 6,
    'Deixe a lentilha de molho por 8 horas, cozinhe com louro. Hidrate a quinoa, adicione à lentilha, cozinhe até secar. Tempere com azeite, alho, limão, cominho, orégano e sal. Acrescente farinha e aveia, deixe esfriar. Cozinhe a vagem e a cenoura. Monte um retângulo com a massa, recheie com os legumes, enrole, asse a 240ºC por 30 minutos, cubra com molho e volte ao forno por 10 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Lentilha crua', 180, 'g', '180g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '240ml', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Quinoa em grãos crua', 50, 'g', '50g, em grãos', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 24, 'ml', '24ml', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 15, 'g', '15g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Orégano seco', 16, 'g', '16g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cominho em pó', 1.5, 'g', '1,5g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 90, 'g', '90g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 75, 'g', '75g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Louro (folha seca)', 1, NULL, '2 folhas', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Suco de limão tahiti', 1, NULL, '2 colheres de sopa', 11);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Molho de tomate caseiro', 200, 'g', '200g (montagem)', 12);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Vagem cozida', 90, 'g', '90g (montagem)', 13);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 120, 'g', '120g, em palito (montagem)', 14);
  END IF;
END $$;

-- 44. Yakisoba low carb
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Yakisoba low carb',
    'Yakisoba com macarrão konjac no lugar do trigo, legumes salteados e molho de shoyu.',
    'jantar', 1,
    'Corte os legumes e cozinhe no vapor até ficarem crocantes. Salteie os legumes com azeite, alho, sal e shoyu. Frite a carne e o frango da mesma forma. Ferva os ingredientes do molho até engrossar. Misture tudo ao macarrão konjac cozido com o molho.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Massa Konjac (macarrão shirataki)', 270, 'g', '270g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Carne bovina patinho grelhado', 55, 'g', '55g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 50, 'g', '50g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Brócolis cozido', 30, 'g', '30g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Couve-flor cozida', 50, 'g', '50g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 50, 'g', '50g, cozida', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Repolho cru', 40, 'g', '40g, roxo, cozido', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 1, NULL, 'a gosto', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Shoyu light', 45, 'g', '45g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Shoyu (molho de soja)', 100, 'ml', '100ml (molho)', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 50, 'ml', '50ml (molho)', 10);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gengibre', 1, NULL, 'ralado a gosto', 11);
  END IF;
END $$;

-- 45. Torta low carb de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta low carb de frango',
    'Torta individual com massa de couve-flor e frango, recheada com refogado de tomate e cebola.',
    'jantar', 1,
    'Bata a couve-flor até virar pasta, misture ao frango até formar massa uniforme, tempere. Leve metade da massa ao forno por 10 minutos. Refogue a cebola, o alho e o tomate para o recheio. Cubra a massa assada com o recheio, feche com o restante da massa, pincele gema, salpique gergelim, asse por 15 a 20 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 100, 'g', '100g, desfiado', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Couve-flor cozida', 50, 'g', '50g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gema de ovo', 15, 'g', '1 unidade', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de gergelim', 1, NULL, 'a gosto', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'sal e ervas a gosto', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Orégano seco', 1, NULL, 'ervas a gosto', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'g', '1 colher de sopa', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, branca', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '2 dentes', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 200, 'g', '2 unidades, maduro', 9);
  END IF;
END $$;

-- 46. Pastel de forno | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pastel de forno | Consciência Nutricional',
    'Pastel assado na air fryer com massa de iogurte e aveia, recheado com frango desfiado.',
    'lanche', 4,
    'Misture tudo até homogêneo, divida em 4 partes, abra em círculo, recheie com 40g de proteína, feche em formato de pastel, pincele gema, leve à air fryer a 180-200ºC por 8 a 10 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural desnatado', 170, 'g', '170g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 200, 'g', '200g, flocos finos', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'ml', '8ml', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Gema de ovo', 15, 'g', '15g, opcional', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 40, 'g', '40g, desfiado', 5);
  END IF;
END $$;

-- 47. Mingau de aveia e psyllium | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Mingau de aveia e psyllium | Consciência Nutricional',
    'Mingau cremoso de aveia com psyllium para saciedade extra, finalizado com morango.',
    'café da manhã', 1,
    'Cozinhe a aveia na água até ficar cremoso. Adicione o psyllium, misture bem. Adoce se desejar e sirva com morango picado.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 30, 'g', '30g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 150, 'ml', '150ml', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Psyllium (casca em pó)', 10, 'g', '10g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Mel', 3, 'g', '3g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Morango', 60, 'g', '60g, picado', 4);
  END IF;
END $$;

-- 48. Pão Integral | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão Integral | Consciência Nutricional',
    'Pão integral rico em fibras, com mix de farinhas, castanhas e mix de grãos.',
    'lanche', 12,
    'Misture os secos, adicione os líquidos (azeite, ovos, 200ml de água), acrescente o restante da água aos poucos, adicione o fermento por último. Asse em forma untada por 30 a 40 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de trigo integral', 75, 'g', '75g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 90, 'g', '90g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de coco', 60, 'g', '60g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Mix de grãos e sementes', 75, 'g', '75g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite em pó integral', 45, 'g', '45g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Castanha-do-pará', 80, 'g', '80g, picada', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 6, 'g', '6g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 24, 'ml', '24ml', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 150, 'g', '3 unidades', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 400, 'ml', '400ml', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 10);
  END IF;
END $$;

-- 49. Pizza saudável com psyllium | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pizza saudável com psyllium | Consciência Nutricional',
    'Mini pizza individual de massa de farinha de aveia e psyllium, recheada com frango e muçarela.',
    'jantar', 1,
    'Misture a farinha, o psyllium, a água, os ovos, o queijo, o sal e a pimenta. Espalhe numa assadeira forrada, asse por 20 minutos, adicione o recheio.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo muçarela', 45, 'g', '45g (massa)', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 25, 'g', '25g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Psyllium (casca em pó)', 10, 'g', '10g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 30, 'ml', '30ml', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 35, 'g', '35g, desfiado (recheio)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo muçarela', 15, 'g', '15g (recheio)', 8);
  END IF;
END $$;

-- 50. Torta de atum | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Torta de atum | Consciência Nutricional',
    'Torta batida no liquidificador com massa de farinha de aveia e recheio de atum.',
    'jantar', 10,
    'Bata os ovos, o azeite, o iogurte, o sal, a pimenta e a farinha no liquidificador, acrescente o fermento no pulsar. Coloque metade da massa na forma, cubra com atum, cubra com o restante da massa e parmesão. Asse a 180ºC por 30 a 40 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 200, 'g', '4 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 16, 'ml', '16ml', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural integral', 100, 'g', '100g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'a gosto', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pimenta do reino', 1, NULL, 'a gosto', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 140, 'g', '140g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Atum em conserva', 170, 'g', '170g (recheio)', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Queijo parmesão', 8, 'g', '8g, ralado (recheio)', 8);
  END IF;
END $$;

-- 51. Pizza com farinha de aveia | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pizza com farinha de aveia | Consciência Nutricional',
    'Massa de pizza individual sem glúten feita só com farinha de aveia e iogurte natural.',
    'jantar', 1,
    'Pré-aqueça a 230ºC. Misture o iogurte, o sal e o fermento. Acrescente a farinha aos poucos até desgrudar das mãos. Abra a massa, transfira para a forma, faça furos com garfo, pré-asse 8 minutos, recheie e asse novamente.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 480, 'g', '480g, sem glúten', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural desnatado', 100, 'g', '100g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 3, 'g', '3g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 3);
  END IF;
END $$;

-- 52. Bolinho de banana | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolinho de banana | Consciência Nutricional',
    'Bolinho assado de banana com tâmara ou uva passa, aveia e farelo de aveia.',
    'sobremesa', 10,
    'Misture a banana, o ovo, a tâmara e o azeite. Junte o farelo de aveia, a aveia e a canela, depois o fermento. Asse em forminhas ou forma a 180ºC por aproximadamente 30 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 160, 'g', '4 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 200, 'g', '4 unidades', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tâmara', 117, 'g', '117g, ou uva passa picada', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 24, 'ml', '24ml', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 240, 'g', '240g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 240, 'g', '240g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 1, NULL, 'a gosto', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 7);
  END IF;
END $$;

-- 53. Pão de linhaça com psyllium | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pão de linhaça com psyllium | Consciência Nutricional',
    'Pão simples de apenas 4 ingredientes, rico em fibras, à base de farinha de linhaça e psyllium.',
    'lanche', 10,
    'Misture tudo com garfo ou colher, molde no formato desejado, asse a 180ºC por 50 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 6, 'g', '6g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '240ml, quente', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de linhaça dourada', 100, 'g', '100g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Psyllium (casca em pó)', 40, 'g', '40g', 4);
  END IF;
END $$;

-- 54. Bolo de maçã | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolo de maçã | Consciência Nutricional',
    'Bolinho individual de micro-ondas com maçã, whey e farinha de amêndoa e coco.',
    'sobremesa', 1,
    'Misture todos os ingredientes, leve ao micro-ondas por 5 minutos.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 40, 'g', '40g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 100, 'g', '2 unidades', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de amêndoa', 30, 'g', '30g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de coco', 24, 'g', '24g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural integral', 50, 'g', '50g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Maçã', 130, 'g', '130g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cacau em pó', 15, 'g', '15g', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 1, 'g', '1g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Whey protein (concentrado)', 30, 'g', '30g, whey puro', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 5, 'g', '5g', 9);
  END IF;
END $$;

-- 55. Bolo de limão siciliano e mirtilos | Consciência Nutricional
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Bolo de limão siciliano e mirtilos | Consciência Nutricional',
    'Bolo de aveia com tâmara, limão siciliano e mirtilos, finalizado com calda de leite em pó.',
    'sobremesa', 12,
    'Misture os ovos, as tâmaras, o iogurte, as raspas de limão e a baunilha. Acrescente a farinha de aveia e os mirtilos (passados na farinha). Adicione o suco de limão e o fermento. Asse a 180ºC por 30 minutos. Calda: misture o leite em pó, a água e o suco de limão até dar consistência cremosa.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 150, 'g', '3 unidades', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tâmara', 120, 'g', '120g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Iogurte natural integral', 100, 'g', '100g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Limão', 30, 'g', '30g, siciliano, raspas', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Extrato de baunilha', 7.5, 'g', '7,5g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farinha de aveia', 360, 'g', '360g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Mirtilo', 1, NULL, '10 unidades', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 10, 'g', '10g', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite em pó integral', 48, 'g', '48g (calda)', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água', 240, 'ml', '240ml (calda)', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Limão', 1, NULL, 'suco para calda', 10);
  END IF;
END $$;

-- 56. Suco verde funcional - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Suco verde funcional - Prof. Bianca Innocencio',
    'Suco verde funcional batido de maçã, couve e água de coco.',
    'bebida', 1,
    'Bater todos os ingredientes, coar se preferir.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Maçã', 130, 'g', '130g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'água de coco', 200, 'ml', '200ml', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Couve crua', 20, 'g', '1 folha', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Limão', 20, 'g', '20g', 3);
  END IF;
END $$;

-- 57. Pudim de chia funcional - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Pudim de chia funcional - Prof. Bianca Innocencio',
    'Pudim de chia com bebida vegetal, pronto em 30 minutos de geladeira.',
    'sobremesa', 1,
    'Misture a chia, a bebida vegetal e o adoçante. Geladeira por 30 minutos. Sirva com fruta ou geleia sem açúcar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Leite de amêndoa (bebida vegetal)', 200, 'ml', '200ml, bebida vegetal', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Semente de chia', 30, 'g', '30g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Adoçante sucralose/stévia (Linea)', 1, NULL, 'a gosto', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Morango', 1, NULL, 'fruta a gosto (opcional)', 3);
  END IF;
END $$;

-- 58. Salada de alface, rúcula e agrião - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Salada de alface, rúcula e agrião - Prof. Bianca Innocencio',
    'Salada simples de folhas verdes, pronta em minutos.',
    'refeição', 1,
    'Misturar e servir.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alface americana', 30, 'g', '30g, crespa', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Rúcula', 36, 'g', '36g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Agrião cru', 30, 'g', '30g', 2);
  END IF;
END $$;

-- 59. Salada de tomate cereja, cebola e pepino - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Salada de tomate cereja, cebola e pepino - Prof. Bianca Innocencio',
    'Salada refrescante de tomate cereja, cebola e pepino.',
    'refeição', 1,
    'Misturar e servir.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Tomate cru', 30, 'g', '30g, cereja', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 8, 'g', '8g, branca', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pepino', 12, 'g', '12g', 2);
  END IF;
END $$;

-- 60. Panqueca de banana com aveia - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Panqueca de banana com aveia - Prof. Bianca Innocencio',
    'Panqueca individual e rápida de banana amassada com aveia, grelhada em óleo de coco.',
    'café da manhã', 1,
    'Amasse a banana, misture os demais ingredientes, grelhe em frigideira untada com óleo de coco.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '50g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Banana prata', 40, 'g', '40g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Aveia em flocos', 30, 'g', '30g', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Canela em pó', 1, NULL, 'a gosto', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Óleo de coco', 1, NULL, 'para untar', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Fermento em pó (fermento químico)', 1.5, 'g', '1,5g', 5);
  END IF;
END $$;

-- 61. Salada de legumes: cenoura, beterraba e pepino - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Salada de legumes: cenoura, beterraba e pepino - Prof. Bianca Innocencio',
    'Salada crua e colorida de cenoura, beterraba e pepino em cubos.',
    'refeição', 1,
    'Higienizar, cortar em cubos, misturar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 17, 'g', '17g', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Pepino', 18, 'g', '18g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Beterraba crua', 25, 'g', '25g', 2);
  END IF;
END $$;

-- 62. Legumes cozidos: Abobrinha, berinjela e brócolis - Prof. Bianca Innocencio
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Legumes cozidos: Abobrinha, berinjela e brócolis - Prof. Bianca Innocencio',
    'Mix simples de legumes cozidos al dente, para acompanhar qualquer prato principal.',
    'refeição', 1,
    'Higienizar, cozinhar em água fervente al dente, escorrer e misturar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Abobrinha cozida', 30, 'g', '30g, italiana', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Berinjela cozida', 10, 'g', '10g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Brócolis cozido', 10, 'g', '10g', 2);
  END IF;
END $$;

-- 63. Hamburguer de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Hamburguer de frango',
    'Hambúrguer caseiro de frango moído com legumes ralados, cúrcuma e páprica.',
    'almoço', 8,
    'Misture o frango moído, a cenoura ralada, a abobrinha ralada, a cebola, o alho, a aveia, o ovo, a salsinha, a páprica, a cúrcuma, o sal e a pimenta. Modele os hambúrgueres, leve à geladeira por 30 minutos para firmar.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 500, 'g', '500g, cru', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 100, 'g', '100g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Abobrinha cozida', 120, 'g', '120g, italiana', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, branca', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '6g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 20, 'g', '20g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '50g, inteiro', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 1, NULL, 'salsinha a gosto', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Páprica em pó', 2, 'g', '2g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cúrcuma em pó', 2, 'g', '2g', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'ml', '8ml', 10);
  END IF;
END $$;

-- 64. Almondegas funcionais
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Almondegas funcionais',
    'Almôndegas de patinho moído com legumes ralados, fritas na frigideira e servidas com molho de tomate.',
    'almoço', 25,
    'Misture a carne moída, a cenoura ralada, a abobrinha ralada, a cebola, o alho, a aveia, o ovo, a salsinha, a páprica, a cúrcuma e o sal. Modele as almôndegas, firme na geladeira por 30 minutos, frite na frigideira com azeite por 5 a 7 minutos por lado até dourar. Sirva com molho de tomate e arroz integral, quinoa ou salada.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Carne bovina patinho grelhado', 500, 'g', '500g, moído', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 100, 'g', '100g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Abobrinha cozida', 120, 'g', '120g, italiana', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, branca', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Alho cru', 6, 'g', '6g', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Farelo de aveia', 20, 'g', '20g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ovo de galinha cru', 50, 'g', '50g, inteiro', 6);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Salsa crua', 1, NULL, 'salsinha a gosto', 7);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Páprica em pó', 2, 'g', '2g', 8);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cúrcuma em pó', 2, 'g', '2g', 9);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Sal refinado', 1, NULL, 'sal marinho iodado a gosto', 10);
  END IF;
END $$;

-- 65. Patê de frango
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Patê de frango',
    'Patê cremoso de frango desfiado com creme de ricota e cenoura, ótimo para o lanche da tarde.',
    'lanche', 27,
    'Misture todos os ingredientes.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Frango peito grelhado', 1000, 'g', '1000g, desfiado', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Ricota', 500, 'g', '500g, creme de ricota', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 120, 'g', '1 unidade', 2);
  END IF;
END $$;

-- 66. Patê de atum
DO $$
DECLARE v_recipe_id uuid; v_tenant uuid := '2949970e-57d1-4a6e-9d28-75ea65552db1';
BEGIN
  v_recipe_id := _seed_recipe(v_tenant, 'Patê de atum',
    'Patê rápido de atum em conserva com cenoura, cebola refogada e maionese.',
    'lanche', 20,
    'Pique a cebola e a cebolinha, ralar a cenoura. Refogue a cebola no azeite, adicione a páprica. Escorra e lave o atum, amasse com garfo. Misture o atum, a cebola refogada, a maionese e a cenoura ralada. Ajuste o sal.');

  IF v_recipe_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_components WHERE recipe_id = v_recipe_id) THEN
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebola crua', 70, 'g', '70g, branca', 0);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cenoura crua', 60, 'g', '60g', 1);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Atum em conserva', 170, 'g', '1 lata, em óleo', 2);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Maionese tradicional', 135, 'g', '135g', 3);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Cebolinha verde crua', 1, NULL, 'a gosto', 4);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Páprica em pó', 4, 'g', '4g', 5);
    PERFORM _seed_recipe_component(v_recipe_id, v_tenant, 'Azeite de oliva', 8, 'ml', '8ml', 6);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Limpeza das funções auxiliares temporárias
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS _seed_recipe_component(uuid, uuid, text, numeric, text, text, int);
DROP FUNCTION IF EXISTS _seed_recipe(uuid, text, text, text, int, text);
