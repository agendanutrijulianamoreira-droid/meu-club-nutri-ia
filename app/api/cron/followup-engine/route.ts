import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET || ''

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[followup-engine] CRON_SECRET ausente; execução bloqueada por segurança.')
    return NextResponse.json({ error: 'Cron configuration unavailable' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  const xSecret = request.headers.get('x-cron-secret')
  if (auth !== `Bearer ${CRON_SECRET}` && xSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Backend configuration unavailable' }, { status: 500 })

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: tenants, error } = await admin.from('tenants').select('id').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = localDate()
  const results: Array<Record<string, unknown>> = []

  for (const tenant of tenants || []) {
    const tenantId = tenant.id
    const steps: Record<string, unknown> = {}
    const pipeline: Array<[string, string, Record<string, unknown>]> = [
      ['snapshot', 'refresh_patient_operational_snapshot', { p_tenant_id: tenantId, p_reference_date: today }],
      ['lifecycle', 'refresh_patient_lifecycle_states', { p_tenant_id: tenantId, p_reference_date: today }],
      ['risk_tasks', 'sync_patient_followup_tasks', { p_tenant_id: tenantId, p_reference_date: today }],
      ['phase_tasks', 'sync_phase_review_tasks', { p_tenant_id: tenantId, p_reference_date: today }],
      ['feedback_tasks', 'sync_checkin_feedback_tasks', { p_tenant_id: tenantId, p_reference_date: today }],
      ['lifecycle_tasks', 'sync_lifecycle_followup_tasks', { p_tenant_id: tenantId, p_reference_date: today }],
      ['exit_rules', 'apply_followup_exit_rules', { p_tenant_id: tenantId }],
    ]

    let failed = false
    for (const [name, fn, args] of pipeline) {
      const { data, error: rpcError } = await admin.rpc(fn, args)
      if (rpcError) {
        steps[name] = { error: rpcError.message }
        failed = true
        break
      }
      steps[name] = data ?? { ok: true }
    }

    results.push({ tenant_id: tenantId, ok: !failed, steps })
  }

  const failedCount = results.filter(r => r.ok === false).length
  console.log(`[followup-engine] ${today} tenants=${results.length} failed=${failedCount}`)
  return NextResponse.json({ reference_date: today, tenants: results.length, failed: failedCount, results }, { status: failedCount ? 207 : 200 })
}
