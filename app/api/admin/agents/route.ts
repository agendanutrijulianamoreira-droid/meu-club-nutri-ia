import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenantId = tenant.id
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)

  // ── 1. Agent Logs (últimos 7 dias) ─────────────────────────────────────
  const { data: recentLogs } = await supabase
    .from('agent_logs')
    .select('id, agent_name, trigger_type, status, tokens_used, cost_usd, duration_ms, created_at, error_message')
    .eq('tenant_id', tenantId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  // ── 2. Agent Stats (agregados) ─────────────────────────────────────────
  const logs = recentLogs || []
  const agentNames = ['orchestrator', 'sabotage', 'daily_checkin', 'onboarding', 'meals', 'retention', 'protocol', 'community', 'community_moderation']

  const agentStats = agentNames.map(name => {
    const agentLogs = logs.filter(l => l.agent_name === name)
    const successLogs = agentLogs.filter(l => l.status === 'success')
    const errorLogs = agentLogs.filter(l => l.status === 'error')
    const skippedLogs = agentLogs.filter(l => l.status === 'skipped')
    const totalTokens = agentLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)
    const totalCost = agentLogs.reduce((sum, l) => sum + (parseFloat(l.cost_usd) || 0), 0)
    const avgDuration = agentLogs.length > 0
      ? Math.round(agentLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / agentLogs.length)
      : 0

    return {
      agent_name: name,
      total_runs: agentLogs.length,
      success: successLogs.length,
      errors: errorLogs.length,
      skipped: skippedLogs.length,
      total_tokens: totalTokens,
      total_cost: Math.round(totalCost * 10000) / 10000,
      avg_duration_ms: avgDuration,
      last_run: agentLogs[0]?.created_at || null,
      last_error: errorLogs[0]?.error_message || null,
    }
  })

  // ── 3. Totais gerais ──────────────────────────────────────────────────
  const totalRuns = logs.length
  const totalTokens = logs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)
  const totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost_usd) || 0), 0)
  const totalErrors = logs.filter(l => l.status === 'error').length
  const successRate = totalRuns > 0 ? Math.round(((totalRuns - totalErrors) / totalRuns) * 100) : 100

  // ── 4. Risk Scores atuais ──────────────────────────────────────────────
  const { data: riskScores } = await supabase
    .from('patient_risk_scores')
    .select('user_id, overall_risk, risk_level, signals, recommended_action, action_taken, calculated_at')
    .eq('tenant_id', tenantId)
    .gte('calculated_at', todayStr)
    .order('overall_risk', { ascending: false })

  const riskDistribution = {
    critical: (riskScores || []).filter(r => r.risk_level === 'critical').length,
    high: (riskScores || []).filter(r => r.risk_level === 'high').length,
    medium: (riskScores || []).filter(r => r.risk_level === 'medium').length,
    low: (riskScores || []).filter(r => r.risk_level === 'low').length,
  }

  // ── 5. Inbox Messages stats ────────────────────────────────────────────
  const { data: inboxStats } = await supabase
    .from('inbox_messages')
    .select('id, agent_name, message_type, status, priority, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  const inbox = inboxStats || []
  const inboxByType: Record<string, number> = {}
  const inboxByAgent: Record<string, number> = {}
  for (const msg of inbox) {
    inboxByType[msg.message_type] = (inboxByType[msg.message_type] || 0) + 1
    inboxByAgent[msg.agent_name] = (inboxByAgent[msg.agent_name] || 0) + 1
  }
  const readRate = inbox.length > 0
    ? Math.round((inbox.filter(m => m.status === 'read' || m.status === 'acted').length / inbox.length) * 100)
    : 0

  // ── 6. Timeline (últimas 20 execuções) ────────────────────────────────
  const timeline = logs.slice(0, 30).map(l => ({
    id: l.id,
    agent: l.agent_name,
    status: l.status,
    trigger: l.trigger_type,
    tokens: l.tokens_used || 0,
    duration: l.duration_ms || 0,
    time: l.created_at,
    error: l.error_message || null,
  }))

  // ── 7. Risk Scores com nomes das pacientes ─────────────────────────────
  let riskWithNames: any[] = []
  if (riskScores && riskScores.length > 0) {
    const riskUserIds = riskScores.map(r => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .in('user_id', riskUserIds)

    const nameMap = new Map((profiles || []).map(p => [p.user_id, p.name]))
    riskWithNames = riskScores.map(r => ({
      ...r,
      name: nameMap.get(r.user_id) || 'Paciente',
    }))
  }

  return NextResponse.json({
    overview: {
      total_runs_7d: totalRuns,
      total_tokens_7d: totalTokens,
      total_cost_7d: Math.round(totalCost * 10000) / 10000,
      success_rate: successRate,
      total_messages_7d: inbox.length,
      read_rate: readRate,
    },
    agent_stats: agentStats,
    risk_distribution: riskDistribution,
    risk_patients: riskWithNames,
    inbox_by_type: inboxByType,
    inbox_by_agent: inboxByAgent,
    timeline,
  })
}
