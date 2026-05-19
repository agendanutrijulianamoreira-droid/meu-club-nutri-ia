import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, current_plan, created_at, current_streak, total_xp')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json([])

  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const { data: products } = await supabase
    .from('gateway_products')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('is_active', true)
    .contains('visible_to_plans', [profile.current_plan ?? 'community'])
    .order('display_order', { ascending: true })

  if (!products) return NextResponse.json([])

  // Filter by trigger conditions
  const visible = products.filter((p: any) => {
    if (p.trigger_type === 'manual') return true
    if (p.trigger_type === 'after_days') return daysSinceJoin >= (p.trigger_value ?? 0)
    if (p.trigger_type === 'high_engagement') return (profile.current_streak ?? 0) >= (p.trigger_value ?? 7)
    return true
  })

  return NextResponse.json(visible)
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_id, interaction_type } = await request.json()
  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('gateway_product_interactions').upsert({
    product_id, user_id: user.id, tenant_id: profile.tenant_id, interaction_type
  }, { onConflict: 'product_id,user_id,interaction_type' })

  return NextResponse.json({ ok: true })
}
