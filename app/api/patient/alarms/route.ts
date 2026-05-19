import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const VALID_ALARM_TYPES = ['hydration', 'meal', 'medication', 'exercise', 'checkin']

/**
 * GET /api/patient/alarms
 * Lista alarmes da paciente autenticada
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('user_alarms')
    .select('*')
    .eq('patient_id', profile.id)
    .order('time_hhmm')

  if (error) {
    console.error('[patient/alarms GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alarms: data || [] })
}

/**
 * POST /api/patient/alarms
 * Cria um novo alarme para a paciente
 * Body: { alarm_type, label, time_hhmm, days_of_week? }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { alarm_type, label, time_hhmm, days_of_week } = body

  if (!alarm_type || !label || !time_hhmm) {
    return NextResponse.json({ error: 'alarm_type, label, and time_hhmm are required' }, { status: 400 })
  }

  if (!VALID_ALARM_TYPES.includes(alarm_type)) {
    return NextResponse.json({ error: `alarm_type must be one of: ${VALID_ALARM_TYPES.join(', ')}` }, { status: 400 })
  }

  // Validate time format HH:MM
  if (!/^\d{2}:\d{2}$/.test(time_hhmm)) {
    return NextResponse.json({ error: 'time_hhmm must be in HH:MM format' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_alarms')
    .insert({
      patient_id: profile.id,
      tenant_id: profile.tenant_id,
      alarm_type,
      label,
      time_hhmm,
      days_of_week: days_of_week || [1, 2, 3, 4, 5, 6, 7],
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('[patient/alarms POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, alarm: data }, { status: 201 })
}

/**
 * PATCH /api/patient/alarms?id=uuid
 * Toggle alarme ativo/inativo ou atualizar campos
 */
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const alarmId = searchParams.get('id')

  if (!alarmId) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  }

  const body = await request.json()
  const allowedFields = ['is_active', 'label', 'time_hhmm', 'days_of_week', 'alarm_type']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field]
  }

  const { data, error } = await supabase
    .from('user_alarms')
    .update(updateData)
    .eq('id', alarmId)
    .eq('patient_id', profile.id) // Security: only own alarms
    .select()
    .single()

  if (error) {
    console.error('[patient/alarms PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, alarm: data })
}

/**
 * DELETE /api/patient/alarms?id=uuid
 * Remove um alarme da paciente
 */
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const alarmId = searchParams.get('id')

  if (!alarmId) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_alarms')
    .delete()
    .eq('id', alarmId)
    .eq('patient_id', profile.id) // Security: only own alarms

  if (error) {
    console.error('[patient/alarms DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
