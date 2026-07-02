// ==================================================
// Supabase Edge Function: daily-engagement
// Roda diariamente via pg_cron às 09:00 BRT
// Para cada tenant → analisa cada paciente → 
// gera mensagem IA personalizada → salva no inbox
// ==================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''

interface PatientContext {
  user_id: string
  name: string
  tenant_id: string
  current_streak: number
  last_checkin_date: string | null
  total_xp: number
  current_plan: string
  primary_goal: string | null
  daysSinceActivity: number
  adherenceRate: number  // 0-100, últimos 7 dias
  riskLevel: 'low' | 'medium' | 'high'
  checkinScore: number | null  // nota da dieta do último check-in semanal
}

interface TenantContext {
  id: string
  brand_name: string
  method_name: string | null
  gpt_system_prompt: string | null
  settings: any
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: aceita cron secret ou service role
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
  const body = await req.json().catch(() => ({}))
  const tenantIdFilter: string | null = body.tenant_id || null  // opcional: rodar só para 1 tenant

  try {
    const startTime = Date.now()
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // 1. Buscar todos os tenants ativos
    let tenantsQuery = supabase
      .from('tenants')
      .select('id, brand_name, method_name, gpt_system_prompt, settings')
      .eq('is_active', true)

    if (tenantIdFilter) {
      tenantsQuery = tenantsQuery.eq('id', tenantIdFilter)
    }

    const { data: tenants } = await tenantsQuery
    if (!tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ message: 'No active tenants', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: any[] = []

    for (const tenant of tenants) {
      // 2. Pacientes do tenant
      const { data: patients } = await supabase
        .from('profiles')
        .select('user_id, name, current_streak, last_checkin_date, total_xp, current_plan, primary_goal')
        .eq('tenant_id', tenant.id)
        .eq('role', 'patient')

      if (!patients || patients.length === 0) continue

      const userIds = patients.map((p: any) => p.user_id)

      // 3. Logs últimos 7 dias
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('user_id, log_date, meal_plan_check')
        .in('user_id', userIds)
        .gte('log_date', sevenDaysAgoStr)

      // 4. Último check-in semanal
      const { data: checkins } = await supabase
        .from('weekly_checkin_responses')
        .select('user_id, diet_score, ai_risk_level')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })

      // Mapas
      const logsByUser: Record<string, any[]> = {}
      for (const log of logs || []) {
        if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
        logsByUser[log.user_id].push(log)
      }

      const checkinByUser: Record<string, any> = {}
      for (const c of checkins || []) {
        if (!checkinByUser[c.user_id]) checkinByUser[c.user_id] = c
      }

      // 5. Calcular contexto de cada paciente
      const patientContexts: PatientContext[] = patients.map((p: any) => {
        const userLogs = logsByUser[p.user_id] || []
        const checkin = checkinByUser[p.user_id]

        const daysSince = p.last_checkin_date
          ? Math.floor((today.getTime() - new Date(p.last_checkin_date).getTime()) / 86400000)
          : 999

        const adherenceRate = userLogs.length > 0
          ? Math.round((userLogs.filter((l: any) => l.meal_plan_check).length / 7) * 100)
          : 0

        // Risk score
        let risk = 10
        if (daysSince > 7) risk -= 4
        else if (daysSince > 3) risk -= 2
        if (!p.current_streak || p.current_streak === 0) risk -= 3
        else if (p.current_streak < 3) risk -= 1
        if (adherenceRate < 30) risk -= 2
        else if (adherenceRate < 60) risk -= 1
        if (checkin?.diet_score !== undefined && checkin.diet_score < 5) risk -= 2
        if (checkin?.ai_risk_level === 'high') risk = Math.min(risk, 3)
        if (checkin?.ai_risk_level === 'medium') risk = Math.min(risk, 6)
        risk = Math.max(0, Math.min(10, risk))

        const riskLevel = risk <= 4 ? 'high' : risk <= 6 ? 'medium' : 'low'

        return {
          user_id: p.user_id,
          name: p.name || 'Rainha',
          tenant_id: tenant.id,
          current_streak: p.current_streak || 0,
          last_checkin_date: p.last_checkin_date,
          total_xp: p.total_xp || 0,
          current_plan: p.current_plan || 'community',
          primary_goal: p.primary_goal,
          daysSinceActivity: daysSince,
          adherenceRate,
          riskLevel,
          checkinScore: checkin?.diet_score ?? null,
        }
      })

      // 6. Processar pacientes que precisam de engajamento
      // Sempre toca em: high risk + medium risk + streak milestones
      const toEngage = patientContexts.filter(p =>
        p.riskLevel === 'high' ||
        p.riskLevel === 'medium' ||
        [7, 14, 21, 30, 60, 100].includes(p.current_streak)  // celebrar marcos de streak
      )

      let tenantNotified = 0

      for (const patient of toEngage) {
        try {
          const message = await generateEngagementMessage(patient, tenant)
          if (!message) continue

          // Salvar na inbox
          const { error: notifError } = await supabase
            .from('inbox_messages')
            .insert({
              tenant_id: tenant.id,
              user_id: patient.user_id,
              agent_name: 'daily_engagement',
              title: message.title,
              body: message.body,
              message_type: 'engagement',
              priority: 'normal',
              cta_label: message.cta_label || null,
              cta_url: message.cta_url || null,
              channels: ['inbox'],
            })

          if (!notifError) {
            tenantNotified++
          }

          // Tentar push se tiver device token
          const { data: tokens } = await supabase
            .from('device_tokens')
            .select('token, platform')
            .eq('user_id', patient.user_id)

          if (tokens && tokens.length > 0) {
            await sendPushNotification(tokens, message)
          }

        } catch (err) {
          console.error(`[daily-engagement] Error for patient ${patient.user_id}:`, err)
        }
      }

      results.push({
        tenant_id: tenant.id,
        brand_name: tenant.brand_name,
        patients_total: patients.length,
        patients_at_risk: toEngage.length,
        notifications_sent: tenantNotified,
      })
    }

    const elapsed = Date.now() - startTime

    return new Response(JSON.stringify({
      success: true,
      elapsed_ms: elapsed,
      tenants_processed: tenants.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[daily-engagement] Fatal error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Generate personalized message with Claude ───────────────────────────────
async function generateEngagementMessage(
  patient: PatientContext,
  tenant: TenantContext
): Promise<{ title: string; body: string; cta_label?: string; cta_url?: string } | null> {
  const firstName = patient.name.split(' ')[0]
  const tone = tenant.settings?.ai?.tone || 'motivadora'
  const methodName = tenant.method_name || 'Protocolo Nutri'
  const brand = tenant.brand_name

  const toneGuide: Record<string, string> = {
    acolhedora: 'Seja carinhosa, acolhedora e encorajadora. Use termos de afeto.',
    motivadora: 'Seja energética, motivacional e empoderada. Use energia positiva.',
    tecnica: 'Seja direta, objetiva e embasada em ciência. Sem floreios.',
  }

  // Determine message type
  const isStreakMilestone = [7, 14, 21, 30, 60, 100].includes(patient.current_streak)
  const isInactive = patient.daysSinceActivity > 3
  const isHighRisk = patient.riskLevel === 'high'

  let situationPrompt = ''

  if (isStreakMilestone) {
    situationPrompt = `A paciente atingiu ${patient.current_streak} dias consecutivos de streak. 
    Envie uma mensagem de CELEBRAÇÃO e parabéns.`
  } else if (isHighRisk && patient.daysSinceActivity > 7) {
    situationPrompt = `A paciente está inativa há ${patient.daysSinceActivity} dias e tem alto risco de evasão.
    Envie uma mensagem de RESGATE — carinhosa, sem julgamento, que faça ela querer voltar.`
  } else if (isHighRisk) {
    situationPrompt = `A paciente tem baixa adesão (${patient.adherenceRate}% nos últimos 7 dias) e streak zerado.
    Envie uma mensagem de MOTIVAÇÃO — que reconheça a dificuldade e encoraje um pequeno passo hoje.`
  } else if (patient.riskLevel === 'medium') {
    situationPrompt = `A paciente tem adesão média (${patient.adherenceRate}% nos últimos 7 dias).
    Envie uma mensagem de ENGAJAMENTO — uma dica prática para melhorar esta semana.`
  } else {
    return null  // low risk sem milestone → não notificar
  }

  const systemPrompt = tenant.gpt_system_prompt ||
    `Você é a nutricionista virtual especializada do ${brand}. Seu papel é ser companheira inteligente de cada mulher em sua jornada — presente nos bons dias, nos difíceis, nas dúvidas e nas conquistas. Priorize alimentos reais, acessíveis e do mercado brasileiro. Reconheça que comer é um ato emocional e nunca culpe ou julgue. Acolha recaídas com cuidado e ajude a retomar. Use sempre o nome da paciente para criar vínculo. Seja direta, prática e concisa — máximo 3 frases por mensagem de notificação. Nunca forneça diagnósticos médicos. Responda em português brasileiro natural e caloroso.`

  const userPrompt = `Você é a IA do ${brand}, método ${methodName}.
${toneGuide[tone] || toneGuide.motivadora}

SITUAÇÃO: ${situationPrompt}

PERFIL DA PACIENTE:
- Nome: ${firstName}
- Objetivo: ${patient.primary_goal || 'não informado'}
- Streak atual: ${patient.current_streak} dias
- Última atividade: ${patient.daysSinceActivity === 0 ? 'hoje' : `há ${patient.daysSinceActivity} dias`}
- Adesão 7d: ${patient.adherenceRate}%
${patient.checkinScore !== null ? `- Nota da dieta (check-in): ${patient.checkinScore}/10` : ''}

Retorne APENAS JSON válido:
{
  "title": "título da notificação (máx 8 palavras)",
  "body": "corpo da mensagem (máx 3 frases, personalize com o nome ${firstName})",
  "cta_label": "texto do botão (opcional, ex: Ver meu plano)",
  "cta_url": "/patient/home"
}`

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { maxOutputTokens: 300, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    console.error('[generateEngagementMessage] Error:', err)
    // Fallback sem IA
    return {
      title: isStreakMilestone
        ? `🔥 ${patient.current_streak} dias de streak, ${firstName}!`
        : isHighRisk
          ? `${firstName}, a gente está com saudade 💜`
          : `Dica da semana para você, ${firstName}`,
      body: isStreakMilestone
        ? `Uau! ${patient.current_streak} dias seguidos é incrível. Continue assim!`
        : isHighRisk
          ? `Faz ${patient.daysSinceActivity} dias que você não registra. Que tal começar com um pequeno passo hoje?`
          : `Sua adesão esta semana foi de ${patient.adherenceRate}%. Você consegue melhorar!`,
      cta_label: 'Abrir meu app',
      cta_url: '/patient/home',
    }
  }
}

// ─── Send web push (FCM) ─────────────────────────────────────────────────────
async function sendPushNotification(
  tokens: Array<{ token: string; platform: string }>,
  message: { title: string; body: string }
) {
  const FCM_KEY = Deno.env.get('FCM_SERVER_KEY')
  if (!FCM_KEY) return  // push não configurado — silently skip

  const webTokens = tokens.filter(t => t.platform === 'web').map(t => t.token)
  if (webTokens.length === 0) return

  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${FCM_KEY}`,
    },
    body: JSON.stringify({
      registration_ids: webTokens,
      notification: { title: message.title, body: message.body },
    }),
  })
}
