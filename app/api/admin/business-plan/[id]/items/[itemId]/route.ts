import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

const VALID_STATUS = new Set(['pending_review', 'approved', 'edited', 'rejected', 'scheduled', 'pushed'])

// PATCH: aprovar/editar/rejeitar um item do plano, e/ou definir quando distribuir (scheduled_for)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { status, scheduled_for, edited_title, edited_description, owner_notes, linked_product_id, week_id } = body

  if (status && !VALID_STATUS.has(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (status !== undefined) updates.status = status
  if (scheduled_for !== undefined) updates.scheduled_for = scheduled_for
  if (edited_title !== undefined) updates.edited_title = edited_title
  if (edited_description !== undefined) updates.edited_description = edited_description
  if (owner_notes !== undefined) updates.owner_notes = owner_notes
  if (linked_product_id !== undefined) updates.linked_product_id = linked_product_id
  if (week_id !== undefined) updates.week_id = week_id

  const { data, error } = await supabase
    .from('business_plan_items')
    .update(updates)
    .eq('id', params.itemId)
    .eq('plan_id', params.id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) {
    console.error('[business-plan items PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
