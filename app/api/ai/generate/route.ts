import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'
import { getGenerateSystemPrompt } from '@/lib/ai-nutritionist-identity'
import { sanitizeForPrompt, isValidTask, validateGenerateOutput, type GenerateTask } from '@/lib/ai-security'

function normalizeAIResponse(task: string, raw: any): any {
    if (!raw || typeof raw !== 'object') return raw
    if (task === 'generate-protocol') {
        const inner = raw.protocol || raw.data || raw.result || raw
        return {
            title: inner?.title || raw?.title || '',
            description: inner?.description || inner?.overview || inner?.summary || raw?.description || '',
            days: inner?.days || inner?.schedule || inner?.plan || raw?.days || [],
        }
    }
    return raw
}

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
        const body = await request.json()
        const task: string = body.task
        const context = sanitizeForPrompt(body.context, 500)
        const prompt = sanitizeForPrompt(body.prompt, 1000)

        if (!task) {
            return NextResponse.json({ error: 'Task is required' }, { status: 400 })
        }

        if (!isValidTask(task)) {
            return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
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
                .select('brand_name, method_name, gpt_system_prompt, settings')
                .eq('id', profile.tenant_id)
                .single()
            tenantInfo = tenant
        }

        const personality = tenantInfo?.settings?.ai?.tone || 'motivadora'
        const brandName = tenantInfo?.brand_name || 'Meu Club Nutri'
        const methodName = tenantInfo?.method_name || 'Protocolo Nutri'
        const baseInstructions = (tenantInfo as any)?.gpt_system_prompt || ''

        // 3. Build system prompt
        let systemInstruction = getGenerateSystemPrompt(brandName, methodName, personality, baseInstructions)

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
        } else if (task === 'checkin-analysis') {
            systemInstruction += `
Tarefa: Analisar um check-in nutricional.
Esquema de Retorno:
{
  "title": "Título do Insight",
  "message": "Análise técnica rápida + sugestão de ação para o nutricionista (máx 200 caracteres)",
  "risk_impact": "low|medium|high"
}`
        } else if (task === 'email-marketing') {
            const topic = sanitizeForPrompt(body.topic, 300)
            const seg = body.segment || 'all'
            const segLabel: Record<string, string> = { all: 'todas as pacientes', vip: 'pacientes VIP', active: 'pacientes ativas', inactive: 'pacientes inativas' }
            systemInstruction += `
Tarefa: Escrever um email de marketing para ${segLabel[seg] || 'todas as pacientes'} do clube ${brandName}.
Tema solicitado: ${topic || 'Motivação e saúde'}
Diretrizes:
- Tom: ${personality === 'acolhedora' ? 'caloroso e acolhedor' : personality === 'tecnica' ? 'direto e informativo' : 'motivacional e energético'}
- Use emojis com moderação
- Máximo 200 palavras no corpo
- Inclua uma frase de chamada para ação no final
- O HTML deve ser simples: apenas <p>, <strong>, <br>, listas simples
Retorne JSON:
{
  "subject": "Linha de assunto do email",
  "html_body": "<p>Corpo do email em HTML simples...</p>"
}`
        } else if (task === 'generate-business-plan') {
            const revenueGoal = sanitizeForPrompt(body.revenueGoalCents, 20)
            const focusTheme = sanitizeForPrompt(body.focusTheme, 500)
            const productsSummary = sanitizeForPrompt(body.productsSummary, 1500)
            systemInstruction += `
Tarefa: Rascunhar um planejamento anual de estratégia comercial e de conteúdo para o consultório, cobrindo os 12 meses do ano, para os dois planos pagos do clube: "tech_diet" (posicionado como o plano Premium/intermediário) e "vip" (o plano mais completo).
Meta de faturamento do ano (em centavos, se informada): ${revenueGoal || 'não informada'}
Foco/tema geral do ano: ${focusTheme || context || 'crescimento sustentável da comunidade'}
Catálogo de produtos/serviços já existente (use como referência para os itens sugeridos, sem inventar produtos que não existem nesta lista quando ela for informada): ${productsSummary || 'nenhum catálogo informado'}
Diretrizes importantes:
- O objetivo é vender sem parecer que está vendendo — priorize itens de conteúdo, comunidade e valor percebido, com promoções pontuais e espaçadas, nunca um mês inteiro de puro CTA de venda.
- Cada mês deve ter um tema claro e, quando fizer sentido, ser dividido em até 4 semanas com um foco específico.
- "suggested_items" são só SUGESTÕES para revisão humana antes de qualquer coisa ser publicada — não afirme nada como certo, são propostas.
- item_type deve ser um destes: challenge, protocol, content_post, push_campaign, email_campaign, promotion, product_launch, special_event.
- club_tier indica pra qual público o item é: "tech_diet" (Premium), "vip", ou "both" se for pra ambos.
Esquema de Retorno:
{
  "summary": "Resumo do racional geral da estratégia do ano (2-4 frases)",
  "months": [
    {
      "month_number": 1,
      "theme": "Tema do mês",
      "focus_area": "Área de foco (ex: retenção, aquisição, upsell)",
      "revenue_target_cents": 500000,
      "weeks": [ { "week_number": 1, "theme": "Tema da semana" } ],
      "suggested_items": [
        { "item_type": "content_post", "club_tier": "both", "title": "Título", "description": "Breve descrição" }
      ]
    }
  ]
}`
        }

        const fullPrompt = prompt || `Gere um ${task} baseado no contexto: ${context}`

        const raw = await callClaudeJSON({
            system: systemInstruction,
            maxTokens: task === 'generate-business-plan' ? 8000 : 2000,
            messages: [{ role: 'user', content: fullPrompt }],
        })

        const normalized = normalizeAIResponse(task, raw)
        const result = validateGenerateOutput(task as GenerateTask, normalized)

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[AI API] Error:', error)
        const isZodError = error?.name === 'ZodError' || Array.isArray(error?.issues)
        const message = isZodError
            ? 'A IA retornou uma resposta inesperada. Tente novamente em instantes.'
            : (error.message || 'Erro interno da IA')
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
