import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

// POST: gera uma refeição composta por IA. CRUD manual (incluindo montar a
// composição a partir de ativos existentes via picker) é feito pelo admin
// diretamente via Supabase client (useMeals/useMealComponents).
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { theme, category_id } = await request.json()
  if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

  const userPrompt = `Crie uma refeição composta com o tema: "${theme}" (ex: "Café da manhã proteico").
Retorne APENAS JSON válido:
{
  "title": "Nome da refeição",
  "description": "Uma linha sobre o benefício principal",
  "notes": "orientação opcional, ex: sirva gelado",
  "ingredients": [
    {"name": "nome do alimento (ex: ovo)", "quantity": número ou texto, "unit": "g/ml/unidade"}
  ],
  "tags": ["tags relevantes, ex: proteico, low carb"]
}`

  try {
    const result = await callClaudeJSON<any>({
      system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1000,
    })

    const { data, error } = await supabase.from('meals').insert({
      tenant_id: tenant.id,
      title: result.title || theme,
      description: result.description || null,
      category_id: category_id || null,
      notes: result.notes || null,
      tags: result.tags || [],
      is_ai_generated: true,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
      await insertComponentsFromIngredients(supabase, 'meal_components', 'meal_id', data.id, tenant.id, result.ingredients)
    }

    return NextResponse.json({ meal: data })
  } catch (err: any) {
    console.error('[/api/admin/meals/generate]', err)
    return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
  }
}
