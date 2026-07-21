// Biblioteca de mensagens contextualizadas por fase da jornada.
// Genérica e independente da quantidade/nome das fases — o nome da fase
// vem sempre de method_phases.name (banco), nunca de um dicionário fixo.

export type TipoNotificacao = 'lembrete_refeicao' | 'hidratacao' | 'checkin' | 'motivacao'

export interface MensagensFase {
  lembrete_refeicao: string[]
  hidratacao: string[]
  checkin: string[]
  motivacao: string[]
}

// Templates com placeholder {fase} — funcionam para qualquer nome/quantidade de fases.
const MENSAGENS_GENERICAS: MensagensFase = {
  lembrete_refeicao: [
    'Hora de nutrir seu corpo! Sua refeição de agora é parte da fase {fase}.',
    'Refeição te esperando — mantenha o foco na fase {fase}.',
    'Cada refeição conta na sua jornada. Você está na fase {fase}!',
  ],
  hidratacao: [
    'Hidratação é parte do seu protocolo na fase {fase}. Já bebeu água hoje?',
    'Água agora ajuda seu corpo a responder melhor à fase {fase}.',
    'Beber água é um hábito que sustenta toda a fase {fase}.',
  ],
  checkin: [
    'Como você está se sentindo hoje? Registre seu check-in da fase {fase}.',
    'Seu diário está aguardando — 1 minuto que ajuda a acompanhar a fase {fase}.',
    'Check-in rápido: energia, humor, adesão. Vamos monitorar sua fase {fase}!',
  ],
  motivacao: [
    'Fase {fase} em andamento! Cada dia de protocolo é um passo à frente.',
    'Seu corpo está se transformando na fase {fase}. Continue!',
    'Você está construindo resultado real na fase {fase}. Confie no processo.',
  ],
}

export function sortearMensagem(nomeFase: string, tipo: TipoNotificacao): string {
  const msgs = MENSAGENS_GENERICAS[tipo]
  if (!msgs?.length) return ''
  const template = msgs[Math.floor(Math.random() * msgs.length)]
  return template.replace('{fase}', nomeFase)
}
