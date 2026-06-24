import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

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

    // Fetch patient profile
    const { data: profile } = await supabase
        .from('profiles')
        .select(`
            name, email, current_plan, current_streak, longest_streak,
            total_xp, nutri_coins, current_level, last_checkin_date,
            created_at, primary_goal, current_weight, initial_weight,
            dietary_restrictions, onboarding_completed, tenant_id
        `)
        .eq('user_id', patientId)
        .single()

    if (!profile || profile.tenant_id !== tenant.id) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch last 3 weekly checkins
    const { data: checkins } = await supabase
        .from('weekly_checkin_responses')
        .select('diet_score, mood, had_binge, main_difficulty, extra_notes, ai_summary, created_at')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false })
        .limit(3)

    // Fetch daily logs last 14 days
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const { data: logs } = await supabase
        .from('daily_logs')
        .select('log_date, meal_plan_check, water_check, workout_check')
        .eq('user_id', patientId)
        .gte('log_date', twoWeeksAgo.toISOString().split('T')[0])

    // Fetch active protocol
    const { data: assignment } = await supabase
        .from('protocol_assignments')
        .select('started_at, protocols(title, description)')
        .eq('user_id', patientId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // Build context
    const today = new Date().toISOString().split('T')[0]
    const daysSinceJoin = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    const adherenceCount = (logs || []).filter(l => l.meal_plan_check || l.water_check || l.workout_check).length
    const adherenceRate = logs && logs.length > 0 ? Math.round((adherenceCount / 14) * 100) : 0
    const protocol = assignment?.protocols as { title: string; description: string } | null

    const latestCheckin = checkins?.[0]
    const checkinTrend = checkins && checkins.length > 1
        ? `Tendência: score ${checkins.map(c => c.diet_score).reverse().join(' → ')}`
        : ''

    const systemPrompt = tenant.gpt_system_prompt ||
        'Você é uma nutricionista especialista em comportamento alimentar e saúde feminina.'

    const userPrompt = `
Você é a IA analítica do clube de saúde "${tenant.name}". Gere um insight profundo e personalizado sobre esta paciente.

DADOS DA PACIENTE:
- Nome: ${profile.name}
- Objetivo: ${profile.primary_goal || 'Não informado'}
- No clube há: ${daysSinceJoin} dias
- Plano: ${profile.current_plan}
- Onboarding completo: ${profile.onboarding_completed ? 'Sim' : 'Não'}
- Peso inicial: ${profile.initial_weight ? profile.initial_weight + 'kg' : 'N/A'}
- Peso atual: ${profile.current_weight ? profile.current_weight + 'kg' : 'N/A'}
- Restrições: ${(profile.dietary_restrictions || []).join(', ') || 'Nenhuma'}
- Protocolo ativo: ${protocol ? protocol.title : 'Nenhum'}

ENGAJAMENTO:
- XP total: ${profile.total_xp}
- Nível: ${profile.current_level}
- Streak atual: ${profile.current_streak} dias
- Maior streak: ${profile.longest_streak} dias
- Adesão últimas 2 semanas: ${adherenceRate}%
- NutriCoins: ${profile.nutri_coins}
- Último check-in: ${profile.last_checkin_date || 'Nunca'}

CHECK-INS RECENTES:
${latestCheckin ? `
- Score dieta: ${latestCheckin.diet_score}/10
- Humor: ${latestCheckin.mood || 'N/A'}
- Teve compulsão: ${latestCheckin.had_binge ? 'Sim' : 'Não'}
- Dificuldade principal: ${latestCheckin.main_difficulty || 'N/A'}
- Notas: ${latestCheckin.extra_notes || 'N/A'}
- Análise IA anterior: ${latestCheckin.ai_summary || 'N/A'}
${checkinTrend}
` : 'Nenhum check-in registrado'}

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
