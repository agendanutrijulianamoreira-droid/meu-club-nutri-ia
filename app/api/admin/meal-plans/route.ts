import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/meal-plans — Lista cardápios do tenant
 * GET /api/admin/meal-plans?id=uuid — Detalhe com items
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
    const planId = url.searchParams.get('id')

    // Detalhe com items
    if (planId) {
        const { data: plan } = await supabase
            .from('meal_plans')
            .select('*')
            .eq('id', planId)
            .eq('tenant_id', profile.tenant_id)
            .single()

        if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

        const { data: items } = await supabase
            .from('meal_plan_items')
            .select('*, foods(name, category, energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g, serving_size_g, serving_label)')
            .eq('meal_plan_id', planId)
            .order('day_number')
            .order('sort_order')

        // Agrupar por dia e refeição
        const days: Record<number, Record<string, any[]>> = {}
        for (const item of items || []) {
            if (!days[item.day_number]) days[item.day_number] = {}
            if (!days[item.day_number][item.meal_type]) days[item.day_number][item.meal_type] = []
            days[item.day_number][item.meal_type].push(item)
        }

        // Calcular totais por dia
        const dayTotals: Record<number, any> = {}
        for (const [day, meals] of Object.entries(days)) {
            const allItems = Object.values(meals).flat()
            dayTotals[Number(day)] = {
                kcal: Math.round(allItems.reduce((s, i) => s + (i.calc_kcal || 0), 0)),
                protein: Math.round(allItems.reduce((s, i) => s + (i.calc_protein_g || 0), 0)),
                carbs: Math.round(allItems.reduce((s, i) => s + (i.calc_carbs_g || 0), 0)),
                fat: Math.round(allItems.reduce((s, i) => s + (i.calc_fat_g || 0), 0)),
                fiber: Math.round(allItems.reduce((s, i) => s + (i.calc_fiber_g || 0), 0)),
            }
        }

        return NextResponse.json({ plan, items: items || [], days, day_totals: dayTotals })
    }

    // Lista
    const { data: plans } = await supabase
        .from('meal_plans')
        .select('id, title, description, goal, duration_days, target_kcal, target_protein_g, status, is_ai_generated, tags, created_at')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })

    return NextResponse.json({ plans: plans || [] })
}

/**
 * PATCH /api/admin/meal-plans — Atualizar cardápio ou item
 * Body: { plan_id, updates } ou { item_id, updates }
 */
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    // Atualizar item específico
    if (body.item_id) {
        const { item_id, ...updates } = body

        // Recalcular nutrientes se quantity_g mudou e food_id existe
        if (updates.quantity_g && updates.food_id) {
            const { data: food } = await supabase
                .from('foods')
                .select('energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g')
                .eq('id', updates.food_id)
                .single()

            if (food) {
                const ratio = updates.quantity_g / 100
                updates.calc_kcal = Math.round(food.energy_kcal * ratio * 10) / 10
                updates.calc_protein_g = Math.round(food.protein_g * ratio * 10) / 10
                updates.calc_carbs_g = Math.round(food.carbs_g * ratio * 10) / 10
                updates.calc_fat_g = Math.round(food.total_fat_g * ratio * 10) / 10
                updates.calc_fiber_g = Math.round(food.fiber_g * ratio * 10) / 10
            }
        }

        const { data, error } = await supabase
            .from('meal_plan_items')
            .update(updates)
            .eq('id', item_id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, item: data })
    }

    // Atualizar plano
    if (body.plan_id) {
        const { plan_id, ...updates } = body
        const { data, error } = await supabase
            .from('meal_plans')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', plan_id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, plan: data })
    }

    return NextResponse.json({ error: 'plan_id or item_id required' }, { status: 400 })
}

/**
 * POST /api/admin/meal-plans — Adicionar item a um cardápio existente
 * Body: { meal_plan_id, day_number, meal_type, food_id, quantity_g, ... }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { meal_plan_id, day_number, meal_type, food_id, food_name, quantity_g, serving_qty, serving_label, preparation_notes, substitution_note } = body

    if (!meal_plan_id || !day_number || !meal_type || !food_name) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calcular nutrientes a partir do food_id
    let calcData: any = {}
    if (food_id && quantity_g) {
        const { data: food } = await supabase
            .from('foods')
            .select('energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g')
            .eq('id', food_id)
            .single()

        if (food) {
            const ratio = quantity_g / 100
            calcData = {
                calc_kcal: Math.round(food.energy_kcal * ratio * 10) / 10,
                calc_protein_g: Math.round(food.protein_g * ratio * 10) / 10,
                calc_carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
                calc_fat_g: Math.round(food.total_fat_g * ratio * 10) / 10,
                calc_fiber_g: Math.round(food.fiber_g * ratio * 10) / 10,
            }
        }
    }

    // Pegar sort_order
    const { count } = await supabase
        .from('meal_plan_items')
        .select('*', { count: 'exact', head: true })
        .eq('meal_plan_id', meal_plan_id)
        .eq('day_number', day_number)
        .eq('meal_type', meal_type)

    const { data, error } = await supabase
        .from('meal_plan_items')
        .insert({
            meal_plan_id,
            day_number,
            meal_type,
            food_id,
            food_name,
            quantity_g,
            serving_qty,
            serving_label,
            preparation_notes,
            substitution_note,
            sort_order: (count || 0),
            ...calcData,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, item: data })
}

/**
 * DELETE /api/admin/meal-plans?item_id=uuid — Remover item
 * DELETE /api/admin/meal-plans?plan_id=uuid — Remover cardápio inteiro
 */
export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const itemId = url.searchParams.get('item_id')
    const planId = url.searchParams.get('plan_id')

    if (itemId) {
        await supabase.from('meal_plan_items').delete().eq('id', itemId)
        return NextResponse.json({ success: true })
    }

    if (planId) {
        await supabase.from('meal_plans').delete().eq('id', planId)
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'item_id or plan_id required' }, { status: 400 })
}
