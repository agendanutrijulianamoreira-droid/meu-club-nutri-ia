import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { triggerOrchestrator } from '@/lib/services/anthropic'

const CLIENT_EVENTS = new Set([
    'checkin_submitted',
    'meal_logged',
    'post_created',
    'chat_message',
    'photo_submitted',
])

const MAX_PAYLOAD_BYTES = 50_000

/**
 * Client bridge for low-privilege user events only.
 * Privileged events (manual, cron_daily, stripe_webhook) must be emitted by
 * trusted server-side flows, never selected by a browser request.
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const type = typeof body.type === 'string' ? body.type : ''
    const payload = body.payload == null ? {} : body.payload

    if (!CLIENT_EVENTS.has(type)) {
        return NextResponse.json({ error: 'Event type not allowed' }, { status: 400 })
    }

    if (typeof payload !== 'object' || Array.isArray(payload)) {
        return NextResponse.json({ error: 'payload must be an object' }, { status: 400 })
    }

    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (profileError || !profile?.tenant_id) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Client events represent the current user only; user_id and tenant_id are
    // derived server-side and cannot be overridden by payload.
    triggerOrchestrator(type, profile.tenant_id, user.id, payload)

    return NextResponse.json({ triggered: true, type })
}
