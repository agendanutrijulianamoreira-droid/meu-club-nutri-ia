import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { triggerOrchestrator } from '@/lib/services/anthropic'

/**
 * POST /api/trigger-agent
 * Client-side bridge to fire agent orchestrator events.
 * Authenticates user, resolves tenant, and triggers fire-and-forget.
 * 
 * Body: { type: 'meal_logged' | 'post_created' | ..., payload?: any }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { type, payload } = body

    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

    // Resolve tenant_id from profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Fire-and-forget to orchestrator
    triggerOrchestrator(type, profile.tenant_id, user.id, payload)

    return NextResponse.json({ triggered: true, type })
}
