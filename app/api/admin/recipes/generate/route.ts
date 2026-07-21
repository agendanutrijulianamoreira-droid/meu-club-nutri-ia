import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients, insertRecipeSubstitutions } from '@/lib/services/clinicalAssets'

// POST: gera uma receita completa por IA. CRUD manual (criar/editar/
// arquivar/duplicar) é feito pelo admin diretamente via Supabase client
// (useRecipes, lib/hooks/useDatabase.ts) — este endpoint existe só porque
// a geração por IA precisa rodar no servidor (chave de API).
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { theme, category_id, dietary_tags, access_tier } = await request.json()
  if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

  const restrictionInfo = dietary_tags?.length
    ? `A receita DEVE ser adequada para: ${dietary_tags.join(', ')}.`
    : 'Sem restrições alimentares específicas.'

  const userPrompt = `Crie uma receita saudável com o tema: "${theme}".
${restrictionInfo}
Nível de acesso: ${access_tier === 'premium' ? 'Premium — inclua calorias e macros exatos' : 'Básico — qualitativo, sem cálculo obrigatório'}.

Retorne APENAS JSON válido com esta estrutura:
{
  "title": "Nome da receita",
  "description": "Uma linha descrevendo o prato e seus benefícios",
  "emoji": "um emoji representativo",
  "prep_time_min": número em minutos,
  "servings": número de porções,
  "ingredients": [
    {"name": "nome do ingrediente (ex: peito de frango)", "quantity": número ou texto, "unit": "g/ml/unidade/colher"}
  ],
  "instructions": "Modo de preparo em texto corrido, passos numerados",
  "dietary_tags": ["tags que se aplicam: lactose, gluten, vegana, vegetariana, etc"],
  "tags": ["tags descritivas livres, ex: anti-inflamatório, detox"],
  "substitutions": [
    {"ingredient": "ingrediente original", "substitute": "substituição sugerida", "reason": "motivo"}
  ],
  "calories": null ou número,
  "protein_g": null ou número,
  "carbs_g": null ou número,
  "fat_g": null ou número
}`

  try {
    const result = await callClaudeJSON<any>({
      system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500,
    })

    const { data, error } = await supabase.from('recipes').insert({
      tenant_id: tenant.id,
      title: result.title || theme,
      description: result.description || null,
      emoji: result.emoji || '🍽️',
      category_id: category_id || null,
      dietary_tags: result.dietary_tags || dietary_tags || [],
      tags: result.tags || [],
      prep_time_min: result.prep_time_min || null,
      servings: result.servings || 1,
      instructions: result.instructions || '',
      calories: result.calories || null,
      protein_g: result.protein_g || null,
      carbs_g: result.carbs_g || null,
      fat_g: result.fat_g || null,
      access_tier: access_tier || 'basic',
      is_ai_generated: true,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
      await insertComponentsFromIngredients(supabase, 'recipe_components', 'recipe_id', data.id, tenant.id, result.ingredients)
    }
    if (Array.isArray(result.substitutions) && result.substitutions.length > 0) {
      await insertRecipeSubstitutions(supabase, data.id, tenant.id, result.substitutions)
    }

    return NextResponse.json({ recipe: data })
  } catch (err: any) {
    console.error('[/api/admin/recipes/generate]', err)
    return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
  }
}
