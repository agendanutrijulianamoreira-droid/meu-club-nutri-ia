import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { awardPoints } from '@/lib/services/gamification'

const PROOF_TYPES = ['simple', 'camera', 'gallery'] as const
type ProofType = typeof PROOF_TYPES[number]

function saoPauloDateString() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
    return `${value.year}-${value.month}-${value.day}`
}

function parseDate(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
}

function isAllowedLocalDate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const current = parseDate(saoPauloDateString())
    const candidate = parseDate(value)
    return Math.abs(candidate - current) <= 86400000
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
        assignment_id,
        protocol_item_id,
        mark,
        proof_type = 'simple',
        photo_url = null,
        local_date,
    } = await request.json()

    if (!assignment_id || !protocol_item_id || typeof mark !== 'boolean') {
        return NextResponse.json({ error: 'assignment_id, protocol_item_id e mark são obrigatórios' }, { status: 400 })
    }
    if (!PROOF_TYPES.includes(proof_type)) {
        return NextResponse.json({ error: 'proof_type inválido' }, { status: 400 })
    }
    if (!isAllowedLocalDate(local_date)) {
        return NextResponse.json({ error: 'local_date inválida ou fora da janela permitida' }, { status: 400 })
    }

    const { data: assignment, error: assignmentError } = await supabase
        .from('protocol_assignments')
        .select('id, user_id, protocol_id')
        .eq('id', assignment_id)
        .single()

    if (assignmentError || !assignment || assignment.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: item, error: itemError } = await supabase
        .from('protocol_items')
        .select('points, points_camera, points_gallery, protocol_day_id')
        .eq('id', protocol_item_id)
        .single()

    if (itemError || !item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

    const { data: protocolDay, error: dayError } = await supabase
        .from('protocol_days')
        .select('protocol_id')
        .eq('id', item.protocol_day_id)
        .single()

    if (dayError || !protocolDay || protocolDay.protocol_id !== assignment.protocol_id) {
        return NextResponse.json({ error: 'Item não pertence ao protocolo atribuído' }, { status: 403 })
    }

    const { data: existing } = await supabase
        .from('protocol_progress')
        .select('points_earned')
        .eq('assignment_id', assignment_id)
        .eq('protocol_item_id', protocol_item_id)
        .maybeSingle()

    if (mark && existing) {
        return NextResponse.json({ success: true, points_delta: 0, already_marked: true })
    }

    if (mark) {
        const pointsByProof: Record<ProofType, number> = {
            simple: item.points ?? 10,
            gallery: item.points_gallery ?? item.points ?? 10,
            camera: item.points_camera ?? item.points ?? 10,
        }
        const itemPoints = pointsByProof[proof_type as ProofType]

        const { error } = await supabase
            .from('protocol_progress')
            .insert({
                assignment_id,
                protocol_item_id,
                completed_at: new Date().toISOString(),
                checkin_date: local_date,
                points_earned: itemPoints,
                proof_type,
                photo_url,
            })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        await awardPoints(supabase, user.id, itemPoints, 'protocol-progress mark')
        return NextResponse.json({ success: true, points_delta: itemPoints })
    }

    if (!existing) {
        return NextResponse.json({ success: true, points_delta: 0, already_unmarked: true })
    }

    const earnedPoints = existing.points_earned ?? 0

    const { error } = await supabase
        .from('protocol_progress')
        .delete()
        .eq('assignment_id', assignment_id)
        .eq('protocol_item_id', protocol_item_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (earnedPoints !== 0) {
        await awardPoints(supabase, user.id, -earnedPoints, 'protocol-progress unmark')
    }
    return NextResponse.json({ success: true, points_delta: -earnedPoints })
}
