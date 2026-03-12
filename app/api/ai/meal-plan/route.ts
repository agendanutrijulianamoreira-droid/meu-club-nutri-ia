import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { focus, duration_days = 7 } = await request.json()

        if (!focus) {
            return NextResponse.json({ error: 'focus is required' }, { status: 400 })
        }

        // Load patient profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, tenant_id, dietary_restrictions, primary_goal, current_weight, initial_weight')
            .eq('user_id', user.id)
            .single()

        // Load tenant personality
        let tenantInfo: any = null
        if (profile?.tenant_id) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('brand_name, method_name, gpt_system_prompt, settings')
                .eq('id', profile.tenant_id)
                .single()
            tenantInfo = tenant
        }

        const restrictions: string[] = profile?.dietary_restrictions || []
        const patientName = profile?.name?.split(' ')[0] || 'Rainha'
        const methodName = tenantInfo?.method_name || 'Protocolo Nutri'
        const tone = tenantInfo?.settings?.ai?.tone || 'motivadora'
        const basePrompt = tenantInfo?.gpt_system_prompt ||
            'Você é uma nutricionista anti-bullshit. Seja direta, use alimentos acessíveis e foque na biologia, não em modismos.'

        const toneGuide: Record<string, string> = {
            acolhedora: 'Use tom carinhoso, encorajador e acolhedor.',
            motivadora: 'Use tom energético, motivacional e empoderador.',
            tecnica: 'Use tom técnico, objetivo e embasado em ciência.',
        }

        const systemInstruction = `${basePrompt}
Método: ${methodName}. ${toneGuide[tone] || toneGuide.motivadora}
Responda APENAS com JSON válido, sem markdown, sem explicações fora do JSON.`

        const userPrompt = `Crie um cardápio de ${duration_days} dias focado em: ${focus}

PERFIL:
- Nome: ${patientName}
- Restrições: ${restrictions.length > 0 ? restrictions.join(', ') : 'Nenhuma'}
- Objetivo: ${profile?.primary_goal || 'Não especificado'}
- Peso atual: ${profile?.current_weight ? `${profile.current_weight}kg` : 'Não informado'}

REGRAS:
- Use alimentos acessíveis e comuns no Brasil
- Seja específica com quantidades e horários
- Varie as refeições entre os dias
- Inclua shots matinais e hidratação
- Cardápio realista e sustentável

FORMATO JSON:
{
  "title": "Título motivacional curto",
  "description": "2 linhas explicando o foco",
  "days": [
    {
      "day": 1,
      "title": "Ex: Dia 1 - Despertar Metabólico",
      "tasks": [
        {
          "time": "07:00",
          "type": "shot",
          "description": "Nome da tarefa",
          "ingredients": ["item 1", "item 2"],
          "points": 15
        },
        {
          "time": "08:00",
          "type": "meal",
          "description": "Nome da refeição",
          "ingredients": ["item 1", "item 2", "item 3"],
          "points": 30
        }
      ]
    }
  ]
}

TIPOS: shot, meal, water, workout, content
PONTOS: shot=10-20, meal=20-40, water=10, workout=30-50, content=5`

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
            generationConfig: {
                responseMimeType: 'application/json',
                maxOutputTokens: 4000,
                temperature: 0.8,
            },
        })

        const result = await model.generateContent(userPrompt)
        const responseText = result.response.text()
        const generated = JSON.parse(responseText)

        // Save to ai_generations log
        await supabase.from('ai_generations').insert({
            user_id: user.id,
            tenant_id: profile?.tenant_id,
            prompt_text: focus,
            focus,
            duration_days,
            generated_content: generated,
            status: 'success',
        })

        return NextResponse.json({ success: true, data: generated })

    } catch (error: any) {
        console.error('[Meal Plan API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
    }
}
