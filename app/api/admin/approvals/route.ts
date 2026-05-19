import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id').eq('owner_id', userId).single()
  return data
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

  const { data: items, error } = await supabase
    .from('agent_approval_queue')
    .select(`
      *,
      target_profile:profiles!agent_approval_queue_target_user_id_fkey(name, email)
    `)
    .eq('tenant_id', tenant.id)
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[/api/admin/approvals GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Contagem de pendentes para o badge
  const { count: pendingCount } = await supabase
    .from('agent_approval_queue')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending')

  return NextResponse.json({ items: items || [], pending_count: pendingCount || 0 })
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

  // Verifica que o item pertence ao tenant
  const { data: item } = await supabase
    .from('agent_approval_queue')
    .select('id, status, action_type, payload, agent_name')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  if (item.status !== 'pending') {
    return NextResponse.json({ error: 'Item já foi revisado' }, { status: 409 })
  }

  const finalStatus = decision === 'approved' ? 'approved' : 'rejected'
  const wasEdited = decision === 'approved' && edited_payload != null

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
    .select().single()

  if (error) {
    console.error('[/api/admin/approvals PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Registra feedback para aprendizado do gerente
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
