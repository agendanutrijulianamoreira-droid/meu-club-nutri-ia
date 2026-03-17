import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { aiGenerateLimiter } from '@/lib/rate-limiter'

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

    // 2. Rate Limit Guard
    const { allowed, remaining, resetAt } = aiGenerateLimiter.check(user.id)
    if (!allowed) {
        const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)
        return NextResponse.json(
            { error: `Muitas requisições. Tente novamente em ${retryAfterSeconds} segundos.` },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Remaining': String(remaining),
                    'X-RateLimit-Reset': String(resetAt),
                    'Retry-After': String(retryAfterSeconds),
                },
            }
        )
    }

    try {
        const { task, context, prompt } = await request.json()

        if (!task) {
            return NextResponse.json({ error: 'Task is required' }, { status: 400 })
        }

        // 2. Load Tenant Personality & Patient Cycle Data
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, cycle_tracking_enabled, last_period_start, cycle_length')
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

        // If patient has cycle tracking, include phase context
        if (profile?.cycle_tracking_enabled && profile?.last_period_start) {
            const lastPeriod = new Date(profile.last_period_start)
            const today = new Date()
            const diffDays = Math.floor((today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24))
            const cycleLen = profile.cycle_length || 28
            const currentDay = (diffDays % cycleLen) + 1

            let phase = 'menstrual'
            if (currentDay <= 5) phase = 'menstrual'
            else if (currentDay <= 13) phase = 'folicular'
            else if (currentDay <= 16) phase = 'ovulatória'
            else phase = 'lútea'

            systemInstruction += `\nA paciente está na fase ${phase} do ciclo menstrual (dia ${currentDay} de ${cycleLen}). Considere isso nas recomendações nutricionais e de atividades.`
        }

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
