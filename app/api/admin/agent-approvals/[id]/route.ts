import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, rejection_reason } = await request.json() // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { data: updated, error } = await supabase
    .from('agent_pending_actions')
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      ...(rejection_reason ? { rejection_reason } : {}),
    })
    .eq('id', params.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending') // can only act on pending
    .select()
    .single()

  if (error || !updated) {
    console.error('[agent-approvals PATCH]', error)
    return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 })
  }

  // If approved and it's a send_message action, execute immediately
  if (action === 'approve' && updated.action_type === 'send_message' && updated.target_user_id) {
    try {
      const { error: msgError } = await supabase
        .from('inbox_messages')
        .insert({
          user_id: updated.target_user_id,
          tenant_id: tenant.id,
          agent_name: updated.agent_name,
          message: updated.content,
          context_data: updated.context_data,
          is_read: false,
        })

      if (!msgError) {
        await supabase
          .from('agent_pending_actions')
          .update({ status: 'executed', executed_at: new Date().toISOString() })
          .eq('id', params.id)
      }
    } catch (execError) {
      console.error('[agent-approvals execute]', execError)
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
