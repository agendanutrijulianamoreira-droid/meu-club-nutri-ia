import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id, method_name, brand_name')
        .eq('owner_id', user.id)
        .single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantId = tenant.id
    const today = new Date()
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7)
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
    const sevenStr = sevenDaysAgo.toISOString().split('T')[0]
    const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0]

    // ── 1. All patients ───────────────────────────────────────────────────────
    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, current_streak, longest_streak, last_checkin_date, total_xp, current_plan, primary_goal, current_weight, initial_weight')
        .eq('tenant_id', tenantId)
        .eq('role', 'patient')

    const total = patients?.length || 0
    const userIds = (patients || []).map(p => p.user_id)

    // ── 2. Active subscriptions (revenue proxy) ───────────────────────────────
    const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .catch(() => ({ count: 0 })) as any

    // ── 3. Active protocol assignments ────────────────────────────────────────
    const { count: activeProtocols } = await supabase
        .from('protocol_assignments')
        .select('*', { count: 'exact', head: true })
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'active') as any

    // ── 4. Daily logs last 7 days (adherence) ────────────────────────────────
    const { data: logs7d } = await supabase
        .from('daily_logs')
        .select('user_id, log_date, meal_plan_check')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('log_date', sevenStr)

    // ── 5. Weekly checkins ────────────────────────────────────────────────────
    const { data: checkins } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id, diet_score, ai_risk_level, ai_summary, created_at')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })

    // Build maps
    const logsByUser: Record<string, any[]> = {}
    for (const log of logs7d || []) {
        if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
        logsByUser[log.user_id].push(log)
    }
    const checkinByUser: Record<string, any> = {}
    for (const c of checkins || []) {
        if (!checkinByUser[c.user_id]) checkinByUser[c.user_id] = c
    }

    // ── 6. Risk scoring per patient ───────────────────────────────────────────
    type RiskLevel = 'low' | 'medium' | 'high'
    const patientRisks = (patients || []).map(p => {
        const userLogs = logsByUser[p.user_id] || []
        const checkin = checkinByUser[p.user_id]
        const daysSince = p.last_checkin_date
            ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
            : 999
        const adherence = userLogs.length > 0
            ? Math.round((userLogs.filter((l: any) => l.meal_plan_check).length / 7) * 100)
            : 0

        let risk = 10
        if (daysSince > 7) risk -= 4
        else if (daysSince > 3) risk -= 2
        if (!p.current_streak || p.current_streak === 0) risk -= 3
        else if (p.current_streak < 3) risk -= 1
        if (adherence < 30) risk -= 2
        else if (adherence < 60) risk -= 1
        if (checkin?.diet_score !== undefined && checkin.diet_score < 5) risk -= 2
        if (checkin?.ai_risk_level === 'high') risk = Math.min(risk, 3)
        if (checkin?.ai_risk_level === 'medium') risk = Math.min(risk, 6)
        risk = Math.max(0, Math.min(10, risk))

        const riskLevel: RiskLevel = risk <= 4 ? 'high' : risk <= 6 ? 'medium' : 'low'
        return { ...p, riskLevel, riskScore: risk, adherence, daysSince }
    })

    const criticalCount = patientRisks.filter(p => p.riskLevel === 'high').length
    const mediumCount = patientRisks.filter(p => p.riskLevel === 'medium').length

    // ── 7. Adherence average ─────────────────────────────────────────────────
    const activePatients = patientRisks.filter(p => p.daysSince <= 7)
    const avgAdherence = activePatients.length > 0
        ? Math.round(activePatients.reduce((acc, p) => acc + p.adherence, 0) / activePatients.length)
        : 0

    // ── 8. Total XP ───────────────────────────────────────────────────────────
    const totalXP = (patients || []).reduce((acc, p) => acc + (p.total_xp || 0), 0)

    // ── 9. Top 3 queens by XP ─────────────────────────────────────────────────
    const topQueens = [...(patients || [])]
        .sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0))
        .slice(0, 3)
        .map((p, i) => ({
            id: p.user_id,
            name: p.name || 'Rainha',
            initials: (p.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            xp: p.total_xp || 0,
            streak: p.current_streak || 0,
            rank: i + 1,
            progress: Math.min(100, Math.round(((p.total_xp || 0) / Math.max(1, (patients![0]?.total_xp || 1))) * 100)),
        }))

    // ── 10. At-risk patients for inbox/insights ───────────────────────────────
    const atRisk = patientRisks
        .filter(p => p.riskLevel === 'high' || p.riskLevel === 'medium')
        .sort((a, b) => a.riskScore - b.riskScore)
        .slice(0, 5)
        .map(p => ({
            id: p.user_id,
            name: p.name || 'Rainha',
            initials: (p.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            riskLevel: p.riskLevel,
            daysSince: p.daysSince,
            adherence: p.adherence,
            streak: p.current_streak || 0,
            summary: checkinByUser[p.user_id]?.ai_summary ||
                (p.daysSince > 7
                    ? `Inativa há ${p.daysSince} dias. Risco de evasão ${p.riskLevel === 'high' ? 'alto' : 'médio'}.`
                    : `Adesão de ${p.adherence}% nos últimos 7 dias.`),
        }))

    // ── 11. Streak milestones today ───────────────────────────────────────────
    const MILESTONES = [7, 14, 21, 30, 60, 100]
    const milestoneToday = (patients || []).filter(p =>
        MILESTONES.includes(p.current_streak || 0)
    ).map(p => ({ name: p.name?.split(' ')[0] || 'Rainha', streak: p.current_streak }))

    // ── 12. Active protocol (for the tracker widget) ─────────────────────────
    const { data: activeProtocol } = await supabase
        .from('protocols')
        .select('id, title, duration_days')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .single()
        .catch(() => ({ data: null })) as any

    // ── 13. Build AI insights (data-driven, no hallucination) ─────────────────
    const insights: any[] = []

    if (criticalCount > 0) {
        const names = atRisk.filter(p => p.riskLevel === 'high').slice(0, 3).map(p => p.name.split(' ')[0]).join(', ')
        const maxDays = Math.max(...atRisk.filter(p => p.riskLevel === 'high').map(p => p.daysSince))
        insights.push({
            id: 1, urgency: 'high',
            iconType: 'alert',
            title: `${criticalCount} ${criticalCount === 1 ? 'rainha em risco' : 'rainhas em risco'} de evasão`,
            body: `${names} ${criticalCount > 3 ? `e outras ${criticalCount - 3}` : ''} com baixo engajamento. Maior inatividade: ${maxDays > 999 ? 'nunca se conectou' : `${maxDays} dias`}.`,
            action: 'Ver Alertas',
            view: 'checkins',
        })
    }

    if (avgAdherence > 0) {
        const trend = avgAdherence >= 70 ? 'acima' : avgAdherence >= 50 ? 'na média' : 'abaixo'
        insights.push({
            id: 2, urgency: avgAdherence >= 70 ? 'low' : avgAdherence >= 50 ? 'medium' : 'high',
            iconType: 'trend',
            title: `Adesão média: ${avgAdherence}%`,
            body: `O clube está ${trend} da meta de 70%. ${mediumCount > 0 ? `${mediumCount} ${mediumCount === 1 ? 'rainha precisa' : 'rainhas precisam'} de atenção.` : 'Bom trabalho mantendo o engajamento!'}`,
            action: 'Ver Protocolos',
            view: 'protocols',
        })
    }

    if (milestoneToday.length > 0) {
        const names = milestoneToday.slice(0, 2).map(m => `${m.name} (${m.streak}d)`).join(', ')
        insights.push({
            id: 3, urgency: 'low',
            iconType: 'trophy',
            title: `🔥 ${milestoneToday.length} marco${milestoneToday.length > 1 ? 's' : ''} de streak hoje`,
            body: `${names}${milestoneToday.length > 2 ? ` e mais ${milestoneToday.length - 2}` : ''} atingiram marcos de streak. A IA de engajamento já celebrou automaticamente.`,
            action: 'Ver Pacientes',
            view: 'patients',
        })
    }

    if (insights.length === 0) {
        insights.push({
            id: 1, urgency: 'low',
            iconType: 'star',
            title: 'Clube saudável!',
            body: `${total} paciente${total !== 1 ? 's' : ''} cadastrada${total !== 1 ? 's' : ''}. ${criticalCount === 0 ? 'Nenhuma em risco crítico no momento.' : ''}`,
            action: 'Ver Pacientes',
            view: 'patients',
        })
    }

    return NextResponse.json({
        stats: {
            activeQueens: activePatients.length || total,
            totalPatients: total,
            adherence: avgAdherence,
            criticalAlerts: criticalCount,
            totalXP,
            activeProtocols: activeProtocols || 0,
        },
        atRisk,
        topQueens,
        insights,
        milestoneToday,
        activeProtocol: activeProtocol || null,
        methodName: tenant.method_name || '',
    })
}
