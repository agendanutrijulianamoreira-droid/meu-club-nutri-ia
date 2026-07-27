-- ============================================================
-- Cardápio-modelo "Fase 1" (base do acompanhamento) — importado da
-- prescrição real da nutricionista (PDF fornecido em 2026-07-27).
--
-- Objetivo: reduzir custo de IA. Hoje todo cardápio quantitativo é
-- gerado chamando o Gemini a cada paciente nova. Este cardápio vira um
-- modelo real, salvo uma única vez, que pode ser duplicado (sem
-- nenhuma chamada de IA) para pacientes que se encaixam na Fase 1 —
-- só entra IA de verdade quando for preciso personalizar de fato.
--
-- Alguns alimentos do cardápio (produtos de marca como o adoçante
-- Linea, e o pão "100% Integral Puro Grão 12 Grãos Slim") não existem
-- na tabela `foods` (que só tem itens genéricos TACO/TBCA) — foram
-- cadastrados aqui com valores nutricionais estimados a partir de
-- tabelas de rótulo típicas para esse tipo de produto. Não são valores
-- oficiais do fabricante; revisar se precisão de macro for crítica.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Alimentos novos (genéricos faltantes + produtos de marca)
-- ------------------------------------------------------------

INSERT INTO foods (name, name_search, category, source, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, serving_size_g, serving_label)
VALUES
  ('Queijo muçarela', 'queijo mucarela', 'Laticínios', 'taco', 280, 22.0, 20.0, 2.2, 0.0, 20.0, '1 fatia média'),
  ('Feijão vermelho cozido', 'feijao vermelho cozido', 'Leguminosas', 'taco', 127, 8.7, 0.5, 22.8, 6.4, 17.0, '1 colher de sopa cheia'),
  ('Gengibre em pó', 'gengibre em po', 'Outros', 'taco', 335, 9.1, 4.2, 71.6, 14.1, 2.0, '1/2 colher de café'),
  ('Farelo de aveia', 'farelo de aveia', 'Cereais', 'taco', 246, 17.0, 7.0, 66.0, 15.0, 10.0, '1 colher de sopa'),
  ('Couve crua', 'couve crua', 'Verduras e Legumes', 'taco', 27, 2.9, 0.5, 4.3, 3.1, 20.0, '1 folha'),
  ('Café coado', 'cafe coado', 'Bebidas', 'taco', 2, 0.1, 0.0, 0.0, 0.0, 240.0, '1 copo americano duplo'),
  ('Chá de melissa', 'cha de melissa', 'Bebidas', 'taco', 1, 0.0, 0.0, 0.2, 0.0, 200.0, '1 xícara de chá'),
  ('Limonada', 'limonada', 'Bebidas', 'custom', 25, 0.1, 0.0, 6.0, 0.2, 240.0, '1 copo americano duplo'),
  ('Pão 100% Integral Puro Grão 12 Grãos Slim (zero adição de açúcar)', 'pao 100 integral puro grao 12 graos slim zero adicao de acucar', 'Pães', 'custom', 235, 11.0, 3.5, 38.0, 7.0, 25.0, '1 fatia'),
  ('Adoçante sucralose/stévia (Linea)', 'adocante sucralose stevia linea', 'Outros', 'custom', 0, 0.0, 0.0, 0.0, 0.0, 0.1, '1 gota')
ON CONFLICT (name, source) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Cardápio-modelo (meal_plans) — dia único que se repete, com as
--    opções de substituição da nutricionista cobrindo a variedade
--    (é assim que a prescrição original foi estruturada).
-- ------------------------------------------------------------

INSERT INTO meal_plans (
  tenant_id, title, description, goal, duration_days,
  target_kcal, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g,
  status, is_ai_generated, tags
)
SELECT
  '2949970e-57d1-4a6e-9d28-75ea65552db1',
  'Cardápio Fase 1 — Reequilíbrio Base',
  'Modelo padrão da primeira fase do acompanhamento, com shot matinal, 6 refeições e opções de substituição por alimento. Estrutura de dia único repetido — a variedade vem das trocas sugeridas pela nutricionista, não de um cardápio diferente por dia.',
  'reequilíbrio',
  7,
  1900, 100, 214, 63, 25,
  'published', false,
  ARRAY['fase1', 'base', 'modelo']
WHERE NOT EXISTS (
  SELECT 1 FROM meal_plans
  WHERE tenant_id = '2949970e-57d1-4a6e-9d28-75ea65552db1'
    AND title = 'Cardápio Fase 1 — Reequilíbrio Base'
);

-- ------------------------------------------------------------
-- 3. Itens do cardápio-modelo (dia 1, repetido pelos 7 dias)
-- ------------------------------------------------------------

DO $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM meal_plans
  WHERE tenant_id = '2949970e-57d1-4a6e-9d28-75ea65552db1'
    AND title = 'Cardápio Fase 1 — Reequilíbrio Base'
  ORDER BY created_at DESC LIMIT 1;

  -- Reaplicação segura: se este plano já tem itens, não duplica.
  IF EXISTS (SELECT 1 FROM meal_plan_items WHERE meal_plan_id = v_plan_id) THEN
    RETURN;
  END IF;

  -- Shot matinal (água em jejum)
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g, preparation_notes)
  SELECT v_plan_id, 1, 'shot', 'Beber Água (jejum)', 0, id, name, 240, 1, '1 copo americano duplo', 0, 0, 0, 0, 0, 'Beber em jejum, assim que acordar'
  FROM foods WHERE name = 'água' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'shot', 'Beber Água (jejum)', 1, id, name, NULL, NULL, 'à vontade', NULL
  FROM foods WHERE name = 'Limão' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'shot', 'Beber Água (jejum)', 2, id, name, 2, 0.5, '1/2 colher de café cheia', energy_kcal * 0.02, protein_g * 0.02, carbs_g * 0.02, total_fat_g * 0.02, fiber_g * 0.02
  FROM foods WHERE name = 'Gengibre em pó' LIMIT 1;

  -- Café da manhã
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 0, id, name, 50, 2, '2 fatias', energy_kcal * 0.5, protein_g * 0.5, carbs_g * 0.5, total_fat_g * 0.5, fiber_g * 0.5
  FROM foods WHERE name = 'Pão 100% Integral Puro Grão 12 Grãos Slim (zero adição de açúcar)' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 1, id, name, 100, 2, '2 unidades', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Ovo cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 2, id, name, 4, 0.5, '1/2 colher de sopa', energy_kcal * 0.04, protein_g * 0.04, carbs_g * 0.04, total_fat_g * 0.04, fiber_g * 0.04
  FROM foods WHERE name = 'Azeite de oliva' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 3, id, name, 20, 1, '1 fatia média', energy_kcal * 0.2, protein_g * 0.2, carbs_g * 0.2, total_fat_g * 0.2, fiber_g * 0.2
  FROM foods WHERE name = 'Queijo muçarela' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 4, id, name, 240, 1, '1 copo americano duplo', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Café coado' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'cafe_manha', 'Café da Manhã', 5, id, name, 0.4, 4, '4 gotas', NULL
  FROM foods WHERE name = 'Adoçante sucralose/stévia (Linea)' LIMIT 1;

  -- Colação
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'colacao', 'Colação', 0, id, name, 55, 1, '1 unidade grande', energy_kcal * 0.55, protein_g * 0.55, carbs_g * 0.55, total_fat_g * 0.55, fiber_g * 0.55
  FROM foods WHERE name = 'Banana prata' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'colacao', 'Colação', 1, id, name, 10, 1, '1 colher de sopa', energy_kcal * 0.1, protein_g * 0.1, carbs_g * 0.1, total_fat_g * 0.1, fiber_g * 0.1
  FROM foods WHERE name = 'Farelo de aveia' LIMIT 1;

  -- Almoço
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 0, id, name, NULL, NULL, 'à vontade', 'Base da salada'
  FROM foods WHERE name = 'Couve crua' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 1, id, name, 45, 3, '3 fatias médias', energy_kcal * 0.45, protein_g * 0.45, carbs_g * 0.45, total_fat_g * 0.45, fiber_g * 0.45
  FROM foods WHERE name = 'Tomate cru' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 2, id, name, NULL, NULL, 'à vontade', 'Temperar a salada'
  FROM foods WHERE name = 'Limão' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 3, id, name, 4, 0.5, '1/2 colher de sopa', energy_kcal * 0.04, protein_g * 0.04, carbs_g * 0.04, total_fat_g * 0.04, fiber_g * 0.04
  FROM foods WHERE name = 'Azeite de oliva' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 4, id, name, 108, 3, '3 colheres de sopa cheias, picada', energy_kcal * 1.08, protein_g * 1.08, carbs_g * 1.08, total_fat_g * 1.08, fiber_g * 1.08
  FROM foods WHERE name = 'Abóbora moranga cozida' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 5, id, name, 75, 5, '5 colheres de sopa cheias, picado', energy_kcal * 0.75, protein_g * 0.75, carbs_g * 0.75, total_fat_g * 0.75, fiber_g * 0.75
  FROM foods WHERE name = 'Brócolis cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 6, id, name, 100, 1, '1 filé médio', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Frango peito grelhado' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 7, id, name, 102, 6, '6 colheres de sopa cheias', energy_kcal * 1.02, protein_g * 1.02, carbs_g * 1.02, total_fat_g * 1.02, fiber_g * 1.02
  FROM foods WHERE name = 'Feijão vermelho cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 8, id, name, 100, 4, '4 colheres de sopa cheias', energy_kcal * 0.8, protein_g * 0.8, carbs_g * 0.8, total_fat_g * 0.8, fiber_g * 0.8
  FROM foods WHERE name = 'Arroz branco cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'almoco', 'Almoço', 9, id, name, 180, 1, '1 unidade média', energy_kcal * 1.8, protein_g * 1.8, carbs_g * 1.8, total_fat_g * 1.8, fiber_g * 1.8
  FROM foods WHERE name = 'Laranja pera' LIMIT 1;

  -- Lanche da tarde
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'lanche_tarde', 'Lanche da Tarde', 0, id, name, 50, 2, '2 fatias', energy_kcal * 0.5, protein_g * 0.5, carbs_g * 0.5, total_fat_g * 0.5, fiber_g * 0.5
  FROM foods WHERE name = 'Pão 100% Integral Puro Grão 12 Grãos Slim (zero adição de açúcar)' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'lanche_tarde', 'Lanche da Tarde', 1, NULL, 'Patê de frango', 60, 2, '2 colheres de sopa', 'Frango desfiado + creme de ricota + cenoura (ver receita "Patê de frango" na Biblioteca Clínica)'
  FROM (SELECT 1) x;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'lanche_tarde', 'Lanche da Tarde', 2, id, name, 20, 1, '1 fatia média', energy_kcal * 0.2, protein_g * 0.2, carbs_g * 0.2, total_fat_g * 0.2, fiber_g * 0.2
  FROM foods WHERE name = 'Queijo muçarela' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'lanche_tarde', 'Lanche da Tarde', 3, id, name, 0.4, 4, '4 gotas', NULL
  FROM foods WHERE name = 'Adoçante sucralose/stévia (Linea)' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'lanche_tarde', 'Lanche da Tarde', 4, id, name, 240, 1, '1 copo americano duplo', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Limonada' LIMIT 1;

  -- Jantar (mesma estrutura do almoço)
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 0, id, name, NULL, NULL, 'à vontade', 'Base da salada'
  FROM foods WHERE name = 'Couve crua' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 1, id, name, 45, 3, '3 fatias médias', energy_kcal * 0.45, protein_g * 0.45, carbs_g * 0.45, total_fat_g * 0.45, fiber_g * 0.45
  FROM foods WHERE name = 'Tomate cru' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 2, id, name, NULL, NULL, 'à vontade', 'Temperar a salada'
  FROM foods WHERE name = 'Limão' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 3, id, name, 4, 0.5, '1/2 colher de sopa', energy_kcal * 0.04, protein_g * 0.04, carbs_g * 0.04, total_fat_g * 0.04, fiber_g * 0.04
  FROM foods WHERE name = 'Azeite de oliva' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 4, id, name, 108, 3, '3 colheres de sopa cheias, picada', energy_kcal * 1.08, protein_g * 1.08, carbs_g * 1.08, total_fat_g * 1.08, fiber_g * 1.08
  FROM foods WHERE name = 'Abóbora moranga cozida' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 5, id, name, 75, 5, '5 colheres de sopa cheias, picado', energy_kcal * 0.75, protein_g * 0.75, carbs_g * 0.75, total_fat_g * 0.75, fiber_g * 0.75
  FROM foods WHERE name = 'Brócolis cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 6, id, name, 100, 1, '1 filé médio', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Frango peito grelhado' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 7, id, name, 102, 6, '6 colheres de sopa cheias', energy_kcal * 1.02, protein_g * 1.02, carbs_g * 1.02, total_fat_g * 1.02, fiber_g * 1.02
  FROM foods WHERE name = 'Feijão vermelho cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 8, id, name, 100, 4, '4 colheres de sopa cheias', energy_kcal * 0.8, protein_g * 0.8, carbs_g * 0.8, total_fat_g * 0.8, fiber_g * 0.8
  FROM foods WHERE name = 'Arroz branco cozido' LIMIT 1;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'jantar', 'Jantar', 9, id, name, 180, 1, '1 unidade média', energy_kcal * 1.8, protein_g * 1.8, carbs_g * 1.8, total_fat_g * 1.8, fiber_g * 1.8
  FROM foods WHERE name = 'Laranja pera' LIMIT 1;

  -- Hora do chá
  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_id, food_name, quantity_g, serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, calc_fat_g, calc_fiber_g)
  SELECT v_plan_id, 1, 'cha_noturno', 'Hora do Chá', 0, id, name, 200, 1, '1 xícara de chá', energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g
  FROM foods WHERE name = 'Chá de melissa' LIMIT 1;
END $$;
