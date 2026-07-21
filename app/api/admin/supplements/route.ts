import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id, gpt_system_prompt').eq('owner_id', userId).single()
  return data
}

// GET: listar suplementos do tenant
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const tag = searchParams.get('tag')

  let query = supabase.from('supplements')
    .select('*, category:clinical_categories(id, name)')
    .eq('tenant_id', tenant.id)
    .order('sort_order', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (tag) query = query.contains('tags', [tag])

  const { data: supplements, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supplements: supplements || [] })
}

// POST: criar suplemento (manual ou por IA)
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

    const userPrompt = `Descreva o suplemento: "${theme}", para uso em um programa de nutrição clínica.
Retorne APENAS JSON válido:
{
  "title": "Nome do suplemento",
  "description": "Uma linha sobre o benefício principal",
  "default_dosage": número,
  "dosage_unit": "mg/mcg/UI/cápsula/comprimido/ml/gotas",
  "frequency": "ex: 1x ao dia",
  "best_time": "ex: em jejum, após o almoço",
  "indications": "para quem é indicado",
  "contraindications": "quem deve evitar ou ter cautela",
  "tags": ["tags relevantes, ex: energia, sono, imunidade"]
}`

    try {
      const result = await callClaudeJSON<any>({
        system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 800,
      })

      const { data, error } = await supabase.from('supplements').insert({
        tenant_id: tenant.id,
        title: result.title || theme,
        description: result.description || null,
        category_id: category_id || null,
        default_dosage: result.default_dosage || null,
        dosage_unit: result.dosage_unit || null,
        frequency: result.frequency || null,
        best_time: result.best_time || null,
        indications: result.indications || null,
        contraindications: result.contraindications || null,
        tags: result.tags || [],
        is_ai_generated: true,
        is_active: true,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ supplement: data })
    } catch (err: any) {
      console.error('[/api/admin/supplements POST ai]', err)
      return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
    }
  }

  // Modo manual
  const { title, description, category_id, default_dosage, dosage_unit, frequency, best_time, indications, contraindications, tags } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('supplements').insert({
    tenant_id: tenant.id,
    title: title.trim(),
    description: description?.trim() || null,
    category_id: category_id || null,
    default_dosage: default_dosage ? Number(default_dosage) : null,
    dosage_unit: dosage_unit || null,
    frequency: frequency || null,
    best_time: best_time || null,
    indications: indications || null,
    contraindications: contraindications || null,
    tags: tags || [],
    is_ai_generated: false,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/supplements POST manual]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ supplement: data })
}

// PATCH: editar suplemento
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  delete updates.tenant_id

  const { data, error } = await supabase.from('supplements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supplement: data })
}

// DELETE: desativar suplemento
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  await supabase.from('supplements').update({ is_active: false }).eq('id', id).eq('tenant_id', tenant.id)
  return NextResponse.json({ deleted: true })
}
