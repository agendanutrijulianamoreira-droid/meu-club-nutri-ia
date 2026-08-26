export type DashboardUrgency = 'critical' | 'today' | 'soon' | 'normal'

export function urgencyFromRisk(bucket?: string | null, score?: number | null): DashboardUrgency {
  const value = String(bucket || '').toLowerCase()
  if (value === 'critical' || Number(score || 0) >= 80) return 'critical'
  if (value === 'today' || Number(score || 0) >= 60) return 'today'
  if (value === 'soon' || Number(score || 0) >= 40) return 'soon'
  return 'normal'
}

export function urgencyLabel(level: DashboardUrgency) {
  if (level === 'critical') return 'Crítico'
  if (level === 'today') return 'Hoje'
  if (level === 'soon') return 'Esta semana'
  return 'Acompanhar'
}

export function riskReason(row: any) {
  const reasons: string[] = []
  if (row.checkin_overdue) reasons.push('check-in atrasado')
  if (row.consultation_overdue) reasons.push('retorno atrasado')
  if (row.protocol_ending) reasons.push('protocolo terminando')
  if (Number(row.days_since_activity || 0) > 0) reasons.push(`${row.days_since_activity} dias sem atividade`)
  return row.lifecycle_next_action || reasons.slice(0, 2).join(' · ') || 'revisão clínica recomendada'
}

export function crmPriority(row: any, now = new Date()) {
  if (!row.next_action_at) return { label: 'Ação programada', level: 'normal' as DashboardUrgency }
  const due = new Date(row.next_action_at)
  const diffHours = (due.getTime() - now.getTime()) / 36e5
  if (diffHours < 0) return { label: 'Ação vencida', level: 'critical' as DashboardUrgency }
  if (diffHours <= 24) return { label: 'Hoje', level: 'today' as DashboardUrgency }
  if (diffHours <= 72) return { label: 'Próximas 72h', level: 'soon' as DashboardUrgency }
  return { label: row.recency_segment || 'Programada', level: 'normal' as DashboardUrgency }
}
