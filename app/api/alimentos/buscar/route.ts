import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/alimentos/buscar
 *
 * Busca alimentos na base TACO/TBCA (tabela `foods`).
 *
 * Parâmetros:
 *   ?q=frango          — busca por nome (ilike, mín. 2 chars, máx. 30 resultados)
 *   ?nome=arroz+branco — busca por nome exato (case-insensitive, retorna 1 resultado)
 *   &limit=10          — limitar resultados (padrão: 20, máx: 50)
 *
 * Rota pública — não exige autenticação.
 * Usada por: diário alimentar, scanner de código de barras.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const q     = (searchParams.get('q') ?? '').trim()
  const nome  = (searchParams.get('nome') ?? '').trim()
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))

  // Pelo menos um dos parâmetros é obrigatório
  if (!q && !nome) {
    return NextResponse.json(
      { error: 'Forneça o parâmetro ?q= (busca parcial) ou ?nome= (busca exata).' },
      { status: 400 }
    )
  }

  // Busca por nome exato (para resolução precisa, ex: retorno do scanner)
  if (nome) {
    if (nome.length < 2) {
      return NextResponse.json(
        { error: 'O parâmetro nome deve ter ao menos 2 caracteres.' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: alimento, error } = await supabase
      .from('foods')
      .select(
        'id, name, category, source, energy_kcal, protein_g, carbs_g, total_fat_g, ' +
        'fiber_g, sugar_g, sodium_mg, serving_size_g, serving_label, ' +
        'vitamin_c_mg, iron_mg, calcium_mg, potassium_mg, magnesium_mg, zinc_mg'
      )
      .ilike('name', nome)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[alimentos/buscar] busca exata:', error)
      return NextResponse.json({ error: 'Erro ao buscar alimento.' }, { status: 500 })
    }

    return NextResponse.json({ alimento: alimento ?? null })
  }

  // Busca parcial por nome (?q=)
  if (q.length < 2) {
    return NextResponse.json(
      { error: 'O parâmetro q deve ter ao menos 2 caracteres.' },
      { status: 400 }
    )
  }

  const supabase = createSupabaseServerClient(cookies())
  const { data: alimentos, error } = await supabase
    .from('foods')
    .select(
      'id, name, category, source, energy_kcal, protein_g, carbs_g, total_fat_g, ' +
      'fiber_g, serving_size_g, serving_label, ' +
      'vitamin_c_mg, iron_mg, calcium_mg, potassium_mg'
    )
    .or(`name.ilike.%${q}%,name_search.ilike.%${q}%`)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[alimentos/buscar] busca parcial:', error)
    return NextResponse.json({ error: 'Erro ao buscar alimentos.' }, { status: 500 })
  }

  return NextResponse.json({ alimentos: alimentos ?? [], total: alimentos?.length ?? 0 })
}
