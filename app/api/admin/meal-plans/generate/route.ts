import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

/**
 * POST /api/admin/meal-plans/generate
 * Gera cardápio com IA usando alimentos reais da base TACO/TBCA
 * 
 * Body: {
 *   goal: 'emagrecimento' | 'hipertrofia' | 'manutenção' | 'detox' | string,
 *   duration_days: 1-30,
 *   target_kcal: number,
 *   target_protein_g: number,
 *   restrictions: string[],      // 'lactose', 'gluten', 'vegano', etc
 *   preferences: string,         // Texto livre
 *   patient_id?: string,         // Se for para uma paciente específica
 * }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verificar se é admin/nutricionista
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
        goal = 'manutenção',
        duration_days = 7,
        target_kcal = 1800,
        target_protein_g = 90,
        restrictions = [],
        preferences = '',
        patient_id,
    } = body

    try {
        // 1. Buscar TODOS os alimentos da base para a IA usar como referência
        const { data: foods } = await supabase
            .from('foods')
            .select('id, name, category, energy_kcal, protein_g, total_fat_g, carbs_g, fiber_g, serving_size_g, serving_label')
            .eq('is_active', true)
            .order('category')

        if (!foods || foods.length === 0) {
            return NextResponse.json({ error: 'Base de alimentos vazia. Execute a migration primeiro.' }, { status: 400 })
        }

        // 2. Contexto da paciente (se especificada)
        let patientContext = ''
        if (patient_id) {
            const { data: patient } = await supabase
                .from('profiles')
                .select('name, primary_goal, current_weight, initial_weight, dietary_restrictions')
                .eq('user_id', patient_id)
                .single()

            if (patient) {
                const patientRestrictions = patient.dietary_restrictions || []
                patientContext = `
PACIENTE: ${patient.name}
Objetivo: ${patient.primary_goal || goal}
Peso atual: ${patient.current_weight ? patient.current_weight + 'kg' : 'não informado'}
Restrições: ${[...restrictions, ...patientRestrictions].join(', ') || 'nenhuma'}`
            }
        }

        // 3. Tenant info
        const { data: tenant } = await supabase
            .from('tenants')
            .select('brand_name, method_name, gpt_system_prompt')
            .eq('id', profile.tenant_id)
            .single()

        // 4. Formatar catálogo de alimentos para a IA
        const foodCatalog = foods.map(f =>
            `[${f.id}] ${f.name} (${f.category}) — ${f.energy_kcal}kcal, P:${f.protein_g}g, C:${f.carbs_g}g, G:${f.total_fat_g}g, Fib:${f.fiber_g}g | Porção: ${f.serving_size_g}g = ${f.serving_label}`
        ).join('\n')

        // 5. Gerar com Claude
        const systemPrompt = `Você é uma nutricionista especializada criando cardápios com dados reais da Tabela TACO/TBCA.
${tenant?.gpt_system_prompt || ''}

REGRA CRÍTICA: Você DEVE usar APENAS alimentos do catálogo fornecido abaixo. Use o ID exato [uuid] de cada alimento.
Calcule os valores nutricionais baseado na quantidade em gramas especificada vs os valores por 100g do catálogo.

CATÁLOGO DE ALIMENTOS DISPONÍVEIS:
${foodCatalog}`

        const userPrompt = `Crie um cardápio de ${duration_days} dia(s) com estas especificações:

META DIÁRIA: ~${target_kcal} kcal, ~${target_protein_g}g proteína
OBJETIVO: ${goal}
RESTRIÇÕES: ${restrictions.length > 0 ? restrictions.join(', ') : 'nenhuma'}
${preferences ? `PREFERÊNCIAS: ${preferences}` : ''}
${patientContext}

ESTRUTURA POR DIA:
- shot (shot matinal, opcional)
- cafe_manha (café da manhã)
- lanche_manha (lanche da manhã)
- almoco (almoço)
- lanche_tarde (lanche da tarde)
- jantar (jantar)
- ceia (ceia, opcional)

Para cada item, use um alimento do catálogo com seu ID real.
Calcule: kcal = (quantity_g / 100) * energy_kcal do alimento.

Retorne APENAS JSON:
{
  "title": "Nome do cardápio",
  "description": "Descrição curta (2 frases)",
  "days": [
    {
      "day_number": 1,
      "meals": [
        {
          "meal_type": "cafe_manha",
          "meal_label": "Café da manhã",
          "items": [
            {
              "food_id": "uuid-do-alimento",
              "food_name": "Nome do alimento",
              "quantity_g": 150,
              "serving_qty": 2,
              "serving_label": "fatias",
              "calc_kcal": 180,
              "calc_protein_g": 12,
              "calc_carbs_g": 20,
              "calc_fat_g": 5,
              "preparation_notes": "Tostado com azeite",
              "substitution_note": "Pode trocar por pão integral"
            }
          ]
        }
      ],
      "day_total_kcal": 1800,
      "day_total_protein": 92
    }
  ]
}`

        const generated = await callClaudeJSON({
            system: systemPrompt,
            maxTokens: 8000,
            messages: [{ role: 'user', content: userPrompt }],
        })

        // 6. Salvar como meal_plan + items no banco
        const targetCarbs = Math.round((target_kcal * 0.45) / 4) // 45% carbs
        const targetFat = Math.round((target_kcal * 0.30) / 9) // 30% fat

        const { data: plan, error: planError } = await supabase
            .from('meal_plans')
            .insert({
                tenant_id: profile.tenant_id,
                created_by: user.id,
                title: generated.title || `Cardápio ${goal}`,
                description: generated.description,
                goal,
                duration_days,
                target_kcal,
                target_protein_g,
                target_carbs_g: targetCarbs,
                target_fat_g: targetFat,
                target_fiber_g: 25,
                status: 'draft',
                is_ai_generated: true,
                tags: [goal, ...restrictions],
            })
            .select('id')
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: planError?.message || 'Erro ao salvar cardápio' }, { status: 500 })
        }

        // 7. Inserir items
        const items: any[] = []
        for (const day of generated.days || []) {
            let sortOrder = 0
            for (const meal of day.meals || []) {
                for (const item of meal.items || []) {
                    items.push({
                        meal_plan_id: plan.id,
                        day_number: day.day_number,
                        meal_type: meal.meal_type,
                        meal_label: meal.meal_label,
                        sort_order: sortOrder++,
                        food_id: item.food_id || null,
                        food_name: item.food_name,
                        quantity_g: item.quantity_g,
                        serving_qty: item.serving_qty,
                        serving_label: item.serving_label,
                        calc_kcal: item.calc_kcal,
                        calc_protein_g: item.calc_protein_g,
                        calc_carbs_g: item.calc_carbs_g,
                        calc_fat_g: item.calc_fat_g,
                        calc_fiber_g: item.calc_fiber_g || 0,
                        preparation_notes: item.preparation_notes,
                        substitution_note: item.substitution_note,
                    })
                }
            }
        }

        if (items.length > 0) {
            await supabase.from('meal_plan_items').insert(items)
        }

        // 8. Atribuir à paciente se especificada
        if (patient_id) {
            await supabase.from('meal_plan_assignments').insert({
                meal_plan_id: plan.id,
                user_id: patient_id,
                tenant_id: profile.tenant_id,
            })
        }

        return NextResponse.json({
            success: true,
            meal_plan_id: plan.id,
            title: generated.title,
            days_generated: generated.days?.length || 0,
            items_created: items.length,
            generated, // Raw AI output for preview
        })

    } catch (error: any) {
        console.error('[Meal Plan Generator] Error:', error)
        return NextResponse.json({ error: error.message || 'Erro ao gerar cardápio' }, { status: 500 })
    }
}
