import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const DEFAULT_QUESTIONNAIRES = [
  {
    name: 'Check-in Semanal Padrão',
    description: 'Adesão, sintomas e humor geral',
    is_active: true,
    plan_filters: ['community', 'tech_diet', 'vip'],
    estimated_minutes: 3,
    total_respondents: 8,
    response_rate_pct: 94,
    questions: [
      { question_text: 'Como está sua adesão ao cardápio esta semana?', question_type: 'scale_1_5', question_order: 0, is_required: true },
      { question_text: 'Nível de inchaço percebido hoje', question_type: 'scale_1_5', question_order: 1, is_required: true },
      { question_text: 'Teve compulsão noturna nos últimos dias?', question_type: 'ab', question_order: 2, is_required: true },
      { question_text: 'O que foi mais difícil esta semana?', question_type: 'open_text', question_order: 3, is_required: false },
    ],
  },
  {
    name: 'Check-in Hormonal Profundo',
    description: 'Ciclo, energia, humor e sono — SOP/Endo',
    is_active: true,
    plan_filters: ['tech_diet', 'vip'],
    estimated_minutes: 5,
    total_respondents: 5,
    response_rate_pct: 87,
    questions: [
      { question_text: 'Em qual fase do ciclo você está?', question_type: 'scale_1_5', question_order: 0, is_required: true },
      { question_text: 'Nível de energia nos últimos 3 dias', question_type: 'scale_1_5', question_order: 1, is_required: true },
      { question_text: 'Intensidade dos sintomas de TPM', question_type: 'scale_1_5', question_order: 2, is_required: true },
      { question_text: 'Dormiu mais de 7h nos últimos 3 dias?', question_type: 'yes_no', question_order: 3, is_required: false },
    ],
  },
  {
    name: 'Check-in Intestinal',
    description: 'Trânsito, dor, inchaço e hábitos',
    is_active: true,
    plan_filters: ['tech_diet'],
    estimated_minutes: 4,
    total_respondents: 6,
    response_rate_pct: 79,
    questions: [
      { question_text: 'Evacuou hoje?', question_type: 'ab', question_order: 0, is_required: true },
      { question_text: 'Nível de inchaço abdominal', question_type: 'scale_1_5', question_order: 1, is_required: true },
      { question_text: 'Presença de dor ou cólica abdominal', question_type: 'scale_1_5', question_order: 2, is_required: true },
      { question_text: 'Relatou algum alimento suspeito?', question_type: 'open_text', question_order: 3, is_required: false },
    ],
  },
]

export async function GET() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase.from('questionnaires').select('id').eq('tenant_id', tenant.id).limit(1)

  if (!existing || existing.length === 0) {
    for (const tpl of DEFAULT_QUESTIONNAIRES) {
      const { questions, ...meta } = tpl
      const { data: created } = await supabase
        .from('questionnaires')
        .insert({ ...meta, tenant_id: tenant.id })
        .select('id')
        .single()

      if (created) {
        await supabase.from('questionnaire_questions').insert(
          questions.map(q => ({ ...q, questionnaire_id: created.id, tenant_id: tenant.id }))
        )
      }
    }
  }

  const { data: questionnaires, error } = await supabase
    .from('questionnaires')
    .select('*, questionnaire_questions(*)')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[questionnaires GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formatted = (questionnaires || []).map((q: any) => ({
    ...q,
    questions: (q.questionnaire_questions || []).sort((a: any, b: any) => a.question_order - b.question_order),
  }))

  return NextResponse.json({ questionnaires: formatted })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { questions = [], ...meta } = body

  const { data: created, error } = await supabase
    .from('questionnaires')
    .insert({
      tenant_id: tenant.id,
      name: meta.name,
      description: meta.description || '',
      is_active: meta.is_active ?? true,
      plan_filters: meta.plan_filters || [],
      estimated_minutes: meta.estimated_minutes || 3,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[questionnaires POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create' }, { status: 500 })
  }

  if (questions.length > 0) {
    await supabase.from('questionnaire_questions').insert(
      questions.map((q: any, i: number) => ({
        questionnaire_id: created.id,
        tenant_id: tenant.id,
        question_text: q.question_text,
        question_type: q.question_type || 'open_text',
        question_order: q.question_order ?? i,
        is_required: q.is_required ?? false,
        options: q.options || [],
      }))
    )
  }

  return NextResponse.json({ id: created.id })
}

export async function PUT(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, questions = [], ...meta } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('questionnaires')
    .update({
      name: meta.name,
      description: meta.description || '',
      is_active: meta.is_active ?? true,
      plan_filters: meta.plan_filters || [],
      estimated_minutes: meta.estimated_minutes || 3,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[questionnaires PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('questionnaire_questions').delete().eq('questionnaire_id', id)

  if (questions.length > 0) {
    await supabase.from('questionnaire_questions').insert(
      questions.map((q: any, i: number) => ({
        questionnaire_id: id,
        tenant_id: tenant.id,
        question_text: q.question_text,
        question_type: q.question_type || 'open_text',
        question_order: q.question_order ?? i,
        is_required: q.is_required ?? false,
        options: q.options || [],
      }))
    )
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
    .from('questionnaires')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    console.error('[questionnaires DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
