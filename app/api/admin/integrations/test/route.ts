import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getVitalConfig, getVitalSecret, requireStaffIntegrationContext, jsonError } from '@/lib/integrations/vitalSettings'

export const dynamic = 'force-dynamic'

type TestResult = { ok: boolean; detail: string; metadata?: Record<string, unknown> }

async function googleToken(tenantId: string) {
  const [clientId, clientSecret, refreshToken] = await Promise.all([
    getVitalConfig(tenantId, 'google_workspace', 'CLIENT_ID'),
    getVitalSecret(tenantId, 'google_workspace', 'CLIENT_SECRET'),
    getVitalSecret(tenantId, 'google_workspace', 'REFRESH_TOKEN'),
  ])
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google ainda não foi conectado por OAuth')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    cache: 'no-store',
  })
  const b = await r.json() as any
  if (!r.ok || !b.access_token) throw new Error(`Google OAuth respondeu ${r.status}`)
  return String(b.access_token)
}

async function testGoogle(tenantId: string): Promise<TestResult> {
  const [token, calendarId] = await Promise.all([googleToken(tenantId), getVitalConfig(tenantId, 'google_workspace', 'CALENDAR_ID')])
  const id = calendarId || 'primary'
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`)
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('timeMin', new Date().toISOString())
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Google Calendar respondeu ${r.status}`)
  return { ok: true, detail: 'Google Calendar conectado e autorizado', metadata: { calendar: id } }
}

async function testMeta(tenantId: string): Promise<TestResult> {
  const [phoneId, token, version] = await Promise.all([
    getVitalConfig(tenantId, 'meta_whatsapp', 'PHONE_NUMBER_ID'),
    getVitalSecret(tenantId, 'meta_whatsapp', 'ACCESS_TOKEN'),
    getVitalConfig(tenantId, 'meta_whatsapp', 'GRAPH_VERSION'),
  ])
  if (!phoneId || !token) throw new Error('Phone Number ID ou Access Token ausente')
  const r = await fetch(`https://graph.facebook.com/${version || 'v26.0'}/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  const b = await r.json() as any
  if (!r.ok) throw new Error(b?.error?.message || `Meta respondeu ${r.status}`)
  return { ok: true, detail: 'WhatsApp Cloud API autenticado', metadata: { display_phone_number: b?.display_phone_number || null, verified_name: b?.verified_name || null } }
}

async function testGemini(tenantId: string): Promise<TestResult> {
  const key = await getVitalSecret(tenantId, 'gemini', 'API_KEY')
  if (!key) throw new Error('Gemini API Key ausente')
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Gemini respondeu ${r.status}`)
  return { ok: true, detail: 'Gemini API autenticada' }
}

async function testResend(tenantId: string): Promise<TestResult> {
  const key = await getVitalSecret(tenantId, 'resend', 'API_KEY')
  if (!key) throw new Error('Resend API Key ausente')
  const r = await fetch('https://api.resend.com/domains', { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Resend respondeu ${r.status}`)
  return { ok: true, detail: 'Resend autenticado; nenhum e-mail foi enviado' }
}

async function testAsaas(tenantId: string): Promise<TestResult> {
  const [key, base] = await Promise.all([getVitalSecret(tenantId, 'asaas', 'API_KEY'), getVitalConfig(tenantId, 'asaas', 'BASE_URL')])
  if (!key) throw new Error('Asaas API Key ausente')
  const root = (base || 'https://api.asaas.com/v3').replace(/\/$/, '')
  const r = await fetch(`${root}/customers?limit=1&offset=0`, { headers: { access_token: key, 'content-type': 'application/json', 'user-agent': 'NutriOS/1.0' }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Asaas respondeu ${r.status}`)
  return { ok: true, detail: 'Asaas autenticado; nenhuma cobrança foi criada', metadata: { environment: root.includes('sandbox') ? 'sandbox' : 'production' } }
}

async function testStripe(tenantId: string): Promise<TestResult> {
  const key = await getVitalSecret(tenantId, 'stripe', 'SECRET_KEY')
  if (!key) throw new Error('Stripe Secret Key ausente')
  const r = await fetch('https://api.stripe.com/v1/account', { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Stripe respondeu ${r.status}`)
  return { ok: true, detail: 'Stripe autenticado; nenhuma cobrança foi criada' }
}

async function testMercadoPago(tenantId: string): Promise<TestResult> {
  const key = await getVitalSecret(tenantId, 'mercadopago', 'ACCESS_TOKEN')
  if (!key) throw new Error('Mercado Pago Access Token ausente')
  const r = await fetch('https://api.mercadolibre.com/users/me', { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Mercado Pago respondeu ${r.status}`)
  return { ok: true, detail: 'Mercado Pago autenticado; nenhum pagamento foi criado' }
}

async function testZoom(tenantId: string): Promise<TestResult> {
  const [accountId, clientId, clientSecret] = await Promise.all([
    getVitalConfig(tenantId, 'zoom', 'ACCOUNT_ID'), getVitalConfig(tenantId, 'zoom', 'CLIENT_ID'), getVitalSecret(tenantId, 'zoom', 'CLIENT_SECRET'),
  ])
  if (!accountId || !clientId || !clientSecret) throw new Error('Credenciais Server-to-Server OAuth do Zoom incompletas')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, { method: 'POST', headers: { authorization: `Basic ${basic}` }, cache: 'no-store' })
  if (!r.ok) throw new Error(`Zoom respondeu ${r.status}`)
  return { ok: true, detail: 'Zoom Server-to-Server OAuth autenticado' }
}

async function testAutomation(tenantId: string): Promise<TestResult> {
  const [base, key] = await Promise.all([getVitalConfig(tenantId, 'automation', 'N8N_BASE_URL'), getVitalSecret(tenantId, 'automation', 'N8N_API_KEY')])
  if (!base) throw new Error('n8n Base URL ausente')
  const url = `${base.replace(/\/$/, '')}/api/v1/workflows?limit=1`
  const r = await fetch(url, { headers: key ? { 'X-N8N-API-KEY': key } : {}, cache: 'no-store' })
  if (!r.ok) throw new Error(`n8n respondeu ${r.status}`)
  return { ok: true, detail: 'n8n acessível e autenticado' }
}

const TESTERS: Record<string, (tenantId: string) => Promise<TestResult>> = {
  google_workspace: testGoogle,
  meta_whatsapp: testMeta,
  gemini: testGemini,
  resend: testResend,
  asaas: testAsaas,
  stripe: testStripe,
  mercadopago: testMercadoPago,
  zoom: testZoom,
  automation: testAutomation,
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireStaffIntegrationContext()
    const body = await req.json().catch(() => ({})) as { provider?: string }
    const provider = String(body.provider || '')
    const tester = TESTERS[provider]
    if (!tester) return Response.json({ error: 'provider_not_testable' }, { status: 400 })

    let result: TestResult
    try {
      result = await tester(tenantId)
    } catch (error) {
      result = { ok: false, detail: String((error as Error)?.message || error).slice(0, 300) }
    }

    const admin = getSupabaseAdmin()
    await admin.from('tenant_vital_settings').update({
      validation_status: result.ok ? 'valid' : 'invalid',
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).eq('provider', provider)

    return Response.json(result, { status: result.ok ? 200 : 422 })
  } catch (error) {
    return jsonError(error)
  }
}
