import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { streamClaude } from '@/lib/services/anthropic'

export async function POST(request: NextRequest) {
    if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { message, history } = await request.json()

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        // 1. Load patient profile + active protocol
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, tenant_id, total_xp, current_streak, current_plan, primary_goal, initial_weight, current_weight')
            .eq('user_id', user.id)
            .single()

        // 2. Load active protocol assignment
        let activeProtocol = null
        let currentDay = 1
        if (profile?.tenant_id) {
            const { data: assignment } = await supabase
                .from('protocol_assignments')
                .select(`
                    started_at,
                    progress_percentage,
                    protocol:protocols(title, description, duration_days)
                `)
                .eq('patient_id', user.id)
                .eq('status', 'active')
                .single()

            if (assignment) {
                activeProtocol = assignment
                const startDate = new Date(assignment.started_at)
                const today = new Date()
                const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                currentDay = Math.max(1, diffDays + 1)
            }
        }

        // 3. Load tenant AI personality
        let tenantInfo: any = null
        if (profile?.tenant_id) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('brand_name, method_name, settings, gpt_system_prompt')
                .eq('id', profile.tenant_id)
                .single()
            tenantInfo = tenant
        }

        const tone = tenantInfo?.settings?.ai?.tone || 'acolhedora'
        const emojiLevel = tenantInfo?.settings?.ai?.emojiLevel ?? 2
        const brandName = tenantInfo?.brand_name || 'NutriClub'
        const methodName = tenantInfo?.method_name || 'Protocolo Nutri'
        const patientName = profile?.name?.split(' ')[0] || 'Rainha'

        // 4. Build system prompt with full context
        const toneInstructions: Record<string, string> = {
            acolhedora: 'Seja calorosa, empática e encorajadora. Use linguagem carinhosa. Chame de "querida" ou pelo nome.',
            motivadora: 'Seja energética, direta e motivadora. Use linguagem de empoderamento. Celebre cada conquista com entusiasmo.',
            tecnica: 'Seja clara, objetiva e embasada em ciência. Explique o porquê de cada recomendação. Evite excessos emocionais.',
        }

        const emojiInstructions = [
            'Não use emojis.',
            'Use emojis moderadamente (máximo 1 por mensagem).',
            'Use emojis com frequência para tornar a mensagem mais viva.',
            'Use muitos emojis para transmitir energia e entusiasmo.',
        ]

        const protocolContext = activeProtocol
            ? `A paciente está no Dia ${currentDay} do protocolo "${(activeProtocol.protocol as any)?.title}". Progresso geral: ${activeProtocol.progress_percentage || 0}%.`
            : 'A paciente ainda não tem um protocolo ativo.'

        const profileContext = profile
            ? `Nome: ${profile.name}. XP Total: ${profile.total_xp || 0}. Streak atual: ${profile.current_streak || 0} dias. Plano: ${profile.current_plan || 'community'}. ${profile.primary_goal ? `Objetivo principal: ${profile.primary_goal}.` : ''} ${profile.initial_weight && profile.current_weight ? `Peso inicial: ${profile.initial_weight}kg, Peso atual: ${profile.current_weight}kg.` : ''}`
            : ''

        const systemPrompt = `Você é a IA de saúde e nutrição do ${brandName}, operando sob o método "${methodName}".

PERSONALIDADE: ${toneInstructions[tone] || toneInstructions.acolhedora}
EMOJIS: ${emojiInstructions[emojiLevel] || emojiInstructions[1]}

CONTEXTO DA PACIENTE:
${profileContext}
${protocolContext}

REGRAS ABSOLUTAS:
- Sempre chame a paciente de "${patientName}" ou "Rainha", nunca de "você" de forma fria.
- Suas respostas devem ser concisas (máximo 4 parágrafos curtos) e práticas.
- Foque em nutrição, saúde, bem-estar, motivação e o protocolo ativo.
- Se perguntarem sobre algo fora da sua área (finanças, política, etc.), redirecione gentilmente para saúde.
- Nunca forneça diagnósticos médicos. Para sintomas graves, indique procurar um médico.
- Personalize sempre com base no contexto da paciente acima.
- Responda em português brasileiro, de forma natural e humana.
${tenantInfo?.gpt_system_prompt ? `\nINSTRUÇÕES ADICIONAIS DO MÉTODO:\n${tenantInfo.gpt_system_prompt}` : ''}`

        // 5. Convert history to Claude format
        const claudeMessages = (history || []).map((msg: { sender: string; content: string }) => ({
            role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content,
        }))
        claudeMessages.push({ role: 'user' as const, content: message })

        // 6. Stream the response
        const stream = streamClaude({
            system: systemPrompt,
            maxTokens: 600,
            messages: claudeMessages,
        })

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        })

    } catch (error: any) {
        console.error('[Chat API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal AI Error' }, { status: 500 })
    }
}
