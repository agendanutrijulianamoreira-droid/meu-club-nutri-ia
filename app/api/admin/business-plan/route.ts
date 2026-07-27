import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getTenant(supabase: any, userId: string) {
  const { data } = await supabase
    .from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

// GET: listar planos do tenant (resumo, sem aninhar months/weeks/items)
export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: plans, error } = await supabase
    .from('business_plans')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('year', { ascending: false })

  if (error) {
    console.error('[business-plan GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plans: plans || [] })
}

// POST: criar um novo plano, opcionalmente já com months/weeks/items (rascunho gerado por IA)
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { year, title, revenue_goal_cents, questionnaire, ai_summary, months } = body

  if (!year) return NextResponse.json({ error: 'Ano é obrigatório' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })

  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .insert({
      tenant_id: tenant.id,
      year: Number(year),
      title: title.trim(),
      revenue_goal_cents: revenue_goal_cents != null ? Number(revenue_goal_cents) : null,
      questionnaire: questionnaire || {},
      ai_summary: ai_summary || null,
      generated_at: ai_summary ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (planError || !plan) {
    console.error('[business-plan POST]', planError)
    return NextResponse.json({ error: planError?.message || 'Erro ao criar plano' }, { status: 500 })
  }

  // Se veio um rascunho de meses (ex: resultado da IA), insere months/weeks/items relacionalmente
  if (Array.isArray(months) && months.length > 0) {
    for (const month of months) {
      const { data: monthRow, error: monthError } = await supabase
        .from('business_plan_months')
        .insert({
          plan_id: plan.id,
          tenant_id: tenant.id,
          month_number: month.month_number,
          theme: month.theme,
          focus_area: month.focus_area || null,
          revenue_target_cents: month.revenue_target_cents ?? null,
        })
        .select()
        .single()

      if (monthError || !monthRow) {
        console.error('[business-plan POST] month insert error', monthError)
        continue
      }

      const weekIdByNumber: Record<number, string> = {}
      if (Array.isArray(month.weeks) && month.weeks.length > 0) {
        const weekRows = month.weeks.map((w: any) => ({
          month_id: monthRow.id,
          tenant_id: tenant.id,
          week_number: w.week_number,
          theme: w.theme,
        }))
        const { data: insertedWeeks, error: weeksError } = await supabase
          .from('business_plan_weeks')
          .insert(weekRows)
          .select()
        if (weeksError) {
          console.error('[business-plan POST] weeks insert error', weeksError)
        } else {
          for (const w of insertedWeeks || []) weekIdByNumber[w.week_number] = w.id
        }
      }

      if (Array.isArray(month.suggested_items) && month.suggested_items.length > 0) {
        const itemRows = month.suggested_items.map((item: any) => ({
          plan_id: plan.id,
          month_id: monthRow.id,
          tenant_id: tenant.id,
          club_tier: item.club_tier || 'both',
          item_type: item.item_type,
          title: item.title,
          description: item.description || null,
          status: 'pending_review',
        }))
        const { error: itemsError } = await supabase.from('business_plan_items').insert(itemRows)
        if (itemsError) console.error('[business-plan POST] items insert error', itemsError)
      }
    }
  }

  return NextResponse.json({ plan })
}
