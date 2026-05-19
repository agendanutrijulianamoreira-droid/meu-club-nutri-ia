import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('annual_plans')
    .select('*, annual_plan_items(count)')
    .eq('tenant_id', tenant.id)
    .order('year', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: tenant } = await supabase.from('tenants').select('id, name, method_name, gpt_system_prompt').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { year, questionnaire } = await request.json()

  // Get real business context
  const [{ count: patientCount }, { data: topPlan }, { data: checkinStats }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('role', 'patient'),
    supabase.from('profiles').select('current_plan').eq('tenant_id', tenant.id).eq('role', 'patient'),
    supabase.from('weekly_checkin_responses').select('created_at').eq('tenant_id', tenant.id).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const planCounts: Record<string, number> = {}
  topPlan?.forEach((p: any) => { planCounts[p.current_plan ?? 'community'] = (planCounts[p.current_plan ?? 'community'] ?? 0) + 1 })

  const businessContext = {
    totalPatients: patientCount ?? 0,
    planDistribution: planCounts,
    checkinsLast30d: checkinStats?.length ?? 0,
    clubName: tenant.name,
    methodName: (tenant as any).method_name,
  }

  // Build AI prompt
  const q = questionnaire
  const systemPrompt = `Você é uma consultora estratégica especializada em negócios de saúde e nutrição e especialista em nutricionismo clínico brasileiro.
Seu papel é criar planos anuais altamente personalizados para nutricionistas independentes que gerenciam clubes de saúde digital.
Use o calendário sazonal brasileiro e comportamento de consumo feminino 30-50 anos para maximizar engajamento e conversão.

SAZONALIDADES CHAVE BRASIL (use para protocolos e promoções):
- Jan: detox pós-festas, resolução de ano novo, alto engajamento
- Fev-Mar: Carnaval (foco em corpo, energia), pós-carnaval (retomada)
- Abr: outono, foco em imunidade, proteínas e sopas
- Mai: Dia das Mães (alta conversão para upsell), equinócio, foco em menopausa/hormônios
- Jun: inverno, sopas, shots anti-inflamatórios, queda de engajamento — retenção crítica
- Jul: férias escolares, estilo de vida, desafio família saudável
- Ago: primavera chegando, detox pré-primavera, corpo de primavera
- Set: Dia do Cliente (promoções), início da primavera — alto momento de conversão
- Out: Outubro Rosa (foco saúde feminina, preventivo), calor chegando
- Nov: Black Friday (upsell, annual plans), pré-verão intenso
- Dez: verão, festas, desafio manter o foco, relatório anual

PRODUTOS DE UPSELL DISPONÍVEIS:
- Consulta individual: momento ideal = meses 3, 6, 9 (trimestrais), no aniversário, pós check-in preocupante
- Método 90 Dias: melhor lançar jan, abr, set (início de estações)
- Teste Genético: melhor em momento de plateau ou frustração com resultado
Responda SEMPRE em JSON válido, sem texto fora do JSON.`

  const userPrompt = `Com base nas respostas da nutricionista e no contexto real do clube, gere um plano anual completo para ${year}.

RESPOSTAS DA NUTRICIONISTA:
- Foco principal: ${q.main_focus ?? 'Emagrecimento e saúde'}
- Meta de pacientes: ${q.patient_goal ?? 'Crescer 30%'}
- Produto estrela: ${q.star_product ?? 'Protocolo Bio'}
- Desafios que enfrentou: ${q.past_challenges ?? 'Retenção de clientes'}
- Datas comemorativas relevantes: ${q.relevant_dates ?? 'Carnaval, verão, natal'}
- Tipo de público-alvo: ${q.target_profile ?? 'Mulheres 30-50 anos'}
- Meta financeira: ${q.financial_goal ?? 'Dobrar receita'}
- Estilo de comunicação preferido: ${q.comm_style ?? 'Acolhedor e motivador'}
- Produtos de upsell planejados: ${q.upsell_products ?? 'Consulta individual, método 90 dias, teste genético'}

CONTEXTO REAL DO CLUBE:
- Total de pacientes: ${businessContext.totalPatients}
- Distribuição por plano: ${JSON.stringify(businessContext.planDistribution)}
- Check-ins nos últimos 30 dias: ${businessContext.checkinsLast30d}
- Nome do clube: ${businessContext.clubName}
- Método: ${businessContext.methodName ?? 'Não definido'}

IMPORTANTE: Para cada mês, o protocolo sazonal DEVE estar alinhado à estação do ano brasileira e ao comportamento do público-alvo naquele período. Os upsells devem seguir os momentos de maior receptividade. As promoções devem ter urgência real (Black Friday real em novembro, verão em dezembro, etc).

Gere um plano com EXATAMENTE esta estrutura JSON:
{
  "summary": "Resumo estratégico em 2-3 frases",
  "main_theme": "Tema central do ano",
  "months": [
    {
      "month": 1,
      "month_name": "Janeiro",
      "theme": "Tema do mês",
      "challenge": { "title": "...", "description": "...", "duration_days": 21 },
      "protocol": { "title": "...", "description": "..." },
      "promotion": { "title": "...", "description": "...", "discount_pct": 20 },
      "content_theme": "...",
      "push_campaign": { "title": "...", "message": "..." },
      "special_note": "Observação estratégica"
    }
  ],
  "quarterly_highlights": [
    { "quarter": "Q1", "focus": "...", "key_action": "..." }
  ],
  "upsell_calendar": [
    { "month": 3, "product": "...", "trigger": "..." }
  ]
}`

  try {
    const GEMINI_KEY = process.env.GEMINI_API_KEY
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 8000,
        },
      }),
    })

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const planData = JSON.parse(clean)

    // Save plan
    const { data: plan, error: planError } = await supabase
      .from('annual_plans')
      .upsert({
        tenant_id: tenant.id,
        year,
        status: 'in_review',
        questionnaire,
        plan_data: planData,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,year' })
      .select()
      .single()

    if (planError || !plan) throw new Error(planError?.message ?? 'Failed to save plan')

    // Flatten into plan items for review
    const items: any[] = []

    planData.months?.forEach((m: any) => {
      if (m.challenge) items.push({ plan_id: plan.id, tenant_id: tenant.id, month: m.month, item_type: 'challenge', title: m.challenge.title, description: m.challenge.description, details: m.challenge })
      if (m.protocol) items.push({ plan_id: plan.id, tenant_id: tenant.id, month: m.month, item_type: 'protocol', title: m.protocol.title, description: m.protocol.description, details: m.protocol })
      if (m.promotion) items.push({ plan_id: plan.id, tenant_id: tenant.id, month: m.month, item_type: 'promotion', title: m.promotion.title, description: m.promotion.description, details: m.promotion })
      if (m.push_campaign) items.push({ plan_id: plan.id, tenant_id: tenant.id, month: m.month, item_type: 'push_campaign', title: m.push_campaign.title, description: m.push_campaign.message, details: m.push_campaign })
    })

    planData.upsell_calendar?.forEach((u: any) => {
      items.push({ plan_id: plan.id, tenant_id: tenant.id, month: u.month, item_type: 'special_event', title: `Upsell: ${u.product}`, description: u.trigger, details: u })
    })

    if (items.length > 0) {
      // Delete old items for this plan first
      await supabase.from('annual_plan_items').delete().eq('plan_id', plan.id)
      await supabase.from('annual_plan_items').insert(items)
    }

    return NextResponse.json({ plan, itemCount: items.length })
  } catch (e: any) {
    console.error('[annual-plan POST]', e)
    return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status: 500 })
  }
}
