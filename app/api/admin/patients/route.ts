import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { calculateRiskScore, adherenceFromLogs } from '@/lib/services/riskScore'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantId = tenant.id
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 1. All patients for this tenant
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
            user_id, name, email, phone, current_plan,
            current_streak, longest_streak, total_xp, nutri_coins,
            current_level, last_checkin_date, created_at,
            primary_goal, current_weight, initial_weight,
            dietary_restrictions, onboarding_completed
        `)
        .eq('tenant_id', tenantId)
        .eq('role', 'patient')
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!profiles || profiles.length === 0) return NextResponse.json({ patients: [] })

    const userIds = profiles.map(p => p.user_id)
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)

    // 2-4. Independent per-user queries fired in parallel instead of sequentially.
    // Checkins are bounded to the last 180 days — only the most recent one per user
    // is ever used, so there's no reason to pull years of history across the roster.
    const [{ data: logs }, { data: checkins }, { data: assignments }] = await Promise.all([
        supabase
            .from('daily_logs')
            .select('user_id, log_date, meal_plan_check, water_check, workout_check')
            .in('user_id', userIds)
            .gte('log_date', sevenDaysAgo.toISOString().split('T')[0]),
        supabase
            .from('weekly_checkin_responses')
            .select('user_id, diet_score, ai_summary, ai_risk_level, ai_suggestion, created_at, had_binge, mood')
            .in('user_id', userIds)
            .gte('created_at', sixMonthsAgo.toISOString())
            .order('created_at', { ascending: false }),
        supabase
            .from('protocol_assignments')
            .select('user_id, protocol_id, start_date, status')
            .in('user_id', userIds)
            .eq('status', 'active'),
    ])

    // Build maps
    const logsByUser: Record<string, any[]> = {}
    for (const log of logs || []) {
        if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
        logsByUser[log.user_id].push(log)
    }

    const latestCheckin: Record<string, any> = {}
    for (const c of checkins || []) {
        if (!latestCheckin[c.user_id]) latestCheckin[c.user_id] = c
    }

    const assignmentByUser: Record<string, any> = {}
    for (const a of assignments || []) {
        assignmentByUser[a.user_id] = a
    }

    // Enrich patients
    const patients = profiles.map(p => {
        const userLogs = logsByUser[p.user_id] || []
        const checkin = latestCheckin[p.user_id]
        const assignment = assignmentByUser[p.user_id]

        const daysSinceActivity = p.last_checkin_date
            ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / (1000 * 60 * 60 * 24))
            : 999

        const adherenceRate = adherenceFromLogs(userLogs)

        const { riskScore, riskLevel } = calculateRiskScore({
            daysSinceActivity,
            currentStreak: p.current_streak,
            adherenceRate,
            dietScore: checkin?.diet_score,
            aiRiskLevel: checkin?.ai_risk_level,
        })

        const status = riskLevel === 'high' ? 'risk'
            : p.current_streak >= 7 ? 'star'
            : 'active'

        const aiSummary = checkin?.ai_summary
            || (daysSinceActivity === 0 ? `Ativa hoje · ${p.current_streak || 0} dias de streak`
                : daysSinceActivity > 7 ? `Inativa há ${daysSinceActivity} dias`
                : `${adherenceRate}% de adesão nos últimos 7 dias`)

        const lastLoginStr = p.last_checkin_date
            ? (daysSinceActivity === 0 ? 'Hoje'
                : daysSinceActivity === 1 ? 'Ontem'
                : `Há ${daysSinceActivity} dias`)
            : 'Nunca'

        const initials = (p.name || '??')
            .split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

        return {
            id: p.user_id,
            name: p.name || 'Sem nome',
            email: p.email || '',
            phone: p.phone || '',
            plan: p.current_plan || 'community',
            avatar: initials,
            status,
            riskLevel,
            riskScore,
            adherenceRate,
            lastLogin: lastLoginStr,
            daysSinceActivity,
            startDate: new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
            aiSummary,
            aiSuggestion: checkin?.ai_suggestion || null,
            xp: p.total_xp || 0,
            coins: p.nutri_coins || 0,
            level: p.current_level || 1,
            streak: p.current_streak || 0,
            longestStreak: p.longest_streak || 0,
            weight: {
                current: p.current_weight || 0,
                start: p.initial_weight || 0,
                goal: 0,
            },
            primaryGoal: p.primary_goal || '',
            onboardingCompleted: p.onboarding_completed || false,
            hasActiveProtocol: !!assignment,
            hasCheckin: !!checkin,
            checkinScore: checkin?.diet_score ?? null,
        }
    })

    // Sort: high risk → medium → star → active
    patients.sort((a, b) => {
        const order: Record<string, number> = { risk: 0, medium: 1, star: 2, active: 3 }
        const aOrder = a.status === 'risk' ? 0 : a.riskLevel === 'medium' ? 1 : a.status === 'star' ? 2 : 3
        const bOrder = b.status === 'risk' ? 0 : b.riskLevel === 'medium' ? 1 : b.status === 'star' ? 2 : 3
        return aOrder - bOrder
    })

    return NextResponse.json({ patients })
}
