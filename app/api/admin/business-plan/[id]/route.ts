import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

// GET: plano com months/weeks/items aninhados
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  }

  const { data: months } = await supabase
    .from('business_plan_months').select('*').eq('plan_id', plan.id).order('month_number')

  const monthIds = (months || []).map((m: any) => m.id)

  const [{ data: weeks }, { data: items }] = await Promise.all([
    monthIds.length > 0
      ? supabase.from('business_plan_weeks').select('*').in('month_id', monthIds).order('week_number')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('business_plan_items').select('*').eq('plan_id', plan.id).order('created_at'),
  ])

  const weeksByMonth: Record<string, any[]> = {}
  for (const w of weeks || []) {
    if (!weeksByMonth[w.month_id]) weeksByMonth[w.month_id] = []
    weeksByMonth[w.month_id].push(w)
  }

  const itemsByMonth: Record<string, any[]> = {}
  const itemsByWeek: Record<string, any[]> = {}
  const itemsYearWide: any[] = []
  for (const item of items || []) {
    if (item.week_id) {
      if (!itemsByWeek[item.week_id]) itemsByWeek[item.week_id] = []
      itemsByWeek[item.week_id].push(item)
    } else if (item.month_id) {
      if (!itemsByMonth[item.month_id]) itemsByMonth[item.month_id] = []
      itemsByMonth[item.month_id].push(item)
    } else {
      itemsYearWide.push(item)
    }
  }

  const monthsExpanded = (months || []).map((m: any) => ({
    ...m,
    weeks: (weeksByMonth[m.id] || []).map((w: any) => ({ ...w, items: itemsByWeek[w.id] || [] })),
    items: itemsByMonth[m.id] || [],
  }))

  return NextResponse.json({ plan, months: monthsExpanded, items_year_wide: itemsYearWide })
}

// PATCH: atualizar campos do plano (status, título, meta de faturamento etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { tenant_id, id, ...updates } = body

  const { data, error } = await supabase
    .from('business_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) {
    console.error('[business-plan/[id] PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plan: data })
}
