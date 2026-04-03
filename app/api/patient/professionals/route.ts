import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { triggerOrchestrator } from '@/lib/services/anthropic'

/**
 * GET /api/patient/professionals — Lista profissionais disponíveis para o paciente
 * GET /api/patient/professionals?id=uuid — Detalhes de um profissional
 * GET /api/patient/professionals?my_bookings=true — Minhas consultas
 */
export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id').eq('user_id', user.id).single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const url = new URL(request.url)
    const profId = url.searchParams.get('id')
    const myBookings = url.searchParams.get('my_bookings') === 'true'
    const profession = url.searchParams.get('profession')

    // Minhas consultas
    if (myBookings) {
        const { data } = await supabase
            .from('professional_bookings')
            .select('*, professional:professionals(name, profession, specialty, photo_url, meeting_link)')
            .eq('patient_id', user.id)
            .order('scheduled_at', { ascending: false })

        return NextResponse.json({ bookings: data || [] })
    }

    // Detalhes de um profissional + slots disponíveis
    if (profId) {
        const { data: prof } = await supabase
            .from('professionals')
            .select('id, name, photo_url, bio, profession, specialty, registration_id, is_virtual, is_in_person, duration_minutes, price_cents, availability, rating, total_sessions, is_featured')
            .eq('id', profId)
            .eq('is_active', true)
            .eq('tenant_id', profile.tenant_id)
            .single()

        if (!prof) return NextResponse.json({ error: 'Professional not found' }, { status: 404 })

        // Buscar bookings dos próximos 14 dias para calcular slots ocupados
        const now = new Date()
        const twoWeeksLater = new Date(now.getTime() + 14 * 86400000)
        const { data: existingBookings } = await supabase
            .from('professional_bookings')
            .select('scheduled_at, duration_minutes')
            .eq('professional_id', profId)
            .in('status', ['pending', 'confirmed'])
            .gte('scheduled_at', now.toISOString())
            .lte('scheduled_at', twoWeeksLater.toISOString())

        const bookedSlots = (existingBookings || []).map(b => b.scheduled_at)

        return NextResponse.json({
            professional: {
                ...prof,
                price_display: `R$ ${(prof.price_cents / 100).toFixed(2)}`,
            },
            booked_slots: bookedSlots,
        })
    }

    // Lista de profissionais ativos
    let query = supabase
        .from('professionals')
        .select('id, name, photo_url, bio, profession, specialty, is_virtual, is_in_person, price_cents, rating, total_sessions, is_featured, duration_minutes')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })

    if (profession) query = query.eq('profession', profession)

    const { data } = await query

    return NextResponse.json({
        professionals: (data || []).map(p => ({
            ...p,
            price_display: `R$ ${(p.price_cents / 100).toFixed(2)}`,
        })),
    })
}

/**
 * POST /api/patient/professionals — Agendar consulta com profissional
 * Body: { professional_id, scheduled_at, patient_notes?, payment_method? }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id, name').eq('user_id', user.id).single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const { professional_id, scheduled_at, patient_notes, payment_method } = body

    if (!professional_id || !scheduled_at) {
        return NextResponse.json({ error: 'professional_id and scheduled_at required' }, { status: 400 })
    }

    // Buscar profissional
    const { data: prof } = await supabase
        .from('professionals')
        .select('id, name, price_cents, commission_pct, duration_minutes, meeting_link, is_virtual')
        .eq('id', professional_id)
        .eq('is_active', true)
        .single()

    if (!prof) return NextResponse.json({ error: 'Professional not found' }, { status: 404 })

    // Verificar se slot está disponível
    const { data: conflict } = await supabase
        .from('professional_bookings')
        .select('id')
        .eq('professional_id', professional_id)
        .eq('scheduled_at', scheduled_at)
        .in('status', ['pending', 'confirmed'])
        .limit(1)

    if (conflict && conflict.length > 0) {
        return NextResponse.json({ error: 'Horário já reservado. Escolha outro.' }, { status: 409 })
    }

    // Criar booking (trigger calcula split automaticamente)
    const { data: booking, error } = await supabase
        .from('professional_bookings')
        .insert({
            tenant_id: profile.tenant_id,
            professional_id,
            patient_id: user.id,
            scheduled_at,
            duration_minutes: prof.duration_minutes,
            is_virtual: prof.is_virtual,
            meeting_link: prof.meeting_link,
            price_cents: prof.price_cents,
            commission_pct: prof.commission_pct,
            payment_method: payment_method || 'pending',
            patient_notes,
            status: 'pending',
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notificar paciente no inbox
    const scheduledDate = new Date(scheduled_at)
    const dateStr = scheduledDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

    await supabase.from('inbox_messages').insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        agent_name: 'manual',
        title: `Sessão agendada com ${prof.name}`,
        body: `Sua consulta está marcada para ${dateStr} às ${timeStr}. Valor: R$ ${(prof.price_cents / 100).toFixed(2)}. Aguardando confirmação do profissional.`,
        message_type: 'alert',
        priority: 'high',
        cta_label: 'Ver minhas consultas',
        cta_url: '/patient/professionals',
        channels: ['inbox', 'push'],
    })

    return NextResponse.json({
        success: true,
        booking,
        split: {
            total: `R$ ${(booking.price_cents / 100).toFixed(2)}`,
            platform: `R$ ${(booking.platform_amount / 100).toFixed(2)}`,
            professional: `R$ ${(booking.professional_amount / 100).toFixed(2)}`,
            commission: `${booking.commission_pct}%`,
        },
    })
}

/**
 * PATCH /api/patient/professionals — Cancelar booking ou avaliar
 * Body: { booking_id, action: 'cancel' | 'rate', rating?, review_text? }
 */
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { booking_id, action, rating, review_text, cancellation_reason } = body

    if (!booking_id || !action) return NextResponse.json({ error: 'booking_id and action required' }, { status: 400 })

    if (action === 'cancel') {
        const { data, error } = await supabase
            .from('professional_bookings')
            .update({
                status: 'cancelled_patient',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: cancellation_reason || 'Cancelado pelo paciente',
            })
            .eq('id', booking_id)
            .eq('patient_id', user.id)
            .in('status', ['pending', 'confirmed'])
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, booking: data })
    }

    if (action === 'rate') {
        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating 1-5 required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('professional_bookings')
            .update({ rating, review_text, rated_at: new Date().toISOString() })
            .eq('id', booking_id)
            .eq('patient_id', user.id)
            .eq('status', 'completed')
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, booking: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
