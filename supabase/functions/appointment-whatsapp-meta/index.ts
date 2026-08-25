import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

type Claim = {
  job_id: string
  tenant_id: string
  appointment_id: string
  patient_id: string
  kind: string
  phone: string
  patient_name: string
  scheduled_at: string
  timezone: string
  appointment_type: string
  template_name: string
  template_language: string
  parameter_keys: string[]
  phone_number_id: string
  graph_version: string
  access_token_env: string
  verify_token_env: string
  app_secret_env: string
  fallback_to_inbox: boolean
}

function secretKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, string>
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (first) return first
    } catch { /* legacy fallback below */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || ''
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabase = createClient(supabaseUrl, secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function timingSafeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (aa.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]
  return diff === 0
}

function normalizePhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  // Perfis brasileiros historicamente podem estar sem DDI.
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) return `55${digits}`
  return digits
}

function parts(iso: string, timezone: string) {
  const date = new Date(iso)
  const appointmentDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone || 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
  const appointmentTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone || 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
  return { appointmentDate, appointmentTime }
}

function parameterValue(key: string, job: Claim) {
  const { appointmentDate, appointmentTime } = parts(job.scheduled_at, job.timezone)
  const values: Record<string, string> = {
    patient_name: job.patient_name || 'Paciente',
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    appointment_type: job.appointment_type || 'Consulta',
    appointment_id: job.appointment_id,
  }
  return values[key] ?? ''
}

async function completeJob(jobId: string, success: boolean, opts: {
  messageId?: string
  error?: string
  retryable?: boolean
  metadata?: Record<string, unknown>
}) {
  const { data, error } = await supabase.rpc('service_complete_appointment_whatsapp_job', {
    p_job_id: jobId,
    p_success: success,
    p_provider_message_id: opts.messageId ?? null,
    p_error: opts.error ?? null,
    p_retryable: opts.retryable ?? true,
    p_response_metadata: opts.metadata ?? {},
  })
  if (error) throw new Error(`complete_job: ${error.message}`)
  return data
}

function retryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

async function sendMetaTemplate(job: Claim) {
  const token = Deno.env.get(job.access_token_env)
  if (!token) {
    return completeJob(job.job_id, false, {
      error: `Secret ${job.access_token_env} não configurado na Edge Function`,
      retryable: false,
      metadata: { code: 'provider_secret_missing' },
    })
  }

  const phone = normalizePhone(job.phone)
  if (!phone) {
    return completeJob(job.job_id, false, {
      error: 'Telefone WhatsApp inválido ou ausente', retryable: false,
      metadata: { code: 'invalid_phone' },
    })
  }

  const keys = Array.isArray(job.parameter_keys) ? job.parameter_keys : []
  const parameters = keys.map(key => ({ type: 'text', text: parameterValue(String(key), job) }))
  const template: Record<string, unknown> = {
    name: job.template_name,
    language: { code: job.template_language || 'pt_BR' },
  }
  if (parameters.length) template.components = [{ type: 'body', parameters }]

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template,
  }

  let response: Response
  try {
    response = await fetch(`https://graph.facebook.com/${job.graph_version}/${job.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    return completeJob(job.job_id, false, {
      error: `Falha de rede Meta: ${(error as Error).message}`,
      retryable: true,
      metadata: { code: 'network_error' },
    })
  }

  let responseBody: any = null
  try { responseBody = await response.json() } catch { responseBody = null }

  if (!response.ok) {
    const metaError = responseBody?.error
    const message = String(metaError?.message || `Meta HTTP ${response.status}`).slice(0, 450)
    return completeJob(job.job_id, false, {
      error: message,
      retryable: retryableStatus(response.status),
      metadata: {
        http_status: response.status,
        meta_code: metaError?.code ?? null,
        meta_subcode: metaError?.error_subcode ?? null,
        fbtrace_id: metaError?.fbtrace_id ?? null,
      },
    })
  }

  const messageId = responseBody?.messages?.[0]?.id
  if (!messageId) {
    return completeJob(job.job_id, false, {
      error: 'Meta aceitou a requisição sem retornar message id',
      retryable: true,
      metadata: { http_status: response.status },
    })
  }

  return completeJob(job.job_id, true, {
    messageId,
    retryable: false,
    metadata: {
      wa_id: responseBody?.contacts?.[0]?.wa_id ?? null,
      graph_version: job.graph_version,
      template_name: job.template_name,
    },
  })
}

async function dispatch(req: Request, body: any) {
  const token = req.headers.get('x-dispatch-token') || ''
  const { data: verified, error: verifyError } = await supabase.rpc('service_verify_appointment_dispatch_token', { p_token: token })
  if (verifyError || verified !== true) return json({ error: 'unauthorized' }, 401)

  const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)))
  const { data, error } = await supabase.rpc('service_claim_appointment_whatsapp_jobs', { p_limit: limit })
  if (error) return json({ error: error.message }, 500)

  const jobs = (data || []) as Claim[]
  const results: Array<Record<string, unknown>> = []
  for (const job of jobs) {
    try {
      const result = await sendMetaTemplate(job)
      results.push({ job_id: job.job_id, result })
    } catch (error) {
      try {
        await completeJob(job.job_id, false, { error: (error as Error).message, retryable: true })
      } catch { /* job will be reclaimable after stale-lock window */ }
      results.push({ job_id: job.job_id, error: (error as Error).message })
    }
  }
  return json({ claimed: jobs.length, results })
}

async function verifyWebhook(url: URL) {
  const mode = url.searchParams.get('hub.mode')
  const candidate = url.searchParams.get('hub.verify_token') || ''
  const challenge = url.searchParams.get('hub.challenge') || ''
  if (mode !== 'subscribe' || !candidate || !challenge) return new Response('Bad Request', { status: 400 })

  const { data, error } = await supabase
    .from('appointment_communication_channel_settings')
    .select('whatsapp_verify_token_env')
    .eq('whatsapp_provider', 'meta_cloud')
  if (error) return new Response('Internal Server Error', { status: 500 })

  const accepted = (data || []).some(row => {
    const expected = Deno.env.get(row.whatsapp_verify_token_env) || ''
    return expected && timingSafeEqual(expected, candidate)
  })
  return accepted ? new Response(challenge, { status: 200 }) : new Response('Forbidden', { status: 403 })
}

async function hmacSha256Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function webhook(req: Request, raw: string) {
  let payload: any
  try { payload = JSON.parse(raw) } catch { return json({ error: 'invalid_json' }, 400) }
  if (payload?.object !== 'whatsapp_business_account') return json({ ignored: true })

  const phoneNumberIds = new Set<string>()
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const id = change?.value?.metadata?.phone_number_id
      if (id) phoneNumberIds.add(String(id))
    }
  }
  if (!phoneNumberIds.size) return json({ ignored: true })

  const { data: configs, error: configError } = await supabase
    .from('appointment_communication_channel_settings')
    .select('tenant_id,whatsapp_phone_number_id,whatsapp_app_secret_env')
    .in('whatsapp_phone_number_id', Array.from(phoneNumberIds))
  if (configError || !configs?.length) return json({ error: 'provider_config_not_found' }, 404)

  const signatureHeader = req.headers.get('x-hub-signature-256') || ''
  let validSignature = false
  for (const config of configs) {
    const secret = Deno.env.get(config.whatsapp_app_secret_env) || ''
    if (!secret) continue
    const expected = `sha256=${await hmacSha256Hex(secret, raw)}`
    if (timingSafeEqual(expected, signatureHeader)) { validSignature = true; break }
  }
  if (!validSignature) return json({ error: 'invalid_signature' }, 401)

  let processed = 0
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const phoneNumberId = String(change?.value?.metadata?.phone_number_id || '')
      const config = configs.find(c => c.whatsapp_phone_number_id === phoneNumberId)
      if (!config) continue
      for (const status of change?.value?.statuses || []) {
        const providerMessageId = String(status?.id || '')
        const state = String(status?.status || '')
        if (!providerMessageId || !['sent','delivered','read','failed','deleted'].includes(state)) continue
        const eventAt = status?.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString()
        const firstError = status?.errors?.[0]

        const { data: job } = await supabase
          .from('appointment_communication_jobs')
          .select('id,tenant_id,status,attempt_count,max_attempts,metadata')
          .eq('provider', 'meta_cloud')
          .eq('provider_message_id', providerMessageId)
          .maybeSingle()
        if (!job || job.tenant_id !== config.tenant_id) continue

        await supabase.from('appointment_communication_delivery_events').insert({
          tenant_id: job.tenant_id,
          job_id: job.id,
          provider: 'meta_cloud',
          provider_message_id: providerMessageId,
          status: state,
          event_at: eventAt,
          error_code: firstError?.code ? String(firstError.code) : null,
          error_message: firstError?.title || firstError?.message || null,
          metadata: {
            recipient_id: status?.recipient_id ?? null,
            conversation_id: status?.conversation?.id ?? null,
          },
        })

        if (state === 'delivered') {
          await supabase.from('appointment_communication_jobs').update({ delivered_at: eventAt, updated_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
        } else if (state === 'read') {
          await supabase.from('appointment_communication_jobs').update({
            delivered_at: job.metadata?.delivered_at || eventAt,
            metadata: { ...(job.metadata || {}), whatsapp_read_at: eventAt },
            updated_at: new Date().toISOString(), last_error: null,
          }).eq('id', job.id)
        } else if (state === 'failed') {
          // Falha assíncrona após aceite: força fallback seguro no Inbox.
          await supabase.from('appointment_communication_jobs').update({
            status: 'ready', channel: 'inbox', provider: null, provider_message_id: null,
            attempt_count: 0, next_attempt_at: null, locked_at: null, failed_at: eventAt,
            last_error: String(firstError?.title || firstError?.message || 'Meta delivery failed').slice(0, 500),
            metadata: { ...(job.metadata || {}), whatsapp_fallback: { at: eventAt, reason: 'delivery_failed', provider_message_id: providerMessageId } },
            updated_at: new Date().toISOString(),
          }).eq('id', job.id)
        }
        processed++
      }
    }
  }
  return json({ received: true, processed })
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    if (req.method === 'GET') return verifyWebhook(url)
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const raw = await req.text()
    let body: any = null
    try { body = raw ? JSON.parse(raw) : {} } catch { body = {} }

    if (body?.action === 'dispatch') return dispatch(req, body)
    return webhook(req, raw)
  } catch (error) {
    console.error('appointment-whatsapp-meta', error)
    return json({ error: 'internal_error' }, 500)
  }
})
