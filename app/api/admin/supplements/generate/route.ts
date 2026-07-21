import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

// POST: descreve um suplemento por IA. CRUD manual é feito pelo admin
// diretamente via Supabase client (useSupplements, lib/hooks/useDatabase.ts).
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { theme, category_id } = await request.json()
  if (!theme?.trim()) return NextResponse.json({ error: 'Tema é obrigatório' }, { status: 400 })

  const userPrompt = `Descreva o suplemento: "${theme}", para uso em um programa de nutrição clínica.
Retorne APENAS JSON válido:
{
  "title": "Nome do suplemento",
  "description": "Uma linha sobre o benefício principal",
  "default_dosage": número,
  "dosage_unit": "mg/mcg/UI/cápsula/comprimido/ml/gotas",
  "frequency": "ex: 1x ao dia",
  "best_time": "ex: em jejum, após o almoço",
  "indications": "para quem é indicado",
  "contraindications": "quem deve evitar ou ter cautela",
  "tags": ["tags relevantes, ex: energia, sono, imunidade"]
}`

  try {
    const result = await callClaudeJSON<any>({
      system: `Você é uma nutricionista especializada. ${tenant.gpt_system_prompt || ''}`,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 800,
    })

    const { data, error } = await supabase.from('supplements').insert({
      tenant_id: tenant.id,
      title: result.title || theme,
      description: result.description || null,
      category_id: category_id || null,
      default_dosage: result.default_dosage || null,
      dosage_unit: result.dosage_unit || null,
      frequency: result.frequency || null,
      best_time: result.best_time || null,
      indications: result.indications || null,
      contraindications: result.contraindications || null,
      tags: result.tags || [],
      is_ai_generated: true,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ supplement: data })
  } catch (err: any) {
    console.error('[/api/admin/supplements/generate]', err)
    return NextResponse.json({ error: err.message || 'Erro na geração por IA' }, { status: 500 })
  }
}
