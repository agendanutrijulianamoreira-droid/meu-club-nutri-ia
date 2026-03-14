import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, nutri_coins, name')
        .eq('user_id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const [{ data: items }, { data: myRedemptions }] = await Promise.all([
        supabase.from('reward_items')
            .select('id, name, description, cost, type, emoji, stock, delivery_info')
            .eq('tenant_id', profile.tenant_id)
            .eq('active', true)
            .order('cost', { ascending: true }),
        supabase.from('reward_redemptions')
            .select('id, item_id, item_name, item_cost, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
    ])

    // Count redemptions per item to track stock usage
    const { data: allRedemptions } = await supabase
        .from('reward_redemptions')
        .select('item_id')
        .in('item_id', (items || []).map(i => i.id))
        .neq('status', 'cancelled')

    const redeemedByItem: Record<string, number> = {}
    for (const r of allRedemptions || []) {
        if (r.item_id) redeemedByItem[r.item_id] = (redeemedByItem[r.item_id] || 0) + 1
    }

    const enrichedItems = (items || []).map(item => ({
        ...item,
        available_stock: item.stock != null ? item.stock - (redeemedByItem[item.id] || 0) : null,
        out_of_stock: item.stock != null && (item.stock - (redeemedByItem[item.id] || 0)) <= 0,
    }))

    return NextResponse.json({
        items: enrichedItems,
        myCoins: profile.nutri_coins || 0,
        myRedemptions: myRedemptions || [],
    })
}

export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, nutri_coins, name')
        .eq('user_id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { item_id } = await request.json()
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

    // Get item
    const { data: item } = await supabase.from('reward_items')
        .select('*')
        .eq('id', item_id)
        .eq('tenant_id', profile.tenant_id)
        .eq('active', true)
        .single()

    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

    // Check coins
    if ((profile.nutri_coins || 0) < item.cost) {
        return NextResponse.json({
            error: `NutriCoins insuficientes. Você tem ${profile.nutri_coins}, precisa de ${item.cost}.`
        }, { status: 400 })
    }

    // Check stock
    if (item.stock != null) {
        const { count } = await supabase.from('reward_redemptions')
            .select('*', { count: 'exact', head: true })
            .eq('item_id', item_id)
            .neq('status', 'cancelled') as any

        if ((count || 0) >= item.stock) {
            return NextResponse.json({ error: 'Item sem estoque' }, { status: 400 })
        }
    }

    // Deduct coins atomically
    const { error: coinError } = await supabase.from('profiles')
        .update({ nutri_coins: (profile.nutri_coins || 0) - item.cost })
        .eq('user_id', user.id)
        .gte('nutri_coins', item.cost)   // optimistic concurrency check

    if (coinError) {
        return NextResponse.json({ error: 'Erro ao debitar NutriCoins' }, { status: 500 })
    }

    // Create redemption
    const { data: redemption, error: redeemError } = await supabase
        .from('reward_redemptions')
        .insert({
            tenant_id: profile.tenant_id,
            user_id: user.id,
            item_id: item.id,
            item_name: item.name,
            item_cost: item.cost,
            status: 'pending',
        })
        .select().single()

    if (redeemError) {
        // Rollback coins
        await supabase.from('profiles')
            .update({ nutri_coins: profile.nutri_coins })
            .eq('user_id', user.id)
        return NextResponse.json({ error: redeemError.message }, { status: 500 })
    }

    // Notify admin via inbox (as patient notification to admin's user)
    await supabase.from('notifications').insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        title: '🎁 Novo resgate solicitado!',
        body: `${profile.name?.split(' ')[0] || 'Rainha'} resgatou: ${item.name} (${item.cost} NutriCoins)`,
        status: 'unread',
    })

    return NextResponse.json({
        redemption,
        newBalance: (profile.nutri_coins || 0) - item.cost,
    })
}
