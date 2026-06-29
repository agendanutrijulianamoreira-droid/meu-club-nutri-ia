export type RiscoNivel = 'alto' | 'medio'
export type Semaforo = 'verde' | 'amarelo' | 'vermelho'

interface CategoriaIngredientes {
    nome: string
    risco: RiscoNivel
    termos: string[]
}

export const CATEGORIAS_PROBLEMATICAS: CategoriaIngredientes[] = [
    {
        nome: 'inflamatorios',
        risco: 'alto',
        termos: [
            'óleo de soja', 'oleo de soja', 'óleo de palma', 'oleo de palma',
            'gordura hidrogenada', 'gordura vegetal hidrogenada', 'trans',
            'xarope de milho', 'glutamato monossódico', 'glutamato monossodico', 'msg',
            'óleo de canola', 'oleo de canola', 'margarina',
        ],
    },
    {
        nome: 'disruptores_hormonais',
        risco: 'alto',
        termos: [
            'bisfenol', 'bha', 'bht', 'nitrito de sódio', 'nitrito de sodio',
            'nitrato de sódio', 'nitrato de sodio', 'corante artificial',
            'benzoato de sódio', 'benzoato de sodio', 'ftalato',
        ],
    },
    {
        nome: 'estrogenicos',
        risco: 'medio',
        termos: ['soja', 'proteína de soja', 'proteina de soja', 'lecitina de soja', 'isolado proteico de soja'],
    },
    {
        nome: 'intestinais',
        risco: 'medio',
        termos: ['carragena', 'carragenina', 'polidextrose', 'maltodextrina', 'goma xantana', 'sorbitol', 'manitol'],
    },
    {
        nome: 'glicemicos',
        risco: 'medio',
        termos: ['xarope de glicose', 'frutose', 'açúcar invertido', 'acucar invertido', 'dextrose', 'maltose'],
    },
]

export interface AlertaIngrediente {
    categoria: string
    risco: RiscoNivel
    termo: string
}

export interface AvaliacaoProduto {
    semaforo: Semaforo
    alertas: AlertaIngrediente[]
    mensagem: string
}

export function avaliarProduto(ingredientesTexto: string, faseAtual?: number): AvaliacaoProduto {
    const texto = (ingredientesTexto || '').toLowerCase()
    const alertas: AlertaIngrediente[] = []

    if (texto.trim()) {
        for (const categoria of CATEGORIAS_PROBLEMATICAS) {
            for (const termo of categoria.termos) {
                if (texto.includes(termo)) {
                    alertas.push({ categoria: categoria.nome, risco: categoria.risco, termo })
                }
            }
        }
    }

    const temAlto = alertas.some(a => a.risco === 'alto')
    const temMedio = alertas.some(a => a.risco === 'medio')

    let semaforo: Semaforo = 'verde'
    if (temAlto) semaforo = 'vermelho'
    else if (temMedio) semaforo = 'amarelo'

    const mensagem = gerarMensagemAvaliacao(semaforo, alertas, faseAtual)

    return { semaforo, alertas, mensagem }
}

export function gerarMensagemAvaliacao(semaforo: Semaforo, alertas: AlertaIngrediente[], faseAtual?: number): string {
    if (semaforo === 'verde') {
        return 'Nenhum ingrediente problemático identificado. Bom alinhamento com seu protocolo.'
    }

    const categoriasUnicas = Array.from(new Set(alertas.map(a => a.categoria)))

    if (semaforo === 'vermelho') {
        const motivo = categoriasUnicas.includes('disruptores_hormonais')
            ? 'contém disruptores hormonais'
            : 'contém ingredientes inflamatórios'
        return `Atenção: este produto ${motivo}. Evite o consumo frequente, especialmente na fase ${faseAtual ?? 'atual'} do seu protocolo.`
    }

    if (categoriasUnicas.includes('estrogenicos')) {
        return 'Este produto contém soja (fitoestrógenos). Consumo moderado, sem necessidade de exclusão total.'
    }

    return 'Este produto possui ingredientes de atenção moderada. Prefira consumo ocasional.'
}
