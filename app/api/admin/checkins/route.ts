import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get this nutritionist's tenant
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantId = tenant.id
    const today = new Date()

    // 1. Load all patients for this tenant
    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, current_streak, total_xp, last_checkin_date, current_plan, created_at')
        .eq('tenant_id', tenantId)
        .eq('role', 'patient')
        .order('created_at', { ascending: false })

    if (!patients || patients.length === 0) {
        return NextResponse.json({ responses: [], stats: { total: 0, low: 0, medium: 0, high: 0 } })
    }

    // 2. Load last 7 days of daily_logs per patient
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const userIds = patients.map(p => p.user_id)

    const { data: logs } = await supabase
        .from('daily_logs')
        .select('user_id, log_date, meal_plan_check, water_check, workout_check')
        .in('user_id', userIds)
        .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])

    // 3. Load latest weekly checkin responses
    const { data: checkinResponses } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id, diet_score, main_difficulty, bowel, had_binge, mood, extra_notes, ai_summary, ai_risk_level, ai_suggestion, week_start, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })

    // Build a map of latest checkin per user
    const latestCheckin: Record<string, any> = {}
    for (const r of checkinResponses || []) {
        if (!latestCheckin[r.user_id]) {
            latestCheckin[r.user_id] = r
        }
    }

    // Build a map of logs per user
    const logsByUser: Record<string, any[]> = {}
    for (const log of logs || []) {
        if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
        logsByUser[log.user_id].push(log)
    }

    // 4. Calculate risk score for each patient
    const responses = patients.map(patient => {
        const userLogs = logsByUser[patient.user_id] || []
        const checkin = latestCheckin[patient.user_id]

        // Days since last activity
        let daysSinceActivity = 999
        if (patient.last_checkin_date) {
            const lastDate = new Date(patient.last_checkin_date)
            daysSinceActivity = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Adherence in last 7 days
        const adherenceRate = userLogs.length > 0
            ? userLogs.filter(l => l.meal_plan_check).length / 7
            : 0

        // Risk algorithm
        let riskScore = 10 // start perfect
        let riskLevel: 'low' | 'medium' | 'high' = 'low'

        if (daysSinceActivity > 7) riskScore -= 4
        else if (daysSinceActivity > 3) riskScore -= 2

        if (patient.current_streak === 0) riskScore -= 3
        else if (patient.current_streak < 3) riskScore -= 1

        if (adherenceRate < 0.3) riskScore -= 2
        else if (adherenceRate < 0.6) riskScore -= 1

        if (checkin?.diet_score !== undefined && checkin.diet_score < 5) riskScore -= 2
        if (checkin?.ai_risk_level === 'high') riskScore = Math.min(riskScore, 3)
        if (checkin?.ai_risk_level === 'medium') riskScore = Math.min(riskScore, 6)

        riskScore = Math.max(0, Math.min(10, riskScore))

        if (riskScore <= 4) riskLevel = 'high'
        else if (riskScore <= 6) riskLevel = 'medium'
        else riskLevel = 'low'

        // Summary
        let summary = ''
        if (checkin?.ai_summary) {
            summary = checkin.ai_summary
        } else if (daysSinceActivity === 0) {
            summary = `Ativa hoje · ${patient.current_streak} dias de streak`
        } else if (daysSinceActivity === 1) {
            summary = `Última atividade ontem · ${Math.round(adherenceRate * 100)}% de adesão`
        } else if (daysSinceActivity > 7) {
            summary = `Inativa há ${daysSinceActivity} dias · Sem check-in recente`
        } else {
            summary = `${Math.round(adherenceRate * 100)}% de adesão nos últimos 7 dias`
        }

        // Format date
        let dateStr = 'Nunca'
        if (patient.last_checkin_date) {
            const d = new Date(patient.last_checkin_date)
            if (daysSinceActivity === 0) dateStr = 'Hoje'
            else if (daysSinceActivity === 1) dateStr = 'Ontem'
            else dateStr = `Há ${daysSinceActivity} dias`
        }

        const initials = (patient.name || 'RQ')
            .split(' ')
            .map((n: string) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()

        return {
            id: patient.user_id,
            userName: patient.name || 'Rainha',
            userAvatar: initials,
            date: dateStr,
            riskScore,
            riskLevel,
            summary,
            streak: patient.current_streak || 0,
            xp: patient.total_xp || 0,
            plan: patient.current_plan || 'community',
            adherenceRate: Math.round(adherenceRate * 100),
            daysSinceActivity,
            hasCheckin: !!checkin,
            checkinScore: checkin?.diet_score ?? null,
            checkinDetails: checkin ? {
                diet_score: checkin.diet_score,
                main_difficulty: checkin.main_difficulty,
                bowel: checkin.bowel,
                had_binge: checkin.had_binge,
                mood: checkin.mood,
                extra_notes: checkin.extra_notes,
                ai_suggestion: checkin.ai_suggestion,
                week_start: checkin.week_start,
                created_at: checkin.created_at,
            } : null,
        }
    })

    // Sort: high risk first, then medium, then low
    responses.sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return order[a.riskLevel] - order[b.riskLevel]
    })

    const stats = {
        total: responses.length,
        high: responses.filter(r => r.riskLevel === 'high').length,
        medium: responses.filter(r => r.riskLevel === 'medium').length,
        low: responses.filter(r => r.riskLevel === 'low').length,
    }

    return NextResponse.json({ responses, stats })
}
