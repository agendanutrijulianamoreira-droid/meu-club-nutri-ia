const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://antszuxeairmbctwuafo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFudHN6dXhlYWlybWJjdHd1YWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5ODg3NjMsImV4cCI6MjA3MjU2NDc2M30.mxBEw1lH_wMa0MS4yWl_au9LHAqBR0vhXwF6L2VJV4s';
const supabase = createClient(supabaseUrl, supabaseKey);

const items = [
    // RECIPES
    {
        title: 'Bowl de Abacate e Ovos Soft',
        description: 'Café da manhã denso em nutrientes para estabilidade glicêmica.',
        category: 'recipe',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "tags", content: ["Vegetariana", "Low Carb", "280 kcal"] },
            { type: "ingredients", content: "- 1/2 Abacate maduro\n- 2 Ovos caipiras\n- Sementes de abóbora\n- Azeite extra virgem\n- Sal rosa e pimenta" },
            { type: "instructions", content: "1. Cozinhe os ovos por 6 minutos.\n2. Amasse levemente o abacate no bowl.\n3. Coloque os ovos por cima e finalize com as sementes e azeite." }
        ]
    },
    {
        title: 'Salmão em Crosta de Ervas',
        description: 'Refeição rica em Ômega-3 para saúde cerebral.',
        category: 'recipe',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "tags", content: ["Zero Lactose", "Sem Glúten", "350 kcal"] },
            { type: "ingredients", content: "- 150g Filet de Salmão\n- Crosta: Salsinha, Alecrim e Farinha de Amêndoas\n- Aspargos grelhados" },
            { type: "instructions", content: "1. Tempere o salmão.\n2. Pressione a mistura de ervas no topo.\n3. Leve ao forno a 180°C por 12-15 minutos." }
        ]
    },
    {
        title: 'Mousse de Cacau 70% Bio-Ativo',
        description: 'Sobremesa estratégica para controle de compulsão.',
        category: 'recipe',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "tags", content: ["Zero Açúcar", "Vegano", "150 kcal"] },
            { type: "ingredients", content: "- 1 Abacate pequeno\n- 3 colheres de sopa de Cacau Puro\n- Eritritol ou Stevia\n- Extrato de Baunilha" },
            { type: "instructions", content: "1. Bata tudo no processador até ficar homogêneo.\n2. Deixe na geladeira por 1 hora antes de servir." }
        ]
    },
    {
        title: 'Espaguete de Abobrinha à Bolonhesa',
        description: 'Almoço leve com alta densidade proteica.',
        category: 'recipe',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "tags", content: ["Low Carb", "Sem Glúten", "310 kcal"] },
            { type: "ingredients", content: "- 2 Abobrinhas médias\n- 200g Carne moída magra\n- Molho de tomate artesanal\n- Manjericão fresco" },
            { type: "instructions", content: "1. Use um espiralizador para a abobrinha.\n2. Refogue a carne com o molho.\n3. Misture rapidamente a abobrinha no molho quente (não cozinhe demais)." }
        ]
    },
    {
        title: 'Frango ao Curry com Leite de Coco',
        description: 'Refeição anti-inflamatória e termogênica.',
        category: 'recipe',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "tags", content: ["Zero Lactose", "Paleo", "380 kcal"] },
            { type: "ingredients", content: "- 150g Peito de frango em cubos\n- Leite de coco caseiro\n- Curry em pó, Gengibre e Cúrcuma\n- Brócolis no vapor" },
            { type: "instructions", content: "1. Sele o frango no óleo de coco.\n2. Adicione os temperos e o leite de coco.\n3. Cozinhe em fogo baixo até o molho encorpar." }
        ]
    },
    // SHOTS
    {
        title: 'Shot Imunidade Inabalável',
        description: 'Protocolo matinal para despertar o sistema imune.',
        category: 'shot',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "ingredients", content: "- 30ml de Água morna\n- 1 Limão espremido\n- 15 gotas de Própolis Verde\n- 1 pitada de Cúrcuma e Pimenta Preta" }
        ]
    },
    {
        title: 'Shot Foco Cerebral (Nootrópico)',
        description: 'Para manhãs de alta demanda cognitiva.',
        category: 'shot',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "ingredients", content: "- 1 dose de Café concentrado frio\n- 1 colher de chá de MCT Oil\n- 1 pitada de Canela Ceilão" }
        ]
    },
    {
        title: 'Shot Detox Profundo',
        description: 'Auxilia a via de limpeza hepática.',
        category: 'shot',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "ingredients", content: "- 50ml de Suco de Couve prensado\n- 1/2 colher de chá de Espirulina\n- Gengibre ralado" }
        ]
    },
    {
        title: 'Shot Termo-Gênico Max',
        description: 'Aceleração metabólica pré-treino.',
        category: 'shot',
        status: 'published',
        duration_days: 0,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "ingredients", content: "- Vinagre de Maçã orgânico (1 colher de sopa)\n- Canela e Canela em pó\n- Água com gás" }
        ]
    },
    // PROTOCOLS
    {
        title: 'Protocolo Desinflamação Express (7 Dias)',
        description: 'Limpeza profunda de paladar e redução de retenção.',
        category: 'protocol',
        status: 'published',
        duration_days: 7,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "phase", content: "Fase 1: Eliminação de gatilhos inflamatórios (Glúten, Açúcar, Laticínios)" }
        ]
    },
    {
        title: 'Protocolo Jejum Metabólico Consciente',
        description: 'Guia para introdução segura ao jejum intermitente.',
        category: 'protocol',
        status: 'published',
        duration_days: 14,
        is_template: true,
        is_active: true,
        content_json: [
            { type: "phase", content: "Semana 1: Janela 12/12. Semana 2: Janela 14/10." }
        ]
    }
];

async function seed() {
    console.log('Iniciando carga de dados no Reino...');
    const { data, error } = await supabase.from('protocols').insert(items);
    if (error) {
        console.error('Erro ao popular biblioteca:', error);
    } else {
        console.log('Sucesso! Biblioteca populada com ativos de elite.');
    }
}

seed();
