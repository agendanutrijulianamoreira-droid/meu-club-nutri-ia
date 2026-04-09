import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/appointments — Lista consultas
 * GET /api/admin/appointments?patient_id=uuid — Consultas de uma paciente
 */
export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const url = new URL(request.url)
    const patientId = url.searchParams.get('patient_id')
    const status = url.searchParams.get('status') // 'scheduled', 'confirmed', 'completed', etc
    const upcoming = url.searchParams.get('upcoming') === 'true'

    let query = supabase
        .from('appointments')
        .select(`
            *,
            patient:profiles!patient_id(name, user_id, primary_goal),
            nutritionist:nutritionists!nutritionist_id(name)
        `)
        .eq('tenant_id', profile.tenant_id)

    if (patientId) query = query.eq('patient_id', patientId)
    if (status) query = query.eq('status', status)
    if (upcoming) query = query.gte('scheduled_at', new Date().toISOString()).in('status', ['scheduled', 'confirmed'])

    query = query.order('scheduled_at', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ appointments: data || [] })
}

/**
 * POST /api/admin/appointments — Agendar consulta
 * Body: {
 *   patient_id, scheduled_at, duration_minutes,
 *   appointment_type, is_virtual, meeting_link, notes,
 *   sync_google_calendar?: boolean
 * }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .single()

    if (!profile?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
        patient_id,
        scheduled_at,
        duration_minutes = 60,
        appointment_type = 'consultation',
        is_virtual = true,
        meeting_link,
        location_address,
        notes,
        sync_google_calendar = false,
    } = body

    if (!patient_id || !scheduled_at) {
        return NextResponse.json({ error: 'patient_id and scheduled_at are required' }, { status: 400 })
    }

    // Buscar nutricionista
    const { data: nutritionist } = await supabase
        .from('nutritionists')
        .select('id, name, email')
        .eq('tenant_id', profile.tenant_id)
        .limit(1)
        .single()

    if (!nutritionist) {
        return NextResponse.json({ error: 'Nutritionist not found' }, { status: 404 })
    }

    // Buscar paciente
    const { data: patient } = await supabase
        .from('profiles')
        .select('name, user_id')
        .eq('user_id', patient_id)
        .single()

    // Criar consulta
    const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
            nutritionist_id: nutritionist.id,
            patient_id,
            tenant_id: profile.tenant_id,
            scheduled_at,
            duration_minutes,
            appointment_type,
            is_virtual,
            meeting_link,
            location_address,
            notes,
            status: 'scheduled',
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notificar paciente via inbox
    const scheduledDate = new Date(scheduled_at)
    const dateStr = scheduledDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    const typeLabels: Record<string, string> = {
        consultation: 'Consulta',
        followup: 'Retorno',
        initial_assessment: 'Avaliação inicial',
        group_session: 'Sessão em grupo',
    }

    await supabase.from('inbox_messages').insert({
        tenant_id: profile.tenant_id,
        user_id: patient_id,
        agent_name: 'manual',
        title: `📅 ${typeLabels[appointment_type] || 'Consulta'} agendada!`,
        body: `Sua ${typeLabels[appointment_type]?.toLowerCase() || 'consulta'} está marcada para ${dateStr} às ${timeStr}.${is_virtual && meeting_link ? ` Link: ${meeting_link}` : ''}`,
        message_type: 'alert',
        priority: 'high',
        cta_label: 'Ver detalhes',
        cta_url: '/patient/home',
        channels: ['inbox', 'push'],
    })

    // Preparar dados para Google Calendar (retorna ao frontend para sync)
    const gcalEvent = sync_google_calendar ? {
        summary: `${typeLabels[appointment_type] || 'Consulta'} — ${patient?.name || 'Paciente'}`,
        description: `${typeLabels[appointment_type]} com ${nutritionist.name}\n${notes || ''}\n\nAgendado via VitaClub`,
        start: {
            dateTime: scheduled_at,
            timeZone: 'America/Sao_Paulo',
        },
        end: {
            dateTime: new Date(scheduledDate.getTime() + duration_minutes * 60000).toISOString(),
            timeZone: 'America/Sao_Paulo',
        },
        location: is_virtual ? meeting_link : location_address,
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 30 },
                { method: 'email', minutes: 1440 }, // 24h antes
            ],
        },
    } : null

    return NextResponse.json({
        success: true,
        appointment,
        gcal_event: gcalEvent, // Frontend pode usar isto para chamar Google Calendar API
    })
}

/**
 * PATCH /api/admin/appointments — Atualizar status de consulta
 * Body: { appointment_id, status, notes?, cancellation_reason? }
 */
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { appointment_id, ...updates } = body

    if (!appointment_id) return NextResponse.json({ error: 'appointment_id required' }, { status: 400 })

    // Adicionar timestamps automáticos
    if (updates.status === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (updates.status === 'completed') updates.completed_at = new Date().toISOString()
    if (updates.status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString()
        updates.cancelled_by = user.id
    }

    const { data, error } = await supabase
        .from('appointments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', appointment_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Se cancelou, notificar paciente
    if (updates.status === 'cancelled') {
        await supabase.from('inbox_messages').insert({
            tenant_id: data.tenant_id,
            user_id: data.patient_id,
            agent_name: 'manual',
            title: 'Consulta cancelada',
            body: `Sua consulta foi cancelada.${updates.cancellation_reason ? ` Motivo: ${updates.cancellation_reason}` : ''} Entre em contato para reagendar.`,
            message_type: 'alert',
            priority: 'high',
            channels: ['inbox', 'push'],
        })
    }

    return NextResponse.json({ success: true, appointment: data })
}
