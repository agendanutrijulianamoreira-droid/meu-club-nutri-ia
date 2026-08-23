import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const PROOF_TYPES = ['simple', 'camera', 'gallery'] as const

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

function privatePhotoPath(value: unknown, userId: string, itemId: string) {
    if (typeof value !== 'string' || !value) return null
    const marker = '/protocol-photos/'
    const rawPath = value.includes(marker) ? value.split(marker).pop() || '' : value
    const path = decodeURIComponent(rawPath.split('?')[0])
    const expectedPrefix = `${userId}/${itemId}/`
    return path.startsWith(expectedPrefix) ? path : null
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

    const proofPath = proof_type === 'simple' ? null : privatePhotoPath(photo_url, user.id, protocol_item_id)
    if (mark && proof_type !== 'simple' && !proofPath) {
        return NextResponse.json({ error: 'Prova fotográfica inválida' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('apply_protocol_progress', {
        p_assignment_id: assignment_id,
        p_protocol_item_id: protocol_item_id,
        p_mark: mark,
        p_proof_type: proof_type,
        p_photo_path: proofPath,
        p_checkin_date: local_date,
    })

    if (error) {
        console.error('Falha ao aplicar progresso do protocolo:', error)
        const message = error.message || 'Não foi possível salvar o progresso'
        const status = message.includes('Forbidden') || message.includes('Unauthorized')
            ? 403
            : message.includes('Item não encontrado')
                ? 404
                : message.includes('inválid') || message.includes('fora da janela')
                    ? 400
                    : 500
        return NextResponse.json({ error: message }, { status })
    }

    const result = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
        success: true,
        points_delta: result?.points_delta ?? 0,
        already_marked: !!result?.already_marked,
        already_unmarked: !!result?.already_unmarked,
    })
}
