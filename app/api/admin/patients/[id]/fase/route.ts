import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { NOMES_FASE } from "@/lib/config/mensagensNotificacao"

// GET /api/admin/patients/[id]/fase → fase vigente da paciente
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: fase, error } = await supabase
    .from('fase_paciente')
    .select('*')
    .eq('paciente_id', params.id)
    .is('fim', null)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[FasePaciente] GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fase })
}

// POST /api/admin/patients/[id]/fase → atribuir nova fase
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { fase: number; observacoes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { fase, observacoes } = body
  if (!fase || fase < 1 || fase > 6) {
    return NextResponse.json({ error: 'Fase deve ser entre 1 e 6' }, { status: 400 })
  }

  // Encerra fase vigente anterior
  await supabase
    .from('fase_paciente')
    .update({ fim: new Date().toISOString().split('T')[0] })
    .eq('paciente_id', params.id)
    .is('fim', null)

  // Cria nova fase
  const { data: novaFase, error } = await supabase
    .from('fase_paciente')
    .insert({
      paciente_id: params.id,
      fase,
      nome_fase: NOMES_FASE[fase],
      inicio: new Date().toISOString().split('T')[0],
      definida_por: user.id,
      observacoes: observacoes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[FasePaciente] POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fase: novaFase }, { status: 201 })
}
