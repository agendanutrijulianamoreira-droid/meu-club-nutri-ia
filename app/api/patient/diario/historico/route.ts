import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

// GET /api/patient/diario/historico?periodo=30
// Retorna soma de calorias por dia para o período
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const periodo = parseInt(searchParams.get('periodo') || '30', 10)

  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodo)
  const dataInicioStr = dataInicio.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('diario_alimentar')
    .select('data, calorias_calculadas')
    .eq('paciente_id', user.id)
    .gte('data', dataInicioStr)
    .order('data', { ascending: true })

  if (error) {
    console.error('[Diario] GET historico:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Agrega por data
  const por_dia: Record<string, number> = {}
  for (const row of data ?? []) {
    por_dia[row.data] = (por_dia[row.data] ?? 0) + (row.calorias_calculadas ?? 0)
  }

  const historico = Object.entries(por_dia).map(([data, calorias_calculadas]) => ({
    data,
    calorias_calculadas,
  }))

  return NextResponse.json({ historico })
}
