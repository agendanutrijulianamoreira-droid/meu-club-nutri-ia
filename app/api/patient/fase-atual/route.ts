import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

// GET /api/patient/fase-atual → fase vigente da paciente autenticada
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: fase, error } = await supabase
    .from('fase_paciente')
    .select('inicio, observacoes, method_phases(id, name, description, sort_order, method_id)')
    .eq('paciente_id', user.id)
    .is('fim', null)
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[FaseAtual] GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fase })
}
