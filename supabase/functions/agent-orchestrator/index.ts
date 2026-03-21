// ==================================================
// Supabase Edge Function: agent-orchestrator
// Router central da orquestra de agentes IA
// Recebe eventos → constrói contexto → despacha agentes → entrega resultado
// ==================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const MODEL = 'claude-sonnet-4-20250514'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrchestratorEvent {
  type: 'cron_daily' | 'checkin_submitted' | 'chat_message' | 'stripe_webhook' | 'photo_submitted' | 'manual'
  tenant_id?: string
  user_id?: string
  payload?: Record<string, any>
}

interface PatientContext {
  user_id: string
  name: string
  tenant_id: string
  current_streak: number
  last_checkin_date: string | null
  total_xp: number
  current_plan: string
  primary_goal: string | null
  days_since_activity: number
  adherence_7d: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  checkin_score: number | null
  had_binge: boolean
  mood: string | null
}

interface TenantContext {
  id: string
  brand_name: string
  method_name: string | null
  gpt_system_prompt: string | null
  settings: any
}

interface AgentResult {
  agent_name: string
  status: 'success' | 'error' | 'skipped'
  messages: Array<{
    user_id: string
    title: string
    body: string
    message_type: string
    priority: string
    cta_label?: string
    cta_url?: string
    channels: string[]
  }>
  risk_scores?: Array<{
    user_id: string
    overall_risk: number
    inactivity_risk: number
    adherence_risk: number
    emotional_risk: number
    engagement_risk: number
    risk_level: string
    signals: string[]
    recommended_action: string
    days_since_activity: number
    current_streak: number
    adherence_7d: number
    last_checkin_score: number | null
  }>
  tokens_used: number
  duration_ms: number
  error?: string
}

// ─── CORS ──────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ─── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const cronHeader = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('authorization')
  const isServiceRole = authHeader?.includes(SUPABASE_SERVICE_KEY)
  const isCron = CRON_SECRET && cronHeader === CRON_SECRET

  if (!isCron && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const event: OrchestratorEvent = await req.json().catch(() => ({ type: 'cron_daily' }))

  const orchestratorStart = Date.now()

  // Log orchestrator start
  const { data: orchLog } = await supabase
    .from('agent_logs')
    .insert({
      tenant_id: event.tenant_id || '00000000-0000-0000-0000-000000000000',
      agent_name: 'orchestrator',
      trigger_type: event.type === 'cron_daily' ? 'cron' : event.type.includes('webhook') ? 'webhook' : 'realtime',
      input_payload: event,
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const results: any[] = []

    // ─── Route by event type ──────────────────────────────────────────

    switch (event.type) {

      case 'cron_daily': {
        // Cron diário: roda sabotage → daily_checkin → gamification para cada tenant
        const tenants = await getActiveTenants(supabase, event.tenant_id)

        for (const tenant of tenants) {
          const patients = await buildPatientContexts(supabase, tenant)
          if (patients.length === 0) continue

          // 1. Sabotage Detection — calcula risk scores
          const sabotageResult = await runSabotageAgent(supabase, tenant, patients)
          results.push(sabotageResult)

          // 2. Daily Check-in — gera mensagens de engajamento baseado no risk
          const engagementResult = await runDailyEngagementAgent(supabase, tenant, patients, sabotageResult)
          results.push(engagementResult)
        }
        break
      }

      case 'checkin_submitted': {
        // Paciente enviou check-in semanal → analisa e responde
        if (!event.user_id || !event.tenant_id) break
        const tenant = (await getActiveTenants(supabase, event.tenant_id))[0]
        if (!tenant) break
        const patients = await buildPatientContexts(supabase, tenant, event.user_id)
        if (patients.length === 0) break

        const sabotageResult = await runSabotageAgent(supabase, tenant, patients)
        results.push(sabotageResult)
        break
      }

      case 'stripe_webhook': {
        // Novo assinante → onboarding
        if (!event.user_id || !event.tenant_id) break
        const onboardingResult = await runOnboardingAgent(supabase, event.tenant_id, event.user_id, event.payload)
        results.push(onboardingResult)
        break
      }

      case 'manual': {
        // Execução manual de um agente específico
        const agentName = event.payload?.agent
        if (!agentName || !event.tenant_id) break
        const tenant = (await getActiveTenants(supabase, event.tenant_id))[0]
        if (!tenant) break
        const patients = await buildPatientContexts(supabase, tenant, event.user_id || undefined)
        
        if (agentName === 'sabotage') {
          results.push(await runSabotageAgent(supabase, tenant, patients))
        } else if (agentName === 'daily_engagement') {
          const sabResult = await runSabotageAgent(supabase, tenant, patients)
          results.push(await runDailyEngagementAgent(supabase, tenant, patients, sabResult))
        }
        break
      }
    }

    // Update orchestrator log
    const elapsed = Date.now() - orchestratorStart
    if (orchLog?.id) {
      await supabase
        .from('agent_logs')
        .update({
          status: 'success',
          output_payload: { results_count: results.length, agents_run: results.map(r => r.agent_name) },
          duration_ms: elapsed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', orchLog.id)
    }

    return new Response(JSON.stringify({
      success: true,
      event_type: event.type,
      elapsed_ms: elapsed,
      agents_run: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[orchestrator] Fatal:', err)
    if (orchLog?.id) {
      await supabase
        .from('agent_logs')
        .update({ status: 'error', error_message: err.message, completed_at: new Date().toISOString() })
        .eq('id', orchLog.id)
    }
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

async function getActiveTenants(supabase: SupabaseClient, tenantId?: string): Promise<TenantContext[]> {
  let query = supabase
    .from('tenants')
    .select('id, brand_name, method_name, gpt_system_prompt, settings')
    .eq('is_active', true)

  if (tenantId) query = query.eq('id', tenantId)

  const { data } = await query
  return (data || []) as TenantContext[]
}

async function buildPatientContexts(
  supabase: SupabaseClient,
  tenant: TenantContext,
  userId?: string
): Promise<PatientContext[]> {
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  let patientsQuery = supabase
    .from('profiles')
    .select('user_id, name, current_streak, last_checkin_date, total_xp, current_plan, primary_goal')
    .eq('tenant_id', tenant.id)
    .eq('role', 'patient')

  if (userId) patientsQuery = patientsQuery.eq('user_id', userId)

  const { data: patients } = await patientsQuery
  if (!patients || patients.length === 0) return []

  const userIds = patients.map((p: any) => p.user_id)

  // Logs últimos 7 dias
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('user_id, log_date, meal_plan_check')
    .in('user_id', userIds)
    .gte('log_date', sevenDaysAgoStr)

  // Último check-in semanal
  const { data: checkins } = await supabase
    .from('weekly_checkin_responses')
    .select('user_id, diet_score, ai_risk_level, had_binge, mood')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })

  const logsByUser: Record<string, any[]> = {}
  for (const log of logs || []) {
    if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
    logsByUser[log.user_id].push(log)
  }

  const checkinByUser: Record<string, any> = {}
  for (const c of checkins || []) {
    if (!checkinByUser[c.user_id]) checkinByUser[c.user_id] = c
  }

  return patients.map((p: any) => {
    const userLogs = logsByUser[p.user_id] || []
    const checkin = checkinByUser[p.user_id]

    const daysSince = p.last_checkin_date
      ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
      : 999

    const adherence = userLogs.length > 0
      ? Math.round((userLogs.filter((l: any) => l.meal_plan_check).length / 7) * 100)
      : 0

    // Risk calculation
    let risk = 10
    if (daysSince > 7) risk -= 4
    else if (daysSince > 3) risk -= 2
    if (!p.current_streak || p.current_streak === 0) risk -= 3
    else if (p.current_streak < 3) risk -= 1
    if (adherence < 30) risk -= 2
    else if (adherence < 60) risk -= 1
    if (checkin?.diet_score !== undefined && checkin.diet_score < 5) risk -= 2
    if (checkin?.ai_risk_level === 'high') risk = Math.min(risk, 3)
    if (checkin?.ai_risk_level === 'medium') risk = Math.min(risk, 6)
    if (checkin?.had_binge) risk -= 2
    risk = Math.max(0, Math.min(10, risk))

    const riskLevel = risk <= 2 ? 'critical' : risk <= 4 ? 'high' : risk <= 6 ? 'medium' : 'low'

    return {
      user_id: p.user_id,
      name: p.name || 'Rainha',
      tenant_id: tenant.id,
      current_streak: p.current_streak || 0,
      last_checkin_date: p.last_checkin_date,
      total_xp: p.total_xp || 0,
      current_plan: p.current_plan || 'community',
      primary_goal: p.primary_goal,
      days_since_activity: daysSince,
      adherence_7d: adherence,
      risk_level: riskLevel,
      checkin_score: checkin?.diet_score ?? null,
      had_binge: checkin?.had_binge ?? false,
      mood: checkin?.mood ?? null,
    }
  })
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: SABOTAGE DETECTION
// Analisa padrões de autossabotagem e calcula risk scores detalhados
// ═══════════════════════════════════════════════════════════════════════════

async function runSabotageAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  patients: PatientContext[]
): Promise<AgentResult> {
  const start = Date.now()
  let totalTokens = 0

  // Log agent start
  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({
      tenant_id: tenant.id,
      agent_name: 'sabotage',
      trigger_type: 'agent_chain',
      input_payload: { patients_count: patients.length },
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const riskScores: AgentResult['risk_scores'] = []

    // Processar em batch — enviar todos os pacientes em uma única chamada para eficiência
    const patientsNeedingAnalysis = patients.filter(p =>
      p.risk_level !== 'low' || p.had_binge || p.days_since_activity > 2
    )

    if (patientsNeedingAnalysis.length === 0) {
      // Nenhum paciente precisa de análise — todos low risk
      const elapsed = Date.now() - start
      if (agentLog?.id) {
        await supabase.from('agent_logs').update({
          status: 'skipped',
          output_payload: { reason: 'all_patients_low_risk' },
          duration_ms: elapsed,
          completed_at: new Date().toISOString(),
        }).eq('id', agentLog.id)
      }

      return {
        agent_name: 'sabotage',
        status: 'skipped',
        messages: [],
        risk_scores: [],
        tokens_used: 0,
        duration_ms: elapsed,
      }
    }

    // Chamar Claude para análise de risco detalhada
    const systemPrompt = `Você é um sistema especializado em detecção de autossabotagem em pacientes de nutrição.
Analise os dados de cada paciente e identifique padrões de risco.

SINAIS DE AUTOSSABOTAGEM:
- Quebra de streak após período bom (self-sabotage pós-conquista)
- Compulsão alimentar recorrente (had_binge = true)
- Queda progressiva de adesão (tendência decrescente)
- Humor negativo persistente (mood = "bad" ou "terrible")
- Inatividade crescente (dias sem atividade subindo)
- Score de dieta baixo no check-in (< 5/10)
- Desistência silenciosa (some sem avisar, 5+ dias)

NÍVEIS DE RISCO:
- low (0-25): Engajada, sem sinais preocupantes
- medium (26-50): Alguns sinais, precisa de atenção preventiva
- high (51-75): Múltiplos sinais, precisa de intervenção
- critical (76-100): Risco iminente de evasão, precisa de resgate urgente

AÇÕES RECOMENDADAS:
- no_action: Paciente estável
- celebrate: Paciente indo bem, reforçar positivamente
- nudge: Lembrete gentil, dica prática
- rescue: Mensagem de acolhimento e resgate
- alert_nutritionist: Caso grave que precisa de atenção humana

Retorne APENAS JSON válido, sem markdown.`

    const patientsSummary = patientsNeedingAnalysis.map(p => ({
      id: p.user_id,
      name: p.name.split(' ')[0],
      streak: p.current_streak,
      days_inactive: p.days_since_activity,
      adherence: p.adherence_7d,
      checkin_score: p.checkin_score,
      had_binge: p.had_binge,
      mood: p.mood,
      xp: p.total_xp,
      goal: p.primary_goal,
    }))

    const userPrompt = `Analise estas ${patientsNeedingAnalysis.length} pacientes do ${tenant.brand_name} e retorne o risk score detalhado de cada uma.

DADOS:
${JSON.stringify(patientsSummary, null, 2)}

Retorne JSON no formato:
{
  "analyses": [
    {
      "user_id": "uuid",
      "overall_risk": 0-100,
      "inactivity_risk": 0-100,
      "adherence_risk": 0-100,
      "emotional_risk": 0-100,
      "engagement_risk": 0-100,
      "risk_level": "low|medium|high|critical",
      "signals": ["signal1", "signal2"],
      "recommended_action": "no_action|celebrate|nudge|rescue|alert_nutritionist",
      "reasoning": "breve explicação"
    }
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
    const data = await res.json()
    totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    // Salvar risk scores no banco
    for (const analysis of parsed.analyses || []) {
      const patient = patientsNeedingAnalysis.find(p => p.user_id === analysis.user_id)
      if (!patient) continue

      const scoreData = {
        tenant_id: tenant.id,
        user_id: analysis.user_id,
        overall_risk: analysis.overall_risk,
        inactivity_risk: analysis.inactivity_risk,
        adherence_risk: analysis.adherence_risk,
        emotional_risk: analysis.emotional_risk,
        engagement_risk: analysis.engagement_risk,
        risk_level: analysis.risk_level,
        signals: analysis.signals,
        recommended_action: analysis.recommended_action,
        action_taken: false,
        days_since_activity: patient.days_since_activity,
        current_streak: patient.current_streak,
        adherence_7d: patient.adherence_7d,
        last_checkin_score: patient.checkin_score,
        agent_log_id: agentLog?.id,
      }

      // Upsert — um score por dia por paciente
      await supabase
        .from('patient_risk_scores')
        .upsert(scoreData, { onConflict: 'user_id,calculated_at' })

      riskScores.push({
        user_id: analysis.user_id,
        overall_risk: analysis.overall_risk,
        inactivity_risk: analysis.inactivity_risk,
        adherence_risk: analysis.adherence_risk,
        emotional_risk: analysis.emotional_risk,
        engagement_risk: analysis.engagement_risk,
        risk_level: analysis.risk_level,
        signals: analysis.signals,
        recommended_action: analysis.recommended_action,
        days_since_activity: patient.days_since_activity,
        current_streak: patient.current_streak,
        adherence_7d: patient.adherence_7d,
        last_checkin_score: patient.checkin_score,
      })
    }

    const elapsed = Date.now() - start

    // Update agent log
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success',
        output_payload: {
          patients_analyzed: patientsNeedingAnalysis.length,
          risk_distribution: {
            critical: riskScores.filter(r => r.risk_level === 'critical').length,
            high: riskScores.filter(r => r.risk_level === 'high').length,
            medium: riskScores.filter(r => r.risk_level === 'medium').length,
            low: riskScores.filter(r => r.risk_level === 'low').length,
          },
        },
        tokens_used: totalTokens,
        cost_usd: (data.usage?.input_tokens || 0) / 1000000 * 3 + (data.usage?.output_tokens || 0) / 1000000 * 15,
        duration_ms: elapsed,
        completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return {
      agent_name: 'sabotage',
      status: 'success',
      messages: [],
      risk_scores: riskScores,
      tokens_used: totalTokens,
      duration_ms: elapsed,
    }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[sabotage] Error:', err)
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'error',
        error_message: err.message,
        duration_ms: elapsed,
        completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }
    return { agent_name: 'sabotage', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: DAILY ENGAGEMENT
// Gera mensagens personalizadas baseado nos risk scores do sabotage agent
// ═══════════════════════════════════════════════════════════════════════════

async function runDailyEngagementAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  patients: PatientContext[],
  sabotageResult: AgentResult
): Promise<AgentResult> {
  const start = Date.now()
  let totalTokens = 0
  const messages: AgentResult['messages'] = []

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({
      tenant_id: tenant.id,
      agent_name: 'daily_checkin',
      trigger_type: 'agent_chain',
      input_payload: { patients_count: patients.length },
      status: 'running',
    })
    .select('id')
    .single()

  try {
    // Determinar quem precisa de mensagem
    const riskMap = new Map(
      (sabotageResult.risk_scores || []).map(r => [r.user_id, r])
    )

    const toEngage = patients.filter(p => {
      const risk = riskMap.get(p.user_id)
      const isStreakMilestone = [7, 14, 21, 30, 60, 100].includes(p.current_streak)
      return isStreakMilestone || p.risk_level !== 'low' || (risk && risk.risk_level !== 'low')
    })

    if (toEngage.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) {
        await supabase.from('agent_logs').update({
          status: 'skipped', output_payload: { reason: 'no_patients_need_engagement' },
          duration_ms: elapsed, completed_at: new Date().toISOString(),
        }).eq('id', agentLog.id)
      }
      return { agent_name: 'daily_checkin', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const tone = tenant.settings?.ai?.tone || 'motivadora'
    const brand = tenant.brand_name
    const method = tenant.method_name || 'Protocolo Nutri'

    const baseSystemPrompt = tenant.gpt_system_prompt ||
      `Você é a nutricionista virtual do ${brand}. Seja companheira, presente, prática. Use português brasileiro caloroso. Máximo 3 frases por mensagem. Nunca julgue ou culpe.`

    // Gerar mensagens em batch
    const patientDescriptions = toEngage.map(p => {
      const risk = riskMap.get(p.user_id)
      const isStreakMilestone = [7, 14, 21, 30, 60, 100].includes(p.current_streak)
      
      let situation = ''
      if (isStreakMilestone) {
        situation = `CELEBRAÇÃO: ${p.current_streak} dias de streak`
      } else if (risk?.recommended_action === 'rescue' || p.days_since_activity > 7) {
        situation = `RESGATE: inativa há ${p.days_since_activity} dias, risco ${risk?.risk_level || p.risk_level}`
      } else if (risk?.recommended_action === 'alert_nutritionist') {
        situation = `ALERTA: risco crítico, sinais: ${risk?.signals?.join(', ')}`
      } else if (p.had_binge) {
        situation = `ACOLHIMENTO: relatou compulsão, humor: ${p.mood || 'não informado'}`
      } else {
        situation = `ENGAJAMENTO: adesão ${p.adherence_7d}%, streak ${p.current_streak}`
      }

      return `- ${p.name.split(' ')[0]} (${p.user_id}): ${situation}, objetivo: ${p.primary_goal || 'não informado'}`
    }).join('\n')

    const userPrompt = `Marca: ${brand}, Método: ${method}, Tom: ${tone}

Gere uma mensagem personalizada para cada paciente:
${patientDescriptions}

Retorne APENAS JSON:
{
  "messages": [
    {
      "user_id": "uuid",
      "title": "título (máx 8 palavras)",
      "body": "corpo (máx 3 frases, use o nome)",
      "message_type": "celebration|rescue|engagement|tip|alert",
      "priority": "low|normal|high|urgent",
      "cta_label": "texto do botão",
      "cta_url": "/patient/home"
    }
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: baseSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
    const data = await res.json()
    totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    // Salvar mensagens no inbox e enviar push
    for (const msg of parsed.messages || []) {
      const channels = ['inbox']
      if (msg.priority === 'high' || msg.priority === 'urgent') channels.push('push')

      await supabase.from('inbox_messages').insert({
        tenant_id: tenant.id,
        user_id: msg.user_id,
        agent_name: 'daily_checkin',
        agent_log_id: agentLog?.id,
        title: msg.title,
        body: msg.body,
        message_type: msg.message_type || 'engagement',
        priority: msg.priority || 'normal',
        cta_label: msg.cta_label,
        cta_url: msg.cta_url || '/patient/home',
        channels,
      })

      // Push notification se canal inclui push
      if (channels.includes('push')) {
        await sendPush(supabase, msg.user_id, msg.title, msg.body)
      }

      messages.push({
        user_id: msg.user_id,
        title: msg.title,
        body: msg.body,
        message_type: msg.message_type,
        priority: msg.priority,
        cta_label: msg.cta_label,
        cta_url: msg.cta_url,
        channels,
      })
    }

    const elapsed = Date.now() - start

    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success',
        output_payload: { messages_sent: messages.length },
        tokens_used: totalTokens,
        cost_usd: (data.usage?.input_tokens || 0) / 1000000 * 3 + (data.usage?.output_tokens || 0) / 1000000 * 15,
        duration_ms: elapsed,
        completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'daily_checkin', status: 'success', messages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[daily_checkin] Error:', err)
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'error', error_message: err.message,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }
    return { agent_name: 'daily_checkin', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: ONBOARDING
// Boas-vindas personalizadas para novos assinantes
// ═══════════════════════════════════════════════════════════════════════════

async function runOnboardingAgent(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  payload?: Record<string, any>
): Promise<AgentResult> {
  const start = Date.now()

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      agent_name: 'onboarding',
      trigger_type: 'webhook',
      input_payload: payload || {},
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, primary_goal')
      .eq('user_id', userId)
      .single()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_name, method_name, gpt_system_prompt')
      .eq('id', tenantId)
      .single()

    const firstName = (profile?.name || 'Rainha').split(' ')[0]
    const brand = tenant?.brand_name || 'VitaClub'

    const systemPrompt = tenant?.gpt_system_prompt ||
      `Você é a nutricionista virtual do ${brand}. Dê boas-vindas calorosas e empolgantes.`

    const userPrompt = `Nova paciente acabou de assinar o ${brand}.

Nome: ${firstName}
Objetivo: ${profile?.primary_goal || 'não informado'}
Plano: ${payload?.plan || 'community'}

Crie 3 mensagens de onboarding que serão enviadas em sequência:
1. Boas-vindas imediata (empolgante, acolhedora)
2. Primeiro passo (orientação prática de o que fazer primeiro no app)
3. Apresentação da comunidade (convidar a se apresentar no feed)

Retorne APENAS JSON:
{
  "messages": [
    {
      "title": "título",
      "body": "corpo (máx 3 frases)",
      "message_type": "onboarding",
      "cta_label": "texto botão",
      "cta_url": "/rota"
    }
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
    const data = await res.json()
    const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    const messages: AgentResult['messages'] = []

    for (const msg of parsed.messages || []) {
      await supabase.from('inbox_messages').insert({
        tenant_id: tenantId,
        user_id: userId,
        agent_name: 'onboarding',
        agent_log_id: agentLog?.id,
        title: msg.title,
        body: msg.body,
        message_type: 'onboarding',
        priority: 'high',
        cta_label: msg.cta_label,
        cta_url: msg.cta_url || '/patient/home',
        channels: ['inbox', 'push'],
      })

      messages.push({
        user_id: userId,
        title: msg.title,
        body: msg.body,
        message_type: 'onboarding',
        priority: 'high',
        cta_label: msg.cta_label,
        cta_url: msg.cta_url,
        channels: ['inbox', 'push'],
      })
    }

    await sendPush(supabase, userId, messages[0]?.title || `Bem-vinda, ${firstName}!`, messages[0]?.body || '')

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success',
        output_payload: { messages_sent: messages.length },
        tokens_used: totalTokens,
        duration_ms: elapsed,
        completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'onboarding', status: 'success', messages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[onboarding] Error:', err)
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'error', error_message: err.message,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }
    return { agent_name: 'onboarding', status: 'error', messages: [], tokens_used: 0, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

async function sendPush(supabase: SupabaseClient, userId: string, title: string, body: string) {
  const FCM_KEY = Deno.env.get('FCM_SERVER_KEY')
  if (!FCM_KEY) return

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', userId)

  const webTokens = (tokens || []).filter((t: any) => t.platform === 'web').map((t: any) => t.token)
  if (webTokens.length === 0) return

  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${FCM_KEY}`,
    },
    body: JSON.stringify({
      registration_ids: webTokens,
      notification: { title, body },
    }),
  })
}
