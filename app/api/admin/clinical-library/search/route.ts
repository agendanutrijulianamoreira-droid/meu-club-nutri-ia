import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const ENTITY_TABLES = [
  { entity_type: 'recipe', table: 'recipes' },
  { entity_type: 'meal', table: 'meals' },
  { entity_type: 'shot', table: 'shots' },
  { entity_type: 'tea', table: 'teas' },
  { entity_type: 'supplement', table: 'supplements' },
  { entity_type: 'material', table: 'materials' },
  { entity_type: 'goal', table: 'goals' },
] as const

// GET: pesquisa simples (ILIKE em title/description) através de todos os
// Ativos Clínicos + Metas de uma vez — data source da aba "Todos" da
// Biblioteca Clínica e do campo de busca global.
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''

  const queries = ENTITY_TABLES.map(async ({ entity_type, table }) => {
    let query = supabase.from(table).select('id, title, description, is_active, tags').eq('tenant_id', tenant.id)
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    const { data, error } = await query.order('sort_order', { ascending: true }).limit(50)
    if (error) return []
    return (data || []).map((row: any) => ({ ...row, entity_type }))
  })

  const results = (await Promise.all(queries)).flat()
  return NextResponse.json({ results })
}
