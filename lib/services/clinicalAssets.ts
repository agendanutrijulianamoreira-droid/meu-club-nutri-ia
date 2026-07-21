// Contrato e utilitários compartilhados para os Ativos Clínicos da Biblioteca
// Clínica (ADR-0002). Reaproveitado por todas as entidades (recipes, meals,
// shots, teas, supplements, materials, goals) em vez de reescrever a mesma
// lógica de duplicação/CRUD em cada tela.
import { SupabaseClient } from '@supabase/supabase-js'
import { upsertFoodsFromIngredients } from '@/lib/services/foodBank'

function normalizeSearch(name: string) {
    return name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

export interface IngredientInput {
    name: string
    quantity?: string | number
    unit?: string
}

// Resolve uma lista de ingredientes citados por nome (ex.: geração por IA)
// para linhas de <entidade>_components referenciando foods por food_id —
// nunca copia o texto do ingrediente como conteúdo (ADR-0003). Cria os
// foods que ainda não existem no banco global (via upsertFoodsFromIngredients,
// que usa o client admin — inserir em `foods` exige service_role).
export async function insertComponentsFromIngredients(
    supabase: SupabaseClient,
    componentsTable: string,
    parentColumn: string,
    parentId: string,
    tenantId: string,
    ingredients: IngredientInput[]
) {
    const names = ingredients.map(i => i.name?.trim()).filter(Boolean) as string[]
    if (names.length === 0) return

    await upsertFoodsFromIngredients(names)

    const searches = names.map(normalizeSearch)
    const { data: foods } = await supabase.from('foods').select('id, name_search').in('name_search', searches)
    const foodIdBySearch = new Map((foods || []).map((f: any) => [f.name_search, f.id]))

    const rows = ingredients
        .map(ing => ({ ing, food_id: foodIdBySearch.get(normalizeSearch(ing.name || '')) }))
        .filter(r => r.food_id)
        .map((r, sort_order) => ({
            [parentColumn]: parentId,
            tenant_id: tenantId,
            food_id: r.food_id,
            quantity: typeof r.ing.quantity === 'number' ? r.ing.quantity : (Number(r.ing.quantity) || null),
            unit: r.ing.unit || null,
            serving_label: typeof r.ing.quantity === 'string' ? r.ing.quantity : null,
            sort_order,
        }))

    if (rows.length > 0) await supabase.from(componentsTable).insert(rows)
}

export interface SubstitutionInput {
    ingredient: string
    substitute: string
    reason?: string
}

// Resolve sugestões de substituição de ingrediente (ex.: geração por IA)
// para linhas relacionais de recipe_substitutions, referenciando foods por
// id nos dois lados (original e substituto) em vez de texto livre em JSON
// (ADR-0003 — mesmo princípio de insertComponentsFromIngredients).
export async function insertRecipeSubstitutions(
    supabase: SupabaseClient,
    recipeId: string,
    tenantId: string,
    substitutions: SubstitutionInput[]
) {
    const names = Array.from(new Set(
        substitutions.flatMap(s => [s.ingredient?.trim(), s.substitute?.trim()]).filter(Boolean) as string[]
    ))
    if (names.length === 0) return

    await upsertFoodsFromIngredients(names)

    const searches = names.map(normalizeSearch)
    const { data: foods } = await supabase.from('foods').select('id, name_search').in('name_search', searches)
    const foodIdBySearch = new Map((foods || []).map((f: any) => [f.name_search, f.id]))

    const rows = substitutions
        .map(s => ({
            original_food_id: foodIdBySearch.get(normalizeSearch(s.ingredient || '')),
            substitute_food_id: foodIdBySearch.get(normalizeSearch(s.substitute || '')),
            reason: s.reason || null,
        }))
        .filter(r => r.original_food_id && r.substitute_food_id)
        .map((r, sort_order) => ({ ...r, recipe_id: recipeId, tenant_id: tenantId, sort_order }))

    if (rows.length > 0) await supabase.from('recipe_substitutions').insert(rows)
}

// Resolve o nome de uma categoria para seu id em clinical_categories,
// criando a categoria no tenant se ainda não existir (ex.: quando a IA de
// classificação de biblioteca sugere um nome de categoria válido mas ainda
// não cadastrado).
export async function resolveCategoryId(
    supabase: SupabaseClient,
    tenantId: string,
    entityType: ClinicalCategory['entity_type'],
    categoryName?: string | null
): Promise<string | null> {
    if (!categoryName?.trim()) return null

    const { data: existing } = await supabase
        .from('clinical_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('name', categoryName.trim())
        .maybeSingle()

    if (existing) return existing.id

    const { data: created } = await supabase
        .from('clinical_categories')
        .insert({ tenant_id: tenantId, entity_type: entityType, name: categoryName.trim() })
        .select('id')
        .single()

    return created?.id ?? null
}

export interface BaseClinicalEntity {
    id: string
    tenant_id: string
    title: string
    description: string | null
    is_active: boolean
    is_ai_generated: boolean
    tags: string[]
    image_url: string | null
    sort_order: number
    ai_summary: string | null
    ai_keywords: string[]
    indications: string | null
    contraindications: string | null
    embedding_status: string | null
    last_ai_update: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface ClinicalCategory {
    id: string
    tenant_id: string
    entity_type: 'recipe' | 'meal' | 'shot' | 'tea' | 'supplement' | 'material'
    name: string
    sort_order: number
    is_active: boolean
    created_at: string
}

// Duplica um registro mestre: nova linha independente (ADR-0003 — "duplicar"
// nunca é "instanciar"). Reseta o que descreve o ciclo de vida da cópia
// original (IA, timestamps, autor), mantém o conteúdo.
export async function duplicateAsset<T extends BaseClinicalEntity>(
    supabase: SupabaseClient,
    table: string,
    id: string
): Promise<{ data: T | null; error: string | null }> {
    try {
        const { data: original, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !original) throw fetchError || new Error('Registro não encontrado')

        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...rest } = original as Record<string, unknown>
        const { data: { user } } = await supabase.auth.getUser()

        const copy = {
            ...rest,
            title: `${(original as any).title} (cópia)`,
            is_ai_generated: false,
            ai_summary: null,
            ai_keywords: [],
            embedding_status: null,
            last_ai_update: null,
            created_by: user?.id ?? null,
        }

        const { data, error } = await supabase.from(table).insert([copy]).select().single()
        if (error) throw error
        return { data: data as T, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}
