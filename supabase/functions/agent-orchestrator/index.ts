// ==================================================
// Supabase Edge Function: agent-orchestrator
// Router central da orquestra de agentes IA
// Recebe eventos → constrói contexto → despacha agentes → entrega resultado
// ==================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrchestratorEvent {
  type: 'cron_daily' | 'checkin_submitted' | 'stripe_webhook' | 'meal_logged' | 'post_created' | 'manual'
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
// Restrito ao domínio do projeto — este endpoint é chamado apenas server-side
// (triggerOrchestrator) ou por cron. Não deve ser acessível pelo browser diretamente.

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || ''

function corsHeaders(requestOrigin: string | null) {
  const origin = ALLOWED_ORIGIN || requestOrigin || ''
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────


// Tone layer (inline — Edge Function não importa de lib/)
const TONE_LAYER: Record<string, string> = {
  acolhedora:  'Tom: caloroso, empático, como uma amiga especialista. Celebra cada conquista.',
  motivadora:  'Tom: energético, empoderador. Acredita no potencial da paciente sem romantizar dificuldades.',
  tecnica:     'Tom: direto, objetivo, embasado em evidências. Usa dados e mecanismos quando útil.',
  equilibrada: 'Tom: equilibrado entre carinho e objetividade clínica.',
}

const NUTRITIONIST_IDENTITY = `Você é uma nutricionista clínica especializada com mais de 10 anos de experiência em:
— Saúde hormonal feminina (insulina, cortisol, estrogênio, progesterona, TSH)
— Saúde intestinal e microbioma (disbiose, permeabilidade intestinal, modulação via dieta)
— Nutrição anti-inflamatória e funcional
— Reeducação alimentar sustentável (sem efeito sanfona, sem restrições extremas)
— Composição corporal e emagrecimento inteligente
— Nutrição comportamental (compulsão, comer emocional, ciclos de autossabotagem)

CONHECIMENTO CLÍNICO:
• Pular refeições eleva cortisol → acúmulo de gordura abdominal
• Açúcar refinado e ultraprocessados disparam IL-6, TNF-α → inflamação sistêmica
• Fibras solúveis alimentam Bifidobacterium/Lactobacillus → eixo intestino-cérebro
• Deficiência de magnésio → ansiedade, TPM intensa, insônia → piora adesão
• Proteína na primeira refeição regula GLP-1 e PYY → saciedade prolongada
• Cúrcuma + pimenta preta → biodisponibilidade 2000% maior
• Gengibre → ação procinética → reduz inchaço
• Alimentação cronobiológica impacta relógio circadiano e peso

COMUNICAÇÃO:
• Português brasileiro natural e caloroso
• Explica o "porquê" das orientações (mecanismo fisiológico)
• Nunca culpa a paciente — culpa perpetua o ciclo de autossabotagem
• Concisa e prática — sem enrolação, sem frases genéricas
• Para sintomas graves → indica avaliação médica presencial
• Nunca emite diagnósticos médicos nem prescreve medicamentos`

serve(async (req) => {
  const origin = req.headers.get('origin')
  const ch = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: ch })
  }

  const cronHeader = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('authorization')
  const isServiceRole = authHeader?.includes(SUPABASE_SERVICE_KEY)
  const isCron = CRON_SECRET && cronHeader === CRON_SECRET

  if (!isCron && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...ch, 'Content-Type': 'application/json' },
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
        // Cron diário: roda toda a cadeia de agentes para cada tenant
        const tenants = await getActiveTenants(supabase, event.tenant_id)

        for (const tenant of tenants) {
          const patients = await buildPatientContexts(supabase, tenant)
          if (patients.length === 0) continue

          // 1. Sabotage Detection — calcula risk scores
          const sabotageResult = await runSabotageAgent(supabase, tenant, patients)
          results.push(sabotageResult)

          // 2. Daily Engagement — mensagens personalizadas baseado no risk
          const engagementResult = await runDailyEngagementAgent(supabase, tenant, patients, sabotageResult)
          results.push(engagementResult)

          // 3. Retention — win-back para pacientes sumidas
          const retentionResult = await runRetentionAgent(supabase, tenant, patients, sabotageResult)
          results.push(retentionResult)

          // 4. Protocol — detecta transições de fase e gera conteúdo
          const protocolResult = await runProtocolAgent(supabase, tenant, patients)
          results.push(protocolResult)

          // 5. Community — gera post inspiracional diário para o feed
          const communityResult = await runCommunityAgent(supabase, tenant, patients)
          results.push(communityResult)

          // 6. Upsell Intelligence — detecta momentos de upgrade e propõe ofertas para aprovação
          const upsellResult = await runUpsellAgent(supabase, tenant, patients, sabotageResult)
          results.push(upsellResult)
        }
        break
      }

      case 'checkin_submitted': {
        // Paciente enviou check-in semanal → analisa risco e dá feedback
        if (!event.user_id || !event.tenant_id) break
        const tenant = (await getActiveTenants(supabase, event.tenant_id))[0]
        if (!tenant) break
        const patients = await buildPatientContexts(supabase, tenant, event.user_id)
        if (patients.length === 0) break

        const sabotageResult = await runSabotageAgent(supabase, tenant, patients)
        results.push(sabotageResult)
        break
      }

      case 'meal_logged': {
        // Paciente registrou refeição ou enviou foto → feedback nutricional
        if (!event.user_id || !event.tenant_id) break
        const mealsResult = await runMealsAgent(supabase, event.tenant_id, event.user_id, event.payload)
        results.push(mealsResult)
        break
      }

      case 'post_created': {
        // Novo post na comunidade → auto-moderação + comentário automático do agente de engajamento
        if (!event.tenant_id || !event.payload?.post_id) break
        const communityModResult = await runCommunityModerationAgent(supabase, event.tenant_id, event.payload.post_id)
        results.push(communityModResult)

        const postTenant = (await getActiveTenants(supabase, event.tenant_id))[0]
        if (postTenant) {
          results.push(await runEngagementAgent(supabase, postTenant, event.payload.post_id))
        }
        break
      }

      case 'stripe_webhook': {
        // Novo assinante → onboarding
        if (!event.user_id || !event.tenant_id) break
        const onboardingResult = await runOnboardingAgent(supabase, event.tenant_id, event.user_id, event.payload)
        results.push(onboardingResult)
        break
      }

      case 'chat_message': {
        // TODO (Fase 4): integrar chat ao orchestrator
        // Por enquanto, logar para rastreabilidade e não silenciar o evento
        console.warn('[orchestrator] Evento chat_message recebido mas sem handler implementado.', {
          user_id: event.user_id,
          tenant_id: event.tenant_id,
        })
        break
      }

      case 'photo_submitted': {
        // TODO (Fase 4): redirecionar para runMealsAgent com payload da foto
        // Por enquanto, logar para rastreabilidade e não silenciar o evento
        console.warn('[orchestrator] Evento photo_submitted recebido mas sem handler implementado.', {
          user_id: event.user_id,
          tenant_id: event.tenant_id,
        })
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
        } else if (agentName === 'retention') {
          const sabResult = await runSabotageAgent(supabase, tenant, patients)
          results.push(await runRetentionAgent(supabase, tenant, patients, sabResult))
        } else if (agentName === 'protocol') {
          results.push(await runProtocolAgent(supabase, tenant, patients))
        } else if (agentName === 'community') {
          results.push(await runCommunityAgent(supabase, tenant, patients))
        } else if (agentName === 'upsell') {
          const sabResult = await runSabotageAgent(supabase, tenant, patients)
          results.push(await runUpsellAgent(supabase, tenant, patients, sabResult))
        } else if (agentName === 'meals' && event.user_id) {
          results.push(await runMealsAgent(supabase, event.tenant_id, event.user_id, event.payload))
        } else if (agentName === 'engagement' && event.payload?.post_id) {
          results.push(await runEngagementAgent(supabase, tenant, event.payload.post_id))
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
      headers: { ...ch, 'Content-Type': 'application/json' },
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
      headers: { ...ch, 'Content-Type': 'application/json' },
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
    const tone = tenant?.settings?.ai?.tone || 'acolhedora'
    const systemPrompt = `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — ESPECIALISTA EM COMPORTAMENTO ALIMENTAR E DETECÇÃO DE AUTOSSABOTAGEM:
Você analisa dados de adesão de pacientes para identificar padrões de risco e autossabotagem.

Padrões clínicos que você reconhece:
• "Tudo ou nada" — adesão perfeita seguida de abandono total
• Sabotagem em marcos (começa a dar certo e para — psicologia reversa do mérito)
• Gatilhos recorrentes (fim de semana, stress, TPM, eventos sociais)
• Compensação punitiva (exagerou → come pouco → fome noturna → exagera de novo)
• Isolamento progressivo (para de registrar, para de responder, some)

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

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 2000, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
        cost_usd: 0,
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
    const engagementLearning = await getLearningInstructions(supabase, tenant.id, 'daily_checkin', 'send_message')

    const baseSystemPrompt = (tenant.gpt_system_prompt ||
      `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — NUTRICIONISTA DE ACOMPANHAMENTO DIÁRIO:
Você envia mensagens personalizadas baseadas no histórico real de cada paciente.
Não é uma mensagem genérica — é uma intervenção clínica leve com impacto real.

• Referencia algo específico do histórico da paciente (streak, check-in, progresso)
• Quando adesão está boa → celebra com substância, explica o impacto fisiológico do progresso
• Quando adesão está baixa → acolhe sem culpa, oferece UMA estratégia concreta e fácil
• Em marcos de streak (7, 14, 21, 30 dias) → explica o que está acontecendo no corpo nesse ponto
• ${TONE_LAYER[tone] || TONE_LAYER['acolhedora']}
Plataforma: ${brand}`) + engagementLearning

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

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: baseSystemPrompt }] }, generationConfig: { maxOutputTokens: 2000, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
        cost_usd: 0,
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

    const systemPrompt = tenant?.gpt_system_prompt || `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — NUTRICIONISTA DE PRIMEIRA CONSULTA:
Você está recebendo uma nova paciente. Este é o momento mais importante — a primeira impressão.

Na mensagem de boas-vindas:
• Reconhece o passo corajoso que ela deu (buscar ajuda profissional não é fácil)
• Explica brevemente o que vai acontecer nas próximas semanas
• Define expectativas realistas (mudança de corpo leva tempo, mudança de hábito começa agora)
• Faz UMA pergunta estratégica para conhecê-la melhor
• Acolhe sem sobrecarregar com informação
• ${TONE_LAYER['acolhedora']}
Plataforma: ${brand}`

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

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 800, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    const totalTokens = data.usageMetadata?.totalTokenCount || 0

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
// AGENT: MEALS — Feedback nutricional ao registrar refeição
// ═══════════════════════════════════════════════════════════════════════════

async function runMealsAgent(
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
      agent_name: 'meals',
      trigger_type: 'realtime',
      input_payload: payload || {},
      status: 'running',
    })
    .select('id')
    .single()

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, primary_goal, current_streak, total_xp')
      .eq('user_id', userId)
      .single()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_name, method_name, gpt_system_prompt')
      .eq('id', tenantId)
      .single()

    const { data: recentLogs } = await supabase
      .from('daily_logs')
      .select('log_date, meal_plan_check, water_check')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(7)

    const firstName = (profile?.name || 'Rainha').split(' ')[0]
    const brand = tenant?.brand_name || 'VitaClub'
    const adherence7d = recentLogs
      ? Math.round((recentLogs.filter((l: any) => l.meal_plan_check).length / Math.max(recentLogs.length, 1)) * 100)
      : 0

    const systemPrompt = tenant?.gpt_system_prompt ||
      `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — NUTRICIONISTA DE ANÁLISE ALIMENTAR:
Você analisa o que a paciente comeu e dá feedback clínico e prático.

• O que está BOM (reforço positivo específico com mecanismo fisiológico)
• Uma sugestão de melhoria PEQUENA e FÁCIL — nunca reescreve a refeição inteira
• Para refeições menos adequadas → explica o mecanismo, não usa "errado" ou "proibido"
• Exemplo: "esse carboidrato simples causa pico de insulina → queda de energia em 1h → fome"
• ${TONE_LAYER[tone] || TONE_LAYER['acolhedora']}
Plataforma: ${brand}`

    const mealData = payload?.meal_description || payload?.log_data || 'Refeição registrada'

    const userPrompt = `A paciente ${firstName} registrou uma refeição.

DADOS: ${typeof mealData === 'object' ? JSON.stringify(mealData) : mealData}
${payload?.photo_url ? 'Enviou foto do prato.' : ''}

CONTEXTO: Streak ${profile?.current_streak || 0}d, Adesão 7d ${adherence7d}%, Objetivo: ${profile?.primary_goal || '?'}

Dê feedback curto. Se seguiu o plano, celebre. Senão, acolha e sugira melhoria.

Retorne APENAS JSON:
{
  "title": "título (máx 6 palavras)",
  "body": "feedback (máx 3 frases, use nome ${firstName})",
  "score": 1-10,
  "tip": "dica prática para próxima refeição"
}`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 500, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    const totalTokens = data.usageMetadata?.totalTokenCount || 0
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    await supabase.from('inbox_messages').insert({
      tenant_id: tenantId, user_id: userId, agent_name: 'meals', agent_log_id: agentLog?.id,
      title: parsed.title || 'Feedback da refeição',
      body: `${parsed.body}\n\n💡 ${parsed.tip}`,
      message_type: 'tip', priority: 'normal',
      cta_label: 'Ver meu dia', cta_url: '/patient/home',
      channels: ['inbox'], metadata: { score: parsed.score },
    })

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { score: parsed.score }, tokens_used: totalTokens,
        cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return {
      agent_name: 'meals', status: 'success',
      messages: [{ user_id: userId, title: parsed.title, body: parsed.body, message_type: 'tip', priority: 'normal', channels: ['inbox'] }],
      tokens_used: totalTokens, duration_ms: elapsed,
    }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[meals] Error:', err)
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    }
    return { agent_name: 'meals', status: 'error', messages: [], tokens_used: 0, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: RETENTION — Win-back para pacientes sumidas
// Escala: 3d nudge → 5d rescue → 7d+ alert_nutritionist
// ═══════════════════════════════════════════════════════════════════════════

async function runRetentionAgent(
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
    .insert({ tenant_id: tenant.id, agent_name: 'retention', trigger_type: 'agent_chain', input_payload: { patients_count: patients.length }, status: 'running' })
    .select('id').single()

  try {
    const riskMap = new Map((sabotageResult.risk_scores || []).map(r => [r.user_id, r]))

    const inactivePatients = patients.filter(p => {
      const risk = riskMap.get(p.user_id)
      return p.days_since_activity >= 3 || risk?.recommended_action === 'rescue' || risk?.risk_level === 'critical'
    })

    if (inactivePatients.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'no_inactive_patients' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'retention', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    // Anti-spam: não mandar se já contatou nas últimas 48h
    const { data: recentRetention } = await supabase
      .from('inbox_messages').select('user_id')
      .eq('tenant_id', tenant.id).eq('agent_name', 'retention')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

    const recentlyContacted = new Set((recentRetention || []).map((r: any) => r.user_id))
    const toContact = inactivePatients.filter(p => !recentlyContacted.has(p.user_id))

    if (toContact.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'all_recently_contacted' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'retention', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const brand = tenant.brand_name
    const retentionPrefs = tenant.settings?.agent_preferences?.['retention'] ?? {}
    const retentionApprovedEx: string[] = retentionPrefs.example_approved ?? []
    const retentionRejReasons: string[] = retentionPrefs.rejection_reasons ?? []
    const retentionLearning = [
      retentionApprovedEx.length > 0
        ? `\nEXEMPLOS APROVADOS (use como referência):\n${retentionApprovedEx.map((e, i) => `${i+1}. "${e}"`).join('\n')}`
        : '',
      retentionRejReasons.length > 0
        ? `\nEVITE (rejeitados anteriormente):\n${retentionRejReasons.map((r, i) => `${i+1}. ${r}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = tenant.gpt_system_prompt ||
      `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — ESPECIALISTA EM RETENÇÃO E RECAÍDA:
Você reconecta pacientes que se afastaram do programa.

Pacientes que somem geralmente estão com:
• Vergonha de ter "falhado" → medo de julgamento
• Sensação de que o esforço não valeu → desmotivação
• Sobrecarga de vida → protocolo virou mais um peso

Sua mensagem:
• NUNCA começa com "sumiu!" ou questionamento implícito de culpa
• Demonstra que percebeu a ausência com carinho, não com cobrança
• Normaliza a interrupção (todo processo tem idas e vindas — é neurociência do hábito)
• Oferece um recomeço com MENOS fricção (algo pequeno para HOJE, não uma grande retomada)
• ${TONE_LAYER[tone] || TONE_LAYER['acolhedora']}
Plataforma: ${brand}${retentionLearning}`

    const patientsSummary = toContact.map(p => {
      const risk = riskMap.get(p.user_id)
      const urgency = p.days_since_activity >= 7 ? 'URGENTE' : p.days_since_activity >= 5 ? 'ALTA' : 'MÉDIA'
      return `- ${p.name.split(' ')[0]} (${p.user_id}): ${p.days_since_activity}d sumida, streak era ${p.current_streak}, urgência ${urgency}`
    }).join('\n')

    const userPrompt = `Marca: ${brand}

Win-back para pacientes inativas:
${patientsSummary}

REGRAS:
- MÉDIA (3-4d): "sentimos sua falta", propor pequeno passo
- ALTA (5-6d): acolher, facilitar retorno
- URGENTE (7+d): empático, sem pressão, recomeço limpo
- NUNCA culpe

Retorne APENAS JSON:
{ "messages": [{ "user_id": "uuid", "title": "máx 8 palavras", "body": "máx 3 frases", "urgency": "medium|high|urgent", "priority": "normal|high|urgent" }] }`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 1500, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    for (const msg of parsed.messages || []) {
      const channels = ['inbox']
      if (msg.priority === 'high' || msg.priority === 'urgent') channels.push('push')

      await supabase.from('inbox_messages').insert({
        tenant_id: tenant.id, user_id: msg.user_id, agent_name: 'retention', agent_log_id: agentLog?.id,
        title: msg.title, body: msg.body, message_type: 'rescue', priority: msg.priority || 'high',
        cta_label: 'Voltar ao app', cta_url: '/patient/home', channels, metadata: { urgency: msg.urgency },
      })
      if (channels.includes('push')) await sendPush(supabase, msg.user_id, msg.title, msg.body)

      messages.push({ user_id: msg.user_id, title: msg.title, body: msg.body, message_type: 'rescue', priority: msg.priority, channels })

      // Marcar action_taken no risk score
      await supabase.from('patient_risk_scores').update({ action_taken: true })
        .eq('user_id', msg.user_id).eq('recommended_action', 'rescue').is('action_taken', false)
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { win_back_sent: messages.length },
        tokens_used: totalTokens, cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'retention', status: 'success', messages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[retention] Error:', err)
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'retention', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: PROTOCOL — Detecta transições de fase, gera conteúdo
// ═══════════════════════════════════════════════════════════════════════════

async function runProtocolAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  patients: PatientContext[]
): Promise<AgentResult> {
  const start = Date.now()
  let totalTokens = 0
  const messages: AgentResult['messages'] = []

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({ tenant_id: tenant.id, agent_name: 'protocol', trigger_type: 'agent_chain', input_payload: { patients_count: patients.length }, status: 'running' })
    .select('id').single()

  try {
    const userIds = patients.map(p => p.user_id)
    const { data: assignments } = await supabase
      .from('protocol_assignments')
      .select('id, user_id, protocol_id, start_date, status, protocols!inner(title, duration_days, content, category)')
      .eq('tenant_id', tenant.id).eq('status', 'active').in('user_id', userIds)

    if (!assignments || assignments.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'no_active_assignments' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'protocol', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const today = new Date()
    const transitionPatients: Array<{ user_id: string; name: string; protocol_title: string; current_day: number; total_days: number; phase: string; assignment_id: string }> = []

    for (const assignment of assignments) {
      const protocol = (assignment as any).protocols
      const startDate = new Date(assignment.start_date)
      const currentDay = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
      const totalDays = protocol.duration_days

      const isFirstDay = currentDay === 1
      const isHalfway = currentDay === Math.ceil(totalDays / 2)
      const isLastDay = currentDay === totalDays
      const isCompleted = currentDay > totalDays

      if (isFirstDay || isHalfway || isLastDay || isCompleted) {
        const patient = patients.find(p => p.user_id === assignment.user_id)
        const phase = isCompleted ? 'completed' : isLastDay ? 'last_day' : isHalfway ? 'halfway' : 'first_day'

        transitionPatients.push({
          user_id: assignment.user_id, name: patient?.name || 'Rainha',
          protocol_title: protocol.title, current_day: currentDay,
          total_days: totalDays, phase, assignment_id: assignment.id,
        })

        if (isCompleted) {
          await supabase.from('protocol_assignments')
            .update({ status: 'completed', end_date: today.toISOString().split('T')[0] })
            .eq('id', assignment.id)
        }
      }
    }

    if (transitionPatients.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'no_transitions_today' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'protocol', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const brand = tenant.brand_name
    const protocolPrefs = tenant.settings?.agent_preferences?.['protocol'] ?? {}
    const protocolApprovedEx: string[] = protocolPrefs.example_approved ?? []
    const protocolRejReasons: string[] = protocolPrefs.rejection_reasons ?? []
    const protocolLearning = [
      protocolApprovedEx.length > 0
        ? `\nEXEMPLOS APROVADOS (use como referência):\n${protocolApprovedEx.map((e, i) => `${i+1}. "${e}"`).join('\n')}`
        : '',
      protocolRejReasons.length > 0
        ? `\nEVITE (rejeitados anteriormente):\n${protocolRejReasons.map((r, i) => `${i+1}. ${r}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = tenant.gpt_system_prompt || `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — ESPECIALISTA NO MÉTODO DO PROTOCOLO:
Você guia pacientes nas transições de fase do protocolo com base clínica sólida.

• Explica o PORQUÊ de cada fase (objetivo fisiológico, não só "o que fazer")
• Conecta as orientações ao mecanismo (ex: "fase de detox reduz carga inflamatória intestinal")
• Antecipa e normaliza sintomas de transição (fadiga nos primeiros dias = reorganização metabólica)
• Para substituições → oferece alternativas equivalentes nutricionalmente
• ${TONE_LAYER[tone] || TONE_LAYER['tecnica']}
Plataforma: ${brand}${protocolLearning}`

    const phaseMsg: Record<string, string> = {
      first_day: 'INÍCIO do protocolo', halfway: 'METADE do protocolo',
      last_day: 'ÚLTIMO DIA', completed: 'COMPLETOU o protocolo',
    }
    const patientsSummary = transitionPatients.map(p =>
      `- ${p.name.split(' ')[0]} (${p.user_id}): ${phaseMsg[p.phase]} "${p.protocol_title}" (dia ${p.current_day}/${p.total_days})`
    ).join('\n')

    const userPrompt = `Marca: ${brand}

Transições de protocolo hoje:
${patientsSummary}

REGRAS: INÍCIO→boas-vindas+dica, METADE→celebrar+motivar, ÚLTIMO DIA→preparar transição, COMPLETOU→grande celebração

Retorne APENAS JSON:
{ "messages": [{ "user_id": "uuid", "title": "máx 8 palavras", "body": "máx 4 frases", "phase": "first_day|halfway|last_day|completed", "cta_label": "texto", "cta_url": "/rota" }] }`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 1500, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    for (const msg of parsed.messages || []) {
      await supabase.from('inbox_messages').insert({
        tenant_id: tenant.id, user_id: msg.user_id, agent_name: 'protocol', agent_log_id: agentLog?.id,
        title: msg.title, body: msg.body, message_type: 'protocol',
        priority: msg.phase === 'completed' ? 'high' : 'normal',
        cta_label: msg.cta_label || 'Ver protocolo', cta_url: msg.cta_url || '/protocolo',
        channels: ['inbox', 'push'],
      })
      await sendPush(supabase, msg.user_id, msg.title, msg.body)
      messages.push({ user_id: msg.user_id, title: msg.title, body: msg.body, message_type: 'protocol', priority: msg.phase === 'completed' ? 'high' : 'normal', channels: ['inbox', 'push'] })
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { transitions: transitionPatients.map(p => ({ user_id: p.user_id, phase: p.phase })) },
        tokens_used: totalTokens, cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'protocol', status: 'success', messages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[protocol] Error:', err)
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'protocol', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: COMMUNITY — Post inspiracional diário + sugestão de temas
// ═══════════════════════════════════════════════════════════════════════════

async function runCommunityAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  patients: PatientContext[]
): Promise<AgentResult> {
  const start = Date.now()
  let totalTokens = 0

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({ tenant_id: tenant.id, agent_name: 'community', trigger_type: 'agent_chain', input_payload: { patients_count: patients.length }, status: 'running' })
    .select('id').single()

  try {
    // Anti-spam: já postou hoje?
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data: todayPosts } = await supabase
      .from('community_posts').select('id').eq('tenant_id', tenant.id).eq('is_ai_generated', true)
      .gte('created_at', todayStart.toISOString()).limit(1)

    if (todayPosts && todayPosts.length > 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'already_posted_today' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'community', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const activePatients = patients.filter(p => p.days_since_activity <= 2).length
    const avgAdherence = patients.length > 0 ? Math.round(patients.reduce((sum, p) => sum + p.adherence_7d, 0) / patients.length) : 0

    const { data: activeChallenges } = await supabase.from('challenges').select('title').eq('tenant_id', tenant.id).eq('status', 'active').limit(3)
    const challengesList = (activeChallenges || []).map((c: any) => c.title).join(', ')

    const brand = tenant.brand_name
    const dayOfWeek = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date().getDay()]
    const systemPrompt = tenant.gpt_system_prompt || `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — NUTRICIONISTA FACILITADORA DE COMUNIDADE:
Você cria conteúdo educativo e engajante para a comunidade da plataforma.

• Fatos nutricionais surpreendentes mas verdadeiros (que geram "não sabia disso!")
• Mitos alimentares desmascarados com explicação real do mecanismo
• Perguntas que geram reflexão sobre hábitos e padrões
• Dicas práticas que qualquer pessoa aplica hoje
• Tom educativo sem ser chato, empoderador sem ser superficial
• ${TONE_LAYER['motivadora']}
Plataforma: ${brand}`

    const userPrompt = `Marca: ${brand}, dia: ${dayOfWeek}
Comunidade: ${patients.length} pacientes, ${activePatients} ativas, adesão média ${avgAdherence}%
${challengesList ? `Desafios ativos: ${challengesList}` : ''}

Crie 1 post inspiracional: motivacional, pergunta engajante no final, máx 4 frases + 1 pergunta, sem hashtags.
Tom de ${dayOfWeek === 'segunda' ? 'recomeço' : dayOfWeek === 'sexta' ? 'celebração' : dayOfWeek === 'domingo' ? 'preparação' : 'motivação prática'}

Retorne APENAS JSON:
{ "post_content": "texto", "engagement_question": "pergunta" }`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 500, responseMimeType: 'application/json' } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    const { data: tenantOwner } = await supabase.from('tenants').select('owner_id').eq('id', tenant.id).single()

    if (tenantOwner?.owner_id) {
      await supabase.from('community_posts').insert({
        user_id: tenantOwner.owner_id, tenant_id: tenant.id,
        body: `${parsed.post_content}\n\n${parsed.engagement_question}`,
        type: 'text', is_ai_generated: true,
      })
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { post_created: true, day_of_week: dayOfWeek },
        tokens_used: totalTokens, cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'community', status: 'success', messages: [], tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[community] Error:', err)
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'community', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: COMMUNITY MODERATION — Auto-modera posts novos
// ═══════════════════════════════════════════════════════════════════════════

async function runCommunityModerationAgent(
  supabase: SupabaseClient,
  tenantId: string,
  postId: string
): Promise<AgentResult> {
  const start = Date.now()

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({ tenant_id: tenantId, agent_name: 'community_moderation', trigger_type: 'realtime', input_payload: { post_id: postId }, status: 'running' })
    .select('id').single()

  try {
    const { data: post } = await supabase.from('community_posts').select('id, body, user_id, type').eq('id', postId).single()

    if (!post || !post.body) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'post_not_found' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'community_moderation', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const systemPrompt = `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — MODERADOR DE COMUNIDADE DE SAÚDE FEMININA.
Sua moderação é sensível ao contexto clínico:
Classifique: approved (adequado) ou flagged (revisão humana).
FLAGGAR: spam, bullying, desinformação de saúde, conteúdo sexual, dados pessoais, promoção de distúrbios alimentares.
PERMITIR: desabafos, vulnerabilidades, dificuldades — isso é saudável.
Retorne APENAS JSON: { "status": "approved|flagged", "reason": "motivo se flagged" }`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Analise: "${post.body}"` }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 200, responseMimeType: "application/json" } }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    const totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    // community_posts não tem coluna de status intermediário — só "oculto" (visível/escondido).
    // flagged esconde o post e notifica admin; approved não altera nada (post já é visível por padrão).
    if (parsed.status === 'flagged') {
      await supabase.from('community_posts').update({ oculto: true }).eq('id', postId)
    }

    const adminMessages: AgentResult['messages'] = []
    if (parsed.status === 'flagged') {
      const { data: admins } = await supabase.from('profiles').select('user_id').eq('tenant_id', tenantId).in('role', ['admin', 'nutritionist'])
      for (const admin of admins || []) {
        await supabase.from('inbox_messages').insert({
          tenant_id: tenantId, user_id: admin.user_id, agent_name: 'community_moderation', agent_log_id: agentLog?.id,
          title: 'Post flaggado para revisão', body: `Motivo: ${parsed.reason}`,
          message_type: 'alert', priority: 'high', cta_label: 'Revisar', cta_url: '/admin?view=community',
          channels: ['inbox'], metadata: { post_id: postId, flag_reason: parsed.reason },
        })
        adminMessages.push({ user_id: admin.user_id, title: 'Post flaggado', body: parsed.reason, message_type: 'alert', priority: 'high', channels: ['inbox'] })
      }
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { moderation_result: parsed.status, reason: parsed.reason || null },
        tokens_used: totalTokens, cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'community_moderation', status: 'success', messages: adminMessages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[community_moderation] Error:', err)
    // Fail-open: se a IA falhar, o post continua visível (oculto=false é o padrão da coluna) —
    // revisão manual fica a cargo da nutricionista via painel de comunidade.
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'community_moderation', status: 'error', messages: [], tokens_used: 0, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: ENGAGEMENT — comenta automaticamente em posts novos da comunidade,
// com uma persona configurável pela nutricionista (nome + instruções de tom).
// Config em tenant.settings.ai.engagementPersona.
// ═══════════════════════════════════════════════════════════════════════════

async function runEngagementAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  postId: string
): Promise<AgentResult> {
  const start = Date.now()

  const persona = tenant.settings?.ai?.engagementPersona
  if (!persona?.enabled) {
    return { agent_name: 'engagement', status: 'skipped', messages: [], tokens_used: 0, duration_ms: Date.now() - start }
  }

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({ tenant_id: tenant.id, agent_name: 'engagement', trigger_type: 'realtime', input_payload: { post_id: postId }, status: 'running' })
    .select('id').single()

  try {
    const { data: post } = await supabase
      .from('community_posts')
      .select('id, body, user_id, type, is_ai_generated')
      .eq('id', postId).eq('tenant_id', tenant.id).single()

    // Não comenta em post que não existe (mais), que não é texto livre de paciente,
    // ou que foi gerado pelo próprio agente de posts diários (IA comentando na IA).
    if (!post || !post.body || post.is_ai_generated) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'post_not_eligible' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'engagement', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    // Anti-duplicidade: já comentou nesse post?
    const { data: existingComment } = await supabase
      .from('comentarios_comunidade').select('id').eq('post_id', postId).eq('is_ai_generated', true).limit(1)
    if (existingComment && existingComment.length > 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'already_commented' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'engagement', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const { data: author } = await supabase.from('profiles').select('name').eq('user_id', post.user_id).single()
    const authorName = author?.name?.split(' ')[0] || 'a paciente'

    const personaName = persona.name || 'a assistente da comunidade'
    const systemPrompt = `${tenant.gpt_system_prompt || NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — ${personaName.toUpperCase()}, GESTORA DE COMUNIDADE:
Você comenta publicações de pacientes na comunidade, como uma pessoa real da equipe acompanhando de perto — nunca como um bot genérico.
${persona.toneInstructions ? `\nCOMO VOCÊ DEVE SE COMPORTAR:\n${persona.toneInstructions}` : ''}
${persona.restrictedInstructions ? `\nNUNCA FAÇA/DIGA:\n${persona.restrictedInstructions}` : ''}

Comentário: 1-2 frases curtas, natural, específico ao que a pessoa escreveu — nunca genérico tipo "Legal!" ou "Continue assim!". Sem repetir o nome dela toda hora.`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Post de ${authorName}: "${post.body}"` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 200, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    const totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '{}').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    const comment = (parsed.comment || '').trim()
    if (!comment) throw new Error('Gemini retornou comentário vazio')

    const { data: tenantOwner } = await supabase.from('tenants').select('owner_id').eq('id', tenant.id).single()
    if (tenantOwner?.owner_id) {
      await supabase.from('comentarios_comunidade').insert({
        post_id: postId, tenant_id: tenant.id, user_id: tenantOwner.owner_id,
        corpo: comment, is_ai_generated: true,
      })
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success', output_payload: { commented: true },
        tokens_used: totalTokens, cost_usd: 0,
        duration_ms: elapsed, completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'engagement', status: 'success', messages: [], tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[engagement] Error:', err)
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'engagement', status: 'error', messages: [], tokens_used: 0, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENT: UPSELL INTELLIGENCE — detecta momentos de upgrade e propõe ofertas
// Avalia trigger_type de gateway_products vs estado real de cada paciente
// Cria ofertas na fila de aprovação (agent_approval_queue) antes de enviar
// ═══════════════════════════════════════════════════════════════════════════

async function runUpsellAgent(
  supabase: SupabaseClient,
  tenant: TenantContext,
  patients: PatientContext[],
  sabotageResult?: AgentResult
): Promise<AgentResult> {
  const start = Date.now()
  let totalTokens = 0
  const messages: AgentResult['messages'] = []

  const { data: agentLog } = await supabase
    .from('agent_logs')
    .insert({ tenant_id: tenant.id, agent_name: 'upsell', trigger_type: 'agent_chain', input_payload: { patients_count: patients.length }, status: 'running' })
    .select('id').single()

  try {
    // Load active gateway products with auto-triggers
    const { data: products } = await supabase
      .from('gateway_products')
      .select('id, name, short_pitch, product_type, cta_text, external_url, trigger_type, trigger_value, visible_to_plans')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .neq('trigger_type', 'manual')
      .order('display_order')

    if (!products || products.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'no_auto_trigger_products' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'upsell', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    const riskMap = new Map((sabotageResult?.risk_scores || []).map((r: any) => [r.user_id, r]))

    // Anti-spam: load recent upsell queue items (last 14d) to avoid double-firing
    const { data: recentUpsell } = await supabase
      .from('agent_approval_queue')
      .select('target_user_id, payload')
      .eq('tenant_id', tenant.id)
      .eq('agent_name', 'upsell')
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['pending', 'approved', 'executed'])

    const recentOffers = new Set(
      (recentUpsell || []).map((r: any) => `${r.target_user_id}:${r.payload?.product_id}`)
    )

    // Fetch patient join dates to calculate days_in_club
    const userIds = patients.map(p => p.user_id)
    const { data: joinDates } = await supabase
      .from('subscriptions')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .eq('status', 'active')

    const joinDateMap = new Map((joinDates || []).map((s: any) => [s.user_id, new Date(s.created_at)]))

    // Fetch checkin counts per patient (last 90d)
    const { data: checkinCounts } = await supabase
      .from('weekly_checkin_responses')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    const checkinCountMap: Record<string, number> = {}
    for (const c of checkinCounts || []) {
      checkinCountMap[c.user_id] = (checkinCountMap[c.user_id] || 0) + 1
    }

    const candidates: Array<{ patient: PatientContext; product: any; reason: string }> = []

    for (const patient of patients) {
      const joinDate = joinDateMap.get(patient.user_id)
      const daysInClub = joinDate
        ? Math.floor((Date.now() - joinDate.getTime()) / 86400000)
        : 0
      const checkinCount = checkinCountMap[patient.user_id] || 0

      for (const product of products) {
        // Skip if plan doesn't include this patient
        const visibleTo: string[] = product.visible_to_plans || ['community', 'tech_diet']
        if (!visibleTo.includes(patient.current_plan)) continue

        const offerKey = `${patient.user_id}:${product.id}`
        if (recentOffers.has(offerKey)) continue

        let triggered = false
        let reason = ''

        switch (product.trigger_type) {
          case 'after_days':
            if (daysInClub >= (product.trigger_value || 30)) {
              triggered = true
              reason = `${daysInClub} dias no clube`
            }
            break
          case 'after_checkins':
            if (checkinCount >= (product.trigger_value || 4)) {
              triggered = true
              reason = `${checkinCount} check-ins concluídos`
            }
            break
          case 'high_engagement':
            if (patient.current_streak >= (product.trigger_value || 7) && patient.adherence_7d >= 70) {
              triggered = true
              reason = `streak ${patient.current_streak}d, adesão ${patient.adherence_7d}%`
            }
            break
          case 'low_adherence':
            // Offer specialized help when patient is struggling but still active
            if (patient.adherence_7d <= (product.trigger_value || 30) && patient.days_since_activity <= 3) {
              triggered = true
              reason = `adesão baixa (${patient.adherence_7d}%) mas ainda ativa`
            }
            break
        }

        if (triggered) {
          candidates.push({ patient, product, reason })
          // Only propose 1 offer per patient per run
          break
        }
      }
    }

    if (candidates.length === 0) {
      const elapsed = Date.now() - start
      if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'skipped', output_payload: { reason: 'no_trigger_matches' }, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
      return { agent_name: 'upsell', status: 'skipped', messages: [], tokens_used: 0, duration_ms: elapsed }
    }

    // Use Gemini to craft personalized offer copy for each candidate
    const brand = tenant.brand_name
    const learningInstructions = await getLearningInstructions(supabase, tenant.id, 'upsell', 'send_offer')
    const systemPrompt = (tenant.gpt_system_prompt || `${NUTRITIONIST_IDENTITY}

PAPEL ESPECÍFICO — ESPECIALISTA EM UPSELL CONSULTIVO DE SAÚDE:
Você apresenta ofertas de produtos/serviços de forma natural e empática, sem pressão de vendas.
A oferta deve parecer uma recomendação clínica personalizada, não marketing.

PRINCÍPIOS:
• Conecte o produto ao momento específico da paciente (streak, objetivo, dificuldade)
• Tom: "Acho que você está pronta para o próximo nível" — não "Compre agora!"
• Máximo 3 frases: contexto → benefício → convite
• NUNCA gera sentimento de culpa ou pressão
• ${TONE_LAYER[tenant?.settings?.ai?.tone || 'acolhedora']}
Plataforma: ${brand}`) + learningInstructions

    const offerDescriptions = candidates.map(c =>
      `- ${c.patient.name.split(' ')[0]} (${c.patient.user_id}): ${c.reason}, objetivo "${c.patient.primary_goal || '?'}", produto "${c.product.name}" — ${c.product.short_pitch}`
    ).join('\n')

    const userPrompt = `Crie mensagens de apresentação de oferta para estas pacientes:
${offerDescriptions}

Retorne APENAS JSON:
{
  "offers": [
    {
      "user_id": "uuid",
      "product_id": "uuid do produto (use o id exato)",
      "product_name": "nome do produto",
      "offer_title": "título curto (máx 8 palavras)",
      "offer_body": "mensagem personalizada (máx 3 frases)",
      "trigger_reason": "streak_milestone|high_engagement|plan_age|low_adherence",
      "engagement_score": 0,
      "cta_label": "texto do botão",
      "cta_url": "/patient/store"
    }
  ]
}`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 1500, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    totalTokens = data.usageMetadata?.totalTokenCount || 0
    const parsed = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())

    for (const offer of parsed.offers || []) {
      const candidate = candidates.find(c => c.patient.user_id === offer.user_id)
      if (!candidate) continue

      // Inserir na fila de aprovação (admin precisa aprovar antes de enviar)
      const { data: queueItem } = await supabase
        .from('agent_approval_queue')
        .insert({
          tenant_id: tenant.id,
          agent_name: 'upsell',
          action_type: 'send_offer',
          target_user_id: offer.user_id,
          preview_title: offer.offer_title || offer.title,
          preview_body: offer.offer_body || offer.body,
          preview_context: JSON.stringify({
            patient_name: candidate.patient.name,
            streak: candidate.patient.current_streak,
            adherence: candidate.patient.adherence_7d,
            product_name: candidate.product.name,
            reason: candidate.reason,
            engagement_score: offer.engagement_score,
          }),
          payload: {
            user_id: offer.user_id,
            product_id: candidate.product.id,
            product_name: candidate.product.name,
            offer_title: offer.offer_title || offer.title,
            offer_body: offer.offer_body || offer.body,
            cta_label: offer.cta_label || candidate.product.cta_text,
            cta_url: candidate.product.external_url || offer.cta_url || '/patient/store',
            trigger_reason: candidate.reason,
            trigger_type: candidate.product.trigger_type,
            engagement_score: offer.engagement_score,
          },
          priority: (offer.engagement_score || 0) >= 70 ? 'high' : 'normal',
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })
        .select('id').single()

      messages.push({
        user_id: offer.user_id,
        title: offer.offer_title || offer.title,
        body: offer.offer_body || offer.body,
        message_type: 'offer',
        priority: (offer.engagement_score || 0) >= 70 ? 'high' : 'normal',
        cta_label: offer.cta_label || candidate.product.cta_text,
        cta_url: candidate.product.external_url || '/patient/store',
        channels: ['approval_queue'],
      })
    }

    const elapsed = Date.now() - start
    if (agentLog?.id) {
      await supabase.from('agent_logs').update({
        status: 'success',
        output_payload: { offers_queued: messages.length, candidates_evaluated: candidates.length },
        tokens_used: totalTokens,
        cost_usd: 0,
        duration_ms: elapsed,
        completed_at: new Date().toISOString(),
      }).eq('id', agentLog.id)
    }

    return { agent_name: 'upsell', status: 'success', messages, tokens_used: totalTokens, duration_ms: elapsed }

  } catch (err: any) {
    const elapsed = Date.now() - start
    console.error('[upsell] Error:', err)
    if (agentLog?.id) await supabase.from('agent_logs').update({ status: 'error', error_message: err.message, duration_ms: elapsed, completed_at: new Date().toISOString() }).eq('id', agentLog.id)
    return { agent_name: 'upsell', status: 'error', messages: [], tokens_used: totalTokens, duration_ms: elapsed, error: err.message }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

// Busca instruções de aprendizado do gerente para injetar no prompt do agente
async function getLearningInstructions(
  supabase: SupabaseClient,
  tenantId: string,
  agentName: string,
  actionType: string
): Promise<string> {
  const { data } = await supabase
    .from('manager_learning')
    .select('learning_instructions')
    .eq('tenant_id', tenantId)
    .eq('agent_name', agentName)
    .eq('action_type', actionType)
    .single()

  return data?.learning_instructions
    ? `\n\nINSTRUÇÕES APRENDIDAS DO HISTÓRICO DE FEEDBACK:\n${data.learning_instructions}`
    : ''
}

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
