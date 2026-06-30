/**
 * Instruções clínicas por fase do Método REINO
 * Injetadas no system prompt do gerador de plano alimentar.
 */

export interface FaseReinoConfig {
    numero: number
    nome: string
    objetivo: string
    instrucoes: string
    alimentos_prioridade: string[]
    alimentos_evitar: string[]
}

export const FASES_REINO: Record<number, FaseReinoConfig> = {
    1: {
        numero: 1,
        nome: 'Anti-inflamatória',
        objetivo: 'Reduzir inflamação sistêmica e estresse oxidativo',
        instrucoes: `FASE 1 — ANTI-INFLAMATÓRIA:
- Priorizar ácidos graxos ômega-3 (sardinha, salmão, atum, linhaça, chia)
- Incluir cúrcuma + pimenta preta em PELO MENOS uma refeição por dia (shot ou tempero)
- Incluir gengibre fresco diariamente (shot matinal obrigatório)
- Aumentar antioxidantes: frutas vermelhas, cúrcuma, alho, cebola, brócolis
- EVITAR: açúcar refinado, óleos vegetais refinados (soja, milho), alimentos ultraprocessados
- Meta de gorduras boas: azeite extra virgem em todas as refeições principais
- Proteína magra em todas as refeições para estabilizar glicemia
- Hidratação: estimular chá de gengibre ou cúrcuma no período noturno`,
        alimentos_prioridade: ['sardinha', 'salmão', 'atum', 'linhaça', 'chia', 'cúrcuma', 'gengibre', 'brócolis', 'blueberry', 'morango', 'azeite'],
        alimentos_evitar: ['açúcar', 'margarina', 'óleo de soja', 'ultraprocessados', 'refrigerante'],
    },
    2: {
        numero: 2,
        nome: 'Intestinal',
        objetivo: 'Restaurar microbiota e permeabilidade intestinal',
        instrucoes: `FASE 2 — INTESTINAL:
- Incluir prebióticos diariamente: alho, cebola, banana verde/biomassa, aveia, chicória
- Incluir probióticos: iogurte natural integral, kefir (se disponível no catálogo)
- Adicionar caldo de ossos ou gelatina sem sabor para reparo intestinal
- Dieta low-FODMAP suave: reduzir feijão e brócolis cru, preferir cozidos
- Proteína de fácil digestão: frango, peixe, ovos cozidos
- Incluir fibras solúveis: aveia, psyllium, pera, maçã
- EVITAR: glúten em excesso, laticínios industrializados, álcool, frituras
- Refeições menores e mais frequentes para reduzir carga digestiva`,
        alimentos_prioridade: ['iogurte natural', 'banana', 'aveia', 'alho', 'cebola', 'frango', 'peixe', 'ovo', 'pera', 'maçã', 'azeite'],
        alimentos_evitar: ['feijão cru', 'brócolis cru', 'leite integral em excesso', 'frituras'],
    },
    3: {
        numero: 3,
        nome: 'Hormonal',
        objetivo: 'Suporte ao equilíbrio hormonal e detox estrogênico',
        instrucoes: `FASE 3 — HORMONAL:
- Crucíferas diariamente: brócolis, couve, repolho, couve-flor (detox estrogênico)
- Zinco para produção hormonal: carne vermelha magra, sementes de abóbora, ovos
- Magnésio para cortisol e TPM: amêndoa, castanha, espinafre, avocado
- LIMITAR soja e derivados (fitoestrogênios) — máximo 1 porção pequena por dia
- Incluir linhaça dourada moída (1 col. sopa/dia) como modulador hormonal
- Carboidratos complexos em todas as refeições para estabilizar insulina
- EVITAR: cafeína em excesso (máximo 1 café/dia), álcool, açúcar refinado
- Chá de menta ou erva-cidreira no período noturno para cortisol`,
        alimentos_prioridade: ['brócolis', 'couve', 'repolho', 'carne bovina magra', 'ovo', 'amêndoa', 'castanha', 'linhaça', 'espinafre', 'azeite'],
        alimentos_evitar: ['soja em excesso', 'cafeína em excesso', 'álcool', 'açúcar refinado'],
    },
    4: {
        numero: 4,
        nome: 'Metabólica',
        objetivo: 'Otimizar metabolismo e sensibilidade à insulina',
        instrucoes: `FASE 4 — METABÓLICA:
- Baixo índice glicêmico em TODAS as refeições: arroz integral, batata-doce, quinoa
- Timing nutricional: carboidratos complexos concentrados em café da manhã e almoço
- Jantar: proteína + legume, reduzir carboidratos (não eliminar)
- Combinações obrigatórias: sempre proteína + fibra + gordura boa juntos
- Intervalo mínimo de 4h entre refeições para sensibilidade insulínica
- Canela em pó: incluir no café da manhã (shot ou aveia)
- Proteína elevada: mínimo 30g por refeição principal
- EVITAR: carboidratos refinados, açúcar, sucos de frutas, frutas de alto IG isoladas`,
        alimentos_prioridade: ['arroz integral', 'batata-doce', 'quinoa', 'frango', 'ovo', 'atum', 'feijão', 'lentilha', 'canela', 'azeite', 'abacate'],
        alimentos_evitar: ['pão branco', 'arroz branco em excesso', 'açúcar', 'suco de fruta', 'batata frita'],
    },
    5: {
        numero: 5,
        nome: 'Composição Corporal',
        objetivo: 'Redução de gordura com preservação de massa muscular',
        instrucoes: `FASE 5 — COMPOSIÇÃO CORPORAL:
- Proteína MÍNIMA de 30g por refeição principal (café, almoço, jantar)
- Ciclagem de carboidratos: dias de treino com mais carbo, dias de descanso com menos
- Fontes magras de proteína: peito de frango, atum, clara de ovo, proteína vegetal
- Gorduras boas moderadas: azeite, abacate, oleaginosas em porções controladas
- Pré-treino (se aplicável): banana + proteína 1h antes
- Pós-treino: proteína rápida + carboidrato simples em até 30min
- EVITAR: gorduras saturadas em excesso, álcool (inibe síntese proteica), açúcar
- Hidratação elevada: estimular 2,5L/dia`,
        alimentos_prioridade: ['frango', 'atum', 'ovo', 'proteína vegetal', 'arroz integral', 'batata-doce', 'banana', 'iogurte grego', 'abacate', 'azeite'],
        alimentos_evitar: ['gordura saturada em excesso', 'álcool', 'açúcar', 'frituras'],
    },
    6: {
        numero: 6,
        nome: 'Manutenção',
        objetivo: 'Autonomia alimentar sustentável com regra 80/20',
        instrucoes: `FASE 6 — MANUTENÇÃO:
- Aplicar regra 80/20: 80% de refeições nutricionalmente completas, 20% de flexibilidade
- Cardápio equilibrado sem restrições severas — foco em prazer e sustentabilidade
- Variedade ampla de alimentos integrais e in natura
- Todas as cores do prato representadas diariamente
- Manter ritmo circadiano: café robusto, almoço principal, jantar mais leve
- Não eliminar nenhum grupo alimentar — moderação é a chave
- Incluir 1 refeição social por semana planejada (liberdade consciente)
- Hidratação e movimento são pilares igualmente importantes nesta fase`,
        alimentos_prioridade: ['variedade ampla', 'frutas da estação', 'verduras diversas', 'proteínas variadas', 'cereais integrais', 'gorduras boas'],
        alimentos_evitar: ['ultraprocessados frequentes', 'açúcar em excesso', 'álcool frequente'],
    },
}

export function getPromptFaseReino(fase: number): string {
    const config = FASES_REINO[fase]
    if (!config) return ''
    return `\n═══ FASE CLÍNICA DO MÉTODO REINO ═══\nFase ${config.numero} — ${config.nome}\nObjetivo: ${config.objetivo}\n\n${config.instrucoes}\n`
}

export function getNomeFaseReino(fase: number): string {
    return FASES_REINO[fase]?.nome ?? `Fase ${fase}`
}
