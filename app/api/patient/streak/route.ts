import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak, longest_streak, last_checkin_date')
        .eq('user_id', user.id)
        .single()
    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const daysParam = parseInt(new URL(request.url).searchParams.get('days') || '7')
    const numDays = Math.min(Math.max(daysParam, 1), 90)

    const days: string[] = []
    for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
    }

    const [logsRes, historyRes] = await Promise.all([
        supabase
            .from('daily_logs')
            .select('log_date')
            .eq('user_id', user.id)
            .gte('log_date', days[0]),
        supabase
            .from('historico_streak')
            .select('data, usou_grace, manteve')
            .eq('paciente_id', user.id)
            .gte('data', days[0]),
    ])

    const completedDates = new Set((logsRes.data ?? []).map((l: { log_date: string }) => l.log_date))
    const graceDates = new Set(
        (historyRes.data ?? [])
            .filter((h: { usou_grace: boolean }) => h.usou_grace)
            .map((h: { data: string }) => h.data)
    )

    const timeline = days.map(date => ({
        date,
        completed: completedDates.has(date) || graceDates.has(date),
        usedGrace: graceDates.has(date),
    }))

    return NextResponse.json({
        currentStreak: profile.current_streak ?? 0,
        longestStreak: profile.longest_streak ?? 0,
        timeline,
    })
}
