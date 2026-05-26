export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function escapeCsvValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // If the value contains commas, quotes, or newlines, wrap in quotes and escape inner quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export async function GET() {
    try {
        const supabase = createSupabaseServerClient(cookies())

        // 1. Authenticate user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Verify tenant ownership
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (!tenant) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 3. Query all patients for this tenant with stats and subscription data
        const { data: patients, error: patientsError } = await supabase
            .from('profiles')
            .select(`
                name,
                email,
                phone,
                current_plan,
                total_xp,
                current_level,
                current_streak,
                current_weight,
                primary_goal,
                last_checkin_date,
                created_at,
                user_stats (
                    total_points,
                    current_streak,
                    last_checkin_date
                ),
                subscriptions (
                    plan,
                    status
                )
            `)
            .eq('tenant_id', tenant.id)
            .eq('role', 'patient')
            .order('created_at', { ascending: false })

        if (patientsError) {
            console.error('Export patients error:', patientsError)
            return NextResponse.json({ error: 'Erro ao buscar pacientes' }, { status: 500 })
        }

        // 4. Build CSV
        const headers = [
            'Name',
            'Email',
            'Phone',
            'Plan',
            'Status',
            'XP',
            'Level',
            'Streak',
            'Current Weight',
            'Primary Goal',
            'Last Checkin Date',
            'Joined At'
        ]

        const rows = (patients || []).map((p: any) => {
            const subscription = Array.isArray(p.subscriptions)
                ? p.subscriptions[0]
                : p.subscriptions
            const stats = Array.isArray(p.user_stats)
                ? p.user_stats[0]
                : p.user_stats

            const plan = subscription?.plan || p.current_plan || ''
            const status = subscription?.status || 'active'
            const xp = p.total_xp ?? stats?.total_points ?? 0
            const level = p.current_level ?? 1
            const streak = p.current_streak ?? stats?.current_streak ?? 0
            const lastCheckin = p.last_checkin_date || stats?.last_checkin_date || ''
            const joinedAt = p.created_at
                ? new Date(p.created_at).toISOString().split('T')[0]
                : ''

            return [
                escapeCsvValue(p.name),
                escapeCsvValue(p.email),
                escapeCsvValue(p.phone),
                escapeCsvValue(plan),
                escapeCsvValue(status),
                escapeCsvValue(xp),
                escapeCsvValue(level),
                escapeCsvValue(streak),
                escapeCsvValue(p.current_weight),
                escapeCsvValue(p.primary_goal),
                escapeCsvValue(lastCheckin),
                escapeCsvValue(joinedAt)
            ].join(',')
        })

        const csvContent = [headers.join(','), ...rows].join('\r\n')

        // 5. Return CSV with proper headers
        const today = new Date().toISOString().split('T')[0]
        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="pacientes-export-${today}.csv"`,
            },
        })
    } catch (error: any) {
        console.error('Export error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
