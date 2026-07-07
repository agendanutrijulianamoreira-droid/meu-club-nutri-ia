import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaude } from '@/lib/services/anthropic'
import { buildPatientContext } from '@/lib/services/patientContext'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id, name, gpt_system_prompt')
        .eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const message: string = body?.message?.trim() || ''
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history : []
    if (!message) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    const patientId = params.id
    const context = await buildPatientContext(supabase, patientId, tenant.id)
    if (!context) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const systemPrompt = `${tenant.gpt_system_prompt || 'Você é uma nutricionista especialista em comportamento alimentar e saúde feminina.'}

Você está conversando com A PROFISSIONAL (nutricionista) sobre uma paciente específica dela, chamada ${context.profile.name} — você NÃO está falando com a paciente. Responda de forma objetiva e direta, como uma colega analista te ajudando a entender o caso. Use os dados abaixo como fonte de verdade; se algo não estiver nos dados, diga que não tem essa informação em vez de inventar.

${context.contextText}`

    try {
        const reply = await callClaude({
            system: systemPrompt,
            messages: [...history, { role: 'user', content: message }],
            maxTokens: 800,
        })
        return NextResponse.json({ reply })
    } catch (err) {
        console.error('[PatientChatRoute]', err)
        return NextResponse.json({ error: 'Falha ao consultar IA' }, { status: 500 })
    }
}
