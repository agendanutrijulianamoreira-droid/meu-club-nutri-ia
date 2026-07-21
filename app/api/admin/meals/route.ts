import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', userId).single()
  return data
}

// GET: listar refeições do tenant (não confundir com meal_plans/Dieta)
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const tag = searchParams.get('tag')

  let query = supabase.from('meals')
    .select(`*, category:clinical_categories(id, name),
      meal_components(id, quantity, unit, serving_label, sort_order,
        food:foods(name), recipe:recipes(title), supplement:supplements(title))`)
    .eq('tenant_id', tenant.id)
    .order('sort_order', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (tag) query = query.contains('tags', [tag])

  const { data: meals, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meals: meals || [] })
}

// POST: criar refeição (manual, com componentes já resolvidos da Biblioteca
// Clínica, ou por IA, que sugere ingredientes por nome resolvidos a foods)
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  if (body.mode === 'ai') {
    const { theme, category_id } = body
    if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

    const userPrompt = `Crie uma refeição composta com o tema: "${theme}" (ex: "Café da manhã proteico").
Retorne APENAS JSON válido:
{
  "title": "Nome da refeição",
  "description": "Uma linha sobre o benefício principal",
  "notes": "orientação opcional, ex: sirva gelado",
  "ingredients": [
    {"name": "nome do alimento (ex: ovo)", "quantity": número ou texto, "unit": "g/ml/unidade"}
  ],
  "tags": ["tags relevantes, ex: proteico, low carb"]
}`

    try {
      const result = await callClaudeJSON<any>({
        system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1000,
      })

      const { data, error } = await supabase.from('meals').insert({
        tenant_id: tenant.id,
        title: result.title || theme,
        description: result.description || null,
        category_id: category_id || null,
        notes: result.notes || null,
        tags: result.tags || [],
        is_ai_generated: true,
        is_active: true,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
        await insertComponentsFromIngredients(supabase, 'meal_components', 'meal_id', data.id, tenant.id, result.ingredients)
      }

      return NextResponse.json({ meal: data })
    } catch (err: any) {
      console.error('[/api/admin/meals POST ai]', err)
      return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
    }
  }

  // Modo manual — componentes já resolvidos via picker (food_id/recipe_id/supplement_id)
  const { title, description, category_id, notes, tags, components } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('meals').insert({
    tenant_id: tenant.id,
    title: title.trim(),
    description: description?.trim() || null,
    category_id: category_id || null,
    notes: notes || null,
    tags: tags || [],
    is_ai_generated: false,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/meals POST manual]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(components) && components.length > 0) {
    const rows = components.map((c: any, sort_order: number) => ({
      meal_id: data.id,
      tenant_id: tenant.id,
      food_id: c.food_id || null,
      recipe_id: c.recipe_id || null,
      supplement_id: c.supplement_id || null,
      quantity: c.quantity ? Number(c.quantity) : null,
      unit: c.unit || null,
      serving_label: c.serving_label || null,
      sort_order,
    }))
    await supabase.from('meal_components').insert(rows)
  }

  return NextResponse.json({ meal: data })
}

// PATCH: editar refeição
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  delete updates.tenant_id

  const { data, error } = await supabase.from('meals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meal: data })
}

// DELETE: desativar refeição
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  await supabase.from('meals').update({ is_active: false }).eq('id', id).eq('tenant_id', tenant.id)
  return NextResponse.json({ deleted: true })
}
