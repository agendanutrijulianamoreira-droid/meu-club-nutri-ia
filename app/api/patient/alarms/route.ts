import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET: listar alarmes da paciente autenticada
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: alarms, error } = await supabase
    .from('patient_alarms')
    .select('*')
    .eq('user_id', user.id)
    .order('time_hhmm', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alarms: alarms || [] })
}

// POST: criar alarme
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { type, label, time_hhmm, days_of_week, push_title, push_body } = body

  if (!label?.trim()) return NextResponse.json({ error: 'Rótulo é obrigatório' }, { status: 400 })
  if (!time_hhmm || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time_hhmm)) {
    return NextResponse.json({ error: 'Horário inválido (use HH:MM)' }, { status: 400 })
  }
  if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
    return NextResponse.json({ error: 'Selecione pelo menos um dia' }, { status: 400 })
  }

  const { data, error } = await supabase.from('patient_alarms').insert({
    user_id: user.id,
    tenant_id: profile.tenant_id,
    type: type || 'custom',
    label: label.trim(),
    time_hhmm,
    days_of_week,
    push_title: push_title?.trim() || null,
    push_body: push_body?.trim() || null,
    is_active: true,
  }).select().single()

  if (error) {
    console.error('[/api/patient/alarms POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alarm: data })
}

// PATCH: editar ou ativar/desativar
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // Garante que só edita o próprio alarme
  delete updates.user_id
  delete updates.tenant_id

  const { data, error } = await supabase.from('patient_alarms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alarm: data })
}

// DELETE: remover alarme
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  await supabase.from('patient_alarms')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ deleted: true })
}
