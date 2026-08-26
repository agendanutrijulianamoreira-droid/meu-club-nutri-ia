export type DashboardMode = 'today' | 'clinical' | 'management'
export type DashboardWidgetId = 'today' | 'attention' | 'pending' | 'commercial' | 'summary'
export type DashboardShortcutId = 'new_patient' | 'new_appointment' | 'new_meal_plan' | 'new_protocol' | 'attention' | 'crm' | 'communication' | 'settings'

export type DashboardAttentionRules = {
  no_checkin_days: number
  no_next_appointment_days: number
  inactive_days: number
  protocol_ending_days: number
  unanswered_message_hours: number
}

export type DashboardPreferences = {
  layout_mode: DashboardMode
  visible_widgets: DashboardWidgetId[]
  favorite_shortcuts: DashboardShortcutId[]
  attention_rules: DashboardAttentionRules
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

export function normalizeDashboardPreferences(row: Partial<DashboardPreferences> | null | undefined): DashboardPreferences {
  const defaults = DEFAULT_DASHBOARD_PREFERENCES
  return {
    layout_mode: row?.layout_mode || defaults.layout_mode,
    visible_widgets: Array.isArray(row?.visible_widgets) ? row!.visible_widgets as DashboardWidgetId[] : defaults.visible_widgets,
    favorite_shortcuts: Array.isArray(row?.favorite_shortcuts) ? row!.favorite_shortcuts as DashboardShortcutId[] : defaults.favorite_shortcuts,
    attention_rules: { ...defaults.attention_rules, ...(row?.attention_rules || {}) },
  }
}
