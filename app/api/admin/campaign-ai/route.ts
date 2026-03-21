import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants')
        .select('brand_name, method_name, gpt_system_prompt, settings')
        .eq('owner_id', user.id)
        .single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { goal, segment, tone } = body

    const brandName = tenant.brand_name || 'Nutri Club'
    const methodName = tenant.method_name || 'Protocolo Nutri'
    const toneMap: Record<string, string> = {
        acolhedora: 'carinhosa, acolhedora, usa termos de afeto como "rainha" e "amor"',
        motivadora: 'energética, motivacional, empoderada, usa exclamações',
        tecnica: 'direta, objetiva, embasada, sem floreios',
    }
    const goalMap: Record<string, string> = {
        reengage: 'reengajar pacientes que sumiram — sem julgamento, com acolhimento',
        motivate: 'motivar pacientes a manter consistência no protocolo',
        hydration: 'lembrar da hidratação diária de forma animada',
        checkin: 'incentivar o registro do check-in diário',
        upsell: 'apresentar uma oportunidade de upgrade ou consulta estratégica',
        custom: 'engajamento geral do clube',
    }
    const segmentMap: Record<string, string> = {
        all: 'todas as pacientes do clube',
        low_adherence: 'pacientes com baixa adesão que estão sumidas',
        high_risk: 'pacientes em risco de evasão — alta prioridade, precisa de resgate',
        active: 'pacientes ativas e engajadas',
    }

    const prompt = `Você é o sistema de comunicação do ${brandName} (método ${methodName}).

Gere uma mensagem de notificação para o app.
Objetivo: ${goalMap[goal] || goalMap.custom}
Público: ${segmentMap[segment] || segmentMap.all}
Tom: ${toneMap[tone] || toneMap.motivadora}

Regras: Título máx 8 palavras (1 emoji ok). Mensagem 2-3 frases, máx 120 chars. CTA 2-4 palavras. Sem preços.

Retorne APENAS JSON: { "title": "...", "body": "...", "cta_label": "..." }`

    try {
        const parsed = await callClaudeJSON({
            maxTokens: 300,
            messages: [{ role: 'user', content: prompt }],
        })
        return NextResponse.json(parsed)
    } catch (err) {
        console.error('[campaign-ai] Error:', err)
        return NextResponse.json({ error: 'Erro ao gerar mensagem' }, { status: 500 })
    }
}
