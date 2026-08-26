export type DashboardMode = 'today' | 'clinical' | 'management'
export type DashboardWidgetId = 'today' | 'attention' | 'pending' | 'commercial' | 'summary'
export type DashboardShortcutId = 'new_patient' | 'new_appointment' | 'new_meal_plan' | 'new_protocol' | 'attention' | 'crm' | 'communication' | 'settings'
export type DashboardWidgetSize = 'compact' | 'normal'

export type DashboardAttentionRules = {
  no_checkin_days: number
  no_next_appointment_days: number
  inactive_days: number
  protocol_ending_days: number
  unanswered_message_hours: number
}

export type DashboardDisplaySettings = {
  widget_order: DashboardWidgetId[]
  widget_sizes: Record<DashboardWidgetId, DashboardWidgetSize>
  widget_limits: Record<DashboardWidgetId, number>
  hide_financial_values: boolean
}

export type DashboardPreferences = {
  layout_mode: DashboardMode
  visible_widgets: DashboardWidgetId[]
  favorite_shortcuts: DashboardShortcutId[]
  attention_rules: DashboardAttentionRules
  display_settings: DashboardDisplaySettings
}

const WIDGET_IDS: DashboardWidgetId[] = ['today', 'attention', 'pending', 'commercial', 'summary']
const SHORTCUT_IDS: DashboardShortcutId[] = ['new_patient', 'new_appointment', 'new_meal_plan', 'new_protocol', 'attention', 'crm', 'communication', 'settings']
const MODES: DashboardMode[] = ['today', 'clinical', 'management']

export const DEFAULT_DISPLAY_SETTINGS: DashboardDisplaySettings = {
  widget_order: [...WIDGET_IDS],
  widget_sizes: { today:'normal', attention:'normal', pending:'normal', commercial:'normal', summary:'normal' },
  widget_limits: { today:4, attention:5, pending:4, commercial:5, summary:3 },
  hide_financial_values: false,
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  layout_mode: 'today',
  visible_widgets: [...WIDGET_IDS],
  favorite_shortcuts: ['new_patient', 'new_appointment', 'new_meal_plan', 'attention'],
  attention_rules: {
    no_checkin_days: 3,
    no_next_appointment_days: 7,
    inactive_days: 21,
    protocol_ending_days: 3,
    unanswered_message_hours: 24,
  },
  display_settings: {
    widget_order: [...DEFAULT_DISPLAY_SETTINGS.widget_order],
    widget_sizes: { ...DEFAULT_DISPLAY_SETTINGS.widget_sizes },
    widget_limits: { ...DEFAULT_DISPLAY_SETTINGS.widget_limits },
    hide_financial_values: false,
  },
}

export const DASHBOARD_WIDGETS: Array<{ id: DashboardWidgetId; label: string; description: string }> = [
  { id: 'today', label: 'Meu dia', description: 'Próximas consultas e compromissos de hoje.' },
  { id: 'attention', label: 'Precisa de mim', description: 'Pacientes priorizadas pelo motor de acompanhamento.' },
  { id: 'pending', label: 'Pendências', description: 'Aprovações, falhas de comunicação e tarefas abertas.' },
  { id: 'commercial', label: 'Comercial', description: 'Contatos com próxima ação e oportunidades no CRM.' },
  { id: 'summary', label: 'Resumo da clínica', description: 'Indicadores essenciais, sem poluir a Home.' },
]

export const DASHBOARD_SHORTCUTS: Array<{ id: DashboardShortcutId; label: string; description: string }> = [
  { id: 'new_patient', label: 'Nova paciente', description: 'Abrir cadastro de paciente.' },
  { id: 'new_appointment', label: 'Nova consulta', description: 'Abrir agenda para agendamento.' },
  { id: 'new_meal_plan', label: 'Criar dieta', description: 'Ir para dietas e cardápios.' },
  { id: 'new_protocol', label: 'Criar protocolo', description: 'Ir para protocolos e desafios.' },
  { id: 'attention', label: 'Quem precisa de mim', description: 'Abrir fila de atenção clínica.' },
  { id: 'crm', label: 'Abrir CRM', description: 'Ir para contatos e resgate.' },
  { id: 'communication', label: 'Comunicação', description: 'Abrir central de comunicação.' },
  { id: 'settings', label: 'Configurar painel', description: 'Editar esta Home.' },
]

export const DASHBOARD_PRESETS: Record<DashboardMode, Pick<DashboardPreferences,'visible_widgets'|'favorite_shortcuts'|'display_settings'>> = {
  today: {
    visible_widgets:['today','attention','pending','commercial','summary'],
    favorite_shortcuts:['new_patient','new_appointment','attention','communication'],
    display_settings:{...DEFAULT_DISPLAY_SETTINGS,widget_order:['today','attention','pending','commercial','summary'],widget_sizes:{...DEFAULT_DISPLAY_SETTINGS.widget_sizes,today:'normal',summary:'compact'},widget_limits:{...DEFAULT_DISPLAY_SETTINGS.widget_limits,today:4,attention:4,pending:4,commercial:3}},
  },
  clinical: {
    visible_widgets:['today','attention','pending','summary'],
    favorite_shortcuts:['new_patient','new_meal_plan','new_protocol','attention'],
    display_settings:{...DEFAULT_DISPLAY_SETTINGS,widget_order:['attention','today','pending','summary','commercial'],widget_sizes:{...DEFAULT_DISPLAY_SETTINGS.widget_sizes,attention:'normal',summary:'compact'},widget_limits:{...DEFAULT_DISPLAY_SETTINGS.widget_limits,attention:6,pending:5}},
  },
  management: {
    visible_widgets:['commercial','pending','today','summary'],
    favorite_shortcuts:['crm','new_appointment','communication','settings'],
    display_settings:{...DEFAULT_DISPLAY_SETTINGS,widget_order:['commercial','pending','today','summary','attention'],widget_sizes:{...DEFAULT_DISPLAY_SETTINGS.widget_sizes,commercial:'normal',summary:'normal'},widget_limits:{...DEFAULT_DISPLAY_SETTINGS.widget_limits,commercial:6,pending:5}},
  },
}

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

const cleanUnique = <T extends string>(value: unknown, allowed: readonly T[], fallback: readonly T[]) => {
  if (!Array.isArray(value)) return [...fallback]
  const set = new Set<T>()
  for (const item of value) if (allowed.includes(item as T)) set.add(item as T)
  return set.size ? [...set] : [...fallback]
}

export function normalizeDashboardPreferences(row: Partial<DashboardPreferences> | null | undefined): DashboardPreferences {
  const defaults = DEFAULT_DASHBOARD_PREFERENCES
  const rawDisplay = (row as any)?.display_settings || {}
  const visibleWidgets = cleanUnique(row?.visible_widgets, WIDGET_IDS, defaults.visible_widgets)
  const favoriteShortcuts = cleanUnique(row?.favorite_shortcuts, SHORTCUT_IDS, defaults.favorite_shortcuts).slice(0, 6)
  const requestedOrder = cleanUnique(rawDisplay.widget_order, WIDGET_IDS, defaults.display_settings.widget_order)
  const widgetOrder = [...requestedOrder, ...WIDGET_IDS.filter(id => !requestedOrder.includes(id))]
  const rawSizes = rawDisplay.widget_sizes || {}
  const rawLimits = rawDisplay.widget_limits || {}

  const widgetSizes = { ...defaults.display_settings.widget_sizes }
  const widgetLimits = { ...defaults.display_settings.widget_limits }
  for (const id of WIDGET_IDS) {
    widgetSizes[id] = rawSizes[id] === 'compact' ? 'compact' : 'normal'
    widgetLimits[id] = clampInt(rawLimits[id], defaults.display_settings.widget_limits[id], 1, 8)
  }

  const rawRules = (row as any)?.attention_rules || {}
  const attentionRules: DashboardAttentionRules = {
    no_checkin_days: clampInt(rawRules.no_checkin_days, defaults.attention_rules.no_checkin_days, 1, 90),
    no_next_appointment_days: clampInt(rawRules.no_next_appointment_days, defaults.attention_rules.no_next_appointment_days, 1, 180),
    inactive_days: clampInt(rawRules.inactive_days, defaults.attention_rules.inactive_days, 1, 365),
    protocol_ending_days: clampInt(rawRules.protocol_ending_days, defaults.attention_rules.protocol_ending_days, 1, 90),
    unanswered_message_hours: clampInt(rawRules.unanswered_message_hours, defaults.attention_rules.unanswered_message_hours, 1, 336),
  }

  return {
    layout_mode: MODES.includes(row?.layout_mode as DashboardMode) ? row!.layout_mode as DashboardMode : defaults.layout_mode,
    visible_widgets: visibleWidgets,
    favorite_shortcuts: favoriteShortcuts,
    attention_rules: attentionRules,
    display_settings: {
      widget_order: widgetOrder,
      widget_sizes: widgetSizes,
      widget_limits: widgetLimits,
      hide_financial_values: rawDisplay.hide_financial_values === true,
    },
  }
}
