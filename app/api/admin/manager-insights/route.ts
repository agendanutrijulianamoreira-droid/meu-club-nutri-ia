import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id, brand_name, method_name').eq('owner_id', userId).single()
  return data
}

// GET: retorna os insights de aprendizado do gerente
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: insights } = await supabase
    .from('manager_learning')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('approval_rate', { ascending: false })

  // Stats gerais de feedback
  const { data: feedbackStats } = await supabase
    .from('agent_feedback')
    .select('agent_name, action_type, decision')
    .eq('tenant_id', tenant.id)

  const statsByAgent: Record<string, { approved: number; rejected: number; edited: number; total: number }> = {}
  for (const f of feedbackStats || []) {
    const key = `${f.agent_name}:${f.action_type}`
    if (!statsByAgent[key]) statsByAgent[key] = { approved: 0, rejected: 0, edited: 0, total: 0 }
    statsByAgent[key].total++
    if (f.decision === 'approved') statsByAgent[key].approved++
    else if (f.decision === 'rejected') statsByAgent[key].rejected++
    else if (f.decision === 'edited') statsByAgent[key].edited++
  }

  return NextResponse.json({
    insights: insights || [],
    feedback_stats: statsByAgent,
    total_feedback: feedbackStats?.length || 0,
  })
}

// POST: analisa feedback acumulado e gera/atualiza insights com IA
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Buscar feedbacks dos últimos 90 dias
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: feedbacks } = await supabase
    .from('agent_feedback')
    .select(`
      agent_name, action_type, decision,
      original_payload, final_payload, admin_note,
      created_at
    `)
    .eq('tenant_id', tenant.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!feedbacks || feedbacks.length < 3) {
    return NextResponse.json({
      message: 'Dados insuficientes para análise (mínimo 3 feedbacks necessários)',
      analyzed: 0,
    })
  }

  // Agrupar por agente + tipo de ação
  const groups: Record<string, typeof feedbacks> = {}
  for (const f of feedbacks) {
    const key = `${f.agent_name}:${f.action_type}`
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }

  const updatedInsights: any[] = []

  for (const [key, groupFeedbacks] of Object.entries(groups)) {
    const [agentName, actionType] = key.split(':')
    if (groupFeedbacks.length < 2) continue

    const approved = groupFeedbacks.filter(f => f.decision === 'approved')
    const rejected = groupFeedbacks.filter(f => f.decision === 'rejected')
    const edited   = groupFeedbacks.filter(f => f.decision === 'edited')
    const approvalRate = Math.round((approved.length / groupFeedbacks.length) * 100)

    // Amostras para análise
    const approvedSamples = approved.slice(0, 5).map(f => ({
      original: f.original_payload?.offer_body || f.original_payload?.body || f.original_payload?.message || '',
      note: f.admin_note || '',
    }))
    const rejectedSamples = rejected.slice(0, 5).map(f => ({
      original: f.original_payload?.offer_body || f.original_payload?.body || f.original_payload?.message || '',
      note: f.admin_note || '',
    }))
    const editedSamples = edited.slice(0, 5).map(f => ({
      original: f.original_payload?.offer_body || f.original_payload?.body || f.original_payload?.message || '',
      final: f.final_payload?.offer_body || f.final_payload?.body || f.final_payload?.message || '',
      note: f.admin_note || '',
    }))

    const systemPrompt = `Você é um analista de comportamento de moderação de conteúdo.
Analise padrões de aprovação/rejeição/edição de conteúdo gerado por IA.
Identifique o que consistentemente agrada vs. desagrada o administrador.
Retorne APENAS JSON válido, sem markdown.`

    const userPrompt = `Clube: ${tenant.brand_name}
Agente: ${agentName}, Tipo: ${actionType}
Taxa de aprovação: ${approvalRate}%
Total analisado: ${groupFeedbacks.length} (${approved.length} aprovados, ${rejected.length} rejeitados, ${edited.length} editados)

APROVADOS (${approvedSamples.length} amostras):
${JSON.stringify(approvedSamples, null, 2)}

REJEITADOS (${rejectedSamples.length} amostras):
${JSON.stringify(rejectedSamples, null, 2)}

EDITADOS (${editedSamples.length} amostras):
${JSON.stringify(editedSamples, null, 2)}

Analise e identifique padrões. O que o admin aprova? O que rejeita? O que edita?

Retorne APENAS JSON:
{
  "approved_patterns": [{"pattern": "descrição do padrão", "count": N, "example": "trecho"}],
  "rejected_patterns": [{"pattern": "descrição do padrão", "count": N, "reason": "motivo provável"}],
  "edit_patterns": [{"what_changed": "o que foi mudado", "frequency": "alta|média|baixa"}],
  "learning_instructions": "Instruções em linguagem natural para o agente melhorar (máx 200 palavras). Foque em regras específicas e acionáveis."
}`

    let learningData: any = null
    try {
      learningData = await callClaudeJSON<any>({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1000,
      })
    } catch (e) {
      console.error(`[manager-insights] Gemini error for ${key}:`, e)
      continue
    }

    // Upsert no banco
    const { data: insight } = await supabase
      .from('manager_learning')
      .upsert({
        tenant_id: tenant.id,
        agent_name: agentName,
        action_type: actionType,
        total_approved: approved.length,
        total_rejected: rejected.length,
        total_edited: edited.length,
        approval_rate: approvalRate,
        approved_patterns: learningData?.approved_patterns || [],
        rejected_patterns: learningData?.rejected_patterns || [],
        edit_patterns: learningData?.edit_patterns || [],
        learning_instructions: learningData?.learning_instructions || '',
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,agent_name,action_type' })
      .select()
      .single()

    if (insight) updatedInsights.push(insight)
  }

  return NextResponse.json({
    analyzed: updatedInsights.length,
    insights: updatedInsights,
  })
}
