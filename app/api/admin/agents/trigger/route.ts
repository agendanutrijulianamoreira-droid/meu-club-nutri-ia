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

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
    if (!tenant) return NextResponse.json({ error: 'Not a tenant owner' }, { status: 403 })

    const { agent } = await request.json().catch(() => ({}))
    if (!agent) return NextResponse.json({ error: 'agent é obrigatório' }, { status: 400 })

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-orchestrator`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'x-cron-secret': CRON_SECRET,
            },
            body: JSON.stringify({ type: 'manual', tenant_id: tenant.id, payload: { agent } }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        console.error('[/api/admin/agents/trigger]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
