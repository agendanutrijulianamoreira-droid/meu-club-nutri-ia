import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id, gpt_system_prompt, settings, brand_name, method_name').eq('owner_id', userId).single()
  return data
}

// GET: listar receitas do tenant
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const tag = searchParams.get('tag')

  let query = supabase.from('recipes')
    .select('*, category:clinical_categories(id, name)')
    .eq('tenant_id', tenant.id)
    .order('sort_order', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (tag) query = query.contains('dietary_tags', [tag])

  const { data: recipes, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipes: recipes || [] })
}

// POST: criar receita (manual ou por IA)
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Modo IA: gerar receita completa
  if (body.mode === 'ai') {
    const { theme, category_id, dietary_tags, access_tier } = body
    if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

    const systemPrompt = tenant.gpt_system_prompt || ''
    const restrictionInfo = dietary_tags?.length
      ? `A receita DEVE ser adequada para: ${dietary_tags.join(', ')}.`
      : 'Sem restrições alimentares específicas.'

    const userPrompt = `Crie uma receita saudável com o tema: "${theme}".
${restrictionInfo}
Nível de acesso: ${access_tier === 'premium' ? 'Premium — inclua calorias e macros exatos' : 'Básico — qualitativo, sem cálculo obrigatório'}.

Retorne APENAS JSON válido com esta estrutura:
{
  "title": "Nome da receita",
  "description": "Uma linha descrevendo o prato e seus benefícios",
  "emoji": "um emoji representativo",
  "prep_time_min": número em minutos,
  "servings": número de porções,
  "ingredients": [
    {"name": "nome do ingrediente (ex: peito de frango)", "quantity": número ou texto, "unit": "g/ml/unidade/colher"}
  ],
  "instructions": "Modo de preparo em texto corrido, passos numerados",
  "dietary_tags": ["tags que se aplicam: lactose, gluten, vegana, vegetariana, etc"],
  "tags": ["tags descritivas livres, ex: anti-inflamatório, detox"],
  "substitutions": [
    {"ingredient": "ingrediente original", "substitute": "substituição sugerida", "reason": "motivo"}
  ],
  "calories": null ou número,
  "protein_g": null ou número,
  "carbs_g": null ou número,
  "fat_g": null ou número
}`

    try {
      const result = await callClaudeJSON<any>({
        system: `Você é uma nutricionista especializada. ${systemPrompt}`,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1500,
      })

      const { data, error } = await supabase.from('recipes').insert({
        tenant_id: tenant.id,
        title: result.title || theme,
        description: result.description || null,
        emoji: result.emoji || '🍽️',
        category_id: category_id || null,
        dietary_tags: result.dietary_tags || dietary_tags || [],
        tags: result.tags || [],
        prep_time_min: result.prep_time_min || null,
        servings: result.servings || 1,
        instructions: result.instructions || '',
        substitutions: result.substitutions || [],
        calories: result.calories || null,
        protein_g: result.protein_g || null,
        carbs_g: result.carbs_g || null,
        fat_g: result.fat_g || null,
        access_tier: access_tier || 'basic',
        is_ai_generated: true,
        is_active: true,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
        await insertComponentsFromIngredients(supabase, 'recipe_components', 'recipe_id', data.id, tenant.id, result.ingredients)
      }

      return NextResponse.json({ recipe: data })
    } catch (err: any) {
      console.error('[/api/admin/recipes POST ai]', err)
      return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
    }
  }

  // Modo manual
  const {
    title, description, emoji, category_id, dietary_tags, tags,
    prep_time_min, servings, ingredients, instructions,
    substitutions, calories, protein_g, carbs_g, fat_g, access_tier,
  } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
  if (!instructions?.trim()) return NextResponse.json({ error: 'Modo de preparo é obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('recipes').insert({
    tenant_id: tenant.id,
    title: title.trim(),
    description: description?.trim() || null,
    emoji: emoji || '🍽️',
    category_id: category_id || null,
    dietary_tags: dietary_tags || [],
    tags: tags || [],
    prep_time_min: prep_time_min ? Number(prep_time_min) : null,
    servings: servings ? Number(servings) : 1,
    instructions: instructions.trim(),
    substitutions: substitutions || [],
    calories: calories ? Number(calories) : null,
    protein_g: protein_g ? Number(protein_g) : null,
    carbs_g: carbs_g ? Number(carbs_g) : null,
    fat_g: fat_g ? Number(fat_g) : null,
    access_tier: access_tier || 'basic',
    is_ai_generated: false,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/recipes POST manual]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    await insertComponentsFromIngredients(supabase, 'recipe_components', 'recipe_id', data.id, tenant.id, ingredients)
  }

  return NextResponse.json({ recipe: data })
}

// PATCH: editar receita
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  delete updates.tenant_id

  const { data, error } = await supabase.from('recipes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipe: data })
}

// DELETE: desativar receita
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  await supabase.from('recipes')
    .update({ is_active: false })
    .eq('id', id).eq('tenant_id', tenant.id)

  return NextResponse.json({ deleted: true })
}
