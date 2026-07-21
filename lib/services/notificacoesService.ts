import { sortearMensagem, TipoNotificacao } from '@/lib/config/mensagensNotificacao'
import { sendPushToUser } from '@/lib/onesignal'

// Envia notificação contextualizada à fase atual da paciente (method_phases)
// via OneSignal (mesmo canal de push usado pelo restante do app — ver lib/onesignal.ts)
export async function enviarNotificacaoFase(params: {
  pacienteId: string
  nomeFase: string
  tipo: TipoNotificacao
  nomePaciente?: string
}): Promise<{ ok: boolean; erro?: string }> {
  const { pacienteId, nomeFase, tipo, nomePaciente } = params

  const corpo = sortearMensagem(nomeFase, tipo)

  if (!corpo) {
    return { ok: false, erro: `Sem mensagem para fase ${nomeFase}, tipo ${tipo}` }
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
    data: { tipo, fase: nomeFase },
  })

  if (!result.success) {
    console.error('[NotificacoesService] Falha ao enviar push de fase:', result.error)
    return { ok: false, erro: result.error }
  }

  return { ok: true }
}
