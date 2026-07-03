import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { fromProductRow, toProductRow, GATEWAY_TYPES } from '@/lib/services/productCatalog'

// Esta rota é um adaptador sobre a tabela unificada `products` (ver
// 20260703000003_unify_product_catalog.sql) — ProductGatewayView continua
// falando o formato antigo (product_type, short_pitch, price_label,
// display_order), e o mapeamento acontece aqui para não exigir reescrever a
// view neste momento. gateway_products deixou de ser lida/escrita.

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenant.id)
    .in('type', GATEWAY_TYPES)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[gateway-products GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data || []).map(fromProductRow))
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const row = toProductRow(body)
  const safeSlug = (row.name || 'produto').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-') + '-gw-' + Math.random().toString(36).slice(2, 8)

  const { data, error } = await supabase
    .from('products')
    .insert({ ...row, tenant_id: tenant.id, slug: safeSlug })
    .select()
    .single()

  if (error) {
    console.error('[gateway-products POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(fromProductRow(data))
}
