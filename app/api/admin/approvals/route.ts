import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(String(profile.role || '').toLowerCase())) {
    return null
  }

  return { id: profile.tenant_id }
}

// GET: listar fila de aprovações
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'executed', 'expired'])
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  // target_user_id references auth.users, not profiles. Fetch queue first and
  // resolve display profiles in a second query instead of forcing an invalid
  // PostgREST relationship hint.
  const { data: queueItems, error } = await supabase
    .from('agent_approval_queue')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[/api/admin/approvals GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targetUserIds = Array.from(new Set(
    (queueItems || []).map((item: any) => item.target_user_id).filter(Boolean)
  ))

  let profilesByUserId = new Map<string, { name: string | null; email: string | null }>()

  if (targetUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .eq('tenant_id', tenant.id)
      .in('user_id', targetUserIds)

    if (profilesError) {
      console.error('[/api/admin/approvals GET profiles]', profilesError)
    } else {
      profilesByUserId = new Map(
        (profiles || []).map((profile: any) => [profile.user_id, { name: profile.name, email: profile.email }])
      )
    }
  }

  const items = (queueItems || []).map((item: any) => ({
    ...item,
    target_profile: item.target_user_id ? profilesByUserId.get(item.target_user_id) || null : null,
  }))

  const { count: pendingCount } = await supabase
    .from('agent_approval_queue')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending')

  return NextResponse.json({ items, pending_count: pendingCount || 0 })
}

// PATCH: aprovar, rejeitar ou editar uma ação
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, decision, admin_note, edited_payload } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision deve ser approved ou rejected' }, { status: 400 })
  }

  const { data: item } = await supabase
    .from('agent_approval_queue')
    .select('id, status, action_type, payload, agent_name, target_user_id')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  if (item.status !== 'pending') {
    return NextResponse.json({ error: 'Item já foi revisado' }, { status: 409 })
  }

  const wasEdited = decision === 'approved' && edited_payload != null
  const executionPayload = wasEdited ? edited_payload : (item.payload || {})

  if (decision === 'approved') {
    const actionType: string = item.action_type

    if (actionType === 'create_post') {
      const targetUserId = item.target_user_id || executionPayload.user_id
      if (targetUserId) {
        await supabase.from('community_posts').insert({
          user_id: targetUserId,
          tenant_id: tenant.id,
          content: executionPayload.content || executionPayload.body || '',
          is_ai_generated: true,
        })
      }
    } else if (actionType === 'assign_protocol') {
      const targetUserId = item.target_user_id || executionPayload.user_id
      const protocolId = executionPayload.protocol_id
      if (targetUserId && protocolId) {
        await supabase.from('protocol_assignments')
          .update({ status: 'cancelled' })
          .eq('user_id', targetUserId)
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
        await supabase.from('protocol_assignments').insert({
          user_id: targetUserId,
          protocol_id: protocolId,
          tenant_id: tenant.id,
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
      }
    } else if (actionType === 'send_message' || actionType === 'send_offer') {
      const targetUserId = item.target_user_id || executionPayload.user_id
      if (targetUserId) {
        await supabase.from('inbox_messages').insert({
          tenant_id: tenant.id,
          user_id: targetUserId,
          agent_name: item.agent_name,
          title: executionPayload.offer_title || executionPayload.title || 'Mensagem da equipe',
          body: executionPayload.offer_body || executionPayload.body || '',
          message_type: actionType === 'send_offer' ? 'offer' : 'engagement',
          priority: 'high',
          cta_label: executionPayload.cta_label || 'Ver mais',
          cta_url: executionPayload.cta_url || '/patient/home',
          channels: ['inbox', 'push'],
          metadata: {
            approval_id: id,
            product_id: executionPayload.product_id || null,
            product_name: executionPayload.product_name || null,
          },
        })

        if (actionType === 'send_offer' && executionPayload.product_id) {
          await supabase.from('upsell_events').insert({
            tenant_id: tenant.id,
            user_id: targetUserId,
            product_id: executionPayload.product_id,
            approval_id: id,
            trigger_reason: executionPayload.trigger_reason || 'manual_approval',
            days_on_plan: executionPayload.days_on_plan || null,
            streak_at_offer: executionPayload.streak_at_offer || null,
            engagement_score: executionPayload.engagement_score || null,
            offer_title: executionPayload.offer_title || '',
            offer_body: executionPayload.offer_body || '',
            product_name: executionPayload.product_name || '',
            event_type: 'sent',
          })
        }
      }
    }
  }

  const finalStatus = decision === 'approved' ? 'executed' : 'rejected'

  const { data: updated, error } = await supabase
    .from('agent_approval_queue')
    .update({
      status: finalStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_note: admin_note?.trim() || null,
      edited_payload: wasEdited ? edited_payload : null,
    })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select().single()

  if (error) {
    console.error('[/api/admin/approvals PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('agent_feedback').insert({
    tenant_id: tenant.id,
    approval_id: id,
    agent_name: item.agent_name,
    action_type: item.action_type,
    decision: wasEdited ? 'edited' : decision,
    original_payload: item.payload,
    final_payload: wasEdited ? edited_payload : item.payload,
    admin_note: admin_note?.trim() || null,
  })

  return NextResponse.json({ item: updated })
}
