import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

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
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')

  let query = supabase.from('recipes')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
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
    const { theme, category, dietary_tags, access_tier } = body
    if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

    const systemPrompt = tenant.gpt_system_prompt || ''
    const brandName = tenant.brand_name || 'VitaClub'
    const restrictionInfo = dietary_tags?.length
      ? `A receita DEVE ser adequada para: ${dietary_tags.join(', ')}.`
      : 'Sem restrições alimentares específicas.'

    const userPrompt = `Crie uma receita saudável com o tema: "${theme}".
Categoria: ${category || 'refeição'}.
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
    {"item": "nome do ingrediente", "quantity": "quantidade e unidade", "note": "opcional"}
  ],
  "instructions": "Modo de preparo em texto corrido, passos numerados",
  "dietary_tags": ["tags que se aplicam: lactose, gluten, vegana, vegetariana, etc"],
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
        category: category || 'refeição',
        dietary_tags: result.dietary_tags || dietary_tags || [],
        prep_time_min: result.prep_time_min || null,
        servings: result.servings || 1,
        ingredients: result.ingredients || [],
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
      return NextResponse.json({ recipe: data })
    } catch (err: any) {
      console.error('[/api/admin/recipes POST ai]', err)
      return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
    }
  }

  // Modo manual
  const {
    title, description, emoji, category, dietary_tags,
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
    category: category || 'refeição',
    dietary_tags: dietary_tags || [],
    prep_time_min: prep_time_min ? Number(prep_time_min) : null,
    servings: servings ? Number(servings) : 1,
    ingredients: ingredients || [],
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
