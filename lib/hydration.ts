const MIN_GOAL_ML = 1500
const MAX_GOAL_ML = 4000
const ML_PER_KG = 35

export function goalForWeight(weightKg: number | null): number {
  if (!weightKg) return 2000
  return Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, Math.round(weightKg * ML_PER_KG)))
}
