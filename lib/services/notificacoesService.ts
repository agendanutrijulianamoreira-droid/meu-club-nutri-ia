import { sortearMensagem, NOMES_FASE, TipoNotificacao } from '@/lib/config/mensagensNotificacao'

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY

// Envia push para um único token FCM
export async function enviarPushFCM(
  token: string,
  titulo: string,
  corpo: string,
  dados?: Record<string, string>
): Promise<{ ok: boolean; erro?: string }> {
  if (!FCM_SERVER_KEY) {
    console.error('[NotificacoesService] FCM_SERVER_KEY não configurada')
    return { ok: false, erro: 'FCM_SERVER_KEY ausente' }
  }

  const payload = {
    to: token,
    notification: { title: titulo, body: corpo },
    data: dados ?? {},
  }

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[NotificacoesService] FCM erro:', err)
    return { ok: false, erro: err }
  }

  return { ok: true }
}

// Envia notificação de fase REINO para uma paciente
export async function enviarNotificacaoFase(params: {
  token: string
  fase: number
  tipo: TipoNotificacao
  nomePaciente?: string
}): Promise<{ ok: boolean; erro?: string }> {
  const { token, fase, tipo, nomePaciente } = params

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

  return enviarPushFCM(token, titulos[tipo], corpo, {
    tipo,
    fase: String(fase),
    tela: tipo === 'checkin' ? '/patient/progresso/checkin' : '/patient/diario',
  })
}
