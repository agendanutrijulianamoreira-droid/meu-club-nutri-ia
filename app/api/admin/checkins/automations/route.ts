import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type PlanType = 'community' | 'tech_diet' | 'vip'

const DEFAULT_RULES: Record<PlanType, any[]> = {
  community: [
    { name: 'Check-in de Engajamento', description: 'Questionário: Check-in Semanal Padrão · WhatsApp', questionnaire_names: ['Check-in Semanal Padrão'], frequency_label: 'Toda segunda · 09h', channel: 'WhatsApp', rule_order: 1, is_active: true },
    { name: 'Lembrete de não-resposta', description: 'Automático · 24h após envio sem resposta', questionnaire_names: [], frequency_label: '1x lembrete', channel: 'WhatsApp', rule_order: 2, is_active: true },
    { name: 'Oferta de consulta', description: 'Enviada no dia 30 de clube ativo', questionnaire_names: [], frequency_label: '1x · dia 30', channel: 'WhatsApp', rule_order: 3, is_active: true },
  ],
  tech_diet: [
    { name: 'Check-in Semanal Completo', description: 'Semanal + Hormonal · WhatsApp', questionnaire_names: ['Check-in Semanal Padrão', 'Check-in Hormonal Profundo'], frequency_label: 'Toda quarta · 08h', channel: 'WhatsApp', rule_order: 1, is_active: true },
    { name: 'Check-in Intestinal', description: 'Apenas na Fase 1 (dias 1-30) · WhatsApp', questionnaire_names: ['Check-in Intestinal'], frequency_label: '2x/semana', channel: 'WhatsApp', rule_order: 2, is_active: true },
    { name: 'Marco de evolução (dia 30)', description: 'Questionário de resultado + foto pedida', questionnaire_names: [], frequency_label: 'Dia 30', channel: 'WhatsApp', rule_order: 3, is_active: true },
    { name: 'Marco de evolução (dia 60)', description: 'Questionário completo + ajuste de fase', questionnaire_names: [], frequency_label: 'Dia 60', channel: 'WhatsApp', rule_order: 4, is_active: true },
    { name: 'Pesquisa de depoimento', description: 'Pedido automático no dia 85', questionnaire_names: [], frequency_label: 'Dia 85', channel: 'WhatsApp', rule_order: 5, is_active: true },
  ],
  vip: [
    { name: 'Check-in Pós-consulta', description: 'Enviado 7 dias após a consulta', questionnaire_names: ['Check-in Semanal Padrão'], frequency_label: 'Dia +7', channel: 'WhatsApp', rule_order: 1, is_active: true },
    { name: 'Check-in Mensal', description: 'Acompanhamento leve durante os 3 meses', questionnaire_names: [], frequency_label: 'Mensal', channel: 'WhatsApp', rule_order: 2, is_active: true },
    { name: 'Oferta de upgrade', description: 'Envio no dia 75 — upgrade para Método 90d', questionnaire_names: [], frequency_label: 'Dia 75', channel: 'WhatsApp', rule_order: 3, is_active: true },
  ],
}

const DEFAULT_TRIGGERS: Record<PlanType, any[]> = {
  community: [
    { condition_text: 'Adesão ≤ 2 por 2 semanas seguidas', action_label: 'Alerta risco', action_type: 'risk_alert' },
    { condition_text: 'Mencionar "compulsão" 3x no mês', action_label: 'Oferta consulta', action_type: 'offer_consultation' },
  ],
  tech_diet: [
    { condition_text: 'Sono ≤ 2 por 3 dias seguidos', action_label: 'Alerta + sugestão IA', action_type: 'ai_suggestion' },
    { condition_text: 'Adesão ≥ 4 por 3 semanas', action_label: 'Mensagem celebração', action_type: 'celebration' },
    { condition_text: 'Inchaço > 4 por 5 dias seguidos', action_label: 'Alerta clínico urgente', action_type: 'risk_alert' },
  ],
  vip: [],
}

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existingRules } = await supabase.from('plan_automations').select('id').eq('tenant_id', tenant.id).limit(1)

  if (!existingRules || existingRules.length === 0) {
    const planTypes: PlanType[] = ['community', 'tech_diet', 'vip']
    for (const planType of planTypes) {
      for (const rule of DEFAULT_RULES[planType]) {
        await supabase.from('plan_automations').insert({ ...rule, tenant_id: tenant.id, plan_type: planType })
      }
      for (const trigger of DEFAULT_TRIGGERS[planType]) {
        await supabase.from('automation_triggers').insert({ ...trigger, tenant_id: tenant.id, plan_type: planType })
      }
    }
  }

  const [{ data: rules }, { data: triggers }] = await Promise.all([
    supabase.from('plan_automations').select('*').eq('tenant_id', tenant.id).order('rule_order', { ascending: true }),
    supabase.from('automation_triggers').select('*').eq('tenant_id', tenant.id),
  ])

  const planTypes: PlanType[] = ['community', 'tech_diet', 'vip']
  const sections = planTypes.map(planType => ({
    plan_type: planType,
    rules: (rules || []).filter((r: any) => r.plan_type === planType),
    triggers: (triggers || []).filter((t: any) => t.plan_type === planType),
  }))

  return NextResponse.json({ sections })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const table = body.type === 'trigger' ? 'automation_triggers' : 'plan_automations'
  const { type, ...data } = body

  const { data: created, error } = await supabase
    .from(table)
    .insert({ ...data, tenant_id: tenant.id })
    .select('id')
    .single()

  if (error) {
    console.error('[automations POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}

export async function PUT(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, is_active } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('plan_automations')
    .update({ is_active })
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[automations PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('plan_automations')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[automations DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
