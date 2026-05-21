import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callClaudeJSON } from '@/lib/services/anthropic'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id, brand_name, method_name, gpt_system_prompt, settings').eq('owner_id', userId).single()
  return data
}

// GET: buscar plano anual existente
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  const { data: plan } = await supabase
    .from('strategic_plans')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('year', year)
    .single()

  if (!plan) return NextResponse.json({ plan: null })

  const { data: months } = await supabase
    .from('strategic_plan_months')
    .select('*')
    .eq('plan_id', plan.id)
    .order('month_number')

  return NextResponse.json({ plan: { ...plan, months: months || [] } })
}

// POST: gerar plano anual com IA ou salvar manual
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { mode, year, context } = body

  if (!year) return NextResponse.json({ error: 'year obrigatório' }, { status: 400 })

  if (mode === 'ai') {
    // Buscar métricas do tenant para contextualizar a IA
    const { data: metrics } = await supabase
      .from('profiles')
      .select('current_plan, primary_goal')
      .eq('tenant_id', tenant.id)
      .eq('role', 'patient')

    const planCounts: Record<string, number> = {}
    const goalCounts: Record<string, number> = {}
    for (const m of metrics || []) {
      if (m.current_plan) planCounts[m.current_plan] = (planCounts[m.current_plan] || 0) + 1
      if (m.primary_goal) goalCounts[m.primary_goal] = (goalCounts[m.primary_goal] || 0) + 1
    }

    const totalPatients = metrics?.length || 0
    const topGoal = Object.entries(goalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'emagrecimento'

    const systemPrompt = `${tenant.gpt_system_prompt || 'Você é uma consultora estratégica de nutrição e saúde feminina.'}

PAPEL ESPECÍFICO — PLANEJADORA ESTRATÉGICA ANUAL:
Você cria planos anuais baseados em dados reais do clube, sazonalidade brasileira, e tendências de saúde feminina.

CONHECIMENTO ESTRATÉGICO:
• Janeiro/Fevereiro: alta motivação pós-férias, foco em recomeço e metas
• Março/Abril: Páscoa (desafios de moderação), outono (hidratação, imunidade)
• Maio/Junho: Dia das Mães (campanhas especiais), entrada no inverno
• Julho: inverno = baixa energia, foco em caldos, proteínas quentes, adesão
• Agosto: Semana da Saúde, pico de conscientização
• Setembro: Primavera, renovação, detox leve
• Outubro/Novembro: corrida de fim de ano, gerenciamento de stress
• Dezembro: festas, moderação sem privação, retrospectiva

ESTRUTURA DO PLANO ANUAL:
• Cada mês tem um tema central alinhado à sazonalidade
• Campanhas de comunicação com timing e canal
• Desafios gamificados que aumentam engajamento
• Protocolos sugeridos para o período
• Metas realistas baseadas no histórico

Retorne APENAS JSON válido, sem markdown.`

    const userPrompt = `Crie o plano estratégico anual ${year} para o clube "${tenant.brand_name}".

DADOS DO CLUBE:
- Método: ${tenant.method_name || 'Reeducação Alimentar'}
- Total de pacientes: ${totalPatients}
- Distribuição de planos: ${JSON.stringify(planCounts)}
- Objetivo mais comum: ${topGoal}
- Tom de comunicação: ${tenant.settings?.ai?.tone || 'acolhedora'}
${context ? `- Contexto adicional: ${context}` : ''}

Crie um plano completo com tema, campanhas, desafios e metas para cada um dos 12 meses.

Retorne APENAS JSON:
{
  "title": "Plano Estratégico ${year} — [Nome Inspirador]",
  "summary": "visão geral em 2-3 frases",
  "goals": [
    {"goal": "objetivo anual", "metric": "métrica", "target": "número alvo"}
  ],
  "months": [
    {
      "month_number": 1,
      "theme": "tema do mês (ex: Recomeço Poderoso)",
      "focus_area": "área de foco (ex: hidratação|hormônios|intestino|emagrecimento|mental)",
      "campaigns": [
        {"title": "nome da campanha", "channel": "push|email|feed|whatsapp", "week": 1}
      ],
      "challenges": [
        {"title": "nome do desafio", "duration_days": 7, "xp_reward": 100}
      ],
      "protocols": [
        {"title": "nome do protocolo sugerido", "category": "detox|hormonal|emagrecimento|imunidade"}
      ],
      "content_ideas": [
        {"title": "tema do conteúdo", "type": "post|story|video|live", "platform": "feed|instagram|whatsapp"}
      ],
      "target_checkins": 0,
      "target_new_members": 0,
      "notes": "observações específicas do mês"
    }
  ]
}`

    const generated = await callClaudeJSON<any>({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 4000,
    })

    // Salvar ou atualizar plano
    const { data: existingPlan } = await supabase
      .from('strategic_plans')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('year', year)
      .single()

    let planId: string

    if (existingPlan) {
      await supabase
        .from('strategic_plans')
        .update({
          title: generated.title,
          summary: generated.summary,
          goals: generated.goals || [],
          is_ai_generated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPlan.id)
      planId = existingPlan.id

      // Remover meses antigos antes de inserir novos
      await supabase.from('strategic_plan_months').delete().eq('plan_id', planId)
    } else {
      const { data: newPlan } = await supabase
        .from('strategic_plans')
        .insert({
          tenant_id: tenant.id,
          year,
          title: generated.title,
          summary: generated.summary,
          goals: generated.goals || [],
          is_ai_generated: true,
        })
        .select('id')
        .single()
      planId = newPlan!.id
    }

    // Inserir meses
    const monthsToInsert = (generated.months || []).map((m: any) => ({
      plan_id: planId,
      tenant_id: tenant.id,
      month_number: m.month_number,
      theme: m.theme,
      focus_area: m.focus_area || null,
      campaigns: m.campaigns || [],
      challenges: m.challenges || [],
      protocols: m.protocols || [],
      content_ideas: m.content_ideas || [],
      target_checkins: m.target_checkins || null,
      target_new_members: m.target_new_members || null,
      notes: m.notes || null,
    }))

    await supabase.from('strategic_plan_months').insert(monthsToInsert)

    // Retornar plano completo
    const { data: finalPlan } = await supabase
      .from('strategic_plans').select('*').eq('id', planId).single()
    const { data: finalMonths } = await supabase
      .from('strategic_plan_months').select('*').eq('plan_id', planId).order('month_number')

    return NextResponse.json({ plan: { ...finalPlan, months: finalMonths || [] } })
  }

  return NextResponse.json({ error: 'mode inválido' }, { status: 400 })
}

// PATCH: atualizar mês específico
export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { month_id, updates } = body

  if (!month_id) return NextResponse.json({ error: 'month_id obrigatório' }, { status: 400 })

  // Verifica que o mês pertence ao tenant
  const { data: month } = await supabase
    .from('strategic_plan_months')
    .select('id')
    .eq('id', month_id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!month) return NextResponse.json({ error: 'Mês não encontrado' }, { status: 404 })

  const allowed = ['theme', 'focus_area', 'campaigns', 'challenges', 'protocols', 'content_ideas', 'target_checkins', 'target_new_members', 'notes']
  const safeUpdates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in updates) safeUpdates[key] = updates[key]
  }

  const { data: updated, error } = await supabase
    .from('strategic_plan_months')
    .update(safeUpdates)
    .eq('id', month_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ month: updated })
}
