import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/meal-plans/[id]/duplicate
 *
 * Duplica um cardápio (e todos os meal_plan_items) sem nenhuma chamada de IA —
 * o objetivo é reaproveitar um modelo pronto (ex: "Cardápio Fase 1") para uma
 * paciente nova em vez de gerar tudo de novo pelo Gemini a cada vez.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sourcePlan, error: sourceError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (sourceError || !sourcePlan) {
    return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 })
  }

  const { data: newPlan, error: newPlanError } = await supabase
    .from('meal_plans')
    .insert({
      tenant_id: tenant.id,
      created_by: user.id,
      title: `Cópia de ${sourcePlan.title}`,
      description: sourcePlan.description,
      goal: sourcePlan.goal,
      duration_days: sourcePlan.duration_days,
      target_kcal: sourcePlan.target_kcal,
      target_protein_g: sourcePlan.target_protein_g,
      target_carbs_g: sourcePlan.target_carbs_g,
      target_fat_g: sourcePlan.target_fat_g,
      target_fiber_g: sourcePlan.target_fiber_g,
      status: 'draft',
      is_ai_generated: false,
      plan_mode: sourcePlan.plan_mode,
      tags: sourcePlan.tags,
    })
    .select('id')
    .single()

  if (newPlanError || !newPlan) {
    return NextResponse.json({ error: newPlanError?.message || 'Erro ao criar cópia' }, { status: 500 })
  }

  const { data: sourceItems, error: itemsError } = await supabase
    .from('meal_plan_items')
    .select('*')
    .eq('meal_plan_id', params.id)
    .order('day_number')
    .order('sort_order')

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  if (sourceItems && sourceItems.length > 0) {
    const newItems = sourceItems.map(item => ({
      meal_plan_id: newPlan.id,
      day_number: item.day_number,
      meal_type: item.meal_type,
      meal_label: item.meal_label,
      sort_order: item.sort_order,
      food_id: item.food_id,
      food_name: item.food_name,
      quantity_g: item.quantity_g,
      serving_qty: item.serving_qty,
      serving_label: item.serving_label,
      calc_kcal: item.calc_kcal,
      calc_protein_g: item.calc_protein_g,
      calc_carbs_g: item.calc_carbs_g,
      calc_fat_g: item.calc_fat_g,
      calc_fiber_g: item.calc_fiber_g,
      preparation_notes: item.preparation_notes,
      substitution_note: item.substitution_note,
    }))

    const { error: insertItemsError } = await supabase.from('meal_plan_items').insert(newItems)
    if (insertItemsError) {
      return NextResponse.json({ error: insertItemsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, plan_id: newPlan.id, items_copied: sourceItems?.length || 0 })
}
