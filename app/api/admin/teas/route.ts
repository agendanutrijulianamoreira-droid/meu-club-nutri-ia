import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', userId).single()
  return data
}

// GET: listar chás do tenant
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const tag = searchParams.get('tag')

  let query = supabase.from('teas')
    .select('*, category:clinical_categories(id, name), tea_components(id, quantity, unit, serving_label, sort_order, food:foods(name))')
    .eq('tenant_id', tenant.id)
    .order('sort_order', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (tag) query = query.contains('tags', [tag])

  const { data: teas, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ teas: teas || [] })
}

// POST: criar chá (manual ou por IA)
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

    const userPrompt = `Crie um chá funcional com o tema: "${theme}".
Retorne APENAS JSON válido:
{
  "title": "Nome do chá",
  "description": "Uma linha sobre o benefício principal",
  "instructions": "Modo de preparo/infusão em texto corrido",
  "best_time": "ex: noturno, pela manhã",
  "indications": "para quem é indicado",
  "contraindications": "quem deve evitar ou ter cautela",
  "ingredients": [
    {"name": "nome do ingrediente (ex: camomila)", "quantity": número ou texto, "unit": "g/ml/colher/unidade"}
  ],
  "tags": ["tags relevantes, ex: calmante, digestivo"]
}`

    try {
      const result = await callClaudeJSON<any>({
        system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1000,
      })

      const { data, error } = await supabase.from('teas').insert({
        tenant_id: tenant.id,
        title: result.title || theme,
        description: result.description || null,
        category_id: category_id || null,
        instructions: result.instructions || null,
        best_time: result.best_time || null,
        indications: result.indications || null,
        contraindications: result.contraindications || null,
        tags: result.tags || [],
        is_ai_generated: true,
        is_active: true,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
        await insertComponentsFromIngredients(supabase, 'tea_components', 'tea_id', data.id, tenant.id, result.ingredients)
      }

      return NextResponse.json({ tea: data })
    } catch (err: any) {
      console.error('[/api/admin/teas POST ai]', err)
      return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
    }
  }

  // Modo manual
  const { title, description, category_id, instructions, best_time, indications, contraindications, tags, ingredients } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('teas').insert({
    tenant_id: tenant.id,
    title: title.trim(),
    description: description?.trim() || null,
    category_id: category_id || null,
    instructions: instructions || null,
    best_time: best_time || null,
    indications: indications || null,
    contraindications: contraindications || null,
    tags: tags || [],
    is_ai_generated: false,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/teas POST manual]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    await insertComponentsFromIngredients(supabase, 'tea_components', 'tea_id', data.id, tenant.id, ingredients)
  }

  return NextResponse.json({ tea: data })
}

// PATCH: editar chá
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  delete updates.tenant_id

  const { data, error } = await supabase.from('teas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tea: data })
}

// DELETE: desativar chá
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  await supabase.from('teas').update({ is_active: false }).eq('id', id).eq('tenant_id', tenant.id)
  return NextResponse.json({ deleted: true })
}
