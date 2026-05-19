import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/patient/upsell
// Registra interação da paciente com uma oferta (viewed/clicked/converted/dismissed)

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { approval_id, event_type, product_id } = body

  if (!['viewed', 'clicked', 'converted', 'dismissed'].includes(event_type)) {
    return NextResponse.json({ error: 'event_type inválido' }, { status: 400 })
  }

  if (!approval_id && !product_id) {
    return NextResponse.json({ error: 'approval_id ou product_id obrigatório' }, { status: 400 })
  }

  // Buscar evento existente para atualizar ou criar novo
  let existingEvent: any = null
  if (approval_id) {
    const { data } = await supabase
      .from('upsell_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('approval_id', approval_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    existingEvent = data
  }

  if (existingEvent && event_type !== 'converted') {
    // Atualiza o evento existente (viewed/clicked/dismissed sobre um sent)
    await supabase
      .from('upsell_events')
      .update({
        event_type,
        converted_at: event_type === 'converted' ? new Date().toISOString() : null,
      })
      .eq('id', existingEvent.id)
  } else {
    // Cria novo evento
    const { data: newEvent } = await supabase
      .from('upsell_events')
      .insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        product_id: product_id || null,
        approval_id: approval_id || null,
        event_type,
        converted_at: event_type === 'converted' ? new Date().toISOString() : null,
        trigger_reason: 'patient_action',
      })
      .select('id')
      .single()

    // Se converteu, registrar acesso ao produto
    if (event_type === 'converted' && product_id) {
      await supabase.from('patient_products').upsert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        product_id,
        access_granted_at: new Date().toISOString(),
        access_source: 'upsell_conversion',
      }, { onConflict: 'user_id,product_id' })
    }
  }

  return NextResponse.json({ success: true })
}
