import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * POST /api/patient/foto-refeicao
 * Recebe imagem em base64, analisa via Gemini Vision e retorna a lista de
 * alimentos reconhecidos (porção, calorias, macros) e insights da refeição.
 * Exclusivo do plano VIP.
 */

interface AlimentoReconhecido {
  nome: string
  porcao_g: number
  calorias: number
  proteina_g?: number
  carbo_g?: number
  gordura_g?: number
  confianca: 'alta' | 'media' | 'baixa'
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_plan, tenant_id')
    .eq('user_id', user.id)
    .single()

  if (profile?.current_plan !== 'vip') {
    return NextResponse.json(
      { error: 'Avaliação de pratos por IA é exclusiva do plano VIP', code: 'PLAN_UPGRADE_REQUIRED' },
      { status: 403 }
    )
  }

  let body: { image_base64?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { image_base64 } = body
  if (!image_base64) {
    return NextResponse.json({ error: 'image_base64 é obrigatório' }, { status: 400 })
  }

  // Remove data URL prefix se presente
  const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '')

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Configuração de IA ausente' }, { status: 500 })
  }

  const prompt = `Analise esta imagem de refeição e identifique TODOS os alimentos visíveis.

Para cada alimento identificado, estime:
1. Nome do alimento em português brasileiro
2. Porção estimada em gramas (baseado no que é visível)
3. Calorias estimadas para essa porção
4. Proteínas em gramas (se possível)
5. Carboidratos em gramas (se possível)
6. Gorduras em gramas (se possível)
7. Nível de confiança do reconhecimento: "alta", "media" ou "baixa"

Depois, escreva de 1 a 2 insights curtos sobre a refeição como um todo, com foco em regulação hormonal, saciedade/estabilização de energia e saúde intestinal (ex: "Excelente fonte de proteínas para estabilizar sua energia e reduzir picos de fome", "Rico em fibras, ótimo para o intestino e a microbiota", "Baixo em fibras — considere adicionar vegetais para apoiar a digestão").

Retorne APENAS JSON no formato:
{
  "alimentos": [
    {
      "nome": "Nome do alimento",
      "porcao_g": 150,
      "calorias": 180,
      "proteina_g": 25,
      "carbo_g": 5,
      "gordura_g": 7,
      "confianca": "alta"
    }
  ],
  "insights": ["Insight curto 1", "Insight curto 2"]
}

Regras:
- Identifique cada componente separadamente (ex: arroz, feijão, frango são 3 alimentos)
- Use nomes comuns brasileiros
- Confiança "baixa" para itens difíceis de distinguir na foto
- Máximo 10 alimentos por imagem
- Máximo 2 insights, cada um com no máximo 1 frase
- Se não for uma imagem de comida, retorne { "alimentos": [], "insights": [] }`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data,
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[foto-refeicao] Gemini error:', errText)
      return NextResponse.json({ error: 'Erro ao analisar imagem' }, { status: 502 })
    }

    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    const alimentos: AlimentoReconhecido[] = (parsed.alimentos || []).map((a: any) => ({
      nome: String(a.nome || ''),
      porcao_g: Number(a.porcao_g) || 100,
      calorias: Number(a.calorias) || 0,
      proteina_g: a.proteina_g != null ? Number(a.proteina_g) : undefined,
      carbo_g: a.carbo_g != null ? Number(a.carbo_g) : undefined,
      gordura_g: a.gordura_g != null ? Number(a.gordura_g) : undefined,
      confianca: ['alta', 'media', 'baixa'].includes(a.confianca) ? a.confianca : 'media',
    })).filter((a: AlimentoReconhecido) => a.nome && a.calorias > 0)

    const insights: string[] = Array.isArray(parsed.insights)
      ? parsed.insights.filter((i: unknown) => typeof i === 'string' && i.trim()).slice(0, 2)
      : []

    supabase.from('ai_generations').insert({
      user_id: user.id,
      tenant_id: profile?.tenant_id,
      prompt_text: 'Avaliação de prato por foto (VIP)',
      generated_content: { alimentos, insights },
      gpt_model: 'gemini-2.5-flash',
      status: 'success',
    }).then(({ error }) => {
      if (error) console.error('[foto-refeicao] log ai_generations:', error)
    })

    return NextResponse.json({ alimentos, insights })
  } catch (error) {
    console.error('[foto-refeicao] parse error:', error)
    return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
  }
}
