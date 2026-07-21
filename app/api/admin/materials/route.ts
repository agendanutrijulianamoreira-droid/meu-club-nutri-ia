import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase.from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

// GET: listar materiais do tenant
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const tag = searchParams.get('tag')

  let query = supabase.from('materials')
    .select('*, category:clinical_categories(id, name)')
    .eq('tenant_id', tenant.id)
    .order('sort_order', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (tag) query = query.contains('tags', [tag])

  const { data: materials, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ materials: materials || [] })
}

// POST: criar material (sempre manual — é metadado de um arquivo/link,
// não conteúdo autorável por IA; a classificação por IA de PDFs enviados
// continua em /api/admin/library/upload)
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description, category_id, file_url, external_url, estimated_minutes, author, source, tags } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const { data, error } = await supabase.from('materials').insert({
    tenant_id: tenant.id,
    title: title.trim(),
    description: description?.trim() || null,
    category_id: category_id || null,
    file_url: file_url || null,
    external_url: external_url || null,
    estimated_minutes: estimated_minutes ? Number(estimated_minutes) : null,
    author: author || null,
    source: source || null,
    tags: tags || [],
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/materials POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ material: data })
}

// PATCH: editar material
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  delete updates.tenant_id

  const { data, error } = await supabase.from('materials')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenant.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ material: data })
}

// DELETE: desativar material
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  await supabase.from('materials').update({ is_active: false }).eq('id', id).eq('tenant_id', tenant.id)
  return NextResponse.json({ deleted: true })
}
