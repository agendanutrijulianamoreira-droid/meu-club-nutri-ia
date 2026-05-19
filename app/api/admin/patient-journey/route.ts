import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const VALID_STAGES = ['awareness', 'problem_aware', 'solution_aware', 'value_anchored', 'upsell_ready', 'converted']
const VALID_UPSELL_OFFERS = ['genetic_map', 'presential_checkup', 'protocol_reprogramming', 'annual_plan']

/**
 * GET /api/admin/patient-journey
 * Lista todos os estágios de jornada das pacientes do tenant (com info do perfil)
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const stageFilter = searchParams.get('stage')

  let query = supabase
    .from('patient_journey_stages')
    .select(`
      id, patient_id, stage, previous_stage, stage_entered_at,
      upsell_offer, upsell_offered_at, upsell_approved_by_admin,
      upsell_converted, upsell_converted_at, trigger_reason, metadata,
      created_at, updated_at,
      profiles:patient_id (
        id, name, email, current_plan, primary_goal,
        total_xp, current_streak, last_checkin_date
      )
    `)
    .eq('tenant_id', tenant.id)

  if (stageFilter && VALID_STAGES.includes(stageFilter)) {
    query = query.eq('stage', stageFilter)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    console.error('[patient-journey GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by stage for pipeline view
  const pipeline: Record<string, any[]> = {}
  for (const stage of VALID_STAGES) pipeline[stage] = []
  for (const item of data || []) {
    if (pipeline[item.stage]) pipeline[item.stage].push(item)
  }

  // Find patients without a journey record
  const { data: allPatients } = await supabase
    .from('profiles')
    .select('id, name, email, current_plan, primary_goal, total_xp, current_streak, last_checkin_date')
    .eq('tenant_id', tenant.id)
    .eq('role', 'patient')

  const existingPatientIds = new Set((data || []).map((j: any) => j.patient_id))
  const patientsWithoutJourney = (allPatients || []).filter(p => !existingPatientIds.has(p.id))

  return NextResponse.json({
    journeys: data || [],
    pipeline,
    patients_without_journey: patientsWithoutJourney,
    total: (data || []).length,
  })
}

/**
 * POST /api/admin/patient-journey
 * Avançar manualmente o estágio de uma paciente (admin override)
 * Body: { patient_id, stage, upsell_offer?, trigger_reason? }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { patient_id, stage, upsell_offer, trigger_reason } = body

  if (!patient_id || !stage) {
    return NextResponse.json({ error: 'patient_id and stage are required' }, { status: 400 })
  }

  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: `stage must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
  }

  if (upsell_offer && !VALID_UPSELL_OFFERS.includes(upsell_offer)) {
    return NextResponse.json({ error: `upsell_offer must be one of: ${VALID_UPSELL_OFFERS.join(', ')}` }, { status: 400 })
  }

  // Verify patient belongs to tenant
  const { data: patient } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', patient_id)
    .eq('tenant_id', tenant.id)
    .eq('role', 'patient')
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Get current stage
  const { data: existing } = await supabase
    .from('patient_journey_stages')
    .select('id, stage')
    .eq('patient_id', patient_id)
    .single()

  const upsertData: Record<string, any> = {
    patient_id,
    tenant_id: tenant.id,
    stage,
    previous_stage: existing?.stage || null,
    stage_entered_at: new Date().toISOString(),
    trigger_reason: trigger_reason || 'admin_manual_override',
    updated_at: new Date().toISOString(),
  }

  if (upsell_offer) {
    upsertData.upsell_offer = upsell_offer
    upsertData.upsell_offered_at = new Date().toISOString()
    upsertData.upsell_approved_by_admin = true
  }

  const { data: result, error } = await supabase
    .from('patient_journey_stages')
    .upsert(upsertData, { onConflict: 'patient_id' })
    .select()
    .single()

  if (error) {
    console.error('[patient-journey POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, journey: result })
}
