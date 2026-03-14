import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // 1. Auth Guard
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { task, context, prompt } = await request.json()

        if (!task) {
            return NextResponse.json({ error: 'Task is required' }, { status: 400 })
        }

        // 2. Load Tenant Personality
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', user.id)
            .single()

        let tenantInfo = null
        if (profile?.tenant_id) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('brand_name, method_name, settings')
                .eq('id', profile.tenant_id)
                .single()
            tenantInfo = tenant
        }

        const personality = tenantInfo?.settings?.ai?.tone || 'motivadora'
        const brandName = tenantInfo?.brand_name || 'Meu Club Nutri'
        const methodName = tenantInfo?.method_name || 'Protocolo Nutri'

        // 3. Prepare AI System Instruction
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        })

        let systemInstruction = `Você é a inteligência artificial do ${brandName}, operando sob o método "${methodName}".
Sua personalidade é "${personality}".
Responda sempre em JSON válido seguindo estritamente o esquema solicitado.`

        if (task === 'generate-protocol') {
            systemInstruction += `
Tarefa: Gerar um protocolo nutricional.
Contexto: ${context || 'Geral'}
Esquema de Retorno: 
{
  "title": "Título do Protocolo",
  "description": "Breve descrição",
  "days": [
    {
      "day": 1,
      "title": "Título do Dia",
      "items": [
        { 
          "title": "Nome da Tarefa/Refeição", 
          "time": "HH:MM",
          "item_type": "meal|shot|water|exercise|habit", 
          "description": "Explicação detalhada ou itens da refeição",
          "points": 10 
        }
      ]
    }
  ]
}`
        } else if (task === 'generate-challenge') {
            systemInstruction += `
Tarefa: Sugerir um desafio gamificado.
Contexto: ${context || 'Engajamento'}
Esquema de Retorno:
{
  "title": "Nome do Desafio",
  "description": "O que as Rainhas devem fazer",
  "emoji": "🏆",
  "duration_days": 7
}`
        } else if (task === 'sales-copy') {
            systemInstruction += `
Tarefa: Gerar textos de alta conversão para uma página de vendas de nutrição.
Contexto: ${context || 'clube de nutrição para mulheres'}
Retorne APENAS JSON válido:
{
  "headline": "Grande promessa (máx 12 palavras, sem aspas)",
  "subheadline": "Texto de apoio explicando como a promessa é cumprida (máx 20 palavras)",
  "benefits": ["benefício 1", "benefício 2", "benefício 3", "benefício 4"],
  "cta": "texto do botão de compra (máx 5 palavras, em maiúsculas)"
}`
        } else if (task === 'marketing-suggestion') {
            systemInstruction += `
Tarefa: Sugerir uma notificação push de marketing.
Esquema de Retorno:
{
  "title": "Título Curto",
  "message": "Mensagem persuasiva com emojis de acordo com a personalidade"
}`
        }

        const fullPrompt = prompt || `Gere um ${task} baseado no contexto: ${context}`

        const result = await model.generateContent([
            { text: systemInstruction },
            { text: fullPrompt }
        ])

        const responseText = result.response.text()
        return NextResponse.json(JSON.parse(responseText))

    } catch (error: any) {
        console.error('[AI API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal AI Error' }, { status: 500 })
    }
}
