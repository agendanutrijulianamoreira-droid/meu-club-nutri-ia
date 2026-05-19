import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/agent-queue
 * Lista ações pendentes agrupadas por prioridade e agent_type
 * Query params: ?status=pending|approved|rejected (default: pending)
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'

  const { data, error } = await supabase
    .from('agent_pending_actions')
    .select(`
      id, agent_name, action_type, target_type, target_user_id,
      title, content, content_preview, reasoning, context_data,
      scheduled_for, status, priority, reviewed_at, rejection_reason,
      created_at, expires_at,
      profiles:target_user_id (name)
    `)
    .eq('tenant_id', tenant.id)
    .eq('status', status)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[agent-queue GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by priority
  const high = (data || []).filter(a => a.priority === 'high' || a.priority === 'urgent')
  const medium = (data || []).filter(a => a.priority === 'medium' || a.priority === 'normal')
  const low = (data || []).filter(a => a.priority === 'low' || !a.priority)

  // Group by agent_type
  const byAgent: Record<string, any[]> = {}
  for (const action of data || []) {
    const key = action.agent_name || 'unknown'
    if (!byAgent[key]) byAgent[key] = []
    byAgent[key].push(action)
  }

  return NextResponse.json({
    total: (data || []).length,
    by_priority: { high, medium, low },
    by_agent: byAgent,
    actions: data || [],
  })
}

/**
 * POST /api/admin/agent-queue
 * Aprovar ou rejeitar uma ação com feedback opcional
 * Body: { action_id, decision, edited_content?, patient_id? }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action_id, decision, edited_content, rejection_reason } = body

  if (!action_id || !decision) {
    return NextResponse.json({ error: 'action_id and decision are required' }, { status: 400 })
  }

  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 })
  }

  // Fetch the original action
  const { data: action, error: fetchError } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('id', action_id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending')
    .single()

  if (fetchError || !action) {
    return NextResponse.json({ error: 'Action not found or already processed' }, { status: 404 })
  }

  const finalContent = edited_content ?? action.content

  // Update action status
  const updateData: Record<string, any> = {
    status: decision === 'approved' ? 'approved' : 'rejected',
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }
  if (decision === 'rejected' && rejection_reason) {
    updateData.rejection_reason = rejection_reason
  }
  if (decision === 'approved' && edited_content) {
    updateData.content = edited_content
  }

  const { error: updateError } = await supabase
    .from('agent_pending_actions')
    .update(updateData)
    .eq('id', action_id)

  if (updateError) {
    console.error('[agent-queue POST update]', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // On approval: execute the action and record feedback
  if (decision === 'approved') {
    const userId = action.target_user_id
    const actionType = action.action_type

    // Execute the action
    try {
      if (actionType === 'send_message' && userId) {
        await supabase.from('inbox_messages').insert({
          user_id: userId,
          tenant_id: tenant.id,
          agent_name: action.agent_name,
          title: action.title || 'Mensagem da IA',
          body: finalContent,
          message_type: 'engagement',
          priority: action.priority || 'normal',
          channels: ['inbox'],
          status: 'unread',
        })
      } else if (actionType === 'create_post') {
        await supabase.from('community_posts').insert({
          user_id: userId,
          tenant_id: tenant.id,
          content: finalContent,
          is_ai_generated: true,
        })
      }

      // Mark as executed
      await supabase
        .from('agent_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', action_id)
    } catch (execErr: any) {
      console.error('[agent-queue execute]', execErr)
    }

    // Record feedback vector (original vs approved content)
    const { data: profile } = action.target_user_id
      ? await supabase
          .from('profiles')
          .select('primary_goal, current_plan, total_xp, current_streak')
          .eq('user_id', action.target_user_id)
          .single()
      : { data: null }

    const { error: feedbackError } = await supabase.rpc('record_agent_feedback', {
      p_tenant_id: tenant.id,
      p_pending_action_id: action_id,
      p_agent_type: action.agent_name || 'unknown',
      p_original_content: action.content || '',
      p_approved_content: finalContent,
      p_patient_profile: profile
        ? { primary_goal: profile.primary_goal, current_plan: profile.current_plan, total_xp: profile.total_xp, current_streak: profile.current_streak }
        : {},
    })

    if (feedbackError) {
      console.error('[agent-queue feedback RPC]', feedbackError)
      // Non-fatal: continue
    }
  }

  return NextResponse.json({ ok: true, decision, action_id })
}
