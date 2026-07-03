import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/services/gamification'

// Marca/desmarca um item do protocolo do dia e credita/estorna XP.
// Antes rodava direto no client (lib/hooks/usePatientEngine.ts), chamando a
// RPC increment_user_points pelo browser — movido para o server para que toda
// escrita de XP passe por lib/services/gamification.ts.
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignment_id, protocol_item_id, mark, points } = await request.json()
    if (!assignment_id || !protocol_item_id || typeof mark !== 'boolean') {
        return NextResponse.json({ error: 'assignment_id, protocol_item_id e mark são obrigatórios' }, { status: 400 })
    }

    const { data: assignment } = await supabase
        .from('protocol_assignments')
        .select('id, user_id')
        .eq('id', assignment_id)
        .single()

    if (!assignment || assignment.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (mark) {
        const itemPoints = points ?? 10
        const todayStr = new Date().toISOString().split('T')[0]

        const { error } = await supabase
            .from('protocol_progress')
            .insert({
                assignment_id,
                protocol_item_id,
                completed_at: new Date().toISOString(),
                checkin_date: todayStr,
                points_earned: itemPoints,
            })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        await awardPoints(supabase, user.id, itemPoints, 'protocol-progress mark')
        return NextResponse.json({ success: true, points_delta: itemPoints })
    }

    const { data: existing } = await supabase
        .from('protocol_progress')
        .select('points_earned')
        .eq('assignment_id', assignment_id)
        .eq('protocol_item_id', protocol_item_id)
        .single()

    const earnedPoints = existing?.points_earned ?? points ?? 10

    const { error } = await supabase
        .from('protocol_progress')
        .delete()
        .eq('assignment_id', assignment_id)
        .eq('protocol_item_id', protocol_item_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await awardPoints(supabase, user.id, -earnedPoints, 'protocol-progress unmark')
    return NextResponse.json({ success: true, points_delta: -earnedPoints })
}
