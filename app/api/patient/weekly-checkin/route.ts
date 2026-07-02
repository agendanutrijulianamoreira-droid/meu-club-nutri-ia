import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { triggerOrchestrator } from '@/lib/services/anthropic'

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

    // AI analysis via Gemini
    let aiSummary = ''
    let aiRiskLevel: 'low' | 'medium' | 'high' = 'low'
    let aiSuggestion = ''

    try {
        const apiKey = process.env.GEMINI_API_KEY
        if (apiKey) {
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

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 300, responseMimeType: 'application/json' },
                }),
            })

            if (res.ok) {
                const data = await res.json()
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                const parsed = JSON.parse(clean)
                aiSummary = parsed.summary || ''
                aiRiskLevel = parsed.risk_level || 'low'
                aiSuggestion = parsed.suggestion || ''
            }
        }
    } catch (err) {
        console.error('[Checkin AI] Error:', err)
        aiSummary = `Nota ${diet_score}/10 · ${had_binge ? 'Teve compulsão' : 'Sem compulsão'}`
        aiRiskLevel = diet_score <= 4 ? 'high' : diet_score <= 6 ? 'medium' : 'low'
    }

    // Save response
    const weekStart = new Date()
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    // ⚡ BUGFIX: precisa saber se é um envio NOVO (não um reenvio da mesma semana)
    // antes do upsert, para só creditar XP uma vez por semana.
    const { data: existingCheckin } = await supabase
        .from('weekly_checkin_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single()
    const isNewSubmission = !existingCheckin

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

    // ⚡ BUGFIX: a Home promete "Responda em 2 min e ganhe +20 XP" (e a Loja lista
    // "Check-in semanal enviado: +20 coins" no guia de como ganhar NutriCoins),
    // mas essa rota nunca creditava XP/NutriCoins — a promessa nunca era cumprida.
    // Conforme a tabela de gamificação (CLAUDE.md §10): +20 XP por check-in semanal.
    const CHECKIN_XP = 20
    if (isNewSubmission) {
        const { error: xpError } = await supabase.rpc('increment_user_points', {
            user_id: user.id,
            points_to_add: CHECKIN_XP,
        })
        if (xpError) console.error('[Checkin] XP award error:', xpError)
    }

    // ── Trigger orchestrator: checkin_submitted ─────────────────────────
    triggerOrchestrator('checkin_submitted', profile.tenant_id, user.id)

    return NextResponse.json({
        success: true,
        data,
        ai_summary: aiSummary,
        ai_suggestion: aiSuggestion,
        xp_awarded: isNewSubmission ? CHECKIN_XP : 0,
    })
}

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const weekStart = new Date()
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const { data } = await supabase
        .from('weekly_checkin_responses')
        .select('id, diet_score, ai_summary, mood, created_at')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .single()

    return NextResponse.json({ submitted: !!data, checkin: data || null })
}
