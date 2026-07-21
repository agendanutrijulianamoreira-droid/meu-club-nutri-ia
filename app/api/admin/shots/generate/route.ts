import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

// POST: gera um shot bioativo por IA. CRUD manual é feito pelo admin
// diretamente via Supabase client (useShots, lib/hooks/useDatabase.ts).
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { theme, category_id } = await request.json()
  if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

  const userPrompt = `Crie um shot bioativo (dose concentrada, tomada em jejum ou em momento específico) com o tema: "${theme}".
Retorne APENAS JSON válido:
{
  "title": "Nome do shot",
  "description": "Uma linha sobre o benefício principal",
  "instructions": "Modo de preparo em texto corrido",
  "volume_ml": número (volume total da dose),
  "best_time": "ex: em jejum, 20 min antes do café",
  "indications": "para quem é indicado",
  "contraindications": "quem deve evitar (ex: gastrite, úlcera, anticoagulantes)",
  "ingredients": [
    {"name": "nome do ingrediente (ex: gengibre)", "quantity": número ou texto, "unit": "g/ml/unidade/rodela"}
  ],
  "tags": ["tags relevantes, ex: anti-inflamatório, digestivo"]
}`

  try {
    const result = await callClaudeJSON<any>({
      system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1000,
    })

    const { data, error } = await supabase.from('shots').insert({
      tenant_id: tenant.id,
      title: result.title || theme,
      description: result.description || null,
      category_id: category_id || null,
      instructions: result.instructions || null,
      volume_ml: result.volume_ml || null,
      best_time: result.best_time || null,
      indications: result.indications || null,
      contraindications: result.contraindications || null,
      tags: result.tags || [],
      is_ai_generated: true,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
      await insertComponentsFromIngredients(supabase, 'shot_components', 'shot_id', data.id, tenant.id, result.ingredients)
    }

    return NextResponse.json({ shot: data })
  } catch (err: any) {
    console.error('[/api/admin/shots/generate]', err)
    return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
  }
}
