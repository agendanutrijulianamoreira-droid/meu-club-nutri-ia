export interface AnnualTemplateItem {
    month_index: number;
    title: string;
    type: 'protocolo' | 'desafio' | 'receitas' | 'educativo' | 'evento' | 'conscientizacao' | 'guia';
    description: string;
    habit_focus: string;
    marketing_hook: string;
    action_item: string;
    category?: string;
    duration_days: number;
    emoji?: string;
}

export const ANNUAL_TEMPLATES: Record<string, AnnualTemplateItem[]> = {
    emagrecimento: [
        {
            month_index: 0,
            title: "Detox & Reset Pós-Festas",
            type: "desafio",
            description: "Focado em desinchar e retomar a rotina após Natal e Ano Novo. Cardápio limpo e foco em hidratação.",
            habit_focus: "Beber 3L de água por dia",
            marketing_hook: "Exagerou nas festas? Vamos limpar o organismo em 7 dias.",
            action_item: "Lançar Grupo de Desafio no WhatsApp",
            category: "detox",
            duration_days: 7,
            emoji: "🥗"
        },
        {
            month_index: 1,
            title: "Protocolo Folia: Energia & Hidratação",
            type: "protocolo",
            description: "Estratégia para quem vai curtir o Carnaval. Foco em alimentos energéticos e shots para imunidade.",
            habit_focus: "Comer 1 fruta antes de sair",
            marketing_hook: "Curta o Carnaval sem destruir seus resultados.",
            action_item: "Vender E-book de Shots e Sucos",
            category: "detox",
            duration_days: 15,
            emoji: "🎭"
        },
        {
            month_index: 2,
            title: "Desafio 21 Dias: Rotina de Ferro",
            type: "desafio",
            description: "Março é o 'ano começou de verdade'. Foco em constância e organização de marmitas.",
            habit_focus: "Planejar refeições no domingo",
            marketing_hook: "Chega de desculpas. 21 dias para mudar seus hábitos.",
            action_item: "Abrir vagas para Acompanhamento Trimestral",
            category: "lowcarb",
            duration_days: 21,
            emoji: "📅"
        },
        {
            month_index: 3,
            title: "Páscoa Sem Culpa",
            type: "educativo",
            description: "Educação nutricional sobre chocolate e açúcar. Como comer o ovo de páscoa sem engordar.",
            habit_focus: "Comer doce apenas após o almoço",
            marketing_hook: "Você não precisa cortar o chocolate. Aprenda a comer.",
            action_item: "Live no Instagram + Venda de Consulta",
            category: "maintenance",
            duration_days: 7,
            emoji: "🍫"
        },
        {
            month_index: 4,
            title: "Semana da Autoestima (Mês das Mães)",
            type: "evento",
            description: "Foco em saúde da mulher, pele e intestino.",
            habit_focus: "Incluir fibras no café da manhã",
            marketing_hook: "Cuide de quem cuida de todo mundo.",
            action_item: "Promoção: Traga uma amiga/mãe com 50% off",
            category: "custom",
            duration_days: 7,
            emoji: "👑"
        },
        {
            month_index: 5,
            title: "Festival de Caldos & Sopas Fit",
            type: "receitas",
            description: "Chegada do inverno/festas juninas. Substituições saudáveis para canjica e caldos.",
            habit_focus: "Jantar leve (Sopa/Caldo) 3x na semana",
            marketing_hook: "Esquente seu inverno sem ganhar peso.",
            action_item: "Vender Pack de Receitas de Inverno",
            category: "custom",
            duration_days: 30,
            emoji: "🍲"
        },
        {
            month_index: 6,
            title: "Manutenção de Férias",
            type: "protocolo",
            description: "Estratégias para quem viaja em Julho. Como fazer escolhas em restaurantes e hotéis.",
            habit_focus: "10.000 passos por dia",
            marketing_hook: "Vai viajar? Leve sua Nutri no bolso (App).",
            action_item: "Oferta Relâmpago: Consultoria Online Express",
            category: "maintenance",
            duration_days: 31,
            emoji: "✈️"
        },
        {
            month_index: 7,
            title: "Agosto Dourado: Saúde Intestinal",
            type: "educativo",
            description: "Foco em desinflamação e funcionamento do intestino.",
            habit_focus: "Consumir probióticos ou iogurte natural",
            marketing_hook: "Seu intestino controla seu humor e seu peso.",
            action_item: "Lançar Protocolo de Desinflamação",
            category: "detox",
            duration_days: 15,
            emoji: "🦠"
        },
        {
            month_index: 8,
            title: "Projeto Verão: A Largada",
            type: "desafio",
            description: "Início da preparação de 3-4 meses para o verão. Foco total em adesão e treino.",
            habit_focus: "Treino 4x na semana",
            marketing_hook: "O corpo do verão se constrói na primavera.",
            action_item: "Lançar 'Team Verão' (Grupo de Acompanhamento)",
            category: "lowcarb",
            duration_days: 30,
            emoji: "🌊"
        },
        {
            month_index: 9,
            title: "Outubro Rosa: Nutrição Preventiva",
            type: "conscientizacao",
            description: "Alimentos antioxidantes e preventivos. Foco em saúde celular.",
            habit_focus: "5 cores de vegetais no prato",
            marketing_hook: "Nutrição é prevenção. Cuide-se.",
            action_item: "Evento Presencial ou Online Gratuito",
            category: "custom",
            duration_days: 31,
            emoji: "🎀"
        },
        {
            month_index: 10,
            title: "Desafio 30 Dias: Seca Barriga",
            type: "desafio",
            description: "Intensivão pré-dezembro. Low carb estratégico.",
            habit_focus: "Zero açúcar refinado",
            marketing_hook: "Última chance de entrar naquele vestido no Natal.",
            action_item: "Black Friday: Planos Anuais com Desconto",
            category: "lowcarb",
            duration_days: 30,
            emoji: "🔥"
        },
        {
            month_index: 11,
            title: "Guia de Sobrevivência: Festas",
            type: "guia",
            description: "Estratégias de redução de danos para Ceias e Confraternizações.",
            habit_focus: "Intercalar álcool com água",
            marketing_hook: "Como comer de tudo na Ceia sem engordar.",
            action_item: "Presente de Natal: E-book Grátis para pacientes",
            category: "maintenance",
            duration_days: 31,
            emoji: "🎄"
        }
    ],
    hipertrofia: [
        {
            month_index: 0,
            title: "Performance de Verão",
            type: "protocolo",
            description: "Foco em definição muscular e manutenção da massa magra durante o calor intenso.",
            habit_focus: "Bater meta de proteína limpa",
            marketing_hook: "Mantenha seus ganhos mesmo no auge do verão.",
            action_item: "Lançar Protocolo de Cutting",
            category: "lowcarb",
            duration_days: 30,
            emoji: "💪"
        },
        {
            month_index: 5,
            title: "Bulking de Inverno",
            type: "protocolo",
            description: "Aproveite o frio para ganhar volume muscular.",
            habit_focus: "Superávit calórico controlado",
            marketing_hook: "O corpo do verão é construído no inverno.",
            action_item: "Guia de Hipertrofia no Inverno",
            category: "custom",
            duration_days: 60,
            emoji: "❄️"
        }
        // ... mais itens para hipertrofia poderiam ser adicionados
    ]
};
