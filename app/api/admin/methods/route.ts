import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// GET /api/admin/methods → lista métodos do tenant com suas fases
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: methods, error } = await supabase
    .from('methods')
    .select('*, method_phases(*)')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Methods] GET', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const methodsSorted = (methods || []).map((m: any) => ({
    ...m,
    method_phases: (m.method_phases || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }))

  return NextResponse.json({ methods: methodsSorted })
}

// POST /api/admin/methods → cria novo método
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, description } = body
  if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })

  const { data: method, error } = await supabase
    .from('methods')
    .insert({ tenant_id: tenant.id, name, description: description ?? null })
    .select()
    .single()

  if (error) {
    console.error('[Methods] POST', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ method }, { status: 201 })
}

// PUT /api/admin/methods → atualiza método (name/description/is_active)
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: method, error } = await supabase
    .from('methods')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) {
    console.error('[Methods] PUT', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ method })
}

// DELETE /api/admin/methods?id= → remove método (cascade nas fases)
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('methods')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[Methods] DELETE', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
