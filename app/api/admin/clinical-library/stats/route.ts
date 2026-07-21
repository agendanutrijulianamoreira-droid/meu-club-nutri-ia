import { NextResponse } from 'next/server'
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

// GET: contagens agregadas por entidade para o Dashboard da Biblioteca
// Clínica. "Mais utilizados" não é possível ainda — nenhum protocolo/dieta
// referencia estes ativos até a Sub-fase 3/4, então não seria um dado real.
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stats = await Promise.all(ENTITY_TABLES.map(async ({ entity_type, table }) => {
    const hasCategory = table !== 'goals'
    const selectCols = hasCategory ? 'id, is_active, tags, category_id' : 'id, is_active, tags'
    const { data, error } = await supabase.from(table).select(selectCols).eq('tenant_id', tenant.id)
    if (error || !data) return { entity_type, total: 0, active: 0, inactive: 0, missing_category: 0, missing_tags: 0 }

    const rows = data as any[]
    return {
      entity_type,
      total: rows.length,
      active: rows.filter(r => r.is_active).length,
      inactive: rows.filter(r => !r.is_active).length,
      missing_category: hasCategory ? rows.filter(r => !r.category_id).length : 0,
      missing_tags: rows.filter(r => !r.tags || r.tags.length === 0).length,
    }
  }))

  return NextResponse.json({ stats })
}
