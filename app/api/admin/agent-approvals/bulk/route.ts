import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids, action } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { data, error } = await supabase
    .from('agent_pending_actions')
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    console.error('[agent-approvals bulk]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
}
