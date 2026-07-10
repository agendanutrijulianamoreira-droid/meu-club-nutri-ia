import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/services/gamification'

const PROOF_TYPES = ['simple', 'camera', 'gallery'] as const
type ProofType = typeof PROOF_TYPES[number]

// Marca/desmarca um item do protocolo do dia e credita/estorna XP.
// Antes rodava direto no client (lib/hooks/usePatientEngine.ts), chamando a
// RPC increment_user_points pelo browser — movido para o server para que toda
// escrita de XP passe por lib/services/gamification.ts.
//
// Fase 4 do roadmap: pontuação por proof_type é resolvida aqui a partir do
// próprio protocol_item, nunca a partir do "points" enviado pelo client —
// antes disso era possível inflar XP mandando qualquer valor no body.
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignment_id, protocol_item_id, mark, proof_type = 'simple', photo_url = null } = await request.json()
    if (!assignment_id || !protocol_item_id || typeof mark !== 'boolean') {
        return NextResponse.json({ error: 'assignment_id, protocol_item_id e mark são obrigatórios' }, { status: 400 })
    }
    if (!PROOF_TYPES.includes(proof_type)) {
        return NextResponse.json({ error: 'proof_type inválido' }, { status: 400 })
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
        const { data: item } = await supabase
            .from('protocol_items')
            .select('points, points_camera, points_gallery')
            .eq('id', protocol_item_id)
            .single()
        if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

        const pointsByProof: Record<ProofType, number> = {
            simple: item.points ?? 10,
            gallery: item.points_gallery ?? item.points ?? 10,
            camera: item.points_camera ?? item.points ?? 10,
        }
        const itemPoints = pointsByProof[proof_type as ProofType]
        const todayStr = new Date().toISOString().split('T')[0]

        const { error } = await supabase
            .from('protocol_progress')
            .insert({
                assignment_id,
                protocol_item_id,
                completed_at: new Date().toISOString(),
                checkin_date: todayStr,
                points_earned: itemPoints,
                proof_type,
                photo_url,
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

    const earnedPoints = existing?.points_earned ?? 10

    const { error } = await supabase
        .from('protocol_progress')
        .delete()
        .eq('assignment_id', assignment_id)
        .eq('protocol_item_id', protocol_item_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await awardPoints(supabase, user.id, -earnedPoints, 'protocol-progress unmark')
    return NextResponse.json({ success: true, points_delta: -earnedPoints })
}
