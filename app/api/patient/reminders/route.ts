import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('patient_reminders')
    .select('*')
    .eq('user_id', user.id)
    .order('time_local', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('patient_reminders')
    .upsert({
      user_id: user.id,
      tenant_id: profile.tenant_id,
      reminder_type: body.reminder_type,
      label: body.label,
      time_local: body.time_local,
      timezone: body.timezone ?? 'America/Sao_Paulo',
      days_of_week: body.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
      message: body.message,
      is_active: body.is_active ?? true,
    }, { onConflict: 'user_id,reminder_type' })
    .select()
    .single()

  if (error) {
    console.error('[patient/reminders POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase
    .from('patient_reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
