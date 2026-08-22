import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { calcularAdesao } from "@/lib/utils/calcularAdesao"

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysAgo(value: string, days: number) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() - days)
  return dateString(date)
}

function startOfWeekMonday(value: string) {
  const date = parseDate(value)
  const day = date.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  date.setUTCDate(date.getUTCDate() - diff)
  return dateString(date)
}

function calendarDaysBetween(later: string, earlier: string) {
  return Math.max(0, Math.floor((parseDate(later).getTime() - parseDate(earlier).getTime()) / 86400000))
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const role = String(adminProfile?.role || user.user_metadata?.user_type || user.user_metadata?.role || "").toLowerCase()
  if (!adminProfile?.tenant_id || !["admin", "nutritionist", "nutri"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: "Preview indisponível: service role ausente" }, { status: 503 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const url = new URL(request.url)
  const patientId = url.searchParams.get("patient_id")

  if (!patientId) {
    const { data: rows, error } = await admin
      .from("profiles")
      .select("user_id, name, role, created_at")
      .eq("tenant_id", adminProfile.tenant_id)
      .order("name", { ascending: true })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const patients = (rows || []).filter(row => !["admin", "nutritionist", "nutri"].includes(String(row.role || "").toLowerCase()))
    return NextResponse.json({ patients })
  }

  const requestedDate = url.searchParams.get("date")
  const today = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "")
    ? requestedDate!
    : new Date().toISOString().slice(0, 10)
  const historyStart = daysAgo(today, 13)
  const weekStart = daysAgo(today, 6)
  const weeklyCheckinStart = startOfWeekMonday(today)
  const nowIso = new Date().toISOString()

  const { data: patient, error: patientError } = await admin
    .from("profiles")
    .select("user_id, name, tenant_id, current_plan, created_at, plan_started_at, plan_expires_at, nutri_coins, total_xp, current_streak")
    .eq("user_id", patientId)
    .eq("tenant_id", adminProfile.tenant_id)
    .maybeSingle()

  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 })
  if (!patient) return NextResponse.json({ error: "Paciente não encontrada neste tenant" }, { status: 404 })

  const [
    inboxResult,
    logsResult,
    checkinsResult,
    assignmentResult,
    phaseAssignmentResult,
    appointmentResult,
    weeklyCheckinResult,
    dietMetaResult,
    dietEntriesResult,
  ] = await Promise.all([
    admin.from("inbox_messages").select("*", { count: "exact", head: true }).eq("user_id", patientId).eq("status", "unread"),
    admin.from("daily_logs").select("log_date, water_check, water_ml, meal_plan_check, workout_check, daily_victory").eq("user_id", patientId).gte("log_date", historyStart).lte("log_date", today).order("log_date", { ascending: true }),
    admin.from("checkin_diario").select("data, nivel_energia, nivel_inchaco, nivel_compulsao, qualidade_sono, nivel_ansiedade, dor_abdominal, retencao_liquido, humor").eq("paciente_id", patientId).gte("data", historyStart).lte("data", today).order("data", { ascending: true }),
    admin.from("protocol_assignments").select("id, start_date, created_at, protocol:protocols(id, title, duration_days)").eq("user_id", patientId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("fase_paciente").select("method_phase_id, inicio").eq("paciente_id", patientId).is("fim", null).not("method_phase_id", "is", null).order("inicio", { ascending: false }).limit(1).maybeSingle(),
    admin.from("appointments").select("scheduled_at, is_virtual, meeting_link, appointment_type").eq("patient_id", patientId).in("status", ["scheduled", "confirmed"]).gte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }).limit(1),
    admin.from("weekly_checkin_responses").select("id").eq("user_id", patientId).eq("week_start", weeklyCheckinStart).maybeSingle(),
    admin.from("metas_paciente").select("calorias_meta, proteina_meta_g, carboidrato_meta_g, lipideos_meta_g, fibra_meta_g").eq("paciente_id", patientId).lte("valida_de", today).or(`valida_ate.is.null,valida_ate.gte.${today}`).order("valida_de", { ascending: false }).limit(1).maybeSingle(),
    admin.from("diario_alimentar").select("calorias_calculadas, proteina_calculada, carboidrato_calculado, lipideos_calculado, fibra_calculada").eq("paciente_id", patientId).eq("data", today),
  ])

  const logs = logsResult.data || []
  const checkins = checkinsResult.data || []
  const todayLog = logs.find(row => row.log_date === today) || null

  const dietMeta = dietMetaResult.data ?? {
    calorias_meta: 1800,
    proteina_meta_g: 100,
    carboidrato_meta_g: 200,
    lipideos_meta_g: 60,
    fibra_meta_g: 25,
  }
  const dietSummary = calcularAdesao(dietEntriesResult.data || [], dietMeta)

  const [activeQuestionnairesResult, answeredQuestionnairesResult, rewardsResult] = await Promise.all([
    admin.from("questionnaires").select("id, name").eq("tenant_id", patient.tenant_id).eq("is_active", true),
    admin.from("questionnaire_responses").select("questionnaire_id").eq("patient_id", patientId),
    admin.from("reward_items").select("name, cost, emoji").gt("cost", patient.nutri_coins || 0).eq("is_active", true).order("cost", { ascending: true }).limit(1),
  ])

  const answeredIds = new Set((answeredQuestionnairesResult.data || []).map(row => row.questionnaire_id))
  const pendingQuestionnaires = (activeQuestionnairesResult.data || []).filter(row => !answeredIds.has(row.id))
  const nextReward = rewardsResult.data?.[0] || null

  const assignment: any = assignmentResult.data
  let protocolData: any = null
  let progressHistory: any[] = []

  if (assignment?.id && assignment?.protocol) {
    const currentDay = Math.max(1, calendarDaysBetween(today, assignment.start_date) + 1)
    const [protocolDayResult, progressHistoryResult] = await Promise.all([
      admin.from("protocol_days").select("id, day_number, title").eq("protocol_id", assignment.protocol.id).eq("day_number", currentDay).maybeSingle(),
      admin.from("protocol_progress").select("protocol_item_id, completed_at, checkin_date").eq("assignment_id", assignment.id).gte("checkin_date", historyStart).lte("checkin_date", today),
    ])

    progressHistory = progressHistoryResult.data || []
    let items: any[] = []
    if (protocolDayResult.data?.id) {
      const { data } = await admin.from("protocol_items").select("*").eq("protocol_day_id", protocolDayResult.data.id).order("time", { ascending: true })
      items = data || []
    }

    const todayProgress = progressHistory.filter(row => row.checkin_date === today)
    const progress = Object.fromEntries(todayProgress.map(row => [row.protocol_item_id, true]))
    const completionRate = items.length ? Math.round((todayProgress.length / items.length) * 100) : 0

    protocolData = {
      assignmentId: assignment.id,
      startDate: assignment.start_date,
      protocol: assignment.protocol,
      currentDay,
      items,
      progress,
      completionRate,
    }
  }

  let clinicalJourney: any = null
  const phaseAssignment = phaseAssignmentResult.data
  if (phaseAssignment?.method_phase_id && phaseAssignment.inicio) {
    const { data: phase } = await admin.from("method_phases").select("name, description, sort_order, method_id").eq("id", phaseAssignment.method_phase_id).maybeSingle()

    if (phase) {
      let methodName: string | null = null
      if (phase.method_id) {
        const { data: method } = await admin.from("methods").select("name").eq("id", phase.method_id).maybeSingle()
        methodName = method?.name || null
      }

      clinicalJourney = {
        phaseName: phase.name,
        phaseDescription: phase.description || null,
        phaseNumber: (phase.sort_order ?? 0) + 1,
        methodName,
        startedAt: phaseAssignment.inicio,
        weekNumber: Math.floor(calendarDaysBetween(today, phaseAssignment.inicio) / 7) + 1,
      }
    }
  }

  return NextResponse.json({
    payload: {
      userId: patient.user_id,
      today,
      weekStart,
      historyStart,
      profile: patient,
      unreadCount: inboxResult.count || 0,
      dailyLogs: logs,
      todayLog,
      checkins,
      dailyCheckinSubmitted: checkins.some(row => row.data === today),
      weeklyCheckinSubmitted: !!weeklyCheckinResult.data,
      pendingQuestionnaires,
      dietToday: {
        consumidas: dietSummary.calorias_consumidas,
        meta: dietSummary.calorias_meta,
      },
      nextReward,
      protocol: protocolData,
      progressHistory,
      clinicalJourney,
      nextAppointment: appointmentResult.data?.[0] || null,
    },
  })
}
