import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// POST /api/admin/methods/phases → cria nova fase dentro de um método do tenant
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { method_id, name, description, order_index } = body
  if (!method_id || !name) {
    return NextResponse.json({ error: 'method_id e name são obrigatórios' }, { status: 400 })
  }

  // Nunca confiar apenas no method_id do body — confirma que pertence ao tenant.
  const { data: method } = await supabase
    .from('methods').select('id').eq('id', method_id).eq('tenant_id', tenant.id).single()
  if (!method) return NextResponse.json({ error: 'Método não encontrado' }, { status: 404 })

  const { data: phase, error } = await supabase
    .from('method_phases')
    .insert({
      method_id,
      tenant_id: tenant.id,
      name,
      description: description ?? null,
      order_index: order_index ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[MethodPhases] POST', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ phase }, { status: 201 })
}

// PUT /api/admin/methods/phases → atualiza fase (name/description/order_index)
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: phase, error } = await supabase
    .from('method_phases')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) {
    console.error('[MethodPhases] PUT', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ phase })
}

// DELETE /api/admin/methods/phases?id= → remove fase
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
    .from('method_phases')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[MethodPhases] DELETE', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
