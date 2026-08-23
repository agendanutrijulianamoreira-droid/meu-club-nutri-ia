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
  const auth = request.headers.get('authorization')
  const xSecret = request.headers.get('x-cron-secret')
  const expectedBearer = CRON_SECRET ? `Bearer ${CRON_SECRET}` : ''
  if (CRON_SECRET && auth !== expectedBearer && xSecret !== CRON_SECRET) {
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
    let failed = false

    const run = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error: rpcError } = await admin.rpc(fn, args)
      if (rpcError) {
        steps[name] = { error: rpcError.message }
        failed = true
      } else steps[name] = data ?? { ok: true }
    }

    await run('snapshot', 'refresh_patient_operational_snapshot', { p_tenant_id: tenantId, p_reference_date: today })
    if (!failed) await run('lifecycle', 'refresh_patient_lifecycle_states', { p_tenant_id: tenantId, p_reference_date: today })
    if (!failed) {
      await run('risk_tasks', 'sync_patient_followup_tasks', { p_tenant_id: tenantId, p_reference_date: today })
      await run('phase_tasks', 'sync_phase_review_tasks', { p_tenant_id: tenantId, p_reference_date: today })
      await run('feedback_tasks', 'sync_checkin_feedback_tasks', { p_tenant_id: tenantId, p_reference_date: today })
      await run('lifecycle_tasks', 'sync_lifecycle_followup_tasks', { p_tenant_id: tenantId, p_reference_date: today })
      await run('exit_rules', 'apply_followup_exit_rules', { p_tenant_id: tenantId })
    }

    results.push({ tenant_id: tenantId, ok: !failed, steps })
  }

  const failedCount = results.filter(r => r.ok === false).length
  console.log(`[followup-engine] ${today} tenants=${results.length} failed=${failedCount}`)
  return NextResponse.json({ reference_date: today, tenants: results.length, failed: failedCount, results }, { status: failedCount ? 207 : 200 })
}
