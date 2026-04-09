import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/professionals — Lista profissionais do tenant + resumo financeiro
 */
export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id, role').eq('user_id', user.id).single()
    if (!profile?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(profile.role))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: professionals } = await supabase
        .from('professionals')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('is_featured', { ascending: false })
        .order('name')

    // Resumo financeiro por profissional
    const { data: bookings } = await supabase
        .from('professional_bookings')
        .select('professional_id, status, price_cents, platform_amount, professional_amount, payout_status')
        .eq('tenant_id', profile.tenant_id)

    const financials: Record<string, any> = {}
    for (const b of bookings || []) {
        if (!financials[b.professional_id]) {
            financials[b.professional_id] = {
                total_bookings: 0, completed: 0, cancelled: 0,
                total_revenue: 0, platform_revenue: 0, professional_payout: 0,
                pending_payout: 0,
            }
        }
        const f = financials[b.professional_id]
        f.total_bookings++
        if (b.status === 'completed') {
            f.completed++
            f.total_revenue += b.price_cents
            f.platform_revenue += b.platform_amount
            f.professional_payout += b.professional_amount
            if (b.payout_status === 'pending') f.pending_payout += b.professional_amount
        }
        if (b.status.startsWith('cancelled')) f.cancelled++
    }

    return NextResponse.json({
        professionals: (professionals || []).map(p => ({
            ...p,
            price_display: `R$ ${(p.price_cents / 100).toFixed(2)}`,
            financials: financials[p.id] || {
                total_bookings: 0, completed: 0, cancelled: 0,
                total_revenue: 0, platform_revenue: 0, professional_payout: 0, pending_payout: 0,
            },
        })),
    })
}

/**
 * POST /api/admin/professionals — Cadastrar profissional
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles').select('tenant_id, role').eq('user_id', user.id).single()
    if (!profile?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(profile.role))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()

    const { data, error } = await supabase
        .from('professionals')
        .insert({
            tenant_id: profile.tenant_id,
            created_by: user.id,
            name: body.name,
            email: body.email,
            phone: body.phone,
            photo_url: body.photo_url,
            bio: body.bio,
            profession: body.profession,
            specialty: body.specialty,
            registration_id: body.registration_id,
            is_virtual: body.is_virtual ?? true,
            is_in_person: body.is_in_person ?? false,
            meeting_link: body.meeting_link,
            location_address: body.location_address,
            duration_minutes: body.duration_minutes || 60,
            price_cents: body.price_cents || 0,
            commission_pct: body.commission_pct ?? 50,
            availability: body.availability,
            is_active: body.is_active ?? true,
            is_featured: body.is_featured ?? false,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, professional: data })
}

/**
 * PATCH /api/admin/professionals — Atualizar profissional
 */
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase
        .from('professionals')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, professional: data })
}

/**
 * DELETE /api/admin/professionals?id=uuid — Desativar profissional
 */
export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Soft delete — apenas desativa
    await supabase.from('professionals').update({ is_active: false }).eq('id', id)
    return NextResponse.json({ success: true })
}
