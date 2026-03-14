import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
    const { data } = await supabase
        .from('tenants').select('id').eq('owner_id', userId).single()
    return data
}

// GET: list items + redemptions stats
export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [{ data: items }, { data: redemptions }] = await Promise.all([
        supabase.from('reward_items')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('cost', { ascending: true }),
        supabase.from('reward_redemptions')
            .select('*, profiles(name)')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(100),
    ])

    // Redemption counts per item
    const countByItem: Record<string, number> = {}
    for (const r of redemptions || []) {
        if (r.item_id) countByItem[r.item_id] = (countByItem[r.item_id] || 0) + 1
    }

    const enrichedItems = (items || []).map(item => ({
        ...item,
        redemption_count: countByItem[item.id] || 0,
    }))

    const enrichedRedemptions = (redemptions || []).map(r => ({
        ...r,
        user_name: r.profiles?.name || 'Rainha',
        user_initials: (r.profiles?.name || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
    }))

    return NextResponse.json({ items: enrichedItems, redemptions: enrichedRedemptions })
}

// POST: create item
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, description, cost, type, emoji, stock, delivery_info } = body

    if (!name?.trim() || !cost || cost < 1) {
        return NextResponse.json({ error: 'Nome e custo são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase.from('reward_items').insert({
        tenant_id: tenant.id,
        name: name.trim(),
        description: description?.trim() || null,
        cost: Number(cost),
        type: type || 'digital',
        emoji: emoji || '🎁',
        stock: stock ? Number(stock) : null,
        delivery_info: delivery_info?.trim() || null,
        active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
}

// PATCH: update item
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase.from('reward_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
}

// DELETE: deactivate item
export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await request.json()
    await supabase.from('reward_items')
        .update({ active: false })
        .eq('id', id).eq('tenant_id', tenant.id)

    return NextResponse.json({ deleted: true })
}
