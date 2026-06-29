// Biblioteca de mensagens contextualizadas por fase do Método REINO
// 6 fases × 4 tipos = 24 conjuntos de mensagens

export type TipoNotificacao = 'lembrete_refeicao' | 'hidratacao' | 'checkin' | 'motivacao'

export interface MensagensFase {
  lembrete_refeicao: string[]
  hidratacao: string[]
  checkin: string[]
  motivacao: string[]
}

export const NOMES_FASE: Record<number, string> = {
  1: 'Anti-inflamatória',
  2: 'Intestinal',
  3: 'Hormonal',
  4: 'Metabólica',
  5: 'Composição Corporal',
  6: 'Manutenção',
}

export const MENSAGENS_POR_FASE: Record<number, MensagensFase> = {
  1: {
    lembrete_refeicao: [
      'Hora de nutrir seu corpo! Lembre do ômega-3 hoje.',
      'Refeição anti-inflamatória te esperando. Evite frituras e ultraprocessados agora.',
      'Seu corpo está em processo de redução de inflamação. Cada refeição conta!',
    ],
    hidratacao: [
      'Água com limão agora ajuda no processo anti-inflamatório.',
      'Hidratação é parte do protocolo desta fase. Já bebeu água hoje?',
      'Curcuma + água morna: seu ritual anti-inflamatório do dia.',
    ],
    checkin: [
      'Como está seu nível de inchaço hoje? Registre no app para acompanharmos a evolução.',
      'Seu diário de sintomas está aguardando. 1 minuto que faz diferença no seu tratamento.',
      'Check-in rápido: energia, inchaço, humor. Vamos monitorar sua Fase 1!',
    ],
    motivacao: [
      'Fase 1 em andamento! Cada dia de protocolo é um dia a menos de inflamação.',
      'Seu corpo está se curando por dentro. Continue!',
      'Anti-inflamatório não é dieta — é um protocolo de cura. Você está no caminho certo.',
    ],
  },

  2: {
    lembrete_refeicao: [
      'Hora da refeição! Priorizou fibras e prebióticos hoje?',
      'Seu intestino agradece mastigação lenta. Come devagar agora!',
      'Iogurte natural ou kefir no lanche de hoje? Seu microbioma precisa!',
    ],
    hidratacao: [
      'Água é fundamental para o trânsito intestinal. Beba um copo agora!',
      'Chá de camomila ou hortelã ajuda no conforto intestinal. Que tal agora?',
      'Hidratação + fibras = intestino feliz. Beba água!',
    ],
    checkin: [
      'Como foi seu trânsito intestinal hoje? Registre no diário.',
      'Distensão abdominal melhorou? Conta pra gente no check-in!',
      'Fase 2: como está seu conforto digestivo hoje? Registre agora.',
    ],
    motivacao: [
      '80% do seu sistema imune está no intestino. Você está cuidando do mais importante!',
      'Cada refeição com prebióticos é um investimento no seu microbioma.',
      'Intestino saudável = hormônios equilibrados. Você está construindo isso agora!',
    ],
  },

  3: {
    lembrete_refeicao: [
      'Crucíferas no almoço ajudam na detoxificação estrogênica. Brócolis, couve-flor!',
      'Zinco e magnésio são seus aliados nesta fase. Presentes na sua refeição?',
      'Fase Hormonal: priorize proteína + vegetais coloridos agora.',
    ],
    hidratacao: [
      'Chá de framboesa ou hortelã pode ajudar nos sintomas hormonais hoje.',
      'Água com semente de linhaça: suporte hormonal natural. Experimente!',
      'Hidratação adequada apoia a detoxificação hepática de hormônios.',
    ],
    checkin: [
      'Em que dia do ciclo você está? Registre no check-in para calibrarmos seu protocolo.',
      'Como está seu humor e nível de ansiedade hoje? Fase Hormonal quer saber!',
      'TPM ou não: registre seus sintomas agora para analisarmos padrões.',
    ],
    motivacao: [
      'Equilíbrio hormonal não acontece em dias. Mas acontece. Continue!',
      'Cada crucífera que você come é detox hormonal em ação.',
      'SOP ou endometriose não definem você — o protocolo que você segue define seus resultados.',
    ],
  },

  4: {
    lembrete_refeicao: [
      'Refeição com baixo índice glicêmico agora protege sua sensibilidade à insulina.',
      'Combinou proteína + fibra nesta refeição? Isso estabiliza sua glicose!',
      'Fase Metabólica: café da manhã robusto é regra. Não pule!',
    ],
    hidratacao: [
      'Hidratação adequada melhora o metabolismo em até 30%. Beba água!',
      'Água antes da refeição ajuda no controle glicêmico. Beba agora!',
      'Chá verde sem açúcar: termogênico natural para sua Fase 4.',
    ],
    checkin: [
      'Como está sua energia hoje? Registre para identificarmos padrões metabólicos.',
      'Registrou o que comeu hoje? A adesão é chave na Fase Metabólica.',
      'Nível de compulsão hoje: 0 a 10. Registre — é dado clínico valioso!',
    ],
    motivacao: [
      'Seu metabolismo está sendo reprogramado. Processo, não evento!',
      'Insulina equilibrada = energia estável, menos compulsão, menos acúmulo.',
      'Cada escolha de baixo índice glicêmico é uma reprogramação metabólica.',
    ],
  },

  5: {
    lembrete_refeicao: [
      'Proteína nesta refeição é obrigatória para preservar massa magra!',
      'Distribuiu a proteína ao longo do dia? Meta diária: verifique no app.',
      'Refeição pós-treino: proteína + carbo simples em até 30 minutos!',
    ],
    hidratacao: [
      'Água antes da refeição reduz compulsão. Beba agora!',
      'Hidratação é fundamental para performance e composição. Beba água!',
      'Músculo é 75% água. Hidrate-se para construir!',
    ],
    checkin: [
      'Registrou o peso esta manhã? Faz diferença acompanhar a tendência.',
      'Como está sua energia pós-treino? Registre no check-in.',
      'Diário alimentar + peso de hoje: dados preciosos para sua evolução.',
    ],
    motivacao: [
      'Composição corporal muda de dentro pra fora. Você está no caminho!',
      'Massa magra é metabolismo ativo. Cada proteína conta.',
      'Resultado na Fase 5 é cumulativo. Cada dia de protocolo soma!',
    ],
  },

  6: {
    lembrete_refeicao: [
      'Você chegou na manutenção! Hoje é sobre autonomia. Boa escolha!',
      'Regra 80/20 em ação: 80% funcional, 20% prazer consciente.',
      'Fase Manutenção: confie no que você aprendeu. Escolha bem!',
    ],
    hidratacao: [
      'Hábito construído: hidratação diária. Continua!',
      'Água ainda é prioridade mesmo na manutenção. Beba!',
      'Seus novos hábitos incluem hidratação. Mantenha!',
    ],
    checkin: [
      'Check-in de manutenção: como está se sentindo com sua autonomia alimentar?',
      'Fase 6 pedindo seu check-in. Como foi essa semana?',
      'Manutenção também precisa de monitoramento. Registre hoje!',
    ],
    motivacao: [
      'Manutenção é a fase mais importante. Você construiu isso!',
      'Você transformou protocolo em estilo de vida. Isso é sucesso real.',
      'REINO concluído — agora é autonomia com consciência. Parabéns!',
    ],
  },
}

export function sortearMensagem(fase: number, tipo: TipoNotificacao): string {
  const msgs = MENSAGENS_POR_FASE[fase]?.[tipo]
  if (!msgs?.length) return ''
  return msgs[Math.floor(Math.random() * msgs.length)]
}
