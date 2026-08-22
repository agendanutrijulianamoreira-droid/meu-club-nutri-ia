import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { createSupabaseServerClient } from "@/lib/supabase-server"

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

function calendarDaysBetween(later: string, earlier: string) {
  return Math.max(0, Math.floor((parseDate(later).getTime() - parseDate(earlier).getTime()) / 86400000))
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requestedDate = new URL(request.url).searchParams.get("date")
  const today = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "")
    ? requestedDate!
    : new Date().toISOString().slice(0, 10)
  const historyStart = daysAgo(today, 13)
  const weekStart = daysAgo(today, 6)
  const nowIso = new Date().toISOString()

  const [
    profileResult,
    inboxResult,
    logsResult,
    checkinsResult,
    assignmentResult,
    phaseAssignmentResult,
    appointmentResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, tenant_id, current_plan, created_at, plan_started_at, plan_expires_at, nutri_coins, total_xp, current_streak")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("inbox_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "unread"),
    supabase
      .from("daily_logs")
      .select("log_date, water_check, water_ml, meal_plan_check, workout_check, daily_victory")
      .eq("user_id", user.id)
      .gte("log_date", historyStart)
      .lte("log_date", today)
      .order("log_date", { ascending: true }),
    supabase
      .from("checkin_diario")
      .select("data, nivel_energia, nivel_inchaco, nivel_compulsao, qualidade_sono, nivel_ansiedade, dor_abdominal, retencao_liquido, humor")
      .eq("paciente_id", user.id)
      .gte("data", historyStart)
      .lte("data", today)
      .order("data", { ascending: true }),
    supabase
      .from("protocol_assignments")
      .select("id, start_date, created_at, protocol:protocols(id, title, duration_days)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fase_paciente")
      .select("method_phase_id, inicio")
      .eq("paciente_id", user.id)
      .is("fim", null)
      .not("method_phase_id", "is", null)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("scheduled_at, is_virtual, meeting_link, appointment_type")
      .eq("patient_id", user.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(1),
  ])

  const assignment: any = assignmentResult.data
  let protocolData: any = null
  let progressHistory: any[] = []

  if (assignment?.id && assignment?.protocol) {
    const currentDay = Math.max(1, calendarDaysBetween(today, assignment.start_date) + 1)
    const [protocolDayResult, progressHistoryResult] = await Promise.all([
      supabase
        .from("protocol_days")
        .select("id, day_number, title")
        .eq("protocol_id", assignment.protocol.id)
        .eq("day_number", currentDay)
        .maybeSingle(),
      supabase
        .from("protocol_progress")
        .select("protocol_item_id, completed_at, checkin_date")
        .eq("assignment_id", assignment.id)
        .gte("checkin_date", historyStart)
        .lte("checkin_date", today),
    ])

    progressHistory = progressHistoryResult.data || []
    let items: any[] = []
    if (protocolDayResult.data?.id) {
      const { data } = await supabase
        .from("protocol_items")
        .select("*")
        .eq("protocol_day_id", protocolDayResult.data.id)
        .order("time", { ascending: true })
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
    const { data: phase } = await supabase
      .from("method_phases")
      .select("name, description, sort_order, method_id")
      .eq("id", phaseAssignment.method_phase_id)
      .maybeSingle()

    if (phase) {
      let methodName: string | null = null
      if (phase.method_id) {
        const { data: method } = await supabase
          .from("methods")
          .select("name")
          .eq("id", phase.method_id)
          .maybeSingle()
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
    today,
    weekStart,
    historyStart,
    profile: profileResult.data || null,
    unreadCount: inboxResult.count || 0,
    dailyLogs: logsResult.data || [],
    checkins: checkinsResult.data || [],
    protocol: protocolData,
    progressHistory,
    clinicalJourney,
    nextAppointment: appointmentResult.data?.[0] || null,
  })
}
