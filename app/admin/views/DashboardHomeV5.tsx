"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileClock,
  HeartPulse,
  MessageSquareText,
  RefreshCw,
  Settings2,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  DASHBOARD_SHORTCUTS,
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type DashboardShortcutId,
  type DashboardWidgetId,
} from "@/lib/admin-dashboard"
import {
  crmPriority,
  riskReason,
  urgencyFromRisk,
  urgencyLabel,
  type DashboardUrgency,
} from "./DashboardPriorityHelpers"

type Appointment = {
  id: string
  patient_id: string | null
  scheduled_at: string
  status: string
  appointment_type: string | null
  is_virtual: boolean | null
  patient_name: string
}

type Risk = {
  id: string
  user_id: string
  overall_risk: number | null
  attention_bucket: string | null
  days_since_activity: number | null
  checkin_overdue: boolean | null
  consultation_overdue: boolean | null
  protocol_ending: boolean | null
  lifecycle_next_action: string | null
  calculated_date: string | null
  patient_name: string
}

type Pending = {
  id: string
  title: string | null
  target_patient_name: string | null
  action_type: string
  scheduled_for: string | null
}

type Crm = {
  id: string
  name: string
  next_action_at: string | null
  recency_segment: string | null
  phone: string | null
}

type DashboardData = {
  appointments: Appointment[]
  risks: Risk[]
  pending: Pending[]
  crm: Crm[]
  communicationFailures: number
  totalPatients: number
  activePatients: number
  todayCheckins: number
  yesterdayCheckins: number
  tomorrowAppointments: number
  latestRiskDate: string | null
}

const EMPTY: DashboardData = {
  appointments: [],
  risks: [],
  pending: [],
  crm: [],
  communicationFailures: 0,
  totalPatients: 0,
  activePatients: 0,
  todayCheckins: 0,
  yesterdayCheckins: 0,
  tomorrowAppointments: 0,
  latestRiskDate: null,
}

const TZ = "America/Sao_Paulo"
const dateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
const ptDate = () =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date())
const time = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
const greeting = () => {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  )
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}
const formatRiskDate = (value: string | null) => {
  if (!value) return "sem cálculo recente"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function tone(level: DashboardUrgency) {
  if (level === "critical") return "border-[#F0C9C9] bg-[#FFF5F5] text-[#9B3333]"
  if (level === "today") return "border-[#F2D7B4] bg-[#FFF7EA] text-[#A76517]"
  if (level === "soon") return "border-[#D7E5E1] bg-[#F1F8F6] text-[#0D7166]"
  return "border-[#E3EAE8] bg-[#F8FAF9] text-[#61716C]"
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (!previous && !current)
    return <span className="text-[11px] font-bold text-[#7A8884]">sem comparação</span>
  const up = diff >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-black ${up ? "text-[#2C7A61]" : "text-[#A76517]"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(diff)} vs. ontem
    </span>
  )
}

export function DashboardHomeV5({
  setView,
  userName = "",
  tenantName = "",
  tenantId = "",
  onNewPatient,
}: {
  setView: (v: any) => void
  userName?: string
  tenantName?: string
  tenantId?: string
  onNewPatient?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES)
  const [data, setData] = useState<DashboardData>(EMPTY)

  const load = useCallback(
    async (soft = false) => {
      if (!tenantId) {
        setLoading(false)
        return
      }
      soft ? setRefreshing(true) : setLoading(true)
      setError("")
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Sessão não encontrada.")

        const { data: prefRow } = await supabase
          .from("admin_dashboard_preferences")
          .select("layout_mode,visible_widgets,favorite_shortcuts,attention_rules,display_settings")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
        const nextPrefs = normalizeDashboardPreferences(prefRow as Partial<DashboardPreferences> | null)
        setPrefs(nextPrefs)

        const now = new Date()
        const today = dateKey(now)
        const yesterdayDate = new Date(now)
        const tomorrowDate = new Date(now)
        const afterTomorrowDate = new Date(now)
        yesterdayDate.setDate(yesterdayDate.getDate() - 1)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        afterTomorrowDate.setDate(afterTomorrowDate.getDate() + 2)
        const yesterday = dateKey(yesterdayDate)
        const tomorrow = dateKey(tomorrowDate)
        const afterTomorrow = dateKey(afterTomorrowDate)
        const start = `${today}T00:00:00-03:00`
        const end = `${tomorrow}T00:00:00-03:00`
        const tomorrowEnd = `${afterTomorrow}T00:00:00-03:00`
        const activeCutoff = Math.max(1, nextPrefs.attention_rules.inactive_days)

        const [
          appointmentsRes,
          risksRes,
          pendingRes,
          crmRes,
          failuresRes,
          patientsRes,
          activeRes,
          todayLogsRes,
          yesterdayLogsRes,
          tomorrowRes,
        ] = await Promise.all([
          supabase
            .from("appointments")
            .select("id,patient_id,scheduled_at,status,appointment_type,is_virtual")
            .eq("tenant_id", tenantId)
            .gte("scheduled_at", start)
            .lt("scheduled_at", end)
            .not("status", "in", '("cancelled","no_show")')
            .order("scheduled_at")
            .limit(8),
          supabase
            .from("latest_patient_risk_scores")
            .select("id,user_id,overall_risk,attention_bucket,days_since_activity,checkin_overdue,consultation_overdue,protocol_ending,lifecycle_next_action,calculated_date")
            .eq("tenant_id", tenantId)
            .neq("attention_bucket", "none")
            .order("overall_risk", { ascending: false })
            .limit(8),
          supabase
            .from("agent_pending_actions")
            .select("id,title,target_patient_name,action_type,scheduled_for")
            .eq("tenant_id", tenantId)
            .eq("status", "pending")
            .order("scheduled_for", { ascending: true, nullsFirst: false })
            .limit(8),
          supabase
            .from("crm_contacts")
            .select("id,name,next_action_at,recency_segment,phone")
            .eq("tenant_id", tenantId)
            .eq("do_not_contact", false)
            .not("next_action_at", "is", null)
            .lte("next_action_at", end)
            .order("next_action_at")
            .limit(8),
          supabase
            .from("appointment_communication_jobs")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("status", "failed"),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("role", "patient"),
          supabase
            .from("latest_patient_risk_scores")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .lte("days_since_activity", activeCutoff),
          supabase.from("daily_logs").select("id", { count: "exact", head: true }).eq("log_date", today),
          supabase.from("daily_logs").select("id", { count: "exact", head: true }).eq("log_date", yesterday),
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .gte("scheduled_at", end)
            .lt("scheduled_at", tomorrowEnd)
            .not("status", "in", '("cancelled","no_show")'),
        ])

        const hardError = [appointmentsRes.error, risksRes.error, pendingRes.error, crmRes.error, patientsRes.error]
          .filter(Boolean)
          .map((item: any) => item?.message)
          .filter(Boolean)
        if (hardError.length) throw new Error(hardError[0])

        const rawAppointments = appointmentsRes.data || []
        const rawRisks = risksRes.data || []
        const appointmentPatientIds = [...new Set(rawAppointments.map((row: any) => row.patient_id).filter(Boolean))]
        const riskUserIds = [...new Set(rawRisks.map((row: any) => row.user_id).filter(Boolean))]

        const [appointmentNamesRes, riskNamesRes] = await Promise.all([
          appointmentPatientIds.length
            ? supabase.from("profiles").select("id,name").eq("tenant_id", tenantId).in("id", appointmentPatientIds)
            : Promise.resolve({ data: [], error: null }),
          riskUserIds.length
            ? supabase.from("profiles").select("user_id,name").eq("tenant_id", tenantId).in("user_id", riskUserIds)
            : Promise.resolve({ data: [], error: null }),
        ])
        const appointmentNames = new Map((appointmentNamesRes.data || []).map((p: any) => [p.id, p.name || "Paciente"]))
        const riskNames = new Map((riskNamesRes.data || []).map((p: any) => [p.user_id, p.name || "Paciente"]))
        const latestRiskDate = rawRisks.reduce<string | null>((latest, row: any) => {
          if (!row.calculated_date) return latest
          return !latest || row.calculated_date > latest ? row.calculated_date : latest
        }, null)

        setData({
          appointments: rawAppointments.map((a: any) => ({
            ...a,
            patient_name: appointmentNames.get(a.patient_id) || "Paciente",
          })),
          risks: rawRisks.map((r: any) => ({
            ...r,
            patient_name: riskNames.get(r.user_id) || "Paciente",
          })),
          pending: (pendingRes.data || []) as Pending[],
          crm: (crmRes.data || []) as Crm[],
          communicationFailures: failuresRes.count || 0,
          totalPatients: patientsRes.count || 0,
          activePatients: activeRes.count || 0,
          todayCheckins: todayLogsRes.count || 0,
          yesterdayCheckins: yesterdayLogsRes.count || 0,
          tomorrowAppointments: tomorrowRes.count || 0,
          latestRiskDate,
        })
      } catch (err: any) {
        console.error("[dashboard] load failed", err)
        setError(err?.message || "Não foi possível carregar o painel.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tenantId],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refresh = () => load(true)
    window.addEventListener("dashboard:refresh", refresh)
    return () => window.removeEventListener("dashboard:refresh", refresh)
  }, [load])

  const shortcuts = useMemo(
    () => prefs.favorite_shortcuts.map((id) => DASHBOARD_SHORTCUTS.find((item) => item.id === id)).filter(Boolean),
    [prefs.favorite_shortcuts],
  )
  const nextAppointment = useMemo(
    () => data.appointments.find((item) => new Date(item.scheduled_at) >= new Date()) || data.appointments[0] || null,
    [data.appointments],
  )

  const runShortcut = (id: DashboardShortcutId) => {
    if (id === "new_patient") return onNewPatient?.()
    if (id === "new_appointment") return setView("appointments")
    if (id === "new_meal_plan") return setView("meal-plans")
    if (id === "new_protocol") return setView("protocols")
    if (id === "attention") return router.push("/admin/attention")
    if (id === "crm") return router.push("/admin/crm")
    if (id === "communication") return setView("communication")
    if (id === "settings") return router.push("/admin/dashboard/settings")
  }
  const shortcutIcon = (id: DashboardShortcutId) =>
    id === "new_patient" ? <UserPlus size={17} /> :
    id === "new_appointment" ? <CalendarDays size={17} /> :
    id === "new_meal_plan" ? <UtensilsCrossed size={17} /> :
    id === "new_protocol" ? <Stethoscope size={17} /> :
    id === "attention" ? <HeartPulse size={17} /> :
    id === "crm" ? <Users size={17} /> :
    id === "communication" ? <MessageSquareText size={17} /> : <Settings2 size={17} />

  const ordered = prefs.display_settings.widget_order.filter((id) => prefs.visible_widgets.includes(id))
  const limit = (id: DashboardWidgetId) => prefs.display_settings.widget_limits[id] || 4
  const compact = (id: DashboardWidgetId) => prefs.display_settings.widget_sizes[id] === "compact"
  const pad = (id: DashboardWidgetId) => (compact(id) ? "p-4" : "p-5")

  const renderWidget = (id: DashboardWidgetId) => {
    if (id === "today") {
      return (
        <section key={id} className="overflow-hidden rounded-3xl border border-[#D5E1DE] bg-white shadow-sm xl:col-span-2">
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className={`${pad(id)} border-b border-[#E5ECEA] lg:border-b-0 lg:border-r`}>
              <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#0D7166]">Próxima consulta</p>
              {nextAppointment ? (
                <>
                  <div className="mt-3 flex items-start gap-4">
                    <div className="rounded-2xl bg-[#EAF5F2] px-4 py-3 text-center">
                      <p className="text-2xl font-black text-[#0D7166]">{time(nextAppointment.scheduled_at)}</p>
                      <p className="text-[10px] font-black uppercase text-[#6B7B76]">hoje</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-black">{nextAppointment.patient_name}</h2>
                      <p className="mt-1 text-sm text-[#687772]">
                        {nextAppointment.appointment_type || "Consulta"} · {nextAppointment.is_virtual ? "online" : "presencial"}
                      </p>
                      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${nextAppointment.status === "confirmed" ? "bg-[#EAF5F2] text-[#0D7166]" : "bg-[#FFF5E7] text-[#A76517]"}`}>
                        {nextAppointment.status === "confirmed" ? "Confirmada" : "Aguardando confirmação"}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setView("appointments")} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-black text-[#0D7166]">
                    Abrir agenda <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <div className="mt-4 rounded-2xl bg-[#F2F8F5] p-5">
                  <CheckCircle2 className="mb-2 text-[#4F8A79]" />
                  <p className="font-black">Agenda livre hoje</p>
                </div>
              )}
            </div>
            <div className={pad(id)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">Seu dia</h2>
                  <p className="text-xs text-[#687772]">{data.appointments.length} consulta{data.appointments.length === 1 ? "" : "s"} hoje</p>
                </div>
                <button onClick={() => setView("appointments")} className="min-h-10 text-xs font-black text-[#0D7166]">Agenda completa</button>
              </div>
              <div className="mt-3 space-y-2">
                {data.appointments.slice(0, limit(id)).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#F8FAF9] px-3 py-2">
                    <p className="w-12 text-sm font-black text-[#0D7166]">{time(item.scheduled_at)}</p>
                    <p className="min-w-0 flex-1 truncate text-sm font-black">{item.patient_name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs font-bold text-[#687772]">Amanhã: {data.tomorrowAppointments}</p>
            </div>
          </div>
        </section>
      )
    }

    if (id === "attention") {
      return (
        <section key={id} className={`rounded-3xl border border-[#DCE6E3] bg-white shadow-sm ${pad(id)}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-[#FFF4E5] p-2 text-[#A76517]"><HeartPulse size={19} /></div>
              <div className="min-w-0">
                <h2 className="font-black">Precisa de você</h2>
                <p className="truncate text-xs text-[#687772]">Risco calculado em {formatRiskDate(data.latestRiskDate)}</p>
              </div>
            </div>
            <span className="rounded-full bg-[#FFF4E5] px-3 py-1 text-xs font-black text-[#A76517]">{data.risks.length}</span>
          </div>
          <div className="space-y-2">
            {data.risks.length ? data.risks.slice(0, limit(id)).map((row) => {
              const level = urgencyFromRisk(row.attention_bucket, row.overall_risk)
              return (
                <div key={row.id} className="rounded-2xl border border-[#E5ECEA] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{row.patient_name}</p>
                      {!compact(id) && <p className="mt-1 text-xs text-[#687772]">{riskReason(row)}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${tone(level)}`}>{urgencyLabel(level)}</span>
                  </div>
                </div>
              )
            }) : <p className="rounded-2xl bg-[#F8FAF9] p-4 text-sm text-[#687772]">Nenhum risco disponível para exibir.</p>}
          </div>
          <Link href="/admin/attention" className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-black text-[#0D7166]">Ver fila completa <ArrowRight size={14} /></Link>
        </section>
      )
    }

    if (id === "pending") {
      return (
        <section key={id} className={`rounded-3xl border border-[#DCE6E3] bg-white shadow-sm ${pad(id)}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2FF] p-2 text-[#4F46E5]"><FileClock size={19} /></div><div><h2 className="font-black">Pendências</h2><p className="text-xs text-[#687772]">Mais urgentes primeiro</p></div></div>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-black text-[#4F46E5]">{data.pending.length + data.communicationFailures}</span>
          </div>
          {data.communicationFailures > 0 && (
            <Link href="/admin/appointments/communications" className="mb-2 flex min-h-11 items-center justify-between rounded-2xl border border-[#F2D2D2] bg-[#FFF5F5] p-3">
              <p className="text-sm font-black text-[#9B3333]">{data.communicationFailures} comunicação(ões) com falha</p>
              <AlertTriangle size={17} className="text-[#B64949]" />
            </Link>
          )}
          <div className="space-y-2">
            {data.pending.length ? data.pending.slice(0, limit(id)).map((row) => (
              <div key={row.id} className="rounded-2xl border border-[#E5ECEA] p-3">
                <p className="text-sm font-black">{row.title || "Ação pendente"}</p>
                {!compact(id) && <p className="mt-1 text-xs text-[#687772]">{row.target_patient_name || row.action_type.replaceAll("_", " ")}</p>}
              </div>
            )) : data.communicationFailures === 0 ? <p className="rounded-2xl bg-[#F8FAF9] p-4 text-sm text-[#687772]">Nenhuma pendência aberta.</p> : null}
          </div>
          <Link href="/admin/inbox" className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-black text-[#0D7166]">Abrir caixa única <ArrowRight size={14} /></Link>
        </section>
      )
    }

    if (id === "commercial") {
      return (
        <section key={id} className={`rounded-3xl border border-[#DCE6E3] bg-white shadow-sm ${pad(id)}`}>
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EDF7F3] p-2 text-[#0D7166]"><CircleDollarSign size={19} /></div><div><h2 className="font-black">Comercial</h2><p className="text-xs text-[#687772]">Leads e retornos por prioridade</p></div></div><span className="rounded-full bg-[#EDF7F3] px-3 py-1 text-xs font-black text-[#0D7166]">{data.crm.length}</span></div>
          <div className="space-y-2">
            {data.crm.length ? data.crm.slice(0, limit(id)).map((row) => {
              const priority = crmPriority(row)
              return <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5ECEA] p-3"><div className="min-w-0"><p className="truncate text-sm font-black">{row.name}</p>{!compact(id) && <p className="text-xs text-[#687772]">{row.recency_segment || "CRM"}</p>}</div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${tone(priority.level)}`}>{priority.label}</span></div>
            }) : <p className="rounded-2xl bg-[#F8FAF9] p-4 text-sm text-[#687772]">Nenhuma ação comercial vencida ou próxima.</p>}
          </div>
          <Link href="/admin/crm" className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-black text-[#0D7166]">Abrir CRM <ArrowRight size={14} /></Link>
        </section>
      )
    }

    return (
      <section key={id} className={`rounded-3xl border border-[#DCE6E3] bg-white shadow-sm ${pad(id)}`}>
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-[#F1F5F4] p-2 text-[#52615D]"><Zap size={19} /></div><div><h2 className="font-black">Resumo da clínica</h2><p className="text-xs text-[#687772]">Indicadores essenciais</p></div></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#F7FAF9] p-4"><p className={`${compact(id) ? "text-xl" : "text-2xl"} font-black`}>{data.totalPatients}</p><p className="text-xs font-bold text-[#687772]">Pacientes</p><p className="mt-2 text-[11px] font-bold text-[#7A8884]">{data.activePatients} com atividade recente</p></div>
          <div className="rounded-2xl bg-[#F0F8F6] p-4"><p className={`${compact(id) ? "text-xl" : "text-2xl"} font-black text-[#0D7166]`}>{data.todayCheckins}</p><p className="text-xs font-bold text-[#687772]">Check-ins hoje</p><div className="mt-2"><Delta current={data.todayCheckins} previous={data.yesterdayCheckins} /></div></div>
          <div className="rounded-2xl bg-[#FFF8EA] p-4"><p className={`${compact(id) ? "text-xl" : "text-2xl"} font-black text-[#9A6B18]`}>{data.appointments.length}</p><p className="text-xs font-bold text-[#687772]">Consultas hoje</p><p className="mt-2 text-[11px] font-bold text-[#7A8884]">{data.tomorrowAppointments} amanhã</p></div>
        </div>
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-[#F4F7F6] p-4 pb-28 text-[#1C2B27] sm:p-6 sm:pb-24 lg:p-8 xl:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#0D7166]">Centro operacional · {prefs.layout_mode === "today" ? "Hoje" : prefs.layout_mode === "clinical" ? "Clínica" : "Gestão"}</p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">{greeting()}, {userName.split(" ")[0] || "Admin"}</h1>
            <p className="mt-1 text-sm capitalize text-[#687772]">{tenantName ? `${tenantName} · ` : ""}{ptDate()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load(true)} aria-label="Atualizar painel" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D3DEDB] bg-white text-[#52615D]"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button>
            <Link href="/admin/dashboard/settings" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D3DEDB] bg-white px-4 py-2.5 text-sm font-black text-[#52615D]"><Settings2 size={17} />Personalizar</Link>
          </div>
        </header>

        <section className="mb-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap" aria-label="Atalhos favoritos">
          {shortcuts.map((shortcut) => shortcut && (
            <button key={shortcut.id} onClick={() => runShortcut(shortcut.id)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#DCE6E3] bg-white px-4 py-2.5 text-sm font-black shadow-sm hover:border-[#8FC8BC] hover:bg-[#F4FBF9]">
              {shortcutIcon(shortcut.id)}{shortcut.label}
            </button>
          ))}
        </section>

        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0C9C9] bg-[#FFF5F5] p-4 text-sm text-[#8E3434]">
            <span>{error}</span>
            <button onClick={() => load(true)} className="min-h-10 rounded-xl border border-[#E2BDBD] bg-white px-3 font-black">Tentar novamente</button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-3xl border border-[#DCE6E3] bg-white" /><div className="h-64 animate-pulse rounded-3xl border border-[#DCE6E3] bg-white" /></div>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {ordered.map(renderWidget)}
          </div>
        )}
      </div>
    </main>
  )
}
