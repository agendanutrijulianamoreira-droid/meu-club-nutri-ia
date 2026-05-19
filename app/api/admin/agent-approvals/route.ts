import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Auto-expire stale actions
  await supabase.rpc('expire_pending_actions')

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'

  const { data, error } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[agent-approvals GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
