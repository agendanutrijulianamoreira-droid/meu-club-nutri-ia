// ─── XP rewards por ação ─────────────────────────────────────────────────────
export const XP_REWARDS = {
  daily_checkin:      30,
  hydration_goal:     10,
  exercise_logged:    20,
  weekly_checkin:     20,
  challenge_complete: 100,
} as const

export type XpAction = keyof typeof XP_REWARDS

// ─── Nível a partir do XP total ──────────────────────────────────────────────
// Série: L1=0, L2=500, L3=1500, L4=3000… min_xp(N) = 250 * N * (N-1)
export function levelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1
  let level = 1
  while (250 * (level + 1) * level <= totalXp) level++
  return level
}

// XP mínimo para entrar num nível
export function minXpForLevel(level: number): number {
  if (level <= 1) return 0
  return 250 * level * (level - 1)
}

// Progresso dentro do nível atual (0–1)
export function xpProgressInLevel(totalXp: number): number {
  const level = levelFromXp(totalXp)
  const current = minXpForLevel(level)
  const next    = minXpForLevel(level + 1)
  return (totalXp - current) / (next - current)
}

// XP restante para subir de nível
export function xpToNextLevel(totalXp: number): number {
  const level = levelFromXp(totalXp)
  return minXpForLevel(level + 1) - totalXp
}

// ─── Bônus de streak ─────────────────────────────────────────────────────────
export function streakBonus(streak: number): number {
  if (streak >= 100) return 300
  if (streak >= 60)  return 200
  if (streak >= 30)  return 150
  if (streak >= 21)  return 100
  if (streak >= 14)  return 75
  if (streak >= 7)   return 50
  return 0
}

// ─── Risco de check-in (fallback sem IA) ─────────────────────────────────────
export function checkinRiskLevel(dietScore: number): 'low' | 'medium' | 'high' {
  if (dietScore <= 4) return 'high'
  if (dietScore <= 6) return 'medium'
  return 'low'
}
