import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { calcularAdesao } from "@/lib/utils/calcularAdesao"

// GET /api/patient/diario/meta?data=2026-06-28
// Retorna meta vigente + resumo do consumo do dia
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dataAlvo = new URL(request.url).searchParams.get('data')
    || new Date().toISOString().split('T')[0]

  const [metaRes, registrosRes] = await Promise.all([
    supabase
      .from('metas_paciente')
      .select('*')
      .eq('paciente_id', user.id)
      .lte('valida_de', dataAlvo)
      .or('valida_ate.is.null,valida_ate.gte.' + dataAlvo)
      .order('valida_de', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('diario_alimentar')
      .select('calorias_calculadas, proteina_calculada, carboidrato_calculado, lipideos_calculado, fibra_calculada')
      .eq('paciente_id', user.id)
      .eq('data', dataAlvo),
  ])

  // Meta padrão se não houver nenhuma cadastrada
  const meta = metaRes.data ?? {
    calorias_meta: 1800,
    proteina_meta_g: 100,
    carboidrato_meta_g: 200,
    lipideos_meta_g: 60,
    fibra_meta_g: 25,
  }

  const registros = registrosRes.data ?? []

  if (registrosRes.error) {
    console.error('[DiarioMeta] busca registros:', registrosRes.error)
    return NextResponse.json({ error: registrosRes.error.message }, { status: 500 })
  }

  const resumo = calcularAdesao(registros, {
    calorias_meta: meta.calorias_meta,
    proteina_meta_g: meta.proteina_meta_g,
    carboidrato_meta_g: meta.carboidrato_meta_g,
    lipideos_meta_g: meta.lipideos_meta_g,
    fibra_meta_g: meta.fibra_meta_g,
  })

  return NextResponse.json({ meta, resumo })
}
