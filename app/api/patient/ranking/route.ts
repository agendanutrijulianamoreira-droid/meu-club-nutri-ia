import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()
    if (!me) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, total_xp, current_streak, current_level')
        .eq('tenant_id', me.tenant_id)
        .eq('role', 'patient')
        .order('total_xp', { ascending: false })
        .limit(50)

    const ranking = (patients || []).map((p, i) => ({ ...p, rank: i + 1 }))

    return NextResponse.json({ ranking, myUserId: user.id })
}
