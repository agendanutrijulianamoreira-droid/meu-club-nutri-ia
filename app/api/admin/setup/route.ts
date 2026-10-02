import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

interface SetupPayload {
    name: string
    specialty: string
    methodName: string
    niche: string
    nicheFocus?: string
    instagram?: string
    methodDescription?: string
    offerName?: string
    offerPrice?: string
    offerDuration?: string
    goals?: string
    archetypeAnswers?: Record<string, string>
    archetype: string
    tone: string
}

type GeneratedBlueprint = {
    suggestedArchetype: string
    methodDescription: string
    phases: Array<{ name: string; description: string; goals: string[] }>
    months: Array<{
        month: number
        title: string
        objective: string
        challengeTitle: string
        protocolTitle: string
        posts: Array<{ title: string; body: string }>
    }>
}

function fallbackBlueprint(data: SetupPayload): GeneratedBlueprint {
    const focus = data.nicheFocus || data.niche || 'transformação alimentar'
    const phaseNames = ['Consciência e base', 'Rotina e consistência', 'Autonomia e evolução']
    return {
        suggestedArchetype: data.archetype,
        methodDescription: data.methodDescription || `Uma jornada de ${focus} com educação, prática e acompanhamento próximo.`,
        phases: phaseNames.map((name, index) => ({
            name,
            description: `Etapa ${index + 1} da jornada para ${focus}.`,
            goals: (data.goals || 'consistência, energia e autonomia').split(',').map(goal => goal.trim()).filter(Boolean).slice(0, 4),
        })),
        months: Array.from({ length: 6 }, (_, index) => ({
            month: index + 1,
            title: `Mês ${index + 1} · ${focus}`,
            objective: `Construir um avanço sustentável em ${focus}.`,
            challengeTitle: `Desafio ${index + 1}: Pequenas vitórias`,
            protocolTitle: `Protocolo ${index + 1}: Jornada ${focus}`,
            posts: [
                { title: 'Boas-vindas do mês', body: 'Vamos começar com uma ação simples e possível para esta etapa da sua jornada.' },
                { title: 'Check-in da semana', body: 'Como foi colocar o método em prática? Compartilhe uma vitória e uma dificuldade.' },
            ],
        })),
    }
}

async function createBlueprint(data: SetupPayload): Promise<GeneratedBlueprint> {
    if (!process.env.GEMINI_API_KEY) return fallbackBlueprint(data)
    try {
        const generated = await callClaudeJSON<GeneratedBlueprint>({
            system: 'Você é uma estrategista de clubes de nutrição. Gere conteúdo seguro, educativo e não-diagnóstico. Nunca publique nada: tudo deve ser salvo como rascunho para revisão profissional.',
            maxTokens: 7000,
            messages: [{
                role: 'user',
                content: JSON.stringify({
                    task: 'Criar a fundação de um clube de nutrição para seis meses.',
                    professional: data.name,
                    specialty: data.specialty,
                    niche: data.niche,
                    nicheFocus: data.nicheFocus,
                    methodName: data.methodName,
                    methodDescription: data.methodDescription,
                    offer: { name: data.offerName, price: data.offerPrice, durationMonths: data.offerDuration || 6 },
                    goals: data.goals,
                    archetypeAnswers: data.archetypeAnswers,
                    requestedShape: {
                        suggestedArchetype: 'sage|hero|ruler|lover',
                        methodDescription: 'string',
                        phases: '[3 items with name, description and goals array]',
                        months: '[exactly 6 items; each with month, title, objective, challengeTitle, protocolTitle and 2-4 posts with title/body]',
                    },
                }),
            }],
        })
        const valid = generated
            && Array.isArray(generated.phases)
            && generated.phases.length >= 3
            && Array.isArray(generated.months)
            && generated.months.length >= 6
            && generated.months.slice(0, 6).every(month => Array.isArray(month.posts) && month.posts.length > 0)
        return valid ? generated : fallbackBlueprint(data)
    } catch (error) {
        console.error('[Setup] blueprint generation failed; using safe fallback', error)
        return fallbackBlueprint(data)
    }
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
    const blueprint = await createBlueprint(body)
    const newSettings = {
        ...currentSettings,
        ai: { tone, emojiLevel: 2 },
        wizard: {
            archetype,
            niche,
            nicheFocus: body.nicheFocus || niche,
            specialty,
            instagram: body.instagram || null,
            archetypeAnswers: body.archetypeAnswers || {},
            offer: { name: body.offerName || null, price: body.offerPrice || null, durationMonths: body.offerDuration || '6' },
        },
        clubFoundation: blueprint,
    }

    const { error: updateError } = await supabase
        .from('tenants')
        .update({
            method_name: methodName,
            gpt_system_prompt: buildSystemPrompt({ ...body, niche: body.nicheFocus || niche }),
            club_tone: tone,
            clinic_instagram: body.instagram || null,
            club_setup_done: true,
            settings: newSettings,
        })
        .eq('id', tenant.id)

    if (updateError) {
        console.error('[Setup] tenant update error:', updateError)
        return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })
    }

    // Persist the method and phases in the relational clinical-method model.
    const { data: method, error: methodError } = await supabase
        .from('methods')
        .insert({
            tenant_id: tenant.id,
            name: methodName,
            description: blueprint.methodDescription,
        })
        .select('id')
        .single()

    if (methodError || !method) {
        console.error('[Setup] method insert error:', methodError)
        return NextResponse.json({ error: 'Não foi possível criar o método do clube' }, { status: 500 })
    }

    const phases = blueprint.phases.slice(0, 6).map((phase, index) => ({
        method_id: method.id,
        tenant_id: tenant.id,
        name: phase.name,
        description: phase.description,
        order_index: index,
    }))
    const { error: phasesError } = await supabase.from('method_phases').insert(phases)
    if (phasesError) {
        console.error('[Setup] method phases insert error:', phasesError)
        return NextResponse.json({ error: 'Não foi possível criar as fases do método' }, { status: 500 })
    }

    const monthPlans = blueprint.months.slice(0, 6)
    const draftRows = monthPlans.flatMap(month => [
        {
            tenant_id: tenant.id,
            kind: 'challenge',
            month_index: month.month,
            title: month.challengeTitle,
            body: month.objective,
            metadata: { source: 'club_foundation', objective: month.objective },
            created_by: user.id,
        },
        {
            tenant_id: tenant.id,
            kind: 'protocol',
            month_index: month.month,
            title: month.protocolTitle,
            body: month.objective,
            metadata: { source: 'club_foundation', status: 'draft' },
            created_by: user.id,
        },
        ...month.posts.map((post, index) => ({
            tenant_id: tenant.id,
            kind: 'post',
            month_index: month.month,
            week_index: Math.min(index + 1, 5),
            title: post.title,
            body: post.body,
            metadata: { source: 'club_foundation' },
            created_by: user.id,
        })),
    ])
    const { error: draftsError } = await supabase.from('club_content_drafts').insert(draftRows)
    if (draftsError) {
        console.error('[Setup] drafts insert error:', draftsError)
        return NextResponse.json({ error: 'Método criado, mas não foi possível salvar os rascunhos. Aplique a migration do Clube.' }, { status: 500 })
    }

    const protocolRows = monthPlans.map((month, index) => ({
        tenant_id: tenant.id,
        title: month.protocolTitle,
        description: month.objective,
        category: index % 2 === 0 ? 'custom' : 'challenge',
        duration_days: 30,
        is_active: index === 0,
        content: index === 0 ? SAMPLE_PROTOCOL_CONTENT : [],
        total_points_available: index === 0 ? 160 : 0,
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
