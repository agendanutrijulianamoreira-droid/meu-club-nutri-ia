import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { buildPatientContext } from '@/lib/services/patientContext'

interface InsightResult {
    behavioral_analysis: string
    strengths: string[]
    risks: string[]
    action_suggestions: string[]
    motivational_message: string
    engagement_score: number
}

export async function POST(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id, name, method_name, gpt_system_prompt')
        .eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const patientId = params.id

    const context = await buildPatientContext(supabase, patientId, tenant.id)
    if (!context) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const systemPrompt = tenant.gpt_system_prompt ||
        'Você é uma nutricionista especialista em comportamento alimentar e saúde feminina.'

    const userPrompt = `
Você é a IA analítica do clube de saúde "${tenant.name}". Gere um insight profundo e personalizado sobre esta paciente.

${context.contextText}

Retorne um JSON com esta estrutura exata:
{
  "behavioral_analysis": "Parágrafo de 3-4 frases com análise comportamental profunda e personalizada",
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "risks": ["risco ou área de atenção 1", "risco 2"],
  "action_suggestions": ["ação concreta 1", "ação concreta 2", "ação concreta 3"],
  "motivational_message": "Mensagem motivacional curta e personalizada para enviar a esta paciente (máx 2 frases)",
  "engagement_score": <número 0-100 representando o engajamento geral>
}
`

    try {
        const insight = await callClaudeJSON<InsightResult>({
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            maxTokens: 1200,
        })
        return NextResponse.json({ insight })
    } catch (err) {
        console.error('[InsightRoute]', err)
        return NextResponse.json({ error: 'Falha ao gerar insight' }, { status: 500 })
    }
}
