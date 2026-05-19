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

async function executeApprovedAction(
  supabase: SupabaseClient,
  actionId: string,
  updated: Record<string, any>,
  tenantId: string
) {
  const userId = updated.target_user_id
  const type = updated.action_type

  if (type === 'send_message') {
    const { error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        agent_name: updated.agent_name,
        title: updated.title || updated.content?.substring(0, 60) || 'Mensagem da IA',
        body: updated.content,
        message_type: 'engagement',
        priority: updated.context_data?.priority || 'normal',
        channels: ['inbox'],
        status: 'unread',
      })
    if (!msgError) {
      await supabase
        .from('agent_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', actionId)
    }
    return
  }

  if (type === 'create_post') {
    const { error: postError } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        content: updated.content,
        is_ai_generated: true,
      })
    if (!postError) {
      await supabase
        .from('agent_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', actionId)
    }
    return
  }

  if (type === 'flag_patient') {
    const { error: flagError } = await supabase
      .from('profiles')
      .update({ ai_flag: updated.context_data?.flag_reason || 'agent_alert' })
      .eq('user_id', userId)
    if (!flagError) {
      await supabase
        .from('agent_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', actionId)
    }
    return
  }

  if (type === 'complete_protocol') {
    const assignmentId = updated.context_data?.assignment_id
    if (assignmentId) {
      const { error: protoError } = await supabase
        .from('protocol_assignments')
        .update({ status: 'completed', end_date: new Date().toISOString().split('T')[0] })
        .eq('id', assignmentId)
      if (!protoError) {
        await supabase
          .from('agent_pending_actions')
          .update({ status: 'executed', executed_at: new Date().toISOString() })
          .eq('id', actionId)
      }
    }
    return
  }

  if (type === 'show_offer') {
    const ctx = updated.context_data ?? {}
    const { error: offerError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        agent_name: 'upsell',
        title: updated.title || ctx.product_name || 'Oferta especial para você',
        body: updated.content,
        message_type: 'engagement',
        priority: 'normal',
        cta_label: ctx.cta_text || 'Quero saber mais',
        cta_url: ctx.external_url || '/patient/gateway',
        channels: ['inbox'],
        status: 'unread',
      })
    if (!offerError) {
      await supabase
        .from('agent_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', actionId)
    }
    return
  }

  if (type === 'send_push') {
    // Mark as executed — actual push dispatch handled by the cron/orchestrator
    await supabase
      .from('agent_pending_actions')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        execution_result: { note: 'push_queued' },
      })
      .eq('id', actionId)
    return
  }

  // For any other action type, mark as executed with a note
  await supabase
    .from('agent_pending_actions')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      execution_result: { note: `no_handler_for_${type}` },
    })
    .eq('id', actionId)
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

  // Execute approved actions immediately
  if (action === 'approve' && updated.target_user_id) {
    try {
      await executeApprovedAction(supabase, params.id, updated, tenant.id)
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
