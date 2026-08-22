import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase-server"

function localWeekNumber(startDate?: string | null) {
  if (!startDate) return 1
  const [year, month, day] = startDate.split("-").map(Number)
  if (!year || !month || !day) return 1
  const start = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000 / 7) + 1)
}

function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
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
  const patientId = new URL(request.url).searchParams.get("patient_id")

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

  const { data: patient, error: patientError } = await admin
    .from("profiles")
    .select("user_id, name, tenant_id")
    .eq("user_id", patientId)
    .eq("tenant_id", adminProfile.tenant_id)
    .maybeSingle()

  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 })
  if (!patient) return NextResponse.json({ error: "Paciente não encontrada neste tenant" }, { status: 404 })

  const today = todayString()
  const sevenDaysAgoDate = new Date()
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6)
  const sevenDaysAgo = `${sevenDaysAgoDate.getFullYear()}-${String(sevenDaysAgoDate.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgoDate.getDate()).padStart(2, "0")}`

  const [assignmentResult, phaseAssignmentResult, logsResult, checkinsResult, appointmentResult, inboxResult] = await Promise.all([
    admin.from("protocol_assignments").select("id, start_date, protocol:protocols(id, title, duration_days)").eq("user_id", patientId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("fase_paciente").select("method_phase_id, inicio").eq("paciente_id", patientId).is("fim", null).not("method_phase_id", "is", null).order("inicio", { ascending: false }).limit(1).maybeSingle(),
    admin.from("daily_logs").select("log_date, water_check, water_ml, meal_plan_check, workout_check, daily_victory").eq("user_id", patientId).gte("log_date", sevenDaysAgo),
    admin.from("checkin_diario").select("data").eq("paciente_id", patientId).gte("data", sevenDaysAgo),
    admin.from("appointments").select("scheduled_at").eq("patient_id", patientId).in("status", ["scheduled", "confirmed"]).gte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(1).maybeSingle(),
    admin.from("inbox_messages").select("id", { count: "exact", head: true }).eq("user_id", patientId).eq("status", "unread"),
  ])

  let phaseName: string | null = null
  let phaseDescription: string | null = null
  let phaseNumber: number | null = null
  let methodName: string | null = null
  if (phaseAssignmentResult.data?.method_phase_id) {
    const { data: phase } = await admin.from("method_phases").select("name, description, sort_order, method_id").eq("id", phaseAssignmentResult.data.method_phase_id).maybeSingle()
    if (phase) {
      phaseName = phase.name
      phaseDescription = phase.description || null
      phaseNumber = (phase.sort_order ?? 0) + 1
      if (phase.method_id) {
        const { data: method } = await admin.from("methods").select("name").eq("id", phase.method_id).maybeSingle()
        methodName = method?.name || null
      }
    }
  }

  const assignment: any = assignmentResult.data
  const protocol = assignment?.protocol
  let currentDay = 1
  let tasks: Array<{ id: string; title: string; description?: string | null; done?: boolean }> = []
  let missionsCompleted = 0

  if (assignment?.id && protocol?.id && assignment.start_date) {
    const start = new Date(`${assignment.start_date}T12:00:00`)
    const now = new Date(`${today}T12:00:00`)
    currentDay = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1)

    const [{ data: day }, progressResult] = await Promise.all([
      admin.from("protocol_days").select("id").eq("protocol_id", protocol.id).eq("day_number", currentDay).maybeSingle(),
      admin.from("protocol_progress").select("protocol_item_id, checkin_date").eq("assignment_id", assignment.id).gte("checkin_date", sevenDaysAgo),
    ])

    const progressRows = progressResult.data || []
    missionsCompleted = progressRows.length
    if (day?.id) {
      const { data: items } = await admin.from("protocol_items").select("id, title, description").eq("protocol_day_id", day.id).order("time", { ascending: true })
      const doneToday = new Set(progressRows.filter(row => row.checkin_date === today).map(row => row.protocol_item_id))
      tasks = (items || []).map(item => ({ ...item, done: doneToday.has(item.id) }))
    }
  }

  const activeDates = new Set<string>()
  for (const log of logsResult.data || []) {
    if (log.water_check || (log.water_ml || 0) > 0 || log.meal_plan_check || log.workout_check || log.daily_victory) activeDates.add(log.log_date)
  }
  for (const checkin of checkinsResult.data || []) if (checkin.data) activeDates.add(checkin.data)

  const completedToday = tasks.filter(task => task.done).length
  const totalToday = tasks.length
  const hydrationDays = (logsResult.data || []).filter(log => !!log.water_check).length

  return NextResponse.json({
    model: {
      id: patient.user_id,
      firstName: patient.name?.split(" ")[0] || "Paciente",
      fullName: patient.name || null,
      methodName,
      phaseName,
      phaseNumber,
      weekNumber: localWeekNumber(phaseAssignmentResult.data?.inicio),
      phaseDescription,
      protocolTitle: protocol?.title || null,
      currentDay,
      totalDays: protocol?.duration_days || 21,
      completedToday,
      totalToday,
      completionRate: totalToday ? Math.round((completedToday / totalToday) * 100) : 0,
      dailyCheckinPending: !(checkinsResult.data || []).some(row => row.data === today),
      activeDays: activeDates.size,
      hydrationDays,
      missionsCompleted,
      unreadCount: inboxResult.count || 0,
      nextAppointment: appointmentResult.data?.scheduled_at || null,
      rescueActive: false,
      inactiveFullDays: 0,
      tasks,
    },
  })
}
