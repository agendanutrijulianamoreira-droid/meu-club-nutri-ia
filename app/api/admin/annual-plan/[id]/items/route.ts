import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('annual_plan_items')
    .select('*')
    .eq('plan_id', params.id)
    .eq('tenant_id', tenant.id)
    .order('month', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { item_id, status, edited_title, edited_description, owner_notes } = await request.json()

  const updatePayload: Record<string, any> = { status }
  if (edited_title !== undefined) updatePayload.edited_title = edited_title
  if (edited_description !== undefined) updatePayload.edited_description = edited_description
  if (owner_notes !== undefined) updatePayload.owner_notes = owner_notes

  const { data, error } = await supabase
    .from('annual_plan_items')
    .update(updatePayload)
    .eq('id', item_id)
    .eq('tenant_id', tenant.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
