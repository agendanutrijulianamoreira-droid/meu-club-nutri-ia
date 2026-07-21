import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

// GET /api/admin/patients/[id]/fase → fase vigente da paciente (method_phases)
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
    .select('*, method_phases(id, name, description, order_index, method_id)')
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

// POST /api/admin/patients/[id]/fase → atribuir nova fase (method_phases)
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

  let body: { method_phase_id: string; observacoes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { method_phase_id, observacoes } = body
  if (!method_phase_id) {
    return NextResponse.json({ error: 'method_phase_id é obrigatório' }, { status: 400 })
  }

  // Nunca confiar no tenant_id vindo do body — resolve pelo owner_id e valida
  // que a fase pertence ao tenant antes de atribuí-la.
  const { data: phase } = await supabase
    .from('method_phases')
    .select('id')
    .eq('id', method_phase_id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!phase) {
    return NextResponse.json({ error: 'Fase não encontrada neste clube' }, { status: 404 })
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
      method_phase_id,
      inicio: new Date().toISOString().split('T')[0],
      definida_por: user.id,
      observacoes: observacoes ?? null,
    })
    .select('*, method_phases(id, name, description, order_index, method_id)')
    .single()

  if (error) {
    console.error('[FasePaciente] POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fase: novaFase }, { status: 201 })
}
