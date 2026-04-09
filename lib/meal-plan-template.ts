/**
 * lib/meal-plan-template.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Template de cardápio fixo do VitaClub.
 *
 * ARQUITETURA (template + skill):
 *   IA       → devolve apenas { food_id, quantity_g } por slot por dia (~75% menos tokens)
 *   Template → define horários, labels, ordem, e calcula macros automaticamente
 *
 * Slots fixos (baseados no padrão Juliana Moreira):
 *   06:30  shot         Shot bioativo matinal
 *   08:30  cafe_manha   Café da manhã
 *   10:00  colacao      Colação
 *   12:00  almoco       Almoço
 *   16:00  lanche_tarde Lanche da tarde
 *   19:30  jantar       Jantar
 *   22:00  cha_noturno  Chá noturno (opcional)
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MealSlot {
  slot_key:   string   // 'shot', 'cafe_manha', etc.
  meal_type:  string   // mesmo valor → compatível com meal_plan_items.meal_type
  meal_label: string   // Label PT-BR
  time:       string   // 'HH:MM'
  min_items:  number   // mínimo de itens esperados
  max_items:  number   // máximo de itens esperados
  optional:   boolean  // se pode ser omitido pela IA
  sort_order: number   // posição no dia
}

/** Seleção mínima devolvida pela IA */
export interface AIFoodSelection {
  food_id:    string   // UUID do alimento na tabela foods
  quantity_g: number   // quantidade em gramas
  note?:      string   // observação de preparo (opcional, 1 linha)
}

/** Saída lean da IA (formato compacto) */
export interface AILeanOutput {
  title:       string
  description: string
  days: Array<{
    day_number: number
    day_theme:  string   // ex: "Início Leve", "Dia Proteico"
    slots:      Record<string, AIFoodSelection[]>  // slot_key → seleções
  }>
}

/** Item expandido (compatível com meal_plan_items do DB) */
export interface ExpandedMealItem {
  day_number:         number
  meal_type:          string
  meal_label:         string
  time:               string
  sort_order:         number
  food_id:            string | null
  food_name:          string
  quantity_g:         number
  serving_qty:        number | null
  serving_label:      string | null
  calc_kcal:          number
  calc_protein_g:     number
  calc_carbs_g:       number
  calc_fat_g:         number
  calc_fiber_g:       number
  preparation_notes:  string | null
  substitution_note:  string | null
}

export interface ExpandedDay {
  day_number:        number
  day_theme:         string
  meals:             ExpandedMealGroup[]
  day_total_kcal:    number
  day_total_protein: number
  day_total_carbs:   number
  day_total_fat:     number
}

export interface ExpandedMealGroup {
  meal_type:  string
  meal_label: string
  time:       string
  items:      ExpandedMealItem[]
}

export interface ExpandedPlan {
  title:       string
  description: string
  days:        ExpandedDay[]
  flat_items:  ExpandedMealItem[]  // para inserção direta no DB
}

// ─── Template dos slots ───────────────────────────────────────────────────────

export const MEAL_SLOTS: MealSlot[] = [
  {
    slot_key:   'shot',
    meal_type:  'shot',
    meal_label: 'Shot Matinal',
    time:       '06:30',
    min_items:  1,
    max_items:  3,
    optional:   false,
    sort_order: 0,
  },
  {
    slot_key:   'cafe_manha',
    meal_type:  'cafe_manha',
    meal_label: 'Café da Manhã',
    time:       '08:30',
    min_items:  3,
    max_items:  5,
    optional:   false,
    sort_order: 1,
  },
  {
    slot_key:   'colacao',
    meal_type:  'colacao',
    meal_label: 'Colação',
    time:       '10:00',
    min_items:  1,
    max_items:  3,
    optional:   false,
    sort_order: 2,
  },
  {
    slot_key:   'almoco',
    meal_type:  'almoco',
    meal_label: 'Almoço',
    time:       '12:00',
    min_items:  4,
    max_items:  6,
    optional:   false,
    sort_order: 3,
  },
  {
    slot_key:   'lanche_tarde',
    meal_type:  'lanche_tarde',
    meal_label: 'Lanche da Tarde',
    time:       '16:00',
    min_items:  2,
    max_items:  3,
    optional:   false,
    sort_order: 4,
  },
  {
    slot_key:   'jantar',
    meal_type:  'jantar',
    meal_label: 'Jantar',
    time:       '19:30',
    min_items:  3,
    max_items:  5,
    optional:   false,
    sort_order: 5,
  },
  {
    slot_key:   'cha_noturno',
    meal_type:  'cha_noturno',
    meal_label: 'Chá Noturno',
    time:       '22:00',
    min_items:  1,
    max_items:  1,
    optional:   true,
    sort_order: 6,
  },
]

// Mapa slot_key → slot (para lookup rápido)
export const SLOT_MAP = Object.fromEntries(
  MEAL_SLOTS.map(s => [s.slot_key, s])
)

// ─── Catálogo compacto para o prompt ─────────────────────────────────────────

export interface FoodRow {
  id:            string
  name:          string
  category:      string
  energy_kcal:   number
  protein_g:     number
  total_fat_g:   number
  carbs_g:       number
  fiber_g:       number
  serving_size_g: number
  serving_label:  string
}

/**
 * Gera string de catálogo ultra-compacta para enviar ao prompt.
 * Formato: [id] Nome | kcal P C G (por 100g)
 * ~40 chars por alimento vs ~120 chars no formato antigo → 67% menor
 */
export function buildCompactCatalog(foods: FoodRow[]): string {
  const byCategory: Record<string, FoodRow[]> = {}
  for (const f of foods) {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(f)
  }

  return Object.entries(byCategory).map(([cat, items]) => {
    const lines = items
      .map(f =>
        `[${f.id}] ${f.name} | ${f.energy_kcal}kcal P:${f.protein_g} C:${f.carbs_g} G:${f.total_fat_g}`
      )
      .join('\n')
    return `## ${cat}\n${lines}`
  }).join('\n\n')
}

// ─── Substituições padrão por categoria ──────────────────────────────────────

const SUBSTITUTION_HINTS: Record<string, string | null> = {
  'Cereais':      'Pode trocar por outra fonte de carboidrato do catálogo',
  'Carnes':       'Pode substituir por outra proteína animal ou ovo',
  'Ovos':         'Pode trocar por queijo cottage ou iogurte grego',
  'Laticínios':   'Versão sem lactose disponível no mercado',
  'Leguminosas':  'Qualquer leguminosa do catálogo',
  'Frutas':       'Fruta da estação de valor calórico similar',
  'Legumes':      'Qualquer legume de preferência da paciente',
  'Oleaginosas':  'Pode substituir por outra castanha ou sementes',
  'Outros':       null,
}

// ─── Expand: converte output lean da IA em plano completo ────────────────────

/**
 * Expande a saída lean da IA em um plano completo com macros calculados.
 * Não faz nenhuma chamada à IA — tudo é computado localmente.
 */
export function expandSelections(
  aiOutput: AILeanOutput,
  foodsById: Record<string, FoodRow>
): ExpandedPlan {
  const flat_items: ExpandedMealItem[] = []
  const expandedDays: ExpandedDay[] = []

  for (const day of aiOutput.days) {
    let globalSortOrder = 0
    const expandedMeals: ExpandedMealGroup[] = []
    let day_total_kcal = 0
    let day_total_protein = 0
    let day_total_carbs = 0
    let day_total_fat = 0

    for (const slot of MEAL_SLOTS) {
      const selections = day.slots[slot.slot_key] || []
      if (selections.length === 0 && slot.optional) continue

      const expandedItems: ExpandedMealItem[] = []

      for (const sel of selections) {
        const food = foodsById[sel.food_id]
        if (!food) {
          // Alimento não encontrado — insere placeholder
          expandedItems.push({
            day_number:         day.day_number,
            meal_type:          slot.meal_type,
            meal_label:         slot.meal_label,
            time:               slot.time,
            sort_order:         globalSortOrder++,
            food_id:            null,
            food_name:          `[ID inválido: ${sel.food_id}]`,
            quantity_g:         sel.quantity_g,
            serving_qty:        null,
            serving_label:      null,
            calc_kcal:          0,
            calc_protein_g:     0,
            calc_carbs_g:       0,
            calc_fat_g:         0,
            calc_fiber_g:       0,
            preparation_notes:  sel.note || null,
            substitution_note:  null,
          })
          continue
        }

        // Calcula macros (valores por 100g × quantidade)
        const ratio = sel.quantity_g / 100
        const calc_kcal      = Math.round(food.energy_kcal * ratio * 10) / 10
        const calc_protein_g = Math.round(food.protein_g   * ratio * 10) / 10
        const calc_carbs_g   = Math.round(food.carbs_g     * ratio * 10) / 10
        const calc_fat_g     = Math.round(food.total_fat_g * ratio * 10) / 10
        const calc_fiber_g   = Math.round(food.fiber_g     * ratio * 10) / 10

        // Serving qty aproximado
        const serving_qty = food.serving_size_g > 0
          ? Math.round((sel.quantity_g / food.serving_size_g) * 10) / 10
          : null

        // Substituição padrão por categoria
        const subHint = SUBSTITUTION_HINTS[food.category] ?? null

        expandedItems.push({
          day_number:         day.day_number,
          meal_type:          slot.meal_type,
          meal_label:         slot.meal_label,
          time:               slot.time,
          sort_order:         globalSortOrder++,
          food_id:            food.id,
          food_name:          food.name,
          quantity_g:         sel.quantity_g,
          serving_qty,
          serving_label:      food.serving_label,
          calc_kcal,
          calc_protein_g,
          calc_carbs_g,
          calc_fat_g,
          calc_fiber_g,
          preparation_notes:  sel.note || null,
          substitution_note:  subHint,
        })

        day_total_kcal    += calc_kcal
        day_total_protein += calc_protein_g
        day_total_carbs   += calc_carbs_g
        day_total_fat     += calc_fat_g
      }

      if (expandedItems.length > 0) {
        expandedMeals.push({
          meal_type:  slot.meal_type,
          meal_label: slot.meal_label,
          time:       slot.time,
          items:      expandedItems,
        })
        flat_items.push(...expandedItems)
      }
    }

    expandedDays.push({
      day_number:        day.day_number,
      day_theme:         day.day_theme || `Dia ${day.day_number}`,
      meals:             expandedMeals,
      day_total_kcal:    Math.round(day_total_kcal),
      day_total_protein: Math.round(day_total_protein * 10) / 10,
      day_total_carbs:   Math.round(day_total_carbs * 10) / 10,
      day_total_fat:     Math.round(day_total_fat * 10) / 10,
    })
  }

  return {
    title:       aiOutput.title,
    description: aiOutput.description,
    days:        expandedDays,
    flat_items,
  }
}
