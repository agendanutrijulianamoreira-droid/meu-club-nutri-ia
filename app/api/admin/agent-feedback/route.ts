import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/admin/agent-feedback
 * Retorna exemplos de ações aprovadas/rejeitadas para melhorar futuras gerações.
 * Usado pelo agent-orchestrator como contexto de aprendizado.
 */
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: approved }, { data: rejected }] = await Promise.all([
    supabase
      .from('agent_pending_actions')
      .select('agent_name, action_type, content, reasoning, context_data')
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .gte('reviewed_at', thirtyDaysAgo)
      .order('reviewed_at', { ascending: false })
      .limit(20),
    supabase
      .from('agent_pending_actions')
      .select('agent_name, action_type, content, reasoning, rejection_reason, context_data')
      .eq('tenant_id', tenant.id)
      .eq('status', 'rejected')
      .gte('reviewed_at', thirtyDaysAgo)
      .order('reviewed_at', { ascending: false })
      .limit(10),
  ])

  const approvedExamples = (approved ?? []).map(a => ({
    type: 'approved',
    agent: a.agent_name,
    action: a.action_type,
    content: a.content,
    reasoning: a.reasoning,
  }))

  const rejectedExamples = (rejected ?? []).map(r => ({
    type: 'rejected',
    agent: r.agent_name,
    action: r.action_type,
    content: r.content,
    reason: r.rejection_reason,
  }))

  return NextResponse.json({
    approved: approvedExamples,
    rejected: rejectedExamples,
    summary: {
      approvalRate: approved && rejected
        ? Math.round((approved.length / Math.max(approved.length + rejected.length, 1)) * 100)
        : null,
      topApprovedAgent: mostCommon(approved ?? [], 'agent_name'),
      topRejectedAgent: mostCommon(rejected ?? [], 'agent_name'),
    },
  })
}

function mostCommon(items: any[], key: string): string | null {
  if (!items.length) return null
  const counts: Record<string, number> = {}
  items.forEach(i => { counts[i[key]] = (counts[i[key]] ?? 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
