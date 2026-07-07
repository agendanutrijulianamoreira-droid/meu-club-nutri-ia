import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendPushNotification, sendPushToUser } from '@/lib/onesignal'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Segment = 'all' | 'active' | 'inactive' | 'specific'

interface PushRequestBody {
    title: string
    message: string
    segment: Segment
    userIds?: string[]
    url?: string
}

export async function POST(request: NextRequest) {
    // --- Auth check ---
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .single()

    const roleLower = (profile?.role || '').toLowerCase()
    const metadataRole = (user.user_metadata?.user_type || user.user_metadata?.role || '').toLowerCase()
    const isAuthorized = ['admin', 'nutritionist', 'nutri'].includes(roleLower) || ['admin', 'nutritionist', 'nutri'].includes(metadataRole)

    if (!profile?.tenant_id || !isAuthorized) {
        return NextResponse.json({ error: 'Acesso negado. Somente nutricionistas e admins.' }, { status: 403 })
    }

    const tenantId = profile.tenant_id

    // --- Parse body ---
    let body: PushRequestBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { title, message, segment, userIds, url } = body

    if (!title || !message || !segment) {
        return NextResponse.json({ error: 'title, message, and segment are required' }, { status: 400 })
    }

    if (segment === 'specific' && (!userIds || userIds.length === 0)) {
        return NextResponse.json({ error: 'userIds required for specific segment' }, { status: 400 })
    }

    // --- Resolve target user IDs ---
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    let targetUserIds: string[] = []

    try {
        if (segment === 'all') {
            const { data: patients } = await adminSupabase
                .from('profiles')
                .select('user_id')
                .eq('tenant_id', tenantId)
                .eq('role', 'patient')

            targetUserIds = patients?.map(p => p.user_id) || []

        } else if (segment === 'active') {
            // Patients with current_streak > 0
            const { data: patients } = await adminSupabase
                .from('profiles')
                .select('user_id')
                .eq('tenant_id', tenantId)
                .eq('role', 'patient')
                .gt('current_streak', 0)

            targetUserIds = patients?.map(p => p.user_id) || []

        } else if (segment === 'inactive') {
            // Patients whose last_checkin_date is older than 3 days (or null)
            const threeDaysAgo = new Date()
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
            const cutoff = threeDaysAgo.toISOString()

            const { data: patients } = await adminSupabase
                .from('profiles')
                .select('user_id, last_checkin_date')
                .eq('tenant_id', tenantId)
                .eq('role', 'patient')

            targetUserIds = (patients || [])
                .filter(p => !p.last_checkin_date || p.last_checkin_date < cutoff)
                .map(p => p.user_id)

        } else if (segment === 'specific') {
            // Verify that the requested userIds belong to this tenant and are patients
            const { data: patients } = await adminSupabase
                .from('profiles')
                .select('user_id')
                .in('user_id', userIds!)
                .eq('tenant_id', tenantId)
                .eq('role', 'patient')

            targetUserIds = patients?.map(p => p.user_id) || []
        }

        if (targetUserIds.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                message: 'Nenhum destinatario encontrado para o segmento selecionado.',
            })
        }

        // --- Send push notifications via OneSignal ---
        // Send to each user by their external_user_id (our auth user_id)
        const pushResults = await Promise.allSettled(
            targetUserIds.map(uid =>
                sendPushToUser({
                    externalUserId: uid,
                    title,
                    message,
                    url,
                    data: { segment, sent_by: user.id },
                })
            )
        )

        const successCount = pushResults.filter(
            r => r.status === 'fulfilled' && r.value.success
        ).length

        const failCount = pushResults.length - successCount

        if (failCount > 0) {
            console.error(`[Push API] ${failCount}/${pushResults.length} push sends failed`)
        }

        // --- Save to inbox for in-app fallback ---
        const inboxRecords = targetUserIds.map(uid => ({
            tenant_id: tenantId,
            user_id: uid,
            agent_name: 'manual',
            title,
            body: message,
            message_type: 'engagement',
            priority: 'normal',
            cta_url: url || null,
            channels: ['inbox', 'push'],
        }))

        const { error: insertError } = await adminSupabase
            .from('inbox_messages')
            .insert(inboxRecords)

        if (insertError) {
            console.error('[Push API] Error saving to inbox_messages table:', insertError)
        }

        return NextResponse.json({
            success: true,
            count: targetUserIds.length,
            pushSent: successCount,
            pushFailed: failCount,
        })
    } catch (err: any) {
        console.error('[Push API] Internal error:', err)
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    }
}
