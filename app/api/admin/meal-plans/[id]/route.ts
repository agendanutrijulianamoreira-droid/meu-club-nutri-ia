import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/meal-plans/[id]
 * Retorna um plano alimentar específico com todos os meal_items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: plan, error: planError } = await supabase
    .from('meal_plans')
    .select('*, profiles:patient_id (name, primary_goal, dietary_restrictions, current_plan)')
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .single()

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Try meal_items table first (premium model), fall back to meal_plan_items
  let items: any[] = []
  const { data: premiumItems, error: premiumError } = await supabase
    .from('meal_items')
    .select('*')
    .eq('meal_plan_id', params.id)
    .order('day_number')
    .order('sort_order')

  if (!premiumError && premiumItems && premiumItems.length > 0) {
    items = premiumItems
  } else {
    const { data: legacyItems } = await supabase
      .from('meal_plan_items')
      .select('*')
      .eq('meal_plan_id', params.id)
      .order('day_number')
      .order('sort_order')
    items = legacyItems || []
  }

  // Group items by day and meal_type
  const days: Record<number, Record<string, any[]>> = {}
  for (const item of items) {
    if (!days[item.day_number]) days[item.day_number] = {}
    if (!days[item.day_number][item.meal_type]) days[item.day_number][item.meal_type] = []
    days[item.day_number][item.meal_type].push(item)
  }

  return NextResponse.json({ plan, items, days })
}

/**
 * PATCH /api/admin/meal-plans/[id]
 * Aprovar um plano alimentar (status -> active)
 * Body: { action: 'approve' | 'reject' | 'complete' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action, ...fields } = body

  let updateData: Record<string, any> = {}

  if (action === 'approve') {
    updateData = {
      status: 'active',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } else if (action === 'reject') {
    updateData = {
      status: 'pending_approval',
      updated_at: new Date().toISOString(),
    }
  } else if (action === 'complete') {
    updateData = {
      status: 'completed',
      updated_at: new Date().toISOString(),
    }
  } else {
    // General update
    updateData = { ...fields, updated_at: new Date().toISOString() }
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .update(updateData)
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) {
    console.error('[meal-plans/[id] PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan: data })
}

/**
 * DELETE /api/admin/meal-plans/[id]
 * Soft-delete: set status to 'completed'
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('meal_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[meal-plans/[id] DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
