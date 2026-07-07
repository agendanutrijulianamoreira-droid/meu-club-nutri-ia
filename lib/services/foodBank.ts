import { getSupabaseAdmin } from '@/lib/supabase-admin'

function normalizeSearch(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/**
 * Salva os ingredientes citados em cardápios qualitativos na tabela 'foods',
 * para reaproveitamento futuro no plano alimentar quantitativo (TACO/TBCA).
 * Ignora nomes que já existem (por name_search) e não sobrescreve macros existentes.
 */
export async function upsertFoodsFromIngredients(ingredients: string[]) {
  const names = Array.from(new Set(ingredients.map(i => i.trim()).filter(Boolean)))
  if (names.length === 0) return

  const admin = getSupabaseAdmin()
  const searches = names.map(normalizeSearch)

  const { data: existing } = await admin
    .from('foods')
    .select('name_search')
    .in('name_search', searches)

  const existingSet = new Set((existing || []).map((f: any) => f.name_search))

  const toInsert = names
    .map((name, i) => ({ name, name_search: searches[i] }))
    .filter(f => !existingSet.has(f.name_search))
    .map(f => ({
      name: f.name,
      name_search: f.name_search,
      category: 'outros',
      source: 'custom',
    }))

  if (toInsert.length === 0) return
  await admin.from('foods').insert(toInsert)
}

interface RecipeSource {
  tenantId: string
  title: string
  ingredients: string[]
  instructions: string
  mealType?: string
  imageUrl?: string | null
}

const CATEGORY_BY_MEAL_TYPE: Record<string, string> = {
  shot: 'shot',
  cafe_manha: 'café da manhã',
  colacao: 'lanche',
  lanche_manha: 'lanche',
  almoco: 'almoço',
  lanche_tarde: 'lanche',
  jantar: 'jantar',
  ceia: 'lanche',
  cha_noturno: 'bebida',
  meal: 'refeição',
}

/**
 * Salva refeições do cardápio qualitativo que têm modo de preparo (receita)
 * no banco de receitas do tenant (tabela 'recipes'), evitando duplicar por título.
 */
export async function saveRecipeFromItem(source: RecipeSource) {
  if (!source.title?.trim() || !source.instructions?.trim()) return

  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from('recipes')
    .select('id')
    .eq('tenant_id', source.tenantId)
    .eq('title', source.title.trim())
    .maybeSingle()

  if (existing) return

  await admin.from('recipes').insert({
    tenant_id: source.tenantId,
    title: source.title.trim(),
    category: CATEGORY_BY_MEAL_TYPE[source.mealType || ''] || 'refeição',
    ingredients: source.ingredients.map(item => ({ item })),
    instructions: source.instructions,
    image_url: source.imageUrl || null,
    is_ai_generated: true,
    access_tier: 'basic',
  })
}
