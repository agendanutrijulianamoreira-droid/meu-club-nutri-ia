import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { callClaude } from '@/lib/services/anthropic'

function media(arr: (number | null | undefined)[]): number | null {
  const validos = arr.filter((v): v is number => v !== null && v !== undefined)
  if (validos.length === 0) return null
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10
}

/**
 * GET /api/admin/relatorios/pre-consulta?appointment_id=xxx
 * GET /api/admin/relatorios/pre-consulta?patient_id=xxx
 * Retorna o relatório mais recente já gerado (cache), sem chamar a IA de novo.
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const appointmentId = url.searchParams.get('appointment_id')
  const patientId = url.searchParams.get('patient_id')

  let query = supabase
    .from('relatorios_pre_consulta')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (appointmentId) query = query.eq('appointment_id', appointmentId)
  else if (patientId) query = query.eq('paciente_id', patientId)
  else return NextResponse.json({ error: 'appointment_id ou patient_id é obrigatório' }, { status: 400 })

  const { data, error } = await query.maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ relatorio: data })
}

/**
 * POST /api/admin/relatorios/pre-consulta
 * Body: { appointment_id?, patient_id?, periodo_dias? }
 * Consolida adesão alimentar, sintomas e peso dos últimos N dias e gera
 * análise clínica via IA (Gemini). Salva o resultado para consulta futura.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id, name').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { appointment_id?: string; patient_id?: string; periodo_dias?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const periodoDias = body.periodo_dias ?? 30
  let patientId = body.patient_id
  let appointmentId = body.appointment_id ?? null

  if (appointmentId) {
    const { data: appt, error: errAppt } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('id', appointmentId)
      .eq('tenant_id', tenant.id)
      .single()
    if (errAppt || !appt) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    }
    patientId = appt.patient_id
  }

  if (!patientId) {
    return NextResponse.json({ error: 'appointment_id ou patient_id é obrigatório' }, { status: 400 })
  }

  // Confirma que a paciente pertence ao tenant
  const { data: perfil, error: errPerfil } = await supabase
    .from('profiles')
    .select('name, primary_goal, dietary_restrictions, initial_weight, current_weight, tenant_id')
    .eq('user_id', patientId)
    .eq('tenant_id', tenant.id)
    .single()

  if (errPerfil || !perfil) {
    return NextResponse.json({ error: 'Paciente não encontrada neste tenant' }, { status: 404 })
  }

  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  const periodoInicioStr = dataInicio.toISOString().split('T')[0]
  const periodoFimStr = new Date().toISOString().split('T')[0]

  const [checkinsRes, diarioRes, metasRes, faseRes] = await Promise.all([
    supabase.from('checkin_diario').select('*')
      .eq('paciente_id', patientId).gte('data', periodoInicioStr).order('data'),
    supabase.from('diario_alimentar').select('data, calorias_calculadas, proteina_calculada')
      .eq('paciente_id', patientId).gte('data', periodoInicioStr),
    supabase.from('metas_paciente').select('*')
      .eq('paciente_id', patientId).is('valida_ate', null).maybeSingle(),
    supabase.from('fase_paciente').select('method_phases(name)')
      .eq('paciente_id', patientId).is('fim', null).order('inicio', { ascending: false }).limit(1).maybeSingle(),
  ])

  for (const [label, res] of [['checkins', checkinsRes], ['diario', diarioRes], ['metas', metasRes], ['fase', faseRes]] as const) {
    if (res.error) {
      console.error(`[relatorio-pre-consulta] Erro na query ${label}:`, res.error)
      return NextResponse.json({ error: `Erro ao consolidar dados (${label}): ${res.error.message}` }, { status: 500 })
    }
  }

  const checkins = checkinsRes.data || []
  const diario = diarioRes.data || []

  const diasComRegistro = new Set(diario.map(r => r.data)).size
  const taxaAdesao = periodoDias > 0 ? Math.round((diasComRegistro / periodoDias) * 100) : 0

  const dados = {
    paciente: {
      nome: perfil.name,
      primary_goal: perfil.primary_goal,
      dietary_restrictions: perfil.dietary_restrictions,
      fase_atual: (faseRes.data as any)?.method_phases?.name ?? null,
    },
    periodo: { inicio: periodoInicioStr, fim: periodoFimStr, dias: periodoDias },
    adesao: {
      taxa_percentual: taxaAdesao,
      dias_com_registro: diasComRegistro,
      total_dias: periodoDias,
    },
    sintomas: {
      media_energia: media(checkins.map(c => c.nivel_energia)),
      media_inchaco: media(checkins.map(c => c.nivel_inchaco)),
      media_compulsao: media(checkins.map(c => c.nivel_compulsao)),
      media_sono: media(checkins.map(c => c.qualidade_sono)),
      media_ansiedade: media(checkins.map(c => c.nivel_ansiedade)),
      media_dor_abdominal: media(checkins.map(c => c.dor_abdominal)),
      media_retencao_liquido: media(checkins.map(c => c.retencao_liquido)),
      media_humor: media(checkins.map(c => c.humor)),
    },
    tendencia_peso: checkins
      .filter(c => c.peso_kg != null)
      .map(c => ({ data: c.data, peso: c.peso_kg }))
      .slice(-10),
    peso_inicial: perfil.initial_weight,
    peso_atual: perfil.current_weight,
    metas_vigentes: metasRes.data,
  }

  let analiseClinica = ''
  try {
    analiseClinica = await gerarAnaliseClinica(dados)
  } catch (err: any) {
    console.error('[relatorio-pre-consulta] Erro ao gerar análise clínica via IA:', err)
    analiseClinica = 'Não foi possível gerar a análise clínica automática neste momento. Revise os dados consolidados manualmente.'
  }

  const { data: relatorioSalvo, error: errSalvar } = await supabase
    .from('relatorios_pre_consulta')
    .insert({
      tenant_id: tenant.id,
      paciente_id: patientId,
      appointment_id: appointmentId,
      periodo_inicio: periodoInicioStr,
      periodo_fim: periodoFimStr,
      dados_json: dados,
      analise_clinica: analiseClinica,
      gerado_por: user.id,
    })
    .select()
    .single()

  if (errSalvar) {
    console.error('[relatorio-pre-consulta] Erro ao salvar relatório:', errSalvar)
    return NextResponse.json({ error: errSalvar.message }, { status: 500 })
  }

  return NextResponse.json({ relatorio: relatorioSalvo })
}

async function gerarAnaliseClinica(dados: any): Promise<string> {
  const prompt = `Você é um copiloto clínico para a nutricionista, especializada em saúde da mulher (SOP, endometriose, saúde intestinal, equilíbrio hormonal — Método REINO). Analise os dados desta paciente e gere uma síntese clínica objetiva para uso pré-consulta.

PACIENTE: ${dados.paciente.nome}
OBJETIVO PRINCIPAL: ${dados.paciente.primary_goal || 'Não informado'}
RESTRIÇÕES ALIMENTARES: ${(dados.paciente.dietary_restrictions || []).join(', ') || 'Nenhuma'}
FASE ATUAL DO REINO: ${dados.paciente.fase_atual || 'Não atribuída'}
PERÍODO ANALISADO: ${dados.periodo.inicio} a ${dados.periodo.fim}

ADESÃO ALIMENTAR:
- Taxa de adesão: ${dados.adesao.taxa_percentual}%
- Dias com registro: ${dados.adesao.dias_com_registro} de ${dados.adesao.total_dias}

SINTOMAS (escala 0-10, menor = melhor):
- Energia média: ${dados.sintomas.media_energia ?? 'Não registrado'}
- Inchaço médio: ${dados.sintomas.media_inchaco ?? 'Não registrado'}
- Compulsão média: ${dados.sintomas.media_compulsao ?? 'Não registrado'}
- Sono médio: ${dados.sintomas.media_sono ?? 'Não registrado'}
- Ansiedade média: ${dados.sintomas.media_ansiedade ?? 'Não registrado'}
- Dor abdominal média: ${dados.sintomas.media_dor_abdominal ?? 'Não registrado'}
- Retenção de líquido média: ${dados.sintomas.media_retencao_liquido ?? 'Não registrado'}
- Humor médio: ${dados.sintomas.media_humor ?? 'Não registrado'}

PESO: inicial ${dados.peso_inicial ?? 'N/D'}kg, atual ${dados.peso_atual ?? 'N/D'}kg
TENDÊNCIA RECENTE: ${JSON.stringify(dados.tendencia_peso)}

Gere uma análise em tópicos com:
1. RESUMO EXECUTIVO (3 linhas)
2. PONTOS DE ATENÇÃO (o que precisa de ajuste na consulta)
3. EVOLUÇÃO POSITIVA (o que melhorou)
4. SUGESTÕES DE CONDUTA (hipóteses para investigar na consulta)

Seja clínica, objetiva e direta. Não use linguagem de app — use linguagem de prontuário. Se os dados forem insuficientes (poucos registros), declare isso explicitamente em vez de inventar conclusões.`

  return callClaude({ system: undefined, messages: [{ role: 'user', content: prompt }], maxTokens: 1200 })
}
