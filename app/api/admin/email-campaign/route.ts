import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

async function sendEmailViaResend(to: string[], subject: string, html: string, fromName: string) {
    if (!RESEND_API_KEY) return { ok: false, simulated: true }

    const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(to.map(email => ({
            from: `${fromName} <${RESEND_FROM}>`,
            to: [email],
            subject,
            html,
        }))),
    })
    return { ok: res.ok, simulated: false, status: res.status }
}

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: campaigns } = await supabaseAdmin
        .from('campaigns')
        .select('id, title, body, status, sent_at, created_at, channels, segment')
        .eq('tenant_id', tenant.id)
        .contains('channels', { email: true })
        .order('created_at', { ascending: false })
        .limit(20)

    return NextResponse.json({ campaigns: campaigns || [], has_resend: !!RESEND_API_KEY })
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id, name').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await request.json()
    const { subject, html_body, segment = 'all' } = body

    if (!subject || !html_body) {
        return NextResponse.json({ error: 'Assunto e corpo são obrigatórios' }, { status: 400 })
    }

    // Resolve recipient emails by segment
    let query = supabaseAdmin
        .from('profiles')
        .select('user_id, email, name, current_plan, current_streak, last_checkin_date')
        .eq('tenant_id', tenant.id)
        .eq('role', 'patient')
        .not('email', 'is', null)

    if (segment === 'vip') {
        query = query.eq('current_plan', 'vip')
    } else if (segment === 'active') {
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        query = query.gte('last_checkin_date', threeDaysAgo.toISOString().split('T')[0])
    } else if (segment === 'inactive') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        query = query.or(`last_checkin_date.lt.${sevenDaysAgo.toISOString().split('T')[0]},last_checkin_date.is.null`)
    }

    const { data: recipients } = await query
    const emails = (recipients || []).map(r => r.email).filter(Boolean) as string[]

    if (emails.length === 0) {
        return NextResponse.json({ error: 'Nenhum destinatário encontrado para esse segmento' }, { status: 400 })
    }

    // Save campaign record
    const { data: campaign } = await supabaseAdmin.from('campaigns').insert({
        tenant_id: tenant.id,
        created_by: user.id,
        title: subject,
        body: html_body.replace(/<[^>]*>/g, '').slice(0, 200),
        channels: { email: true, push: false, inbox: false },
        segment: { type: segment },
        status: 'sending',
    }).select().single()

    // Send
    const result = await sendEmailViaResend(emails, subject, html_body, tenant.name)

    const finalStatus = result.ok || result.simulated ? 'sent' : 'failed'
    if (campaign) {
        await supabaseAdmin.from('campaigns')
            .update({ status: finalStatus, sent_at: new Date().toISOString() })
            .eq('id', campaign.id)
    }

    return NextResponse.json({
        success: finalStatus === 'sent',
        count: emails.length,
        simulated: result.simulated,
        status: finalStatus,
    })
}
