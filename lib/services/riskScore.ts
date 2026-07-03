/**
 * Fonte única do cálculo heurístico de risco de evasão da paciente.
 * Antes desta unificação, o mesmo algoritmo estava copiado independentemente em
 * admin/patients, admin/segment-preview e admin/analytics (RISK BREAKDOWN), com
 * pequenas divergências entre as cópias — ver auditoria de sistema de Jul/2026.
 *
 * Isto NÃO substitui o risk score "oficial" gerado por IA pelo agente Sabotage
 * (gravado em patient_risk_scores) — é a heurística leve usada nas telas de admin
 * para listar/filtrar pacientes sem precisar de uma chamada LLM.
 */

export interface RiskInput {
  daysSinceActivity: number
  currentStreak: number | null | undefined
  adherenceRate: number
  dietScore?: number | null
  aiRiskLevel?: 'low' | 'medium' | 'high' | null
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskResult {
  riskScore: number
  riskLevel: RiskLevel
}

export function calculateRiskScore(input: RiskInput): RiskResult {
  const { daysSinceActivity, currentStreak, adherenceRate, dietScore, aiRiskLevel } = input

  let riskScore = 10
  if (daysSinceActivity > 7) riskScore -= 4
  else if (daysSinceActivity > 3) riskScore -= 2

  if (!currentStreak || currentStreak === 0) riskScore -= 3
  else if (currentStreak < 3) riskScore -= 1

  if (adherenceRate < 30) riskScore -= 2
  else if (adherenceRate < 60) riskScore -= 1

  if (dietScore !== undefined && dietScore !== null && dietScore < 5) riskScore -= 2

  if (aiRiskLevel === 'high') riskScore = Math.min(riskScore, 3)
  if (aiRiskLevel === 'medium') riskScore = Math.min(riskScore, 6)

  riskScore = Math.max(0, Math.min(10, riskScore))
  const riskLevel: RiskLevel = riskScore <= 4 ? 'high' : riskScore <= 6 ? 'medium' : 'low'

  return { riskScore, riskLevel }
}

export function daysSinceDate(dateStr: string | null | undefined, now: Date = new Date()): number {
  if (!dateStr) return 999
  return Math.floor((now.getTime() - new Date(dateStr).getTime()) / 86400000)
}

export function adherenceFromLogs(logs: { meal_plan_check?: boolean | null }[], windowDays = 7): number {
  if (logs.length === 0) return 0
  return Math.round((logs.filter(l => l.meal_plan_check).length / windowDays) * 100)
}
