-- ============================================================
-- 20260527000001_seed_content.sql
-- Conteúdo Semente + Tabelas de Suporte (PDF Import)
-- Cria: notification_templates, library_documents
-- Funções: seed_meal_templates, seed_full_content
-- ============================================================

-- ============================================================
-- BLOCO 1: Tabela notification_templates (Upsell / Engajamento)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  message       text NOT NULL,
  tip_content   text,
  category      text DEFAULT 'upsell' CHECK (category IN (
    'upsell', 'engagement', 'milestone', 'educational', 'general'
  )),
  trigger_event text,
  target_plan   text[] DEFAULT '{}',
  cta_text      text,
  cta_url       text,
  is_active     boolean DEFAULT true,
  is_template   boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_tmpl_tenant ON notification_templates(tenant_id);
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_templates_admin ON notification_templates
  FOR ALL TO authenticated
  USING (
    (is_template = true)
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

CREATE POLICY notif_templates_service ON notification_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- BLOCO 2: Tabela library_documents (Upload PDF + IA)
-- ============================================================
CREATE TABLE IF NOT EXISTS library_documents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  user_hint         text,
  file_url          text NOT NULL DEFAULT '',
  file_name         text,
  file_type         text DEFAULT 'pdf' CHECK (file_type IN ('pdf', 'docx', 'txt', 'image')),
  file_size_bytes   bigint,
  detected_type     text,
  ai_summary        text,
  ai_tags           text[] DEFAULT '{}',
  status            text DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'classified', 'distributed', 'error'
  )),
  error_message     text,
  extracted_text    text,
  extracted_content jsonb DEFAULT '{}',
  items_created     jsonb DEFAULT '[]',
  uploaded_by       uuid REFERENCES auth.users(id),
  processed_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lib_docs_tenant ON library_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lib_docs_status ON library_documents(tenant_id, status);
ALTER TABLE library_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY lib_docs_admin ON library_documents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

CREATE POLICY lib_docs_service ON library_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_lib_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lib_docs_updated_at ON library_documents;
CREATE TRIGGER trg_lib_docs_updated_at
  BEFORE UPDATE ON library_documents
  FOR EACH ROW EXECUTE FUNCTION update_lib_docs_updated_at();

-- ============================================================
-- BLOCO 3: Função auxiliar para seed de cardápios (meal plans)
-- Separada porque precisa de múltiplos INSERTs encadeados
-- ============================================================
CREATE OR REPLACE FUNCTION seed_meal_templates(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
  v_owner_id uuid;
  v_plan_id  uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM tenants WHERE id = p_tenant_id;

  -- 1. Café da Manhã Anti-Inchaço
  INSERT INTO meal_plans (tenant_id, created_by, title, description, goal, duration_days, status, is_ai_generated, tags)
  VALUES (
    p_tenant_id, v_owner_id,
    'Café da Manhã Anti-Inchaço',
    'Refeição matinal com foco em reduzir retenção de líquidos e ativar o metabolismo. Rica em fibras solúveis, probióticos e antioxidantes.',
    'Reduzir inchaço e ativar o intestino logo pela manhã',
    1, 'published', false,
    ARRAY['anti-inchaço', 'matinal', 'fibras', 'probióticos']
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, serving_qty, serving_label, preparation_notes)
  VALUES
    (v_plan_id, 1, 'cafe_manha', 'Café da Manhã Anti-Inchaço', 1, 'Iogurte natural integral', 150, 1, 'pote pequeno', 'Escolha sem adição de açúcar. Integral é mais saciante.'),
    (v_plan_id, 1, 'cafe_manha', 'Café da Manhã Anti-Inchaço', 2, 'Frutas vermelhas mistas (morango, mirtilo ou amora)', 100, 1, 'xícara rasa', 'Frescas ou congeladas, sem calda.'),
    (v_plan_id, 1, 'cafe_manha', 'Café da Manhã Anti-Inchaço', 3, 'Semente de chia', 15, 1, 'colher de sopa', 'Adicionar sobre o iogurte com as frutas.'),
    (v_plan_id, 1, 'cafe_manha', 'Café da Manhã Anti-Inchaço', 4, 'Nozes ou amêndoas cruas', 20, 1, 'punhado pequeno', 'Mastigar bem — gordura boa é anti-inflamatória.'),
    (v_plan_id, 1, 'shot', 'Shot Matinal', 5, 'Shot da Imunidade e Metabolismo', 50, 1, 'dose (50ml)', 'Ver receita na biblioteca. Beber 20 min antes do café.');

  -- 2. Lanche Rápido e Saciante
  INSERT INTO meal_plans (tenant_id, created_by, title, description, goal, duration_days, status, is_ai_generated, tags)
  VALUES (
    p_tenant_id, v_owner_id,
    'Lanche Rápido e Saciante',
    'Combinação estratégica de proteína + gordura boa + fibra para manter a saciedade por 3-4h sem pico de insulina.',
    'Saciedade prolongada e estabilidade glicêmica',
    1, 'published', false,
    ARRAY['lanche', 'proteína', 'saciedade', 'low-glycemic']
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, serving_qty, serving_label, preparation_notes, substitution_note)
  VALUES
    (v_plan_id, 1, 'lanche_tarde', 'Lanche Saciante', 1, 'Mix de oleaginosas (castanha, amêndoa, nozes)', 30, 1, 'punhado (30g)', 'Sem sal e sem óleo adicionado.', 'Pode substituir por 2 colheres de pasta de amendoim integral.'),
    (v_plan_id, 1, 'lanche_tarde', 'Lanche Saciante', 2, 'Maçã ou pera com casca', 150, 1, 'unidade média', 'Com casca, rica em pectina (fibra prebiótica).', NULL),
    (v_plan_id, 1, 'lanche_tarde', 'Lanche Saciante', 3, 'Queijo minas frescal ou cottage', 60, 2, 'fatias', 'Fonte de proteína e cálcio de absorção lenta.', 'Pode substituir por 2 ovos cozidos.');

  -- 3. Almoço Anti-inflamatório
  INSERT INTO meal_plans (tenant_id, created_by, title, description, goal, duration_days, status, is_ai_generated, tags)
  VALUES (
    p_tenant_id, v_owner_id,
    'Almoço Anti-inflamatório',
    'Prato completo com a regra dos 4 quadrantes: metade de vegetais coloridos, 1/4 de proteína magra, 1/4 de carboidrato complexo e gordura boa.',
    'Reduzir inflamação sistêmica e manter a energia da tarde',
    1, 'published', false,
    ARRAY['anti-inflamatório', 'almoço', 'completo', 'colorido']
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, serving_qty, serving_label, preparation_notes, substitution_note)
  VALUES
    (v_plan_id, 1, 'almoco', 'Almoço Anti-inflamatório', 1, 'Frango grelhado (peito ou coxa sem pele)', 150, 1, 'porção', 'Temperar com alho, cúrcuma, azeite e limão — todos anti-inflamatórios.', 'Substituir por peixe (tilápia, salmão) ou ovos caipiras.'),
    (v_plan_id, 1, 'almoco', 'Almoço Anti-inflamatório', 2, 'Arroz integral cozido', 100, 4, 'colheres de sopa', 'Manter a proporção pequena — energia sem pico glicêmico.', 'Substituir por batata-doce ou quinoa.'),
    (v_plan_id, 1, 'almoco', 'Almoço Anti-inflamatório', 3, 'Feijão ou lentilha cozida', 80, 2, 'conchas', 'Proteína vegetal + fibra prebiótica. Essencial para o intestino.', NULL),
    (v_plan_id, 1, 'almoco', 'Almoço Anti-inflamatório', 4, 'Mix de vegetais refogados no azeite', 200, 1, 'porção generosa', 'Brócolis, cenoura, abobrinha, chuchu — tempere com alho e sal rosa.', NULL),
    (v_plan_id, 1, 'almoco', 'Almoço Anti-inflamatório', 5, 'Azeite de oliva extra-virgem', 15, 1, 'colher de sopa', 'Finalizar o prato com fio de azeite cru para preservar os polifenóis.', NULL);

  -- 4. Jantar Leve e Funcional
  INSERT INTO meal_plans (tenant_id, created_by, title, description, goal, duration_days, status, is_ai_generated, tags)
  VALUES (
    p_tenant_id, v_owner_id,
    'Jantar Leve e Funcional',
    'Jantar pensado para não sobrecarregar o sistema digestivo à noite, favorecendo o sono reparador e o metabolismo de madrugada.',
    'Digestão leve, sono profundo e recuperação metabólica noturna',
    1, 'published', false,
    ARRAY['jantar', 'leve', 'sono', 'digestão']
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, serving_qty, serving_label, preparation_notes, substitution_note)
  VALUES
    (v_plan_id, 1, 'jantar', 'Jantar Leve', 1, 'Ovo mexido ou cozido', 120, 2, 'unidades', 'Proteína completa de fácil digestão. Perfeito para o jantar.', 'Substituir por atum em água ou sardinha.'),
    (v_plan_id, 1, 'jantar', 'Jantar Leve', 2, 'Sopa de legumes ou caldo de legumes caseiro', 300, 1, 'tigela média', 'Hidratante, aquecedor e de fácil digestão. Evitar macarrão.', NULL),
    (v_plan_id, 1, 'jantar', 'Jantar Leve', 3, 'Folhas verdes ao azeite e limão', 100, 1, 'prato raso', 'Rúcula, agrião ou espinafre cru — enzimas digestivas ativas.', NULL);

  -- 5. Pré-Treino Natural e Energético
  INSERT INTO meal_plans (tenant_id, created_by, title, description, goal, duration_days, status, is_ai_generated, tags)
  VALUES (
    p_tenant_id, v_owner_id,
    'Pré-Treino Natural e Energético',
    'Combinação de carboidrato de qualidade + eletrólitos + cafeína natural para energia sustentada durante o exercício, sem suplementos artificiais.',
    'Performance no treino com alimentos reais',
    1, 'published', false,
    ARRAY['pré-treino', 'energia', 'natural', 'exercício']
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO meal_plan_items (meal_plan_id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, serving_qty, serving_label, preparation_notes, substitution_note)
  VALUES
    (v_plan_id, 1, 'lanche_manha', 'Pré-Treino Natural', 1, 'Banana madura', 100, 1, 'unidade', 'Rica em potássio e carboidrato de liberação gradual. Comer 30-45min antes.', 'Substituir por tâmaras (3 unidades) ou batata-doce cozida.'),
    (v_plan_id, 1, 'lanche_manha', 'Pré-Treino Natural', 2, 'Pasta de amendoim integral', 20, 1, 'colher de sopa cheia', 'Gordura boa + proteína para sustentar a energia durante o treino.', NULL),
    (v_plan_id, 1, 'lanche_manha', 'Pré-Treino Natural', 3, 'Café puro sem açúcar', 100, 1, 'xícara', 'Cafeína natural: aumenta performance e queima de gordura 15% no treino.', 'Pode substituir por chá verde se sensível à cafeína.');

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BLOCO 4: Função principal de seed completo
-- Chamada 1x durante onboarding do tenant
-- ============================================================
CREATE OR REPLACE FUNCTION seed_full_content(p_tenant_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_r_count int := 0;
  v_p_count int := 0;
  v_c_count int := 0;
  v_n_count int := 0;
BEGIN

  -- ── RECEITAS (3 curingas) ──────────────────────────────────
  INSERT INTO recipes (tenant_id, title, description, emoji, category, dietary_tags, prep_time_min, servings, ingredients, instructions, calories, is_ai_generated, access_tier)
  VALUES
  (p_tenant_id,
    'Shot da Imunidade e Metabolismo',
    'Combinação bioativa que ativa o metabolismo, reduz a inflamação silenciosa e fortalece o sistema imune logo pela manhã — tudo em 50ml.',
    '🔥', 'shot',
    ARRAY['vegana', 'sem-gluten', 'sem-lactose'],
    5, 1,
    '[
      {"name": "Gengibre fresco ralado", "quantity": "1 colher de chá"},
      {"name": "Suco de limão-siciliano espremido", "quantity": "30ml"},
      {"name": "Cúrcuma em pó", "quantity": "1/4 colher de chá"},
      {"name": "Pimenta cayena", "quantity": "1 pitada"},
      {"name": "Mel cru (opcional)", "quantity": "1/2 colher de chá"},
      {"name": "Água morna", "quantity": "50ml"}
    ]'::jsonb,
    'Misture todos os ingredientes em um copo pequeno. Beba em jejum, 20 minutos antes do café da manhã. Comece sem a pimenta e vá aumentando gradualmente conforme o paladar se adapta. Quem tem gastrite ou úlcera deve consultar a nutricionista antes de iniciar. A regularidade é o segredo — 21 dias seguidos para sentir a diferença real no pique e na digestão.',
    15, true, 'basic'),

  (p_tenant_id,
    'Suco Verde Estruturado',
    'Diferente de sucos verdes rasos, esse tem fibra, clorofila ativa e eletrólitos — funciona como um reset intestinal e anti-inflamatório em um copo.',
    '🥬', 'bebida',
    ARRAY['vegana', 'sem-gluten', 'sem-lactose'],
    8, 1,
    '[
      {"name": "Folhas de couve-manteiga", "quantity": "2 folhas (sem o talo)"},
      {"name": "Pepino com casca", "quantity": "1/2 unidade"},
      {"name": "Suco de limão", "quantity": "1/2 limão"},
      {"name": "Gengibre fresco", "quantity": "1 pedaço de 1cm"},
      {"name": "Hortelã fresca", "quantity": "5 folhinhas"},
      {"name": "Água de coco gelada", "quantity": "200ml"},
      {"name": "Gelo", "quantity": "a gosto"}
    ]'::jsonb,
    'Bata tudo no liquidificador por 60 segundos até ficar homogêneo. Não coe — a fibra da couve é parte do protocolo. Beba imediatamente após preparar para preservar as enzimas ativas. Ideal consumir entre 30 e 60 minutos antes do almoço ou no lanche da manhã. O gosto da couve vai suavizando ao longo dos dias conforme o paladar se adapta.',
    90, false, 'basic'),

  (p_tenant_id,
    'Panqueca de Banana e Aveia (Sem Farinha)',
    'Rápida, prática e saciante. Funciona como café da manhã ou lanche da tarde — com proteína, fibra e carboidrato de qualidade em uma só receita.',
    '🥞', 'café da manhã',
    ARRAY['sem-gluten', 'vegetariana'],
    12, 2,
    '[
      {"name": "Banana madura amassada", "quantity": "1 unidade grande"},
      {"name": "Ovos caipiras", "quantity": "2 unidades"},
      {"name": "Aveia em flocos finos", "quantity": "3 colheres de sopa"},
      {"name": "Canela em pó", "quantity": "1/2 colher de chá"},
      {"name": "Extrato de baunilha (opcional)", "quantity": "algumas gotas"},
      {"name": "Óleo de coco ou manteiga ghee", "quantity": "para untar a frigideira"}
    ]'::jsonb,
    'Amasse bem a banana com um garfo até virar um purê. Adicione os ovos e bata até misturar. Incorpore a aveia, a canela e a baunilha. Aqueça a frigideira em fogo médio-baixo e unte levemente. Despeje pequenas porções e tampe por 2 minutos. Vire com cuidado e doure mais 1 minuto. Sirva com frutas frescas, mel ou pasta de amendoim sem açúcar. Dica: o fogo baixo é o ingrediente secreto.',
    280, false, 'basic');

  GET DIAGNOSTICS v_r_count = ROW_COUNT;

  -- ── PROTOCOLOS + METAS (7) ────────────────────────────────
  INSERT INTO protocols (tenant_id, title, description, emoji, category, duration_days, content, is_active, is_public)
  VALUES

  -- Protocolo 1: Desinflama 21 Dias
  (p_tenant_id,
    'Protocolo Desinflama 21 Dias',
    'Você chegou em um momento importante. A inflamação silenciosa é responsável por mais de 80% dos sintomas que as mulheres normalizam — inchaço que não sai, cansaço que não passa, digestão lenta, TPM intensa, dificuldade para emagrecer mesmo fazendo tudo "certo". Este protocolo foi criado para remover os principais gatilhos inflamatórios da sua rotina, um passo de cada vez, sem radicalismo. Em 21 dias, seu corpo vai agradecer de formas que você vai notar sem precisar subir na balança.',
    '🌿', 'detox', 21,
    '[
      {"day":1,"title":"Identificar e remover os vilões invisíveis","tasks":["Remover refrigerantes, sucos industrializados e bebidas adoçadas da rotina por 21 dias","Trocar o óleo de soja/milho por azeite de oliva extra-virgem nas preparações frias","Beber pelo menos 2L de água ao longo do dia","Registrar o nível de energia e inchaço no app (escala 1-5)"]},
      {"day":2,"title":"Gut Feeling: Ativar o intestino","tasks":["Incluir 1 porção de alimento fermentado no almoço ou jantar (iogurte natural, kefir ou chucrute)","Aumentar a ingestão de fibras: metade do prato = vegetais coloridos","Fazer caminhada de 20 minutos — o movimento é anti-inflamatório","Evitar comer 2h antes de dormir"]},
      {"day":3,"title":"Açúcar: A grande sabotagem silenciosa","tasks":["Identificar todas as fontes de açúcar oculto na alimentação (sacarose, xarope de glicose, dextrose)","Substituir sobremesas por 1 quadrado de chocolate amargo 70%+ ou frutas com canela","Fazer o Shot da Imunidade ao acordar (receita disponível na biblioteca)","Anotar como você se sentiu ao longo do dia"]},
      {"day":7,"title":"Check da Primeira Semana","tasks":["Fazer o check-in semanal no app com honestidade — cada resposta importa","Celebrar as vitórias da semana, mesmo as pequenas","Verificar hidratação: urina clara = boa hidratação","Preparar a lista de compras da próxima semana com foco em alimentos anti-inflamatórios"]},
      {"day":14,"title":"Meio do Caminho: Consolidar hábitos","tasks":["Avaliar quais hábitos já viraram rotina e quais ainda precisam de atenção","Incluir 1 alimento novo da lista anti-inflamatória (cúrcuma, brócolis, sardinha, frutas vermelhas, nozes)","Fazer 20 minutos de exercício com peso ou yoga","Checar o sono: 7-8h de sono profundo é parte do protocolo anti-inflamatório"]},
      {"day":21,"title":"Chegada: Avaliar e projetar","tasks":["Fazer o check-in final comparando com o dia 1","Registrar as principais mudanças percebidas no corpo, energia e humor","Conversar com a nutricionista sobre o próximo passo do protocolo","Comemorar! 21 dias é o tempo que o cérebro precisa para criar um novo hábito automático"]}
    ]'::jsonb,
    true, true),

  -- Protocolo 2: Pré-Festas 14 Dias
  (p_tenant_id,
    'Protocolo Pré-Festas 14 Dias',
    'Festas são para serem vividas com alegria — não com culpa nem com aquele desconforto de se sentir pesada em uma roupa que não fecha. Este protocolo não é uma dieta punitiva: é uma estratégia inteligente para preparar seu corpo para celebrar com mais leveza, menos retenção de líquidos e mais energia. Vamos trabalhar com o que seu corpo precisa, não contra ele. 14 dias de foco, e você chega nas festas sentindo-se bem na própria pele.',
    '✨', 'seasonal', 14,
    '[
      {"day":1,"title":"Reset: Limpar o terreno","tasks":["Reduzir drasticamente o sódio: evitar embutidos, salgadinhos, temperos prontos e molhos industrializados","Priorizar potássio natural: banana, batata-doce, abacate e folhas verdes ajudam a eliminar o excesso de sódio","Beber 2,5L de água com rodelas de limão ou pepino","Anotar o peso e o nível de inchaço (1-5) para comparar no final"]},
      {"day":3,"title":"Hidratação e Drenagem","tasks":["Incluir 2 xícaras de chá drenante ao dia (cavalinha, hibisco ou gengibre com limão)","Fazer caminhada de 30 minutos ou 20 minutos de Jump/Dance","Reduzir glúten por mais 5 dias (causa retenção em muitas mulheres)","Jantar até às 20h para dar descanso digestivo de pelo menos 12h"]},
      {"day":7,"title":"Metade do Protocolo: Manutenção e Ajuste","tasks":["Check-in semanal obrigatório — sua nutricionista analisa seus dados e ajusta se necessário","Incluir shot matinal anti-retenção: água de coco + limão + pitada de cúrcuma","Priorizar proteínas magras: frango, peixe, ovos e leguminosas","Dormir 7-8h: o cortisol elevado por privação de sono aumenta retenção de líquidos"]},
      {"day":10,"title":"Reta Final: Ajuste Fino","tasks":["Eliminar totalmente álcool, refrigerantes e bebidas com cafeína excessiva","Priorizar cores no prato: roxo (beterraba, repolho roxo), laranja (cenoura, mamão), verde (todas as folhas)","Aumentar colágeno natural: caldos de osso, gelatina sem açúcar, claras de ovo","Preparar mentalmente: um único evento não desfaz 10 dias de dedicação"]},
      {"day":14,"title":"Você Chegou! Aproveite com Consciência","tasks":["Pesar e medir inchaço (1-5) — compare com o dia 1 e celebre a diferença","Dica de festa: coma uma proteína + gordura boa antes de sair (evita excessos por fome)","Na festa, priorize proteínas, saladas e frutas antes de partir para o restante","Registrar no app como se sentiu no evento — essa consciência é o maior resultado do protocolo"]}
    ]'::jsonb,
    true, true),

  -- Meta 1: Ritual do Sono
  (p_tenant_id,
    'Meta: Ritual do Sono',
    'O sono de qualidade é o suplemento mais barato e poderoso que existe. Durante o sono profundo, seu corpo produz GH (hormônio do crescimento), regula o cortisol, repara tecidos e consolida a memória dos novos hábitos que você está construindo. Apagar as telas 1 hora antes de dormir não é sobre ser desapegada do celular — é sobre dar ao seu cérebro o sinal hormonal que ele precisa para entrar no modo de recuperação.',
    '🌙', 'custom', 7,
    '[
      {"day":1,"title":"Preparar o ambiente do sono","tasks":["Definir um horário fixo para dormir (meta: 22h30 ou 23h)","Ativar o modo noturno/filtro de luz azul em todos os dispositivos a partir das 21h","Deixar o quarto fresco: temperatura ideal é entre 18-21°C","Anotar 3 pensamentos positivos do dia antes de deitar (reset mental)"]},
      {"day":2,"title":"Telas fora, rotina dentro","tasks":["Desligar o celular ou colocar fora do quarto 1h antes de dormir","Substituir a tela por: leitura de papel, meditação de 5 min, alongamento leve ou banho morno","Evitar cafeína depois das 15h (café, chá preto/verde, refrigerante)","Notar a qualidade do sono ao acordar: mais descansada que ontem?"]},
      {"day":7,"title":"Avaliar a semana de sono","tasks":["Comparar a energia ao longo da semana com a semana anterior","Manter o horário fixo de dormir mesmo nos finais de semana (o jet lag social sabota os hábitos)","Registrar no check-in: como foi o sono essa semana?","Celebrar! 7 dias de ritual de sono já muda o padrão de cortisol do corpo"]}
    ]'::jsonb,
    true, true),

  -- Meta 2: Hidratação Estratégica
  (p_tenant_id,
    'Meta: Hidratação Estratégica 2L',
    'A maioria das mulheres vive em desidratação crônica leve — e chama isso de cansaço, dor de cabeça, intestino preso e fome excessiva. Água não é só hidratação: ela é o meio de transporte de todos os nutrientes, o solvente do metabolismo e o principal mecanismo de eliminação de toxinas. 2L por dia parece básico, mas quando feito de forma estruturada — horários estratégicos, temperatura certa, adições funcionais — o resultado é visível em 5 dias.',
    '💧', 'custom', 7,
    '[
      {"day":1,"title":"Mapear o consumo atual","tasks":["Anotar quanto de água você bebeu hoje (seja honesta)","Comprar ou separar uma garrafinha de 500ml para carregar junto","Primeira estratégia: beber 1 copo de água morna ao acordar, antes do café","Meta do dia: 1,5L de água pura (já é um avanço para quem bebe pouco)"]},
      {"day":3,"title":"Criar rituais de hidratação","tasks":["Beber 500ml antes das 10h (1 copo ao acordar + 1 antes do café + 1 no meio da manhã)","500ml no almoço: 1 copo antes de comer e 1 depois","500ml no período da tarde: antes do lanche e antes do jantar","Últimos 500ml até às 19h para não atrapalhar o sono"]},
      {"day":7,"title":"Avaliar o impacto","tasks":["Checar a cor da urina: amarelo claro = hidratada, escuro = beba mais água","Notar diferenças: pele, disposição, intestino, fome","Registrar no check-in semanal a evolução da hidratação","Próximo nível: turbinar 1 copo com rodela de pepino + limão + hortelã (drena e refina o paladar)"]}
    ]'::jsonb,
    true, true),

  -- Meta 3: Movimento Consciente
  (p_tenant_id,
    'Meta: Movimento Consciente Diário',
    'Você não precisa malhar 1h por dia para ter resultados. Mas você precisa mover-se todos os dias. A ciência é clara: mulheres sedentárias têm até 40% mais inflamação sistêmica do que as que se movem 30 minutos por dia, independentemente da intensidade. Movimento consciente não é academia — é escolher a escada, caminhar no almoço, dançar em casa, fazer 15 minutos de alongamento ao acordar. O corpo foi feito para mover-se, e quando ele se move, ele muda.',
    '🚶‍♀️', 'custom', 7,
    '[
      {"day":1,"title":"Definir o movimento que cabe na sua vida","tasks":["Escolher 1 tipo de movimento que você consegue fazer HOJE (caminhada, alongamento, dança, bike)","Meta mínima: 20 minutos de movimento contínuo, em qualquer intensidade","Registrar no app: tipo de atividade, duração, como se sentiu (1-5)","Dica: o melhor exercício é o que você faz. Perfeito não existe — constante sim"]},
      {"day":4,"title":"Criar o hábito de mover","tasks":["Fazer o movimento no mesmo horário nos últimos 4 dias (manhã, almoço ou tarde)","Aumentar para 25-30 minutos se já estiver confortável","Incluir 5 minutos de alongamento depois do movimento (reduz inflamação pós-exercício)","Beber água antes e depois — músculos hidratados trabalham melhor"]},
      {"day":7,"title":"Celebrar a semana ativa","tasks":["Contar quantos dias da semana você se moveu — cada dia conta!","Comparar energia, humor e disposição com o início da semana","Registrar no check-in: atividade física essa semana","Desafio para a próxima semana: adicionar mais 5 minutos ou um novo tipo de movimento"]}
    ]'::jsonb,
    true, true),

  -- Meta 4: Janela Alimentar
  (p_tenant_id,
    'Meta: Janela Alimentar Inteligente (12h)',
    'Comer dentro de uma janela de 12h dá ao seu sistema digestivo o descanso que ele nunca recebe. Durante as horas de jejum, o corpo limpa células danificadas (autofagia), equilibra a insulina, reduz a inflamação e melhora a sensibilidade hormonal. Não é dieta — é ritmo biológico. E o melhor: você pode escolher a janela que cabe na sua vida, desde que respeite as 12h de pausa.',
    '⏰', 'custom', 7,
    '[
      {"day":1,"title":"Mapear a janela atual","tasks":["Anotar o horário da primeira e da última refeição de hoje","Calcular quantas horas de janela alimentar você tem atualmente","Definir a janela ideal para você (ex: 7h às 19h, ou 8h às 20h)","Regra de ouro: dentro da janela, coma bem. Fora dela, apenas água, chás sem açúcar e café puro"]},
      {"day":3,"title":"Treinar o fechamento da janela","tasks":["Jantar até 1h antes do horário de fechamento definido","Se sentir fome fora da janela: beber 1 copo de água ou chá de camomila","Não pular refeições dentro da janela — o objetivo é concentrar, não reduzir","Registrar como dormiu após comer mais cedo"]},
      {"day":7,"title":"Avaliar os 7 dias de janela","tasks":["Checar: conseguiu manter a janela de 12h na maioria dos dias?","Notar diferenças na qualidade do sono, disposição e digestão","Conversar com a nutricionista se sentir tonturas ou muita fome: a janela pode precisar de ajuste","Celebrar! Esse hábito, mantido por 30 dias, já tem impacto mensurável na insulina e no peso"]}
    ]'::jsonb,
    true, true),

  -- Meta 5: Diário de Vitórias
  (p_tenant_id,
    'Meta: Diário de Vitórias',
    'O cérebro aprende o que você repete. Quando você termina o dia registrando as vitórias — por menores que sejam — você treina o sistema de recompensa para buscar mais comportamentos positivos no dia seguinte. Isso não é autoajuda: é neurociência aplicada à mudança de comportamento alimentar. Pacientes que registram suas conquistas diárias têm 3x mais chances de manter novos hábitos depois de 90 dias.',
    '📓', 'custom', 7,
    '[
      {"day":1,"title":"Começar o diário de vitórias","tasks":["Antes de dormir, escrever 3 vitórias do dia (pode ser pequena: tomei água, não comi aquele biscoito, dormi bem)","Escrever 1 intenção para amanhã (ex: tomar o shot matinal, caminhar 20 min, jantar até às 20h)","Não julgue as vitórias — uma vitória é qualquer coisa que você fez diferente do padrão antigo","Dica: deixe o app na tela inicial do celular para não esquecer"]},
      {"day":4,"title":"Aprofundar o ritual","tasks":["Além das 3 vitórias, escrever 1 aprendizado do dia (o que funcionou OU o que não funcionou sem julgamento)","Notar padrões: em quais dias é mais fácil manter os hábitos? Em quais cai mais?","Compartilhar 1 vitória no feed da comunidade do app (conexão social reforça o hábito)","Registrar a emoção dominante do dia (1 palavra: calma, ansiosa, motivada, cansada...)"]},
      {"day":7,"title":"Revisão da semana","tasks":["Reler os registros dos últimos 7 dias (evolução visível!)","Identificar: qual foi a maior vitória da semana? Celebre com algo que não envolva comida","Registrar no check-in semanal: Diário de Vitórias — conseguiu fazer essa semana?","Próxima semana: adicionar a intenção da manhã também (30 segundos ao acordar para relembrar o objetivo)"]}
    ]'::jsonb,
    true, true);

  GET DIAGNOSTICS v_p_count = ROW_COUNT;

  -- ── DESAFIOS (2) ──────────────────────────────────────────
  INSERT INTO challenges (tenant_id, title, description, emoji, duration_days, is_active, prize_pool_coins, max_participants, rewards_json)
  VALUES

  (p_tenant_id,
    'Desafio Desincha 7 Dias',
    E'Em 7 dias você pode sentir uma diferença real no inchaço, na leveza e na disposição — desde que siga as 3 regras com consistência. Esse desafio foi criado para dar uma vitória rápida, visível e motivadora.\n\n🔴 Regra 1 — Beba 2L de água ao dia e elimine refrigerantes, sucos industrializados e bebidas alcoólicas pelos 7 dias.\n\n🟡 Regra 2 — Reduza o sódio: sem embutidos, sem temperos prontos, sem salgadinhos. Use sal rosa e ervas frescas para temperar.\n\n🟢 Regra 3 — Registre seu progresso diário no app: nível de inchaço (1-5), como se sentiu ao acordar, e 1 vitória do dia. Quem registrar os 7 dias ganha os NutriCoins do prêmio.',
    '💧', 7, true, 500, 50,
    '[
      {"type":"coins","value":500,"description":"NutriCoins para quem completar os 7 dias"},
      {"type":"badge","value":"desincha_7d","description":"Badge exclusivo Guerreira Desinchada"},
      {"type":"xp","value":100,"description":"100 XP bônus de conclusão"}
    ]'::jsonb),

  (p_tenant_id,
    'Desafio Energia Total 15 Dias',
    E'Cansaço que não passa, vontade de café o tempo todo, ânimo lá embaixo depois das 15h — esses são sintomas de disfunção energética, não de preguiça. Este desafio de 15 dias foi construído com foco em nutrição mitocondrial: os alimentos e hábitos que literalmente alimentam as células produtoras de energia do seu corpo.\n\n⚡ Compromisso 1 — Café da manhã proteico todo dia: mínimo 20g de proteína na primeira refeição (ovos, queijo branco, iogurte grego, frango).\n\n🌿 Compromisso 2 — Um alimento novo da lista energizante por dia: sardinha, brócolis, espinafre, beterraba, semente de abóbora, nozes, cúrcuma, abacate, frutas vermelhas.\n\n📱 Compromisso 3 — Registrar no app: nível de energia ao acordar (1-5) e às 16h (1-5). Em 15 dias, você vai ver a curva de energia mudar nos seus próprios dados.',
    '⚡', 15, true, 1200, 100,
    '[
      {"type":"coins","value":1200,"description":"NutriCoins para quem completar os 15 dias"},
      {"type":"badge","value":"energia_total","description":"Badge Mulher de Alta Performance"},
      {"type":"xp","value":200,"description":"200 XP bônus de conclusão"},
      {"type":"bonus","value":"mentoria_express","description":"Sorteio de 1 mentoria express entre as top 5 do ranking"}
    ]'::jsonb);

  GET DIAGNOSTICS v_c_count = ROW_COUNT;

  -- ── TEMPLATES DE NOTIFICAÇÃO / UPSELL (3) ─────────────────
  INSERT INTO notification_templates (tenant_id, title, message, tip_content, category, trigger_event, target_plan, cta_text, cta_url, is_template)
  VALUES

  (p_tenant_id,
    'Dica de Imunidade + Convite para Evolução',
    'Oi [NOME DA PACIENTE]! 💚 Sabia que o intestino controla 70% do seu sistema imune? Quando sua flora intestinal está equilibrada, você fica menos doente, tem menos inchaço e até o humor melhora. A estratégia mais simples: 1 colher de iogurte natural integral por dia, todo dia. Simples assim.',
    'Dica científica: o eixo intestino-cérebro é bidirecional — o que você come afeta como você se sente emocionalmente. Cuidar do intestino é cuidar da saúde mental também.',
    'upsell', 'after_checkin', ARRAY['community'],
    'Quero o Plano Completo',
    '[LINK DE CHECKOUT DO PLANO [NOME DO PLANO INTERMEDIÁRIO]]',
    true),

  (p_tenant_id,
    'Você está mandando bem! Próximo nível disponível',
    'Oi [NOME DA PACIENTE]! 🏆 Você chegou em [NÚMERO] dias de streak — isso é excepcional. A maioria das pessoas desiste antes da segunda semana, e você está aqui, se superando todo dia. Para quem está nesse nível de comprometimento, eu preparei algo especial: o [NOME DO PLANO PREMIUM] inclui análise semanal dos seus dados, plano alimentar personalizado mensal e acesso à nossa mentoria em grupo ao vivo. Por apenas [VALOR DO PLANO] por mês — menos do que um jantar fora.',
    'Dado motivacional: pacientes com acompanhamento estruturado têm 340% mais chance de manter os resultados depois de 6 meses em comparação com quem faz dieta sozinha.',
    'upsell', 'streak_7d', ARRAY['community', 'tech_diet'],
    'Quero Evoluir para o [NOME DO PLANO PREMIUM]',
    '[LINK DE CHECKOUT DO PLANO PREMIUM]',
    true),

  (p_tenant_id,
    'Sentimos sua falta — e temos algo para te trazer de volta',
    'Oi [NOME DA PACIENTE]! Notei que você ficou alguns dias sem registrar no app, e eu entendo — a vida acontece. Sem julgamento, sem cobrança. Mas também sei que quando você some, geralmente é porque a rotina pesou ou a motivação baixou — e é exatamente para esses momentos que o [NOME DO PROGRAMA DE MENTORIA] existe. É um grupo pequeno, online, onde discutimos estratégias para os dias difíceis, não apenas para os dias bons. Na próxima semana começa uma nova turma. Quer entrar?',
    'A recaída é parte do processo — quem nunca sai do caminho não aprende a voltar. O objetivo não é perfeição, é retomada rápida. Cada dia que você volta conta como uma vitória.',
    'upsell', 'inactive_3d', ARRAY['community'],
    'Quero Entrar na Mentoria',
    '[LINK DE CHECKOUT DA MENTORIA [NOME DA MENTORIA]]',
    true);

  GET DIAGNOSTICS v_n_count = ROW_COUNT;

  -- Meal templates (função auxiliar separada)
  PERFORM seed_meal_templates(p_tenant_id);

  -- Seed de recompensas (se ainda não foi chamado)
  PERFORM seed_reward_items(p_tenant_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'recipes', v_r_count,
    'protocols_and_goals', v_p_count,
    'challenges', v_c_count,
    'notification_templates', v_n_count,
    'meal_templates', 5
  );

END;
$$ LANGUAGE plpgsql;
