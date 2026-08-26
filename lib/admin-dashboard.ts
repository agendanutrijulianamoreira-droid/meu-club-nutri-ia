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

export const DEFAULT_DISPLAY_SETTINGS: DashboardDisplaySettings = {
  widget_order: ['today', 'attention', 'pending', 'commercial', 'summary'],
  widget_sizes: { today:'normal', attention:'normal', pending:'normal', commercial:'normal', summary:'normal' },
  widget_limits: { today:4, attention:5, pending:4, commercial:5, summary:3 },
  hide_financial_values: false,
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  layout_mode: 'today',
  visible_widgets: ['today', 'attention', 'pending', 'commercial', 'summary'],
  favorite_shortcuts: ['new_patient', 'new_appointment', 'new_meal_plan', 'attention'],
  attention_rules: {
    no_checkin_days: 3,
    no_next_appointment_days: 7,
    inactive_days: 21,
    protocol_ending_days: 3,
    unanswered_message_hours: 24,
  },
  display_settings: DEFAULT_DISPLAY_SETTINGS,
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

export function normalizeDashboardPreferences(row: Partial<DashboardPreferences> | null | undefined): DashboardPreferences {
  const defaults = DEFAULT_DASHBOARD_PREFERENCES
  const rawDisplay=(row as any)?.display_settings || {}
  return {
    layout_mode: row?.layout_mode || defaults.layout_mode,
    visible_widgets: Array.isArray(row?.visible_widgets) ? row!.visible_widgets as DashboardWidgetId[] : defaults.visible_widgets,
    favorite_shortcuts: Array.isArray(row?.favorite_shortcuts) ? row!.favorite_shortcuts as DashboardShortcutId[] : defaults.favorite_shortcuts,
    attention_rules: { ...defaults.attention_rules, ...(row?.attention_rules || {}) },
    display_settings: {
      widget_order: Array.isArray(rawDisplay.widget_order) ? rawDisplay.widget_order : defaults.display_settings.widget_order,
      widget_sizes: { ...defaults.display_settings.widget_sizes, ...(rawDisplay.widget_sizes || {}) },
      widget_limits: { ...defaults.display_settings.widget_limits, ...(rawDisplay.widget_limits || {}) },
      hide_financial_values: Boolean(rawDisplay.hide_financial_values),
    },
  }
}
