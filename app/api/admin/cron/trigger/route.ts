import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET = process.env.CRON_SECRET || ''

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify admin owns a tenant
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!tenant) return NextResponse.json({ error: 'Not a tenant owner' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const tenantOnly = body.tenant_only ?? true  // default: rodar só para o tenant do admin

    // Log início
    const { data: logRow } = await supabase
        .from('ai_cron_logs')
        .insert({
            function_name: 'daily-engagement',
            status: 'running',
            triggered_by: 'manual',
        })
        .select()
        .single()

    try {
        const payload: Record<string, any> = {}
        if (tenantOnly) payload.tenant_id = tenant.id

        // Call the edge function
        const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-engagement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'x-cron-secret': CRON_SECRET,
            },
            body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

        const totalNotifs = data.results?.reduce((acc: number, r: any) => acc + (r.notifications_sent || 0), 0) || 0

        // Update log
        if (logRow?.id) {
            await supabase.from('ai_cron_logs').update({
                status: 'success',
                tenants_processed: data.tenants_processed || 0,
                notifications_sent: totalNotifs,
                elapsed_ms: data.elapsed_ms || 0,
            }).eq('id', logRow.id)
        }

        return NextResponse.json({ success: true, data, notifications_sent: totalNotifs })

    } catch (err: any) {
        if (logRow?.id) {
            await supabase.from('ai_cron_logs').update({
                status: 'error',
                error_message: err.message,
            }).eq('id', logRow.id)
        }
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: logs } = await supabase
        .from('ai_cron_logs')
        .select('*')
        .eq('function_name', 'daily-engagement')
        .order('created_at', { ascending: false })
        .limit(20)

    return NextResponse.json({ logs: logs || [] })
}
