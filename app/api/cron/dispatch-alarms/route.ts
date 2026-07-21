import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/onesignal'
import { enviarNotificacaoFase } from '@/lib/services/notificacoesService'
import type { TipoNotificacao } from '@/lib/config/mensagensNotificacao'

const CRON_SECRET = process.env.CRON_SECRET || ''

// Mensagens padrão por tipo de alarme
const DEFAULT_PUSH: Record<string, { title: string; body: string }> = {
  water:      { title: '💧 Hora de hidratar!', body: 'Beba um copo de água agora. Seu corpo agradece.' },
  meal:       { title: '🥗 Hora da refeição!', body: 'Não pule essa refeição — ela faz parte do seu protocolo.' },
  exercise:   { title: '💪 Hora de se mover!', body: 'Seu corpo está esperando por você. Vamos lá!' },
  medication: { title: '💊 Hora do suplemento!', body: 'Não esqueça seus suplementos de hoje.' },
  custom:     { title: '⏰ Lembrete', body: 'Você tem um lembrete agendado para agora.' },
}

// Horários fixos para os tipos de notificação de fase que não têm
// horário customizável em preferencias_notificacao (apenas refeições têm).
const HORARIOS_HIDRATACAO = ['10:00', '15:30']
const HORARIO_CHECKIN = '20:00'
const HORARIO_MOTIVACAO = '08:00'

// GET: verificação de saúde (Vercel Cron chama via GET)
// POST: trigger manual (admin)
export async function GET(request: NextRequest) {
  return handleDispatch(request)
}

export async function POST(request: NextRequest) {
  return handleDispatch(request)
}

async function handleDispatch(request: NextRequest) {
  // Autenticação: secret no header ou query param
  const authHeader = request.headers.get('x-cron-secret')
  const querySecret = new URL(request.url).searchParams.get('secret')
  if (CRON_SECRET && authHeader !== CRON_SECRET && querySecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Supabase service role para leitura irrestrita
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Hora atual em BRT (UTC-3) no formato HH:MM
  const now = new Date()
  const brtOffset = -3 * 60
  const brtNow = new Date(now.getTime() + brtOffset * 60000)
  const hh = String(brtNow.getUTCHours()).padStart(2, '0')
  const mm = String(brtNow.getUTCMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`
  const currentDay = brtNow.getUTCDay() // 0=domingo

  // Buscar alarmes que disparam agora (±1 min de tolerância já é coberto pelo cron a cada minuto)
  const { data: alarms, error } = await supabase
    .from('patient_alarms')
    .select('*, profiles!patient_alarms_user_id_fkey(onesignal_player_id)')
    .eq('is_active', true)
    .eq('time_hhmm', currentTime)
    .contains('days_of_week', [currentDay])

  if (error) {
    console.error('[dispatch-alarms] Query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: { alarm_id: string; success: boolean; error?: string }[] = []

  for (const alarm of alarms || []) {
    const title = alarm.push_title || DEFAULT_PUSH[alarm.type]?.title || '⏰ Lembrete'
    const message = alarm.push_body || DEFAULT_PUSH[alarm.type]?.body || alarm.label

    const result = await sendPushToUser({
      externalUserId: alarm.user_id,
      title,
      message,
      url: '/patient/home',
      data: { alarm_id: alarm.id, type: alarm.type },
    })

    results.push({ alarm_id: alarm.id, success: result.success, error: result.error })

    // Atualiza last_fired_at
    await supabase.from('patient_alarms')
      .update({ last_fired_at: now.toISOString() })
      .eq('id', alarm.id)
  }

  const fired = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  console.log(`[dispatch-alarms] ${currentTime} BRT — disparados: ${fired}, falhas: ${failed}`)

  const reino = await dispatchReinoNotifications(supabase, currentTime)

  return NextResponse.json({
    time: currentTime,
    day: currentDay,
    total: alarms?.length || 0,
    fired,
    failed,
    results,
    reino,
  })
}

// Dispara notificações personalizadas pela fase atual da jornada da paciente,
// respeitando os horários preferidos e opt-ins de cada paciente.
async function dispatchReinoNotifications(
  supabase: any,
  currentTime: string
) {
  const { data: preferencias, error: errPrefs } = await supabase
    .from('preferencias_notificacao')
    .select('*')

  if (errPrefs || !preferencias?.length) {
    if (errPrefs) console.error('[dispatch-alarms/reino] Erro ao buscar preferências:', errPrefs)
    return { total: 0, fired: 0, failed: 0 }
  }

  const pacienteIds = preferencias.map((p: any) => p.paciente_id)

  const { data: fases } = await supabase
    .from('fase_paciente')
    .select('paciente_id, method_phases(name)')
    .in('paciente_id', pacienteIds)
    .is('fim', null)
    .not('method_phase_id', 'is', null)

  const faseByPaciente = new Map<string, string>(
    (fases || [])
      .filter((f: any) => f.method_phases?.name)
      .map((f: any) => [f.paciente_id, f.method_phases.name])
  )

  const { data: perfis } = await supabase
    .from('profiles')
    .select('user_id, name')
    .in('user_id', pacienteIds)

  const nomeByPaciente = new Map<string, string>((perfis || []).map((p: any) => [p.user_id, p.name]))

  const disparos: { pacienteId: string; tipo: TipoNotificacao }[] = []

  for (const pref of preferencias as any[]) {
    if (!faseByPaciente.has(pref.paciente_id)) continue // sem fase atribuída

    if (pref.notif_refeicao && [pref.horario_cafe, pref.horario_almoco, pref.horario_lanche, pref.horario_jantar]
      .some((h: string | null) => h?.slice(0, 5) === currentTime)) {
      disparos.push({ pacienteId: pref.paciente_id, tipo: 'lembrete_refeicao' })
    }
    if (pref.notif_hidratacao && HORARIOS_HIDRATACAO.includes(currentTime)) {
      disparos.push({ pacienteId: pref.paciente_id, tipo: 'hidratacao' })
    }
    if (pref.notif_checkin && currentTime === HORARIO_CHECKIN) {
      disparos.push({ pacienteId: pref.paciente_id, tipo: 'checkin' })
    }
    if (pref.notif_motivacao && currentTime === HORARIO_MOTIVACAO) {
      disparos.push({ pacienteId: pref.paciente_id, tipo: 'motivacao' })
    }
  }

  let fired = 0
  let failed = 0

  for (const { pacienteId, tipo } of disparos) {
    const resultado = await enviarNotificacaoFase({
      pacienteId,
      nomeFase: faseByPaciente.get(pacienteId)!,
      tipo,
      nomePaciente: nomeByPaciente.get(pacienteId)?.split(' ')[0],
    })
    if (resultado.ok) fired++
    else failed++
  }

  if (disparos.length > 0) {
    console.log(`[dispatch-alarms/reino] ${currentTime} BRT — disparados: ${fired}, falhas: ${failed}`)
  }

  return { total: disparos.length, fired, failed }
}
