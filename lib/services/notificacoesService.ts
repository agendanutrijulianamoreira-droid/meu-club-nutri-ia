import { sortearMensagem, NOMES_FASE, TipoNotificacao } from '@/lib/config/mensagensNotificacao'
import { sendPushToUser } from '@/lib/onesignal'

// Envia notificação de fase REINO para uma paciente via OneSignal
// (mesmo canal de push usado pelo restante do app — ver lib/onesignal.ts)
export async function enviarNotificacaoFase(params: {
  pacienteId: string
  fase: number
  tipo: TipoNotificacao
  nomePaciente?: string
}): Promise<{ ok: boolean; erro?: string }> {
  const { pacienteId, fase, tipo, nomePaciente } = params

  const nomeFase = NOMES_FASE[fase] ?? `Fase ${fase}`
  const corpo = sortearMensagem(fase, tipo)

  if (!corpo) {
    return { ok: false, erro: `Sem mensagem para fase ${fase}, tipo ${tipo}` }
  }

  const titulos: Record<TipoNotificacao, string> = {
    lembrete_refeicao: nomePaciente ? `${nomePaciente}, hora da refeição!` : 'Hora da refeição!',
    hidratacao: 'Hidratação em dia?',
    checkin: 'Check-in diário',
    motivacao: `Fase ${nomeFase}`,
  }

  const result = await sendPushToUser({
    externalUserId: pacienteId,
    title: titulos[tipo],
    message: corpo,
    url: tipo === 'checkin' ? '/patient/progresso/checkin' : '/patient/diario',
    data: { tipo, fase: String(fase) },
  })

  if (!result.success) {
    console.error('[NotificacoesService] Falha ao enviar push de fase:', result.error)
    return { ok: false, erro: result.error }
  }

  return { ok: true }
}
