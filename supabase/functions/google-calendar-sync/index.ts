import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

type SyncJob = {
  sync_id: string
  tenant_id: string
  appointment_id: string
  external_calendar_id: string | null
  external_event_id: string | null
  sync_status: string
  attempt_count: number
}

type Appointment = {
  id: string
  tenant_id: string
  patient_id: string | null
  crm_contact_id: string | null
  scheduled_at: string
  ends_at: string | null
  duration_minutes: number
  appointment_type: string | null
  is_virtual: boolean
  meeting_link: string | null
  location_address: string | null
  status: string
}

function secretKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, string>
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (first) return first
    } catch {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || ''
}

const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

async function vitalConfig(tenantId: string, key: string) {
  const { data, error } = await supabase
    .from('tenant_vital_settings')
    .select('config_value')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_workspace')
    .eq('setting_key', key)
    .eq('enabled', true)
    .maybeSingle()
  if (error) throw error
  return data?.config_value || null
}

async function vitalSecret(tenantId: string, key: string) {
  const { data, error } = await supabase.rpc('service_get_tenant_vital_secret', {
    p_tenant_id: tenantId,
    p_provider: 'google_workspace',
    p_setting_key: key,
  })
  if (error) throw error
  return (data as string | null) || null
}

async function googleAccessToken(tenantId: string) {
  const [clientId, clientSecret, refreshToken] = await Promise.all([
    vitalConfig(tenantId, 'CLIENT_ID'),
    vitalSecret(tenantId, 'CLIENT_SECRET'),
    vitalSecret(tenantId, 'REFRESH_TOKEN'),
  ])
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google Workspace não conectado')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = await r.json() as any
  if (!r.ok || !body?.access_token) throw new Error(`Google token refresh falhou (${r.status})`)
  return String(body.access_token)
}

async function finish(job: SyncJob, patch: Record<string, unknown>) {
  const { error } = await supabase.from('appointment_calendar_sync').update({
    locked_at: null,
    updated_at: new Date().toISOString(),
    ...patch,
  }).eq('id', job.sync_id)
  if (error) throw error
}

async function fail(job: SyncJob, error: unknown) {
  const minutes = Math.min(24 * 60, Math.max(5, 5 * Math.pow(2, Math.min(job.attempt_count - 1, 8))))
  await finish(job, {
    status: 'error',
    last_error: String((error as Error)?.message || error).slice(0, 500),
    next_attempt_at: new Date(Date.now() + minutes * 60_000).toISOString(),
  })
}

async function patientName(appt: Appointment) {
  if (appt.crm_contact_id) {
    const { data } = await supabase.from('crm_contacts').select('name').eq('id', appt.crm_contact_id).eq('tenant_id', appt.tenant_id).maybeSingle()
    if (data?.name) return String(data.name)
  }
  if (appt.patient_id) {
    const { data } = await supabase.from('profiles').select('name').eq('user_id', appt.patient_id).eq('tenant_id', appt.tenant_id).maybeSingle()
    if (data?.name) return String(data.name)
  }
  return 'Paciente'
}

async function calendarTimezone(tenantId: string) {
  const { data } = await supabase.from('tenant_appointment_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle()
  return data?.timezone || 'America/Sao_Paulo'
}

async function googleRequest(token: string, url: string, init: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  if (r.status === 404 && init.method === 'DELETE') return null
  let body: any = null
  if (r.status !== 204) {
    try { body = await r.json() } catch {}
  }
  if (!r.ok) {
    const msg = body?.error?.message || `Google Calendar HTTP ${r.status}`
    throw new Error(msg)
  }
  return body
}

function eventUrl(calendarId: string, eventId?: string | null) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=none` : `${base}?conferenceDataVersion=1&sendUpdates=none`
}

async function syncOne(job: SyncJob) {
  const [calendarIdRaw, token] = await Promise.all([
    vitalConfig(job.tenant_id, 'CALENDAR_ID'),
    googleAccessToken(job.tenant_id),
  ])
  const calendarId = calendarIdRaw || 'primary'
  const { data: appt, error: appointmentError } = await supabase
    .from('appointments')
    .select('id,tenant_id,patient_id,crm_contact_id,scheduled_at,ends_at,duration_minutes,appointment_type,is_virtual,meeting_link,location_address,status')
    .eq('tenant_id', job.tenant_id)
    .eq('id', job.appointment_id)
    .maybeSingle()
  if (appointmentError) throw appointmentError

  const shouldDelete = !appt || ['cancelled', 'no_show'].includes(String(appt.status))
  if (shouldDelete) {
    if (job.external_event_id) {
      await googleRequest(token, eventUrl(job.external_calendar_id || calendarId, job.external_event_id), { method: 'DELETE' })
    }
    await finish(job, {
      status: 'deleted',
      external_calendar_id: job.external_calendar_id || calendarId,
      last_error: null,
      next_attempt_at: null,
      last_synced_at: new Date().toISOString(),
    })
    return { deleted: true }
  }

  const appointment = appt as Appointment
  const [name, timezone] = await Promise.all([patientName(appointment), calendarTimezone(job.tenant_id)])
  const end = appointment.ends_at || new Date(new Date(appointment.scheduled_at).getTime() + (appointment.duration_minutes || 60) * 60_000).toISOString()
  const event: any = {
    summary: `Consulta · ${name}`,
    description: 'Agendamento sincronizado pelo sistema da clínica.',
    start: { dateTime: appointment.scheduled_at, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone },
    extendedProperties: { private: { nutrios_appointment_id: appointment.id, nutrios_tenant_id: appointment.tenant_id } },
  }
  if (!appointment.is_virtual && appointment.location_address) event.location = appointment.location_address
  if (appointment.is_virtual && !job.external_event_id && !appointment.meeting_link) {
    event.conferenceData = {
      createRequest: {
        requestId: `nutrios-${appointment.id}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  let response: any
  if (job.external_event_id) {
    response = await googleRequest(token, eventUrl(job.external_calendar_id || calendarId, job.external_event_id), {
      method: 'PATCH', body: JSON.stringify(event),
    })
  } else {
    response = await googleRequest(token, eventUrl(calendarId), { method: 'POST', body: JSON.stringify(event) })
  }

  const eventId = String(response?.id || job.external_event_id || '')
  if (!eventId) throw new Error('Google Calendar não retornou event id')
  const meetLink = response?.hangoutLink || response?.conferenceData?.entryPoints?.find((x: any) => x?.entryPointType === 'video')?.uri || null
  if (appointment.is_virtual && meetLink && meetLink !== appointment.meeting_link) {
    await supabase.from('appointments').update({ meeting_link: meetLink, updated_at: new Date().toISOString() }).eq('tenant_id', job.tenant_id).eq('id', appointment.id)
  }

  await finish(job, {
    status: 'synced',
    external_calendar_id: calendarId,
    external_event_id: eventId,
    last_error: null,
    next_attempt_at: null,
    last_synced_at: new Date().toISOString(),
  })
  return { event_id: eventId, meet_link_created: Boolean(meetLink) }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    let body: any = {}
    try { body = await req.json() } catch {}
    if (body?.action !== 'dispatch') return json({ error: 'unsupported_action' }, 400)

    const dispatchToken = req.headers.get('x-dispatch-token') || ''
    const { data: valid, error: verifyError } = await supabase.rpc('service_verify_google_calendar_dispatch_token', { p_token: dispatchToken })
    if (verifyError || valid !== true) return json({ error: 'unauthorized' }, 401)

    const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)))
    const { data, error } = await supabase.rpc('service_claim_google_calendar_sync', { p_limit: limit })
    if (error) return json({ error: error.message }, 500)
    const jobs = (data || []) as SyncJob[]
    const results: any[] = []
    for (const job of jobs) {
      try {
        results.push({ sync_id: job.sync_id, ok: true, result: await syncOne(job) })
      } catch (error) {
        console.error('google-calendar-sync', job.sync_id, (error as Error).message)
        await fail(job, error)
        results.push({ sync_id: job.sync_id, ok: false, error: (error as Error).message })
      }
    }
    return json({ claimed: jobs.length, results })
  } catch (error) {
    console.error('google-calendar-sync fatal', error)
    return json({ error: 'internal_error' }, 500)
  }
})
