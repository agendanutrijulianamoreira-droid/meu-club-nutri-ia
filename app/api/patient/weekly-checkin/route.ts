import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { diet_score, main_difficulty, bowel, had_binge, mood, extra_notes } = body

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, tenant_id, current_streak')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // AI analysis of the checkin
    let aiSummary = ''
    let aiRiskLevel: 'low' | 'medium' | 'high' = 'low'
    let aiSuggestion = ''

    try {
        if (process.env.GEMINI_API_KEY) {
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 300 },
            })

            const prompt = `Analise este check-in semanal de uma paciente de nutrição e retorne JSON:

Dados:
- Nota para a dieta (0-10): ${diet_score}
- Principal dificuldade: "${main_difficulty || 'não informada'}"
- Intestino: ${bowel || 'não informado'}
- Teve compulsão alimentar: ${had_binge ? 'sim' : 'não'}
- Humor: ${mood || 'não informado'}
- Observações: "${extra_notes || 'nenhuma'}"
- Streak atual: ${profile.current_streak || 0} dias

Retorne APENAS JSON válido:
{
  "summary": "frase curta de 1 linha descrevendo a semana da paciente",
  "risk_level": "low|medium|high",
  "suggestion": "1 sugestão prática e direta para a nutricionista agir (máx 15 palavras)"
}`

            const result = await model.generateContent(prompt)
            const parsed = JSON.parse(result.response.text())
            aiSummary = parsed.summary || ''
            aiRiskLevel = parsed.risk_level || 'low'
            aiSuggestion = parsed.suggestion || ''
        }
    } catch (err) {
        console.error('[Checkin AI] Error:', err)
        // Continue without AI analysis
        aiSummary = `Nota ${diet_score}/10 · ${had_binge ? 'Teve compulsão' : 'Sem compulsão'}`
        aiRiskLevel = diet_score <= 4 ? 'high' : diet_score <= 6 ? 'medium' : 'low'
    }

    // Save response (upsert by week_start to prevent duplicates)
    const weekStart = new Date()
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('weekly_checkin_responses')
        .upsert({
            user_id: user.id,
            tenant_id: profile.tenant_id,
            diet_score,
            main_difficulty,
            bowel,
            had_binge,
            mood,
            extra_notes,
            ai_summary: aiSummary,
            ai_risk_level: aiRiskLevel,
            ai_suggestion: aiSuggestion,
            week_start: weekStartStr,
        }, { onConflict: 'user_id,week_start' })
        .select()
        .single()

    if (error) {
        console.error('[Checkin] Save error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data, ai_summary: aiSummary, ai_suggestion: aiSuggestion })
}

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if patient already submitted this week
    const weekStart = new Date()
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const { data } = await supabase
        .from('weekly_checkin_responses')
        .select('id, diet_score, ai_summary, created_at')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single()

    return NextResponse.json({ submitted: !!data, data })
}
