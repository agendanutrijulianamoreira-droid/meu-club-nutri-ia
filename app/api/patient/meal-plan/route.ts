import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/patient/meal-plan
 * Retorna o cardápio atribuído à paciente logada.
 * Agrupa itens por dia → refeição (com horário do template).
 */

const SLOT_TIMES: Record<string, string> = {
  shot:          '06:30',
  cafe_manha:    '08:30',
  colacao:       '10:00',
  lanche_manha:  '10:00',
  almoco:        '12:00',
  lanche_tarde:  '16:00',
  jantar:        '19:30',
  ceia:          '21:00',
  cha_noturno:   '22:00',
}

const SLOT_EMOJI: Record<string, string> = {
  shot:          '🧪',
  cafe_manha:    '☀️',
  colacao:       '🍎',
  lanche_manha:  '🍎',
  almoco:        '🍽️',
  lanche_tarde:  '🥤',
  jantar:        '🌙',
  ceia:          '😴',
  cha_noturno:   '🍵',
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Busca o assignment ativo mais recente
  const { data: assignment } = await supabase
    .from('meal_plan_assignments')
    .select(`
      id,
      assigned_at,
      meal_plan:meal_plans (
        id, title, description, goal, duration_days,
        target_kcal, target_protein_g, target_carbs_g, target_fat_g,
        status, is_ai_generated
      )
    `)
    .eq('user_id', user.id)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single()

  if (!assignment || !assignment.meal_plan) {
    return NextResponse.json({ plan: null })
  }

  const plan = assignment.meal_plan as any

  // Busca todos os itens do plano, ordenados
  const { data: items } = await supabase
    .from('meal_plan_items')
    .select(
      'id, day_number, meal_type, meal_label, sort_order, food_name, quantity_g, ' +
      'serving_qty, serving_label, calc_kcal, calc_protein_g, calc_carbs_g, ' +
      'calc_fat_g, calc_fiber_g, preparation_notes, substitution_note'
    )
    .eq('meal_plan_id', plan.id)
    .order('day_number')
    .order('sort_order')

  if (!items || items.length === 0) {
    return NextResponse.json({ plan: { ...plan, days: [] } })
  }

  // Agrupa por dia → meal_type
  const daysMap: Record<number, any> = {}

  for (const item of items) {
    const dn = item.day_number
    if (!daysMap[dn]) daysMap[dn] = { day_number: dn, meals: {} }

    const mt = item.meal_type
    if (!daysMap[dn].meals[mt]) {
      daysMap[dn].meals[mt] = {
        meal_type:  mt,
        meal_label: item.meal_label || mt,
        time:       SLOT_TIMES[mt] || null,
        emoji:      SLOT_EMOJI[mt] || '🍽️',
        items:      [],
      }
    }
    daysMap[dn].meals[mt].items.push(item)
  }

  // Ordena dias e refeições (por horário)
  const slotOrder = Object.keys(SLOT_TIMES)
  const days = Object.values(daysMap)
    .sort((a, b) => a.day_number - b.day_number)
    .map(day => {
      const meals = Object.values(day.meals)
        .sort((a: any, b: any) => {
          const ai = slotOrder.indexOf(a.meal_type)
          const bi = slotOrder.indexOf(b.meal_type)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })

      // Totais do dia
      const allItems = meals.flatMap((m: any) => m.items)
      const day_total_kcal    = Math.round(allItems.reduce((s: number, i: any) => s + (i.calc_kcal || 0), 0))
      const day_total_protein = Math.round(allItems.reduce((s: number, i: any) => s + (i.calc_protein_g || 0), 0) * 10) / 10

      return { day_number: day.day_number, meals, day_total_kcal, day_total_protein }
    })

  return NextResponse.json({
    plan: {
      ...plan,
      assigned_at: assignment.assigned_at,
      days,
    },
  })
}
