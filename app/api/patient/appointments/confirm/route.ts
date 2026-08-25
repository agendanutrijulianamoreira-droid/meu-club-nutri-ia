import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function patientUser() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (String(profile?.role || '').toLowerCase() !== 'patient') return null
  return user
}

function errorCode(message: string) {
  const text = message.toLowerCase()
  if (text.includes('não encontrada')) return 'not_found'
  if (text.includes('não pode ser confirmada') || text.includes('passadas')) return 'invalid_state'
  return 'confirmation_failed'
}

export async function POST(request: NextRequest) {
  const user = await patientUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'backend_unavailable' }, { status: 500 })

  let body: { appointment_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }) }
  const appointmentId = String(body.appointment_id || '')
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const { data, error } = await admin.rpc('service_patient_confirm_appointment', {
    p_user_id: user.id,
    p_appointment_id: appointmentId,
  })
  if (error) return NextResponse.json({ error: errorCode(error.message) }, { status: 409 })
  return NextResponse.json({ success: true, appointment_id: data })
}
