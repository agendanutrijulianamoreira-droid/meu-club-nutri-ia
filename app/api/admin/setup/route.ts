import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface SetupPayload {
    name: string
    specialty: string
    methodName: string
    niche: string
    archetype: string
    tone: string
}

const TEMPLATES = {
    emagrecimento: {
        protocols: [
            { title: 'Detox de Janeiro: Reinício Real', description: 'Foco em desinflamação e limpeza hepática pós-festas.', category: 'detox', month: 0 },
            { title: 'Desafio 15 Dias: Seca Barriga', description: 'Protocolo intensivo para reduzir medidas rapidamente.', category: 'challenge', month: 1 },
            { title: 'Páscoa Sem Culpa: Estratégia Doce', description: 'Como aproveitar sem perder os resultados conquistados.', category: 'seasonal', month: 2 },
            { title: 'Abril: Modulação Intestinal', description: 'Foco total na saúde do intestino e absorção de nutrientes.', category: 'custom', month: 3 },
            { title: 'Maio: Equilíbrio Hormonal', description: 'Estratégias para controle de cortisol e insulina.', category: 'custom', month: 4 },
            { title: 'Junho: Foco Termogênico', description: 'Acelerando o metabolismo no inverno.', category: 'lowcarb', month: 5 },
            { title: 'Julho: Detox de Inverno', description: 'Sopas e caldos nutritivos para manter o peso.', category: 'detox', month: 6 },
            { title: 'Agosto: Definição Muscular', description: 'Aumento de aporte proteico e tônus muscular.', category: 'custom', month: 7 },
            { title: 'Setembro: Renovação Metabólica', description: 'Quebra de platô com janelas de jejum estratégico.', category: 'custom', month: 8 },
            { title: 'Outubro: Projeto Verão On', description: 'Intensificação de queima de gordura.', category: 'challenge', month: 9 },
            { title: 'Novembro: Lapidação Final', description: 'Foco em retenção hídrica e definição.', category: 'maintenance', month: 10 },
            { title: 'Dezembro: Estratégia de Festas', description: 'Guia de sobrevivência para o Natal e Ano Novo.', category: 'seasonal', month: 11 },
        ],
    },
    hipertrofia: {
        protocols: [
            { title: 'Janeiro: Superávit Controlado', description: 'Início do ganho de massa com baixo acúmulo de gordura.', category: 'custom', month: 0 },
            { title: 'Fevereiro: Protocolo Creatina', description: 'Saturação e ganho de força.', category: 'challenge', month: 1 },
            { title: 'Março: Hipertrofia 360', description: 'Foco em volume de treino e densidade calórica.', category: 'custom', month: 2 },
            { title: 'Abril: Saúde Mitocondrial', description: 'Otimizando a energia celular para treinos intensos.', category: 'custom', month: 3 },
            { title: 'Maio: Peak Performance', description: 'Ajuste fino de macronutrientes.', category: 'maintenance', month: 4 },
        ],
    },
}

const SAMPLE_PROTOCOL_CONTENT = [
    {
        day: 1,
        title: 'Dia 1: Reinício Metabólico',
        tasks: [
            { time: '07:00', type: 'shot', title: 'Shot Matinal Anti-inflamatório', description: 'Limão + cúrcuma + pimenta-do-reino. Tomar em jejum.', points: 20 },
            { time: '08:00', type: 'meal', title: 'Desjejum Proteico', description: 'Ovos mexidos com espinafre e abacate.', points: 30 },
            { time: '12:00', type: 'meal', title: 'Almoço Funcional', description: 'Proteína magra com legumes no vapor e azeite extravirgem.', points: 30 },
            { time: '19:00', type: 'content', title: 'Reflexão Noturna', description: 'Registre sua vitória do dia.', points: 10 },
        ],
    },
    {
        day: 2,
        title: 'Dia 2: Hidratação e Movimento',
        tasks: [
            { time: '06:30', type: 'shot', title: 'Shot de Aloe Vera', description: 'Babosa + hortelã para o intestino.', points: 20 },
            { time: '09:00', type: 'meal', title: 'Café da Manhã Fibras', description: 'Mingau de aveia com frutas vermelhas e chia.', points: 25 },
            { time: '13:00', type: 'meal', title: 'Almoço Anti-inflamatório', description: 'Salmão grelhado com salada colorida.', points: 30 },
            { time: '20:00', type: 'content', title: 'Checkin de Hidratação', description: 'Confirme que bebeu pelo menos 2L de água hoje.', points: 15 },
        ],
    },
]

function buildSystemPrompt(data: SetupPayload): string {
    const toneMap: Record<string, string> = {
        acolhedora: 'acolhedora, empática e gentil',
        general: 'motivadora, energética e inspiradora',
        cientifica: 'técnica, baseada em evidências e precisa',
    }
    const archetypeMap: Record<string, string> = {
        sage: 'sábia e instrutiva',
        hero: 'corajosa e desafiadora',
        ruler: 'assertiva e soberana',
        lover: 'calorosa e afetiva',
    }

    return `Você é a nutricionista virtual especializada do ${data.name}, profissional de ${data.specialty}. Seu método é o "${data.methodName}" — um protocolo de ${data.niche === 'hipertrofia' ? 'hipertrofia e performance' : 'emagrecimento funcional'} para mulheres que querem resultados reais.

Seu tom de comunicação é ${toneMap[data.tone] || 'equilibrado e profissional'}, com personalidade ${archetypeMap[data.archetype] || 'profissional e carinhosa'}.

IDENTIDADE: Você não é um chatbot genérico. Conhece cada paciente pelo nome, respeita seu histórico e celebra cada avanço. Opere sempre dentro do método "${data.methodName}".

ABORDAGEM NUTRICIONAL: Priorize alimentos reais e acessíveis no mercado brasileiro. Nunca recomende dietas extremamente restritivas. A saciedade e o prazer alimentar fazem parte do protocolo.

GAMIFICAÇÃO: Referencie naturalmente o sistema de XP, NutriCoins, streaks e desafios. Transforme hábitos em identidade.

SEGURANÇA: Nunca forneça diagnósticos médicos. Para sintomas graves, oriente consultar um médico.

COMUNICAÇÃO: Responda em português brasileiro natural. Seja direta e prática. Máximo 4 parágrafos curtos no chat.`
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: SetupPayload = await request.json()
    const { name, specialty, methodName, niche, archetype, tone } = body

    if (!name || !methodName) {
        return NextResponse.json({ error: 'name e methodName são obrigatórios' }, { status: 400 })
    }

    const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('id, settings')
        .eq('owner_id', user.id)
        .single()

    if (tenantErr || !tenant) {
        return NextResponse.json({ error: 'Tenant não encontrado. Crie sua clínica primeiro.' }, { status: 404 })
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {}
    const newSettings = {
        ...currentSettings,
        ai: { tone, emojiLevel: 2 },
        wizard: { archetype, niche, specialty },
    }

    const { error: updateError } = await supabase
        .from('tenants')
        .update({
            method_name: methodName,
            gpt_system_prompt: buildSystemPrompt(body),
            club_tone: tone,
            club_setup_done: true,
            settings: newSettings,
        })
        .eq('id', tenant.id)

    if (updateError) {
        console.error('[Setup] tenant update error:', updateError)
        return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })
    }

    const template = TEMPLATES[niche as keyof typeof TEMPLATES] || TEMPLATES.emagrecimento
    const currentMonth = new Date().getMonth()

    const protocolRows = template.protocols.map((p) => ({
        tenant_id: tenant.id,
        title: p.title,
        description: p.description,
        category: p.category as 'detox' | 'lowcarb' | 'maintenance' | 'challenge' | 'seasonal' | 'custom',
        duration_days: 7,
        is_active: p.month === currentMonth,
        content: p.month === currentMonth ? SAMPLE_PROTOCOL_CONTENT : [],
        total_points_available: p.month === currentMonth ? 160 : 0,
    }))

    const { error: protocolError } = await supabase
        .from('protocols')
        .insert(protocolRows)

    if (protocolError) {
        console.error('[Setup] protocol insert error:', protocolError)
        // Não falha o setup por causa de protocolos
    }

    return NextResponse.json({ success: true })
}
