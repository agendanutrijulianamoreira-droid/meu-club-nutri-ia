import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

async function updateAgentLearning(
  supabase: SupabaseClient,
  tenantId: string,
  action: Record<string, any>,
  decision: 'approve' | 'reject',
  rejectionReason?: string
) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single()
  if (!tenant) return

  const prefs = tenant.settings?.agent_preferences ?? {}
  const agentKey = action.agent_name as string

  if (!prefs[agentKey]) prefs[agentKey] = { approvals: 0, rejections: 0, rejection_reasons: [], example_approved: [] }

  if (decision === 'approve') {
    prefs[agentKey].approvals = (prefs[agentKey].approvals ?? 0) + 1
    // Keep last 3 approved examples as few-shot reference
    const examples: string[] = prefs[agentKey].example_approved ?? []
    examples.unshift(action.content?.substring?.(0, 200) ?? '')
    prefs[agentKey].example_approved = examples.slice(0, 3)
  } else {
    prefs[agentKey].rejections = (prefs[agentKey].rejections ?? 0) + 1
    if (rejectionReason) {
      const reasons: string[] = prefs[agentKey].rejection_reasons ?? []
      reasons.unshift(rejectionReason.substring(0, 100))
      prefs[agentKey].rejection_reasons = reasons.slice(0, 5)
    }
  }

  await supabase
    .from('tenants')
    .update({ settings: { ...tenant.settings, agent_preferences: prefs } })
    .eq('id', tenantId)
}

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

  // Update agent learning preferences in tenant settings (fire-and-forget)
  updateAgentLearning(supabase, tenant.id, updated, action, rejection_reason).catch(e =>
    console.error('[agent-approvals learning]', e)
  )

  return NextResponse.json({ ok: true, status: newStatus })
}
