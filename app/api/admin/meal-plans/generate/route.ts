import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import {
  buildCompactCatalog,
  expandSelections,
  FoodRow,
  AILeanOutput,
} from '@/lib/meal-plan-template'
import {
  getMealPlanSystemPrompt,
  getMealPlanUserPrompt,
} from '@/lib/meal-plan-skill'

/**
 * POST /api/admin/meal-plans/generate
 *
 * Gera cardápio usando template fixo de horários + alimentos reais TACO/TBCA.
 * ARQUITETURA template + skill:
 *   → IA só devolve {food_id, quantity_g} por slot (~75% menos tokens, 7 dias sem truncar)
 *   → Template calcula macros, labels e estrutura completa localmente
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
    goal             = 'manutenção',
    duration_days    = 7,
    target_kcal      = 1800,
    target_protein_g = 90,
    restrictions     = [],
    preferences      = '',
    patient_id,
    fase_reino,      // opcional — se não informado, busca da fase_paciente do BD
  } = body

  try {
    // 1. Carregar alimentos da base
    const { data: foods } = await supabase
      .from('foods')
      .select('id, name, category, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, serving_size_g, serving_label')
      .eq('is_active', true)
      .order('category')

    if (!foods || foods.length === 0) {
      return NextResponse.json(
        { error: 'Base de alimentos vazia. Execute a migration 20260321_foods_meal_plans.sql primeiro.' },
        { status: 400 }
      )
    }

    // Mapa id → food para lookup rápido
    const foodsById: Record<string, FoodRow> = {}
    for (const f of foods) foodsById[f.id] = f as FoodRow

    // 2. Contexto da paciente
    let patientName: string | undefined
    let patientWeight: number | undefined
    let patientGoal: string | undefined
    let allRestrictions = [...restrictions]
    let faseReino: number | undefined = fase_reino ? Number(fase_reino) : undefined

    if (patient_id) {
      const { data: patient } = await supabase
        .from('profiles')
        .select('name, primary_goal, current_weight, dietary_restrictions')
        .eq('user_id', patient_id)
        .single()

      if (patient) {
        patientName    = patient.name
        patientWeight  = patient.current_weight
        patientGoal    = patient.primary_goal
        allRestrictions = [...new Set([...restrictions, ...(patient.dietary_restrictions || [])])]
      }

      // Buscar fase atual do REINO se não foi informada explicitamente
      if (!faseReino) {
        const { data: faseRow } = await supabase
          .from('fase_paciente')
          .select('fase_numero')
          .eq('paciente_id', patient_id)
          .eq('status', 'ativa')
          .order('iniciada_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (faseRow?.fase_numero) faseReino = faseRow.fase_numero
      }
    }

    // 3. Configurações do tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_name, method_name, gpt_system_prompt')
      .eq('id', profile.tenant_id)
      .single()

    // 4. Montar prompts compactos
    const compactCatalog = buildCompactCatalog(foods as FoodRow[])
    const systemPrompt = getMealPlanSystemPrompt(tenant?.gpt_system_prompt, tenant?.method_name, faseReino)
    const userPrompt = getMealPlanUserPrompt({
      goal, duration_days, target_kcal, target_protein_g,
      restrictions: allRestrictions, preferences,
      patientName, patientWeight, patientGoal,
      tenantMethodName: tenant?.method_name,
      tenantSystemPrompt: tenant?.gpt_system_prompt,
      faseReino,
      compactCatalog,
    })

    // 5. Chamar Gemini — output compacto (era 32000 tokens, agora 8192 bastam)
    const aiLeanOutput = await callClaudeJSON<AILeanOutput>({
      system: systemPrompt,
      maxTokens: 8192,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (!aiLeanOutput.days || aiLeanOutput.days.length === 0) {
      throw new Error('Gemini retornou resposta vazia ou inválida')
    }

    // 6. Expandir seleções localmente — sem tokens, sem IA
    const expanded = expandSelections(aiLeanOutput, foodsById)

    // 7. Salvar meal_plan
    const targetCarbs = Math.round((target_kcal * 0.45) / 4)
    const targetFat   = Math.round((target_kcal * 0.30) / 9)

    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .insert({
        tenant_id:       profile.tenant_id,
        created_by:      user.id,
        title:           expanded.title || `Cardápio ${goal}`,
        description:     expanded.description,
        goal,
        duration_days,
        target_kcal,
        target_protein_g,
        target_carbs_g:  targetCarbs,
        target_fat_g:    targetFat,
        target_fiber_g:  25,
        status:          'draft',
        is_ai_generated: true,
        tags:            [goal, ...allRestrictions].filter(Boolean),
        fase_aplicada:   faseReino || null,
      })
      .select('id')
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: planError?.message || 'Erro ao salvar cardápio' }, { status: 500 })
    }

    // 8. Inserir itens expandidos
    const dbItems = expanded.flat_items.map(item => ({
      meal_plan_id:      plan.id,
      day_number:        item.day_number,
      meal_type:         item.meal_type,
      meal_label:        item.meal_label,
      sort_order:        item.sort_order,
      food_id:           item.food_id,
      food_name:         item.food_name,
      quantity_g:        item.quantity_g,
      serving_qty:       item.serving_qty,
      serving_label:     item.serving_label,
      calc_kcal:         item.calc_kcal,
      calc_protein_g:    item.calc_protein_g,
      calc_carbs_g:      item.calc_carbs_g,
      calc_fat_g:        item.calc_fat_g,
      calc_fiber_g:      item.calc_fiber_g,
      preparation_notes: item.preparation_notes,
      substitution_note: item.substitution_note,
    }))

    if (dbItems.length > 0) {
      await supabase.from('meal_plan_items').insert(dbItems)
    }

    // 9. Atribuir à paciente se especificada
    if (patient_id) {
      await supabase.from('meal_plan_assignments').insert({
        meal_plan_id:  plan.id,
        user_id:       patient_id,
        tenant_id:     profile.tenant_id,
        fase_aplicada: faseReino || null,
      })
    }

    // 10. Resposta
    return NextResponse.json({
      success:        true,
      meal_plan_id:   plan.id,
      title:          expanded.title,
      description:    expanded.description,
      days_generated: expanded.days.length,
      items_created:  dbItems.length,
      fase_aplicada:  faseReino || null,
      days_summary: expanded.days.map(d => ({
        day_number:        d.day_number,
        day_theme:         d.day_theme,
        day_total_kcal:    d.day_total_kcal,
        day_total_protein: d.day_total_protein,
        meals_count:       d.meals.length,
      })),
      generated: {
        title:       expanded.title,
        description: expanded.description,
        days: expanded.days.map(d => ({
          day_number: d.day_number,
          day_theme:  d.day_theme,
          meals: d.meals.map(m => ({
            meal_type:  m.meal_type,
            meal_label: m.meal_label,
            time:       m.time,
            items: m.items.map(i => ({
              food_id:           i.food_id,
              food_name:         i.food_name,
              quantity_g:        i.quantity_g,
              serving_qty:       i.serving_qty,
              serving_label:     i.serving_label,
              calc_kcal:         i.calc_kcal,
              calc_protein_g:    i.calc_protein_g,
              calc_carbs_g:      i.calc_carbs_g,
              calc_fat_g:        i.calc_fat_g,
              calc_fiber_g:      i.calc_fiber_g,
              preparation_notes: i.preparation_notes,
              substitution_note: i.substitution_note,
            })),
          })),
          day_total_kcal:    d.day_total_kcal,
          day_total_protein: d.day_total_protein,
        })),
      },
    })

  } catch (error: any) {
    console.error('[Meal Plan Generator] Error:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar cardápio' }, { status: 500 })
  }
}
