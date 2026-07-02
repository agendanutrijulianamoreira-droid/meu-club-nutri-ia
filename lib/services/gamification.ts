import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Único ponto de escrita de XP/NutriCoins via RPC increment_user_points.
 * Chamar sempre a partir do server (API routes) — nunca direto do client —
 * para manter logging/erro consistentes num lugar só.
 *
 * Não cobre o trigger update_gamification_after_log (daily_logs), que
 * recalcula XP/coins de forma independente a partir dos campos booleanos do
 * log diário — é um mecanismo intencionalmente separado (idempotente por
 * design, recomputa o total em vez de aplicar delta), ver nota em
 * lib/gamification.ts. Unificá-lo exigiria reescrever esse trigger e mexer
 * no fluxo de "toques rápidos" da Home — fora do escopo desta consolidação.
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  pointsDelta: number,
  context: string
): Promise<{ error: string | null }> {
  if (pointsDelta === 0) return { error: null }

  const { error } = await supabase.rpc('increment_user_points', {
    user_id: userId,
    points_to_add: pointsDelta,
  })

  if (error) {
    console.error(`[gamification] increment_user_points failed (${context})`, error)
    return { error: error.message }
  }
  return { error: null }
}
