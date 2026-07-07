import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { streamClaude } from '@/lib/services/anthropic'
import { getChatSystemPrompt } from '@/lib/ai-nutritionist-identity'
import { sanitizeForPrompt } from '@/lib/ai-security'

export async function POST(request: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const rawMessage: string = body.message
        const rawHistory: Array<{ sender: string; content: string }> = body.history || []

        if (!rawMessage) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        const message = sanitizeForPrompt(rawMessage, 2000)
        const history = rawHistory.map(msg => ({
            sender: msg.sender,
            content: sanitizeForPrompt(msg.content, 2000),
        }))

        // 1. Load patient profile + active protocol
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, tenant_id, total_xp, current_streak, current_plan, primary_goal, initial_weight, current_weight')
            .eq('user_id', user.id)
            .single()

        // Enforce chat limits based on plan
        const plan = profile?.current_plan ?? 'community'
        if (plan === 'community') {
            // community plan: limit to 5 AI messages per day
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)
            const { count } = await supabase
                .from('ai_generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('task', 'chat')
                .gte('created_at', todayStart.toISOString())

            if ((count ?? 0) >= 5) {
                return NextResponse.json(
                    { error: 'Limite diário de mensagens atingido. Faça upgrade para chat ilimitado.' },
                    { status: 429 }
                )
            }
        }

        // Log chat message for usage tracking
        void supabase.from('ai_generations').insert({
            user_id: user.id,
            tenant_id: profile?.tenant_id,
            task: 'chat',
            model: 'gemini-2.5-flash',
        })

        // 2. Load active protocol assignment
        let activeProtocol = null
        let currentDay = 1
        let progressPercentage = 0
        if (profile?.tenant_id) {
            const { data: assignment } = await supabase
                .from('protocol_assignments')
                .select(`
                    start_date,
                    protocol:protocols(title, description, duration_days)
                `)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single()

            if (assignment) {
                activeProtocol = assignment
                const startDate = new Date(assignment.start_date)
                const today = new Date()
                const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                currentDay = Math.max(1, diffDays + 1)
                const durationDays = (assignment.protocol as any)?.duration_days
                if (durationDays) {
                    progressPercentage = Math.min(100, Math.round((currentDay / durationDays) * 100))
                }
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
            ? `A paciente está no Dia ${currentDay} do protocolo "${(activeProtocol.protocol as any)?.title}". Progresso geral: ${progressPercentage}%.`
            : 'A paciente ainda não tem um protocolo ativo.'

        const profileContext = profile
            ? `Nome: ${sanitizeForPrompt(profile.name, 100)}. XP Total: ${profile.total_xp || 0}. Streak atual: ${profile.current_streak || 0} dias. Plano: ${profile.current_plan || 'community'}. ${profile.primary_goal ? `Objetivo principal: ${sanitizeForPrompt(profile.primary_goal, 200)}.` : ''} ${profile.initial_weight && profile.current_weight ? `Peso inicial: ${profile.initial_weight}kg, Peso atual: ${profile.current_weight}kg.` : ''}`
            : ''

        const systemPrompt = getChatSystemPrompt(
            brandName,
            methodName,
            tone,
            emojiLevel,
            tenantInfo?.gpt_system_prompt,
        ) + `

CONTEXTO DA PACIENTE (${patientName}):
${profileContext}
${protocolContext}`

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
