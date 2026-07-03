import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { HABIT_HIT_XP } from "@/lib/gamification"
import { awardPoints } from "@/lib/services/gamification"

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [habitsRes, logsRes, tenantRes] = await Promise.all([
        supabase
            .from('habits')
            .select('id, name, emoji, description, category, icon_color')
            .eq('tenant_id', profile.tenant_id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),

        supabase
            .from('habit_logs')
            .select('id, habit_id, hit_type, photo_url, xp_awarded, created_at')
            .eq('user_id', user.id)
            .eq('log_date', new Date().toISOString().split('T')[0]),

        supabase
            .from('tenants')
            .select('habits_orientation')
            .eq('id', profile.tenant_id)
            .single(),
    ])

    const logsMap: Record<string, any> = {}
    for (const log of logsRes.data ?? []) {
        logsMap[log.habit_id] = log
    }

    return NextResponse.json({
        habits: habitsRes.data ?? [],
        logs: logsMap,
        orientation: tenantRes.data?.habits_orientation ?? null,
    })
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { habit_id, hit_type = 'simple', photo_url = null } = body

    if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 })
    if (!['simple', 'camera', 'gallery'].includes(hit_type)) {
        return NextResponse.json({ error: 'Invalid hit_type' }, { status: 400 })
    }

    // Verify habit belongs to this tenant
    const { data: habit } = await supabase
        .from('habits')
        .select('id')
        .eq('id', habit_id)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .single()
    if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

    const xp = HABIT_HIT_XP[hit_type as keyof typeof HABIT_HIT_XP]
    const today = new Date().toISOString().split('T')[0]

    // Upsert log (one per habit per day)
    const { error } = await supabase
        .from('habit_logs')
        .upsert({
            tenant_id: profile.tenant_id,
            user_id: user.id,
            habit_id,
            log_date: today,
            hit_type,
            photo_url,
            xp_awarded: xp,
        }, { onConflict: 'user_id,habit_id,log_date' })

    if (error) {
        console.error('[habits POST]', error)
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    // Award XP + NutriCoins (increment_user_points also recalculates current_level)
    await awardPoints(supabase, user.id, xp, 'habits POST')

    return NextResponse.json({ success: true, xp_awarded: xp })
}

export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { habit_id } = await request.json()
    const today = new Date().toISOString().split('T')[0]

    // Buscar XP creditado neste log antes de apagar, para estornar corretamente
    // (mesma classe de bug já corrigida em usePatientEngine.toggleCheckin: sem
    // isso dava pra marcar/desmarcar o mesmo hábito e farmar XP infinitamente)
    const { data: existing } = await supabase
        .from('habit_logs')
        .select('xp_awarded')
        .eq('user_id', user.id)
        .eq('habit_id', habit_id)
        .eq('log_date', today)
        .single()

    const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('habit_id', habit_id)
        .eq('log_date', today)

    if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

    if (existing?.xp_awarded) {
        await awardPoints(supabase, user.id, -existing.xp_awarded, 'habits DELETE')
    }

    return NextResponse.json({ success: true })
}
