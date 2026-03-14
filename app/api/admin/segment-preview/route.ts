import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = new URL(request.url)
    const segmentType = url.searchParams.get('type') || 'all'
    const days = parseInt(url.searchParams.get('days') || '3')

    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, last_checkin_date, current_streak')
        .eq('tenant_id', tenant.id)
        .eq('role', 'patient')

    if (!patients) return NextResponse.json({ count: 0 })

    const today = new Date()
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7)

    // Get daily logs for adherence calc
    const userIds = patients.map(p => p.user_id)
    const { data: logs } = await supabase
        .from('daily_logs')
        .select('user_id, log_date, meal_plan_check')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])

    // Get weekly checkins for risk
    const { data: checkins } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id, diet_score, ai_risk_level')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })

    const logsByUser: Record<string, number> = {}
    for (const l of logs || []) {
        if (l.meal_plan_check) logsByUser[l.user_id] = (logsByUser[l.user_id] || 0) + 1
    }
    const checkinByUser: Record<string, any> = {}
    for (const c of checkins || []) {
        if (!checkinByUser[c.user_id]) checkinByUser[c.user_id] = c
    }

    let filtered = patients

    if (segmentType === 'low_adherence') {
        filtered = patients.filter(p => {
            const daysSince = p.last_checkin_date
                ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
                : 999
            return daysSince >= days
        })
    } else if (segmentType === 'high_risk') {
        filtered = patients.filter(p => {
            const daysSince = p.last_checkin_date
                ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
                : 999
            const adherence = (logsByUser[p.user_id] || 0) / 7 * 100
            let risk = 10
            if (daysSince > 7) risk -= 4
            else if (daysSince > 3) risk -= 2
            if (!p.current_streak || p.current_streak === 0) risk -= 3
            else if (p.current_streak < 3) risk -= 1
            if (adherence < 30) risk -= 2
            else if (adherence < 60) risk -= 1
            const cl = checkinByUser[p.user_id]
            if (cl?.diet_score !== undefined && cl.diet_score < 5) risk -= 2
            if (cl?.ai_risk_level === 'high') risk = Math.min(risk, 3)
            if (cl?.ai_risk_level === 'medium') risk = Math.min(risk, 6)
            risk = Math.max(0, Math.min(10, risk))
            return risk <= 4
        })
    } else if (segmentType === 'active') {
        filtered = patients.filter(p => {
            const daysSince = p.last_checkin_date
                ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
                : 999
            return daysSince <= 3
        })
    }
    // 'all' → keep all patients

    return NextResponse.json({ count: filtered.length, total: patients.length })
}
