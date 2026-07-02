// Única fonte de verdade para XP/nível/coins no cliente.
// Espelha exatamente a lógica gravada no banco — qualquer mudança aqui deve
// ser acompanhada da mudança equivalente nestas funções SQL:
//   - calculate_level(xp)                    → supabase/schema_core.sql
//   - update_gamification_after_log()        → supabase/schema_core.sql
//   - increment_user_points(user_id, points) → supabase/schema_extended.sql

export const XP_PER_LEVEL = 500

// XP creditado por cada campo de daily_logs marcado (update_gamification_after_log)
export const DAILY_LOG_XP = {
  water_check: 10,
  workout_check: 20,
  sleep_check: 10,
  meal_plan_check: 30,
  daily_victory: 10,
  proof_photo: 10,
} as const

export const WEEKLY_CHECKIN_XP = 20
export const HABIT_HIT_XP = { simple: 10, gallery: 15, camera: 20 } as const

// level = FLOOR(xp / 500) + 1 — idêntico a calculate_level() no Postgres
export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.max(0, totalXp) / XP_PER_LEVEL) + 1
}

// XP mínimo para entrar num nível (gap constante de 500 XP por nível)
export function minXpForLevel(level: number): number {
  return Math.max(0, level - 1) * XP_PER_LEVEL
}

// Progresso dentro do nível atual (0–1)
export function xpProgressInLevel(totalXp: number): number {
  const xp = Math.max(0, totalXp)
  return (xp % XP_PER_LEVEL) / XP_PER_LEVEL
}

// XP restante para subir de nível
export function xpToNextLevel(totalXp: number): number {
  const xp = Math.max(0, totalXp)
  const remainder = xp % XP_PER_LEVEL
  return XP_PER_LEVEL - remainder
}

// ─── Risco de check-in (fallback sem IA) ─────────────────────────────────────
export function checkinRiskLevel(dietScore: number): 'low' | 'medium' | 'high' {
  if (dietScore <= 4) return 'high'
  if (dietScore <= 6) return 'medium'
  return 'low'
}
