import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const tenantId = tenant.id
    const now = new Date()

    // ── Helpers ───────────────────────────────────────────────────────────────
    const daysAgo = (n: number) => {
        const d = new Date(now); d.setDate(now.getDate() - n)
        return d.toISOString().split('T')[0]
    }

    // ── 1. All patients ───────────────────────────────────────────────────────
    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, total_xp, current_streak, longest_streak, last_checkin_date, created_at, nutri_coins, primary_goal')
        .eq('tenant_id', tenantId)
        .eq('role', 'patient')
        .order('created_at', { ascending: true })

    const total = patients?.length || 0
    const userIds = (patients || []).map(p => p.user_id)
    const stub = ['00000000-0000-0000-0000-000000000000']

    // ── 2. Daily logs last 56 days (8 weeks) ─────────────────────────────────
    const { data: logs56 } = await supabase
        .from('daily_logs')
        .select('user_id, log_date, meal_plan_check, water_check, workout_check')
        .in('user_id', userIds.length ? userIds : stub)
        .gte('log_date', daysAgo(56))

    // ── 3. Weekly checkins last 8 weeks ───────────────────────────────────────
    const { data: weeklyCheckins } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id, diet_score, ai_risk_level, week_start, created_at')
        .in('user_id', userIds.length ? userIds : stub)
        .gte('week_start', daysAgo(56))

    // ── 4. Redemptions ────────────────────────────────────────────────────────
    const { data: redemptions } = await supabase
        .from('reward_redemptions')
        .select('user_id, item_cost, status, created_at')
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelled')

    // ── 5. Community posts last 30 days ───────────────────────────────────────
    const { data: posts30 } = await supabase
        .from('community_posts')
        .select('user_id, type, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', daysAgo(30))

    // ────────────────────────────────────────────────────────────────────────
    // ADHERENCE TREND: weekly averages for last 8 weeks
    // ────────────────────────────────────────────────────────────────────────
    const weeklyAdherence: { week: string; adherence: number; active: number }[] = []
    for (let w = 7; w >= 0; w--) {
        const weekEnd = new Date(now); weekEnd.setDate(now.getDate() - w * 7)
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6)
        const ws = weekStart.toISOString().split('T')[0]
        const we = weekEnd.toISOString().split('T')[0]
        const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`

        const weekLogs = (logs56 || []).filter(l => l.log_date >= ws && l.log_date <= we)
        const activeUsers = Array.from(new Set(weekLogs.map(l => l.user_id as string))).length
        const mealChecks = weekLogs.filter(l => l.meal_plan_check).length
        const adherence = weekLogs.length > 0 ? Math.round((mealChecks / weekLogs.length) * 100) : 0

        weeklyAdherence.push({ week: label, adherence, active: activeUsers })
    }

    // ────────────────────────────────────────────────────────────────────────
    // GROWTH: new patients per week (last 8 weeks)
    // ────────────────────────────────────────────────────────────────────────
    const weeklyGrowth: { week: string; new: number; cumulative: number }[] = []
    let cumulative = 0
    for (let w = 7; w >= 0; w--) {
        const weekEnd = new Date(now); weekEnd.setDate(now.getDate() - w * 7)
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6)
        const ws = weekStart.toISOString()
        const we = weekEnd.toISOString()
        const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`

        const newThisWeek = (patients || []).filter(p => p.created_at >= ws && p.created_at <= we).length
        cumulative += newThisWeek
        weeklyGrowth.push({ week: label, new: newThisWeek, cumulative })
    }

    // ────────────────────────────────────────────────────────────────────────
    // ENGAGEMENT FUNNEL
    // ────────────────────────────────────────────────────────────────────────
    const last30 = daysAgo(30)
    const logs30 = (logs56 || []).filter(l => l.log_date >= last30)
    const activeUserIds30 = Array.from(new Set(logs30.map(l => l.user_id as string)))
    const checkinUsers30 = Array.from(new Set((weeklyCheckins || []).filter(c => c.week_start >= last30).map(c => c.user_id as string)))
    const postUsers30 = Array.from(new Set((posts30 || []).map(p => p.user_id as string)))
    const redeemUsers = Array.from(new Set((redemptions || []).filter(r => new Date(r.created_at) >= new Date(last30)).map(r => r.user_id as string)))

    const funnel = [
        { label: 'Cadastradas', value: total, pct: 100 },
        { label: 'Ativas (30d)', value: activeUserIds30.length, pct: total ? Math.round((activeUserIds30.length / total) * 100) : 0 },
        { label: 'Check-in semanal', value: checkinUsers30.length, pct: total ? Math.round((checkinUsers30.length / total) * 100) : 0 },
        { label: 'Postaram no feed', value: postUsers30.length, pct: total ? Math.round((postUsers30.length / total) * 100) : 0 },
        { label: 'Resgataram recompensa', value: redeemUsers.length, pct: total ? Math.round((redeemUsers.length / total) * 100) : 0 },
    ]

    // ────────────────────────────────────────────────────────────────────────
    // RETENTION: of patients who joined > 30 days ago, how many active now
    // ────────────────────────────────────────────────────────────────────────
    const thirtyPlusPatients = (patients || []).filter(p => p.created_at <= daysAgo(30))
    const retainedIds = thirtyPlusPatients.filter(p =>
        p.last_checkin_date && p.last_checkin_date >= daysAgo(14)
    )
    const retentionRate = thirtyPlusPatients.length
        ? Math.round((retainedIds.length / thirtyPlusPatients.length) * 100)
        : 0

    // ────────────────────────────────────────────────────────────────────────
    // CHECK-IN SCORES: distribution
    // ────────────────────────────────────────────────────────────────────────
    const scoreDistrib: Record<string, number> = { '1-3': 0, '4-5': 0, '6-7': 0, '8-9': 0, '10': 0 }
    for (const c of weeklyCheckins || []) {
        const s = c.diet_score
        if (s <= 3) scoreDistrib['1-3']++
        else if (s <= 5) scoreDistrib['4-5']++
        else if (s <= 7) scoreDistrib['6-7']++
        else if (s <= 9) scoreDistrib['8-9']++
        else scoreDistrib['10']++
    }

    // ────────────────────────────────────────────────────────────────────────
    // TOP PERFORMERS (last 30 days by activity)
    // ────────────────────────────────────────────────────────────────────────
    const activityByUser: Record<string, number> = {}
    for (const l of logs30) activityByUser[l.user_id] = (activityByUser[l.user_id] || 0) + 1

    const topPerformers = (patients || [])
        .map(p => ({
            name: p.name || 'Rainha',
            initials: (p.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            streak: p.current_streak || 0,
            xp: p.total_xp || 0,
            logs30: activityByUser[p.user_id] || 0,
            coins: p.nutri_coins || 0,
        }))
        .sort((a, b) => b.logs30 - a.logs30 || b.streak - a.streak)
        .slice(0, 5)

    // ────────────────────────────────────────────────────────────────────────
    // RISK BREAKDOWN
    // ────────────────────────────────────────────────────────────────────────
    const riskMap: Record<string, any> = {}
    for (const c of weeklyCheckins || []) {
        if (!riskMap[c.user_id]) riskMap[c.user_id] = c
    }
    let highRisk = 0, medRisk = 0, lowRisk = 0
    for (const p of patients || []) {
        const daysSince = p.last_checkin_date
            ? Math.floor((now.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000) : 999
        let risk = 10
        if (daysSince > 7) risk -= 4
        else if (daysSince > 3) risk -= 2
        if (!p.current_streak || p.current_streak === 0) risk -= 3
        else if (p.current_streak < 3) risk -= 1
        const cl = riskMap[p.user_id]
        if (cl?.diet_score !== undefined && cl.diet_score < 5) risk -= 2
        if (cl?.ai_risk_level === 'high') risk = Math.min(risk, 3)
        if (cl?.ai_risk_level === 'medium') risk = Math.min(risk, 6)
        risk = Math.max(0, Math.min(10, risk))
        if (risk <= 4) highRisk++
        else if (risk <= 6) medRisk++
        else lowRisk++
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUMMARY KPIs
    // ────────────────────────────────────────────────────────────────────────
    const avgStreak = total ? Math.round((patients || []).reduce((acc, p) => acc + (p.current_streak || 0), 0) / total) : 0
    const avgDietScore = weeklyCheckins?.length
        ? Math.round((weeklyCheckins.reduce((acc, c) => acc + c.diet_score, 0) / weeklyCheckins.length) * 10) / 10
        : 0
    const totalCoinsCirculating = (patients || []).reduce((acc, p) => acc + (p.nutri_coins || 0), 0)
    const totalCoinsRedeemed = (redemptions || []).reduce((acc, r) => acc + r.item_cost, 0)

    return NextResponse.json({
        summary: {
            total, retentionRate, avgStreak, avgDietScore,
            totalCoinsCirculating, totalCoinsRedeemed,
            highRisk, medRisk, lowRisk,
            checkinCount: weeklyCheckins?.length || 0,
        },
        weeklyAdherence,
        weeklyGrowth,
        funnel,
        scoreDistrib,
        topPerformers,
    })
}
