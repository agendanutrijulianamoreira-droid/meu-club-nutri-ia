import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

// GET /api/patient/checkin-diario?data=YYYY-MM-DD   → registro do dia (para verificar duplicata)
// GET /api/patient/checkin-diario?periodo=30        → últimos N dias (para gráficos)
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const data = searchParams.get('data')
  const periodo = parseInt(searchParams.get('periodo') || '30', 10)

  if (data) {
    // Verifica se já existe registro no dia
    const { data: registro, error } = await supabase
      .from('checkin_diario')
      .select('*')
      .eq('paciente_id', user.id)
      .eq('data', data)
      .maybeSingle()

    if (error) {
      console.error('[CheckinDiario] GET dia:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ registro })
  }

  // Busca série histórica para gráficos
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodo)
  const dataInicioStr = dataInicio.toISOString().split('T')[0]

  const { data: checkins, error } = await supabase
    .from('checkin_diario')
    .select('*')
    .eq('paciente_id', user.id)
    .gte('data', dataInicioStr)
    .order('data', { ascending: true })

  if (error) {
    console.error('[CheckinDiario] GET periodo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ checkins })
}

// POST /api/patient/checkin-diario  → registra ou atualiza o check-in do dia
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const dataRegistro = (body.data as string) || new Date().toISOString().split('T')[0]

  // Verifica duplicata
  const { data: existente } = await supabase
    .from('checkin_diario')
    .select('id')
    .eq('paciente_id', user.id)
    .eq('data', dataRegistro)
    .maybeSingle()

  if (existente) {
    return NextResponse.json(
      { error: 'Já existe um check-in para hoje. Edição não permitida por esta rota.' },
      { status: 409 }
    )
  }

  const { data: registro, error } = await supabase
    .from('checkin_diario')
    .insert({
      paciente_id: user.id,
      data: dataRegistro,
      nivel_energia:    body.nivel_energia    ?? null,
      nivel_inchaco:    body.nivel_inchaco    ?? null,
      nivel_compulsao:  body.nivel_compulsao  ?? null,
      qualidade_sono:   body.qualidade_sono   ?? null,
      nivel_ansiedade:  body.nivel_ansiedade  ?? null,
      dor_abdominal:    body.dor_abdominal    ?? null,
      retencao_liquido: body.retencao_liquido ?? null,
      humor:            body.humor            ?? null,
      peso_kg:          body.peso_kg          ?? null,
      horas_sono:       body.horas_sono       ?? null,
      copos_agua:       body.copos_agua       ?? null,
      dia_ciclo:        body.dia_ciclo        ?? null,
      fase_ciclo:       body.fase_ciclo       ?? null,
      observacoes:      body.observacoes      ?? null,
    })
    .select()
    .single()

  if (error) {
    // Constraint UNIQUE — segunda via de proteção
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Check-in do dia já registrado.' }, { status: 409 })
    }
    console.error('[CheckinDiario] POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ registro }, { status: 201 })
}
