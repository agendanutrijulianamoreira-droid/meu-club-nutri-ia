import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function errorCode(message: string) {
    const text = message.toLowerCase()
    if (text.includes('limite de consultas futuras')) return 'limit'
    if (text.includes('autoagendamento não está habilitado')) return 'disabled'
    if (text.includes('não permite autoagendamento')) return 'type_disabled'
    if (text.includes('cadastro precisa ser vinculado')) return 'profile_link'
    if (text.includes('overlapping') || text.includes('conflicting key') || text.includes('appointments_no_overlapping_slots')) return 'conflict'
    if (text.includes('disponibilidade') || text.includes('bloqueado') || text.includes('antecedência') || text.includes('jornada') || text.includes('intervalo de início')) return 'unavailable'
    return 'booking_failed'
}

async function patientUser() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
    if (String(profile?.role || '').toLowerCase() !== 'patient') return null
    return user
}

export async function GET(request: NextRequest) {
    const user = await patientUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const admin = adminClient()
    if (!admin) return NextResponse.json({ error: 'backend_unavailable' }, { status: 500 })

    const typeId = request.nextUrl.searchParams.get('type') || ''
    const from = request.nextUrl.searchParams.get('from') || ''
    const to = request.nextUrl.searchParams.get('to') || ''
    if (!/^[0-9a-f-]{36}$/i.test(typeId) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    const { data, error } = await admin.rpc('service_patient_available_appointment_slots', {
        p_user_id: user.id,
        p_appointment_type_id: typeId,
        p_from_date: from,
        p_to_date: to,
    })
    if (error) return NextResponse.json({ error: errorCode(error.message) }, { status: 409 })
    return NextResponse.json({ slots: data || [] })
}

export async function POST(request: NextRequest) {
    const user = await patientUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const admin = adminClient()
    if (!admin) return NextResponse.json({ error: 'backend_unavailable' }, { status: 500 })

    let body: { appointment_type_id?: string; nutritionist_id?: string; local_start?: string }
    try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }) }
    const typeId = String(body.appointment_type_id || '')
    const nutritionistId = String(body.nutritionist_id || '')
    const localStart = String(body.local_start || '')
    if (!/^[0-9a-f-]{36}$/i.test(typeId) || !/^[0-9a-f-]{36}$/i.test(nutritionistId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localStart)) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    const { data, error } = await admin.rpc('service_patient_self_book_appointment', {
        p_user_id: user.id,
        p_appointment_type_id: typeId,
        p_nutritionist_id: nutritionistId,
        p_local_start: localStart,
    })
    if (error) return NextResponse.json({ error: errorCode(error.message) }, { status: 409 })
    return NextResponse.json({ success: true, appointment_id: data })
}
