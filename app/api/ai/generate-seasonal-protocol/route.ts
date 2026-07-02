import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { checkAndConsumeCredit } from '@/lib/ai-credits'

const MEAL_SLOTS = [
  'shot', 'cafe_manha', 'lanche_manha', 'colacao', 'almoco',
  'lanche_tarde', 'jantar', 'ceia', 'cha_noturno', 'water', 'workout', 'content',
]

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id, gpt_system_prompt, name, method_name').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { prompt, durationDays } = await request.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'Descreva o objetivo do protocolo' }, { status: 400 })

  const duration = Math.min(Math.max(parseInt(durationDays) || 7, 1), 30)

  const credit = await checkAndConsumeCredit(tenant.id, 'seasonal_protocol', `Protocolo sazonal: ${prompt.slice(0, 50)}`)
  if (!credit.success) {
    return NextResponse.json({ error: credit.error || 'Créditos de IA esgotados.' }, { status: 402 })
  }

  const systemInstruction = `
Você é uma nutricionista especialista em criar protocolos sazonais (isca/lead magnet) de curta duração,
no estilo de e-books de protocolo (detox, mãe bem diva, etc): cardápio QUALITATIVO (por opções, sem gramas),
com metas claras e tom acolhedor e motivador em português do Brasil.
${tenant.gpt_system_prompt ? `MÉTODO DA NUTRICIONISTA (siga a filosofia): ${tenant.gpt_system_prompt}` : ''}

Retorne APENAS JSON válido com esta estrutura exata:
{
  "title": "Nome chamativo do protocolo (ex: Protocolo Detox Verão)",
  "description": "2-3 frases motivacionais sobre o protocolo",
  "goals": ["Meta 1 objetiva", "Meta 2", "Meta 3", "Meta 4"],
  "days": [
    {
      "day_number": 1,
      "title": "Dia 1: nome do foco do dia",
      "items": [
        {
          "meal_type": "shot|cafe_manha|lanche_manha|colacao|almoco|lanche_tarde|jantar|ceia|cha_noturno|water|workout|content",
          "title": "Nome curto da opção (ex: Suco verde detox)",
          "description": "Descrição qualitativa da refeição/opção, sem gramas",
          "ingredients": ["ingrediente 1", "ingrediente 2"],
          "recipe": "Modo de preparo resumido (se aplicável, senão null)",
          "points": 10
        }
      ]
    }
  ]
}

REGRAS:
- meal_type deve ser um dos valores: ${MEAL_SLOTS.join(', ')}.
- Cada refeição principal (café da manhã, almoço, jantar) deve ter de 2 a 4 "opções" (vários items com o mesmo meal_type no mesmo dia).
- Sempre inclua "ingredients" com os alimentos citados na descrição, para reaproveitamento futuro.
- Gere exatamente ${duration} dias.
- Use alimentos reais e acessíveis no Brasil.
`

  try {
    const data = await callClaudeJSON<any>({
      system: systemInstruction,
      maxTokens: 8000,
      messages: [{ role: 'user', content: `${prompt}. Duração: ${duration} dias.` }],
    })
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[generate-seasonal-protocol]', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar protocolo' }, { status: 500 })
  }
}
