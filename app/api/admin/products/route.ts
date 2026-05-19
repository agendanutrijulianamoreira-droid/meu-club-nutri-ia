import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

// GET: listar produtos do tenant
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: products }, { data: accessStats }] = await Promise.all([
    supabase.from('products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: true }),
    supabase.from('patient_products')
      .select('product_id, status')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active'),
  ])

  const countByProduct: Record<string, number> = {}
  for (const a of accessStats || []) {
    countByProduct[a.product_id] = (countByProduct[a.product_id] || 0) + 1
  }

  const enriched = (products || []).map(p => ({
    ...p,
    active_users: countByProduct[p.id] || 0,
  }))

  return NextResponse.json({ products: enriched })
}

// POST: criar produto
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    name, slug, type, description, short_description,
    price_cents, stripe_price_id, payment_type, recurring_interval,
    content_access, features, badge_text, highlight, sort_order,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!type) return NextResponse.json({ error: 'Tipo é obrigatório' }, { status: 400 })
  if (price_cents == null || price_cents < 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })

  const safeSlug = slug?.trim() ||
    name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

  const { data, error } = await supabase.from('products').insert({
    tenant_id: tenant.id,
    name: name.trim(),
    slug: safeSlug,
    type,
    description: description?.trim() || null,
    short_description: short_description?.trim() || null,
    price_cents: Number(price_cents),
    stripe_price_id: stripe_price_id?.trim() || null,
    payment_type: payment_type || 'one_time',
    recurring_interval: recurring_interval || null,
    content_access: content_access || {},
    features: features || [],
    badge_text: badge_text?.trim() || null,
    highlight: highlight || false,
    sort_order: sort_order ?? 0,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/admin/products POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data })
}

// PATCH: atualizar produto
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

  const { data, error } = await supabase.from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select().single()

  if (error) {
    console.error('[/api/admin/products PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data })
}

// DELETE: desativar produto
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
