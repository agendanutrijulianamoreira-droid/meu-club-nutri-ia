import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const VALID_STAGES = ['awareness', 'problem_aware', 'solution_aware', 'value_anchored', 'upsell_ready', 'converted']
const VALID_UPSELL_OFFERS = ['genetic_map', 'presential_checkup', 'protocol_reprogramming', 'annual_plan']

/**
 * GET /api/admin/patient-journey/[patientId]
 * Retorna o estágio de jornada de uma paciente específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify patient belongs to tenant
  const { data: patient } = await supabase
    .from('profiles')
    .select('id, name, email, current_plan, primary_goal, total_xp, current_streak, last_checkin_date, dietary_restrictions')
    .eq('id', params.patientId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const { data: journey, error } = await supabase
    .from('patient_journey_stages')
    .select('*')
    .eq('patient_id', params.patientId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (error) {
    console.error('[patient-journey/[id] GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If no journey exists, return patient with default stage
  if (!journey) {
    return NextResponse.json({
      patient,
      journey: null,
      current_stage: 'awareness',
      days_in_stage: 0,
    })
  }

  const daysInStage = journey.stage_entered_at
    ? Math.floor((Date.now() - new Date(journey.stage_entered_at).getTime()) / 86400000)
    : 0

  return NextResponse.json({
    patient,
    journey,
    current_stage: journey.stage,
    days_in_stage: daysInStage,
  })
}

/**
 * PATCH /api/admin/patient-journey/[patientId]
 * Atualiza estágio, define oferta de upsell, aprova upsell ou marca como convertido
 * Body: { stage?, upsell_offer?, approve_upsell?, mark_converted?, trigger_reason? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify patient belongs to tenant
  const { data: patient } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', params.patientId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const body = await request.json()
  const { stage, upsell_offer, approve_upsell, mark_converted, trigger_reason } = body

  // Get current journey
  const { data: existing } = await supabase
    .from('patient_journey_stages')
    .select('*')
    .eq('patient_id', params.patientId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (stage) {
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 })
    }
    updateData.stage = stage
    updateData.previous_stage = existing?.stage || null
    updateData.stage_entered_at = new Date().toISOString()
    updateData.trigger_reason = trigger_reason || 'admin_manual_update'
  }

  if (upsell_offer) {
    if (!VALID_UPSELL_OFFERS.includes(upsell_offer)) {
      return NextResponse.json({ error: `Invalid upsell_offer: ${upsell_offer}` }, { status: 400 })
    }
    updateData.upsell_offer = upsell_offer
    updateData.upsell_offered_at = new Date().toISOString()
  }

  if (approve_upsell) {
    updateData.upsell_approved_by_admin = true
  }

  if (mark_converted) {
    updateData.upsell_converted = true
    updateData.upsell_converted_at = new Date().toISOString()
    updateData.stage = 'converted'
    updateData.previous_stage = existing?.stage || null
    updateData.stage_entered_at = new Date().toISOString()
  }

  let result: any
  if (existing) {
    const { data, error } = await supabase
      .from('patient_journey_stages')
      .update(updateData)
      .eq('patient_id', params.patientId)
      .eq('tenant_id', tenant.id)
      .select()
      .single()

    if (error) {
      console.error('[patient-journey/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    result = data
  } else {
    // Create new journey record
    const { data, error } = await supabase
      .from('patient_journey_stages')
      .insert({
        patient_id: params.patientId,
        tenant_id: tenant.id,
        stage: stage || 'awareness',
        trigger_reason: trigger_reason || 'admin_created',
        ...updateData,
      })
      .select()
      .single()

    if (error) {
      console.error('[patient-journey/[id] PATCH insert]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    result = data
  }

  return NextResponse.json({ ok: true, journey: result })
}
