import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/services/gamification'

// Metas não têm XP fixo documentado no roadmap de gamificação (CLAUDE.md
// seção 10) — usado o mesmo valor de um marco de streak intermediário como
// referência de escala.
const GOAL_COMPLETION_XP = 50

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignment_id, current_value } = await request.json()
    if (!assignment_id || typeof current_value !== 'number') {
        return NextResponse.json({ error: 'assignment_id e current_value são obrigatórios' }, { status: 400 })
    }

    const { data: assignment } = await supabase
        .from('patient_goal_assignments')
        .select('id, user_id, target_value, status')
        .eq('id', assignment_id)
        .single()

    if (!assignment || assignment.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (assignment.status !== 'active') {
        return NextResponse.json({ error: 'Meta não está ativa' }, { status: 400 })
    }

    // Metas sem valor-alvo (hábito simples, ex: "beber mais água") completam
    // no primeiro registro de progresso positivo; com valor-alvo, só ao
    // atingi-lo.
    const justCompleted = current_value > 0 &&
        (assignment.target_value == null || current_value >= assignment.target_value)

    const updates: Record<string, unknown> = { current_value }
    if (justCompleted) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
        .from('patient_goal_assignments')
        .update(updates)
        .eq('id', assignment_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (justCompleted) {
        await awardPoints(supabase, user.id, GOAL_COMPLETION_XP, 'goal-completed')
    }

    return NextResponse.json({ success: true, completed: justCompleted, points_delta: justCompleted ? GOAL_COMPLETION_XP : 0 })
}
