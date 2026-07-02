import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// PATCH: update redemption status (pending → processing → completed | cancelled)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: tenant } = await supabase
        .from('tenants').select('id').eq('owner_id', user.id).single()
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { status, admin_notes } = body

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('reward_redemptions')
        .update({
            status,
            admin_notes: admin_notes || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('tenant_id', tenant.id)
        .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If cancelled, refund coins
    if (status === 'cancelled') {
        const { error: rpcErr } = await supabase.rpc('adjust_nutri_coins', {
            p_user_id: data.user_id,
            p_delta: data.item_cost,
        })
        if (rpcErr) {
            console.error('[rewards] adjust_nutri_coins failed:', rpcErr)
        }
    }

    // Notify patient via inbox
    const statusMessages: Record<string, { title: string; body: string }> = {
        processing: {
            title: '🎁 Seu resgate está sendo processado!',
            body: `${data.item_name} está em preparo. Em breve você receberá mais informações.`,
        },
        completed: {
            title: '✅ Recompensa entregue!',
            body: `${data.item_name} foi entregue com sucesso. Aproveite! 🎉`,
        },
        cancelled: {
            title: '❌ Resgate cancelado',
            body: `Seu pedido de ${data.item_name} foi cancelado. ${data.item_cost} NutriCoins foram devolvidos.`,
        },
    }

    if (statusMessages[status]) {
        const msg = statusMessages[status]
        await supabase.from('inbox_messages').insert({
            tenant_id: tenant.id,
            user_id: data.user_id,
            agent_name: 'manual',
            title: msg.title,
            body: msg.body,
            message_type: 'reward',
            priority: 'normal',
            channels: ['inbox'],
        })
    }

    return NextResponse.json({ redemption: data })
}
