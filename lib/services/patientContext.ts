import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Contexto rico de uma paciente (perfil, engajamento, check-ins recentes, protocolo ativo),
 * usado tanto pelo Resumo IA (/api/admin/patients/[id]/insight) quanto pelo Chat IA
 * (/api/admin/patients/[id]/chat) — para a nutricionista não precisar reexplicar quem é a
 * paciente a cada chamada de IA.
 */
export interface PatientContext {
  profile: {
    name: string
  }
  /** Bloco de texto pronto para entrar num prompt de IA. */
  contextText: string
}

export async function buildPatientContext(
  supabase: SupabaseClient,
  patientId: string,
  tenantId: string
): Promise<PatientContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      name, email, current_plan, current_streak, longest_streak,
      total_xp, nutri_coins, current_level, last_checkin_date,
      created_at, primary_goal, current_weight, initial_weight,
      dietary_restrictions, onboarding_completed, tenant_id
    `)
    .eq('user_id', patientId)
    .single()

  if (!profile || profile.tenant_id !== tenantId) return null

  const { data: checkins } = await supabase
    .from('weekly_checkin_responses')
    .select('diet_score, mood, had_binge, main_difficulty, extra_notes, ai_summary, created_at')
    .eq('user_id', patientId)
    .order('created_at', { ascending: false })
    .limit(3)

  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('log_date, meal_plan_check, water_check, workout_check')
    .eq('user_id', patientId)
    .gte('log_date', twoWeeksAgo.toISOString().split('T')[0])

  const { data: assignment } = await supabase
    .from('protocol_assignments')
    .select('start_date, protocols(title, description)')
    .eq('user_id', patientId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const daysSinceJoin = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
  const adherenceCount = (logs || []).filter(l => l.meal_plan_check || l.water_check || l.workout_check).length
  const adherenceRate = logs && logs.length > 0 ? Math.round((adherenceCount / 14) * 100) : 0
  const protocol = assignment?.protocols as unknown as { title: string; description: string } | null

  const latestCheckin = checkins?.[0]
  const checkinTrend = checkins && checkins.length > 1
    ? `Tendência: score ${checkins.map(c => c.diet_score).reverse().join(' → ')}`
    : ''

  const contextText = `
DADOS DA PACIENTE:
- Nome: ${profile.name}
- Objetivo: ${profile.primary_goal || 'Não informado'}
- No clube há: ${daysSinceJoin} dias
- Plano: ${profile.current_plan}
- Onboarding completo: ${profile.onboarding_completed ? 'Sim' : 'Não'}
- Peso inicial: ${profile.initial_weight ? profile.initial_weight + 'kg' : 'N/A'}
- Peso atual: ${profile.current_weight ? profile.current_weight + 'kg' : 'N/A'}
- Restrições: ${(profile.dietary_restrictions || []).join(', ') || 'Nenhuma'}
- Protocolo ativo: ${protocol ? protocol.title : 'Nenhum'}

ENGAJAMENTO:
- XP total: ${profile.total_xp}
- Nível: ${profile.current_level}
- Streak atual: ${profile.current_streak} dias
- Maior streak: ${profile.longest_streak} dias
- Adesão últimas 2 semanas: ${adherenceRate}%
- NutriCoins: ${profile.nutri_coins}
- Último check-in: ${profile.last_checkin_date || 'Nunca'}

CHECK-INS RECENTES:
${latestCheckin ? `
- Score dieta: ${latestCheckin.diet_score}/10
- Humor: ${latestCheckin.mood || 'N/A'}
- Teve compulsão: ${latestCheckin.had_binge ? 'Sim' : 'Não'}
- Dificuldade principal: ${latestCheckin.main_difficulty || 'N/A'}
- Notas: ${latestCheckin.extra_notes || 'N/A'}
- Análise IA anterior: ${latestCheckin.ai_summary || 'N/A'}
${checkinTrend}
` : 'Nenhum check-in registrado'}
`.trim()

  return {
    profile: { name: profile.name },
    contextText,
  }
}
