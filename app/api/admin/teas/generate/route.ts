import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { insertComponentsFromIngredients } from '@/lib/services/clinicalAssets'

// POST: gera um chá funcional por IA. CRUD manual é feito pelo admin
// diretamente via Supabase client (useTeas, lib/hooks/useDatabase.ts).
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { theme, category_id } = await request.json()
  if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

  const userPrompt = `Crie um chá funcional com o tema: "${theme}".
Retorne APENAS JSON válido:
{
  "title": "Nome do chá",
  "description": "Uma linha sobre o benefício principal",
  "instructions": "Modo de preparo/infusão em texto corrido",
  "best_time": "ex: noturno, pela manhã",
  "indications": "para quem é indicado",
  "contraindications": "quem deve evitar ou ter cautela",
  "ingredients": [
    {"name": "nome do ingrediente (ex: camomila)", "quantity": número ou texto, "unit": "g/ml/colher/unidade"}
  ],
  "tags": ["tags relevantes, ex: calmante, digestivo"]
}`

  try {
    const result = await callClaudeJSON<any>({
      system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1000,
    })

    const { data, error } = await supabase.from('teas').insert({
      tenant_id: tenant.id,
      title: result.title || theme,
      description: result.description || null,
      category_id: category_id || null,
      instructions: result.instructions || null,
      best_time: result.best_time || null,
      indications: result.indications || null,
      contraindications: result.contraindications || null,
      tags: result.tags || [],
      is_ai_generated: true,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
      await insertComponentsFromIngredients(supabase, 'tea_components', 'tea_id', data.id, tenant.id, result.ingredients)
    }

    return NextResponse.json({ tea: data })
  } catch (err: any) {
    console.error('[/api/admin/teas/generate]', err)
    return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
  }
}
