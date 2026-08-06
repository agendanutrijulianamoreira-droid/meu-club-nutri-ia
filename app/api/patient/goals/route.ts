import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: assignments, error } = await supabase
        .from('patient_goal_assignments')
        .select('id, goal_id, title, description, emoji, goal_type, metric, target_value, unit, deadline, current_value, status, completed_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ assignments: assignments || [] })
}
