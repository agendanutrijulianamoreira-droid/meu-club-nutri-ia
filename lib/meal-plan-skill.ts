/**
 * lib/meal-plan-skill.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Skill de geração de cardápios — estilo e padrão da Nutricionista Juliana.
 *
 * Contém:
 *   getMealPlanSystemPrompt()  → system prompt com filosofia + exemplo de referência
 *   getMealPlanUserPrompt()    → user prompt com formato de saída lean
 *
 * PRINCÍPIO: a IA só escolhe QUAIS alimentos e QUANTO de cada.
 * Horários, labels e macros são computados pelo template (meal-plan-template.ts).
 */

import { MEAL_SLOTS } from './meal-plan-template'
import { getPromptFaseReino } from './config/promptsPlanoAlimentar'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MealPlanPromptParams {
  goal:              string      // 'emagrecimento' | 'hipertrofia' | 'detox' | ...
  duration_days:     number
  target_kcal:       number
  target_protein_g:  number
  restrictions:      string[]
  preferences?:      string
  patientName?:      string
  patientWeight?:    number
  patientGoal?:      string
  tenantMethodName?: string
  tenantSystemPrompt?: string
  faseReino?:        number      // 1-6: perfil clínico dietético (escolha manual da nutricionista — não é a fase da jornada do método)
  compactCatalog:    string      // saída de buildCompactCatalog()
}

// ─── System Prompt ────────────────────────────────────────────────────────────

export function getMealPlanSystemPrompt(
  tenantSystemPrompt?: string,
  methodName?: string,
  faseReino?: number
): string {
  const method = methodName || 'Método VitaClub'

  return `Você é uma nutricionista especializada em alimentação funcional e anti-inflamatória brasileira, criando cardápios personalizados para o ${method}.

${tenantSystemPrompt ? `FILOSOFIA DO MÉTODO:\n${tenantSystemPrompt}\n` : ''}${faseReino ? getPromptFaseReino(faseReino) : ''}

═══ PRINCÍPIOS INEGOCIÁVEIS ═══

1. USE APENAS alimentos da base de dados fornecida. Cada alimento tem um [uuid] — use o exato.
2. NUNCA sugira menos de 1200 kcal por dia.
3. Priorize alimentos reais, minimamente processados e acessíveis no Brasil.
4. Inclua SEMPRE o shot matinal bioativo (gengibre, cúrcuma, limão disponíveis no catálogo).
5. O almoço SEMPRE tem proteína + carboidrato complexo + leguminosa + legume + gordura boa.
6. Varie as proteínas ao longo dos dias (frango, carne, ovos, peixe, leguminosas).
7. Respeite restrições alimentares informadas — sem exceção.
8. Hidratação: inclua 2L/dia no contexto (não precisa listar como item).

═══ PADRÃO DE QUALIDADE — REFERÊNCIA ═══

Exemplo de almoço de emagrecimento (1800 kcal/dia):
  Almoço:
  → Arroz integral cozido         — 125g (1 escumadeira)
  → Feijão carioca cozido         —  65g (1 concha)
  → Frango peito grelhado         — 150g (1,5 filé)
  → Abobrinha refogada            — 100g (com alho e azeite)
  → Azeite de oliva extra virgem  —  10g (1 col. sobremesa)

Exemplo de café da manhã anti-inflamatório:
  Shot 06:30:
  → Gengibre                      — 5g  (1 rodela fina)
  → Limão                         — 50g (1 unidade, suco)
  → Cúrcuma em pó                 — 3g  (1 pitada)
  
  Café 08:30:
  → Aveia em flocos               — 40g (4 col. sopa)
  → Banana prata                  — 86g (1 unidade)
  → Ovo cozido                    — 50g (1 unidade)
  → Iogurte natural integral      — 170g (1 pote)

═══ SLOTS FIXOS DO CARDÁPIO ═══

${MEAL_SLOTS.map(s =>
  `${s.time}  [${s.slot_key}]  ${s.meal_label}  (${s.min_items}–${s.max_items} itens${s.optional ? ', opcional' : ''})`
).join('\n')}

═══ FORMATO DE SAÍDA — JSON COMPACTO ═══

Retorne APENAS o JSON abaixo. Sem markdown, sem explicações fora do JSON.
Os campos de macros, labels e horários NÃO devem aparecer na saída — são calculados automaticamente.

{
  "title": "Título motivacional do cardápio (max 60 chars)",
  "description": "2 linhas descrevendo o foco e benefício principal",
  "days": [
    {
      "day_number": 1,
      "day_theme": "Tema curto do dia (ex: Início Leve, Dia Proteico)",
      "slots": {
        "shot": [
          { "food_id": "uuid-exato-do-catalogo", "quantity_g": 5, "note": "Diluir em 50ml de água" }
        ],
        "cafe_manha": [
          { "food_id": "uuid-exato", "quantity_g": 40 },
          { "food_id": "uuid-exato", "quantity_g": 86 },
          { "food_id": "uuid-exato", "quantity_g": 50 }
        ],
        "colacao": [
          { "food_id": "uuid-exato", "quantity_g": 150 }
        ],
        "almoco": [
          { "food_id": "uuid-exato", "quantity_g": 125 },
          { "food_id": "uuid-exato", "quantity_g": 65 },
          { "food_id": "uuid-exato", "quantity_g": 150 },
          { "food_id": "uuid-exato", "quantity_g": 100 },
          { "food_id": "uuid-exato", "quantity_g": 10 }
        ],
        "lanche_tarde": [
          { "food_id": "uuid-exato", "quantity_g": 170 },
          { "food_id": "uuid-exato", "quantity_g": 30 }
        ],
        "jantar": [
          { "food_id": "uuid-exato", "quantity_g": 150 },
          { "food_id": "uuid-exato", "quantity_g": 100 },
          { "food_id": "uuid-exato", "quantity_g": 10 }
        ],
        "cha_noturno": [
          { "food_id": "uuid-exato", "quantity_g": 200, "note": "Infusão por 5 min" }
        ]
      }
    }
  ]
}

ATENÇÃO:
- O campo "note" é OPCIONAL — use apenas quando a preparação não for óbvia
- "cha_noturno" é opcional — inclua apenas se complementar o plano calórico
- Varie os alimentos entre os dias — não repita as mesmas escolhas todo dia
- Os UUIDs DEVEM ser exatamente como aparecem no catálogo fornecido`
}

// ─── User Prompt ──────────────────────────────────────────────────────────────

export function getMealPlanUserPrompt(params: MealPlanPromptParams): string {
  const {
    goal,
    duration_days,
    target_kcal,
    target_protein_g,
    restrictions,
    preferences,
    patientName,
    patientWeight,
    patientGoal,
    faseReino,
    compactCatalog,
  } = params

  const targetCarbs = Math.round((target_kcal * 0.45) / 4)
  const targetFat   = Math.round((target_kcal * 0.30) / 9)

  const patientSection = patientName ? `
PACIENTE:
  Nome:          ${patientName}
  Objetivo:      ${patientGoal || goal}
  Peso atual:    ${patientWeight ? patientWeight + 'kg' : 'não informado'}${faseReino ? `\n  Perfil clínico: ${faseReino}` : ''}
` : ''

  const restrictionLine = restrictions.length > 0
    ? restrictions.join(', ')
    : 'Nenhuma'

  const preferenceLine = preferences
    ? `\nPREFERÊNCIAS DA PACIENTE: ${preferences}`
    : ''

  return `Crie um cardápio de ${duration_days} dia(s).
${patientSection}
METAS DIÁRIAS:
  Calorias:   ~${target_kcal} kcal
  Proteínas:  ~${target_protein_g}g
  Carboidratos: ~${targetCarbs}g
  Gorduras:   ~${targetFat}g

OBJETIVO:       ${goal}
RESTRIÇÕES:     ${restrictionLine}${preferenceLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATÁLOGO DE ALIMENTOS DISPONÍVEIS (por 100g):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${compactCatalog}

Retorne o JSON compacto conforme o formato especificado. Inclua todos os ${duration_days} dia(s).`
}
