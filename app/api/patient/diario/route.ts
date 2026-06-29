import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"

// GET /api/patient/diario?data=2026-06-28  — busca alimentos OU registros do dia
// GET /api/patient/diario?q=frango         — busca alimentos na tabela foods
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const data = searchParams.get('data')

  // Busca de alimentos na tabela TACO/foods
  if (query) {
    const { data: alimentos, error } = await supabase
      .from('foods')
      .select('id, name, category, energy_kcal, protein_g, carbs_g, total_fat_g, fiber_g, serving_size_g, serving_label')
      .or(`name.ilike.%${query}%,name_search.ilike.%${query}%`)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(20)

    if (error) {
      console.error('[DiarioAlimentar] busca foods:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ alimentos })
  }

  // Registros do dia
  const dataAlvo = data || new Date().toISOString().split('T')[0]

  const { data: registros, error } = await supabase
    .from('diario_alimentar')
    .select('*')
    .eq('paciente_id', user.id)
    .eq('data', dataAlvo)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[DiarioAlimentar] busca registros:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ registros })
}

// POST /api/patient/diario  — registra uma refeição
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    nome_refeicao: string
    food_id: string
    alimento_nome: string
    quantidade_gramas: number
    calorias_calculadas: number
    proteina_calculada?: number
    carboidrato_calculado?: number
    lipideos_calculado?: number
    fibra_calculada?: number
    data?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { nome_refeicao, food_id, alimento_nome, quantidade_gramas, calorias_calculadas } = body

  if (!nome_refeicao || !alimento_nome || !quantidade_gramas || calorias_calculadas == null) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const dataRegistro = body.data || new Date().toISOString().split('T')[0]

  const { data: registro, error } = await supabase
    .from('diario_alimentar')
    .insert({
      paciente_id: user.id,
      data: dataRegistro,
      nome_refeicao,
      food_id: food_id || null,
      alimento_nome,
      quantidade_gramas,
      calorias_calculadas,
      proteina_calculada: body.proteina_calculada ?? null,
      carboidrato_calculado: body.carboidrato_calculado ?? null,
      lipideos_calculado: body.lipideos_calculado ?? null,
      fibra_calculada: body.fibra_calculada ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[DiarioAlimentar] insert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ registro }, { status: 201 })
}

// DELETE /api/patient/diario?id=uuid  — remove um registro
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase
    .from('diario_alimentar')
    .delete()
    .eq('id', id)
    .eq('paciente_id', user.id)

  if (error) {
    console.error('[DiarioAlimentar] delete:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
