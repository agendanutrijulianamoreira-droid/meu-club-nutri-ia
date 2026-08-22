"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  Award,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Crown,
  Droplet,
  Dumbbell,
  Flame,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { PatientEvolutionSummary } from "@/components/patient/PatientEvolutionSummary"
import { ReminderSettings } from "@/components/patient/ReminderSettings"
import { ProgressRing } from "@/components/patient/ProgressRing"
import { DAILY_LOG_XP } from "@/lib/gamification"
import { usePatientEngine } from "@/lib/hooks/usePatientEngine"
import { supabase } from "@/lib/supabase-browser"

type QuickTapKey = "water" | "meal" | "workout"

type Appointment = {
  scheduled_at: string
  is_virtual: boolean
  meeting_link?: string
  appointment_type: string
}

type Questionnaire = { id: string; name: string }

type ClinicalJourney = {
  phaseName: string
  phaseDescription: string | null
  phaseNumber: number
  methodName: string | null
  startedAt: string
  weekNumber: number
}

type PriorityAction = {
  kind: "daily-checkin" | "weekly-checkin" | "questionnaire" | "appointment" | "protocol" | "trial"
  eyebrow: string
  title: string
  description: string
  href?: string
}

function localDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function weekFromDate(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number)
  if (!year || !month || !day) return 1

  const start = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const elapsedDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
  return Math.floor(elapsedDays / 7) + 1
}

export function PatientHomeV2() {
  const router = useRouter()
  const { loading, activeProtocol, currentDayItems, progress, stats, toggleCheckin } = usePatientEngine()

  const [userId, setUserId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("Rainha")
  const [unreadCount, setUnreadCount] = useState(0)
  const [showReminders, setShowReminders] = useState(false)
  const [dailyCheckinPending, setDailyCheckinPending] = useState(false)
  const [weeklyCheckinPending, setWeeklyCheckinPending] = useState(false)
  const [pendingQuestionnaires, setPendingQuestionnaires] = useState<Questionnaire[]>([])
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)
  const [currentPlan, setCurrentPlan] = useState("community")
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [nutriCoins, setNutriCoins] = useState(0)
  const [nextReward, setNextReward] = useState<{ name: string; cost: number; emoji: string } | null>(null)
  const [dietaHoje, setDietaHoje] = useState<{ consumidas: number; meta: number } | null>(null)
  const [clinicalJourney, setClinicalJourney] = useState<ClinicalJourney | null>(null)
  const [quickTaps, setQuickTaps] = useState<Record<QuickTapKey, boolean>>({ water: false, meal: false, workout: false })
  const [dailyVictory, setDailyVictory] = useState("")
  const [savedVictory, setSavedVictory] = useState("")
  const [savingVictory, setSavingVictory] = useState(false)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)

  const pendingItemRef = useRef<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const uid = session.user.id
      setUserId(uid)
      const today = localDateString()
      const nowIso = new Date().toISOString()

      const [
        profileResult,
        inboxResult,
        dailyResult,
        weeklyResult,
        dietResult,
        appointmentResult,
        dailyLogResult,
        phaseAssignmentResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, tenant_id, current_plan, created_at, plan_started_at, plan_expires_at, nutri_coins")
          .eq("user_id", uid)
          .single(),
        supabase
          .from("inbox_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("status", "unread"),
        fetch(`/api/patient/checkin-diario?data=${today}`).then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, data: {} })),
        fetch("/api/patient/weekly-checkin").then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, data: {} })),
        fetch("/api/patient/diario/meta").then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, data: {} })),
        supabase
          .from("appointments")
          .select("scheduled_at, is_virtual, meeting_link, appointment_type")
          .eq("patient_id", uid)
          .in("status", ["scheduled", "confirmed"])
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1),
        supabase
          .from("daily_logs")
          .select("water_check, meal_plan_check, workout_check, daily_victory")
          .eq("user_id", uid)
          .eq("log_date", today)
          .maybeSingle(),
        supabase
          .from("fase_paciente")
          .select("method_phase_id, inicio")
          .eq("paciente_id", uid)
          .is("fim", null)
          .not("method_phase_id", "is", null)
          .order("inicio", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const profile = profileResult.data
      if (profile?.name) setFirstName(profile.name.split(" ")[0])
      if (profile?.current_plan) setCurrentPlan(profile.current_plan)
      setNutriCoins(profile?.nutri_coins || 0)
      setUnreadCount(inboxResult.count || 0)
      setDailyCheckinPending(dailyResult.ok ? !dailyResult.data?.registro : false)
      setWeeklyCheckinPending(weeklyResult.ok ? !weeklyResult.data?.submitted : false)

      if (dietResult.ok && dietResult.data?.resumo) {
        setDietaHoje({
          consumidas: dietResult.data.resumo.calorias_consumidas,
          meta: dietResult.data.resumo.calorias_meta,
        })
      }

      if (appointmentResult.data?.[0]) setNextAppointment(appointmentResult.data[0] as Appointment)

      if (dailyLogResult.data) {
        setQuickTaps({
          water: !!dailyLogResult.data.water_check,
          meal: !!dailyLogResult.data.meal_plan_check,
          workout: !!dailyLogResult.data.workout_check,
        })
        if (dailyLogResult.data.daily_victory) {
          setDailyVictory(dailyLogResult.data.daily_victory)
          setSavedVictory(dailyLogResult.data.daily_victory)
        }
      }

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

          setClinicalJourney({
            phaseName: phase.name,
            phaseDescription: phase.description || null,
            phaseNumber: (phase.sort_order ?? 0) + 1,
            methodName,
            startedAt: phaseAssignment.inicio,
            weekNumber: weekFromDate(phaseAssignment.inicio),
          })
        }
      }

      if (profile?.current_plan === "community") {
        const ref = profile.plan_expires_at
          ? new Date(profile.plan_expires_at)
          : profile.plan_started_at
            ? new Date(new Date(profile.plan_started_at).getTime() + 15 * 86400000)
            : profile.created_at
              ? new Date(new Date(profile.created_at).getTime() + 15 * 86400000)
              : null
        if (ref) setTrialDaysLeft(Math.max(0, Math.ceil((ref.getTime() - Date.now()) / 86400000)))
      }

      if (profile?.tenant_id) {
        const [activeQsResult, answeredResult] = await Promise.all([
          supabase.from("questionnaires").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true),
          supabase.from("questionnaire_responses").select("questionnaire_id").eq("patient_id", uid),
        ])
        const answeredIds = new Set((answeredResult.data || []).map((r: any) => r.questionnaire_id))
        setPendingQuestionnaires((activeQsResult.data || []).filter((q: Questionnaire) => !answeredIds.has(q.id)))
      }

      const { data: rewards } = await supabase
        .from("reward_items")
        .select("name, cost, emoji")
        .gt("cost", profile?.nutri_coins || 0)
        .eq("is_active", true)
        .order("cost", { ascending: true })
        .limit(1)
      if (rewards?.[0]) setNextReward(rewards[0])
    }

    init()
  }, [])

  const completedCount = currentDayItems.filter(item => progress[item.id]).length
  const firstIncompleteItem = currentDayItems.find(item => !progress[item.id])

  const priorityAction = useMemo<PriorityAction | null>(() => {
    const questionnaireHref = pendingQuestionnaires.length === 1
      ? `/patient/questionnaire/${pendingQuestionnaires[0].id}`
      : "/patient/questionnaires"

    if (dailyCheckinPending) return {
      kind: "daily-checkin",
      eyebrow: "Sua prioridade agora",
      title: "Como você está hoje?",
      description: "Registre energia, humor e sintomas. Leva menos de 3 minutos.",
      href: "/patient/progresso/checkin",
    }
    if (weeklyCheckinPending) return {
      kind: "weekly-checkin",
      eyebrow: "Sua prioridade agora",
      title: "Seu check-in semanal está esperando",
      description: "Conte como foi sua semana para ajustar sua jornada.",
      href: "/patient/checkin",
    }
    if (pendingQuestionnaires.length > 0) return {
      kind: "questionnaire",
      eyebrow: "Sua prioridade agora",
      title: pendingQuestionnaires.length === 1 ? pendingQuestionnaires[0].name : `${pendingQuestionnaires.length} questionários pendentes`,
      description: "Essas respostas ajudam a personalizar seu acompanhamento.",
      href: questionnaireHref,
    }
    if (firstIncompleteItem) return {
      kind: "protocol",
      eyebrow: "Sua próxima missão",
      title: firstIncompleteItem.title,
      description: firstIncompleteItem.description || "Uma ação de cada vez. Conclua e siga para a próxima.",
    }
    if (nextAppointment) return {
      kind: "appointment",
      eyebrow: "Próximo passo",
      title: "Sua próxima consulta já está marcada",
      description: new Date(nextAppointment.scheduled_at).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }),
      href: "/patient/appointments",
    }
    if (currentPlan === "community" && trialDaysLeft !== null && trialDaysLeft <= 3) return {
      kind: "trial",
      eyebrow: "Seu acesso",
      title: trialDaysLeft === 0 ? "Seu período de teste terminou" : `${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} de teste restante${trialDaysLeft === 1 ? "" : "s"}`,
      description: "Veja as opções para continuar sua jornada no clube.",
      href: "/patient/upgrade",
    }
    return null
  }, [dailyCheckinPending, weeklyCheckinPending, pendingQuestionnaires, firstIncompleteItem, nextAppointment, currentPlan, trialDaysLeft])

  const priorityIcon = priorityAction?.kind === "daily-checkin" ? HeartPulse
    : priorityAction?.kind === "weekly-checkin" ? ClipboardCheck
      : priorityAction?.kind === "questionnaire" ? ClipboardList
        : priorityAction?.kind === "appointment" ? Calendar
          : priorityAction?.kind === "trial" ? Crown
            : CheckCircle2

  const handleQuickTap = async (key: QuickTapKey) => {
    if (key === "water") {
      router.push("/patient/hidratacao")
      return
    }

    const newValue = !quickTaps[key]
    setQuickTaps(prev => ({ ...prev, [key]: newValue }))
    if (!userId) return

    const colMap = { meal: "meal_plan_check", workout: "workout_check" } as const
    const { error } = await supabase.from("daily_logs").upsert({
      user_id: userId,
      log_date: localDateString(),
      [colMap[key]]: newValue,
    }, { onConflict: "user_id,log_date" })

    if (error) setQuickTaps(prev => ({ ...prev, [key]: !newValue }))
  }

  const saveVictory = async () => {
    const value = dailyVictory.trim()
    if (!value || value === savedVictory || !userId) return
    setSavingVictory(true)
    const { error } = await supabase.from("daily_logs").upsert({
      user_id: userId,
      log_date: localDateString(),
      daily_victory: value,
    }, { onConflict: "user_id,log_date" })
    if (!error) setSavedVictory(value)
    setSavingVictory(false)
  }

  const requestProof = (itemId: string, type: "camera" | "gallery") => {
    pendingItemRef.current = itemId
    if (type === "camera") cameraInputRef.current?.click()
    else galleryInputRef.current?.click()
  }

  const handleProofFile = async (event: React.ChangeEvent<HTMLInputElement>, proofType: "camera" | "gallery") => {
    const file = event.target.files?.[0]
    const itemId = pendingItemRef.current
    event.target.value = ""
    if (!file || !itemId) return

    setUploadingItemId(itemId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${user.id}/${itemId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("protocol-photos").upload(path, file, { upsert: true })
      let photoUrl: string | null = null
      if (!uploadError) photoUrl = supabase.storage.from("protocol-photos").getPublicUrl(path).data.publicUrl
      await toggleCheckin(itemId, !!progress[itemId], proofType, photoUrl)
    } finally {
      setUploadingItemId(null)
      pendingItemRef.current = null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-[#C9A435]" size={30} />
      </div>
    )
  }

  const PriorityIcon = priorityIcon
  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite"
  const headerJourneyLabel = clinicalJourney
    ? `Fase ${clinicalJourney.phaseNumber} · ${clinicalJourney.phaseName} · Semana ${clinicalJourney.weekNumber}`
    : activeProtocol
      ? `Dia ${stats.currentDay} de ${stats.totalDays} da sua jornada`
      : "Seu acompanhamento, um passo de cada vez"

  return (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleProofFile(e, "camera")} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleProofFile(e, "gallery")} />

      <AnimatePresence>
        {showReminders && <ReminderSettings onClose={() => setShowReminders(false)} />}
      </AnimatePresence>

      <main className="min-h-screen bg-background text-[#2B1A10]">
        <div className="max-w-[460px] mx-auto px-4 pt-6 pb-28">
          <header className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A435] mb-1">{greeting}</p>
              <h1 className="text-3xl font-serif font-semibold leading-tight">{firstName}</h1>
              <p className="text-sm text-[#2B1A10]/50 mt-1 line-clamp-2">{headerJourneyLabel}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowReminders(true)} className="h-10 w-10 rounded-2xl bg-white border border-[#2B1A10]/10 flex items-center justify-center shadow-sm" aria-label="Lembretes">
                <Bell size={17} />
              </button>
              <Link href="/patient/inbox" className="relative h-10 w-10 rounded-2xl bg-white border border-[#2B1A10]/10 flex items-center justify-center shadow-sm" aria-label="Mensagens">
                <Sparkles size={17} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#C9A435] text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>}
              </Link>
            </div>
          </header>

          {(clinicalJourney || activeProtocol) && (
            <section className="mb-4 rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Minha jornada</p>
                    {clinicalJourney && (
                      <span className="rounded-full bg-[#C9A435]/10 border border-[#C9A435]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9B7A16]">
                        Semana {clinicalJourney.weekNumber}
                      </span>
                    )}
                  </div>

                  {clinicalJourney ? (
                    <>
                      {clinicalJourney.methodName && <p className="text-[11px] text-[#2B1A10]/45 mt-2">{clinicalJourney.methodName}</p>}
                      <h2 className="font-serif text-xl font-semibold mt-0.5">Fase {clinicalJourney.phaseNumber} · {clinicalJourney.phaseName}</h2>
                      {clinicalJourney.phaseDescription && (
                        <p className="text-xs text-[#2B1A10]/55 mt-2 leading-relaxed">{clinicalJourney.phaseDescription}</p>
                      )}
                    </>
                  ) : (
                    <h2 className="font-serif text-xl font-semibold truncate mt-1">{activeProtocol.title}</h2>
                  )}
                </div>

                {activeProtocol && (
                  <ProgressRing value={stats.completionRate} max={100} size={62} strokeWidth={5} color="#C9A435">
                    <span className="text-[11px] font-bold">{stats.completionRate}%</span>
                  </ProgressRing>
                )}
              </div>

              {activeProtocol && (
                <div className="mt-4 pt-4 border-t border-[#2B1A10]/5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#2B1A10]/40">Hoje</p>
                      <p className="text-xs font-semibold mt-0.5">{completedCount} de {currentDayItems.length} ações concluídas</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#C9A435]">Dia {stats.currentDay}/{stats.totalDays}</span>
                  </div>
                  <div className="h-2 bg-[#2B1A10]/5 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-[#C9A435] rounded-full" initial={{ width: 0 }} animate={{ width: `${stats.completionRate}%` }} />
                  </div>
                </div>
              )}
            </section>
          )}

          {priorityAction && (
            <section className="mb-5 rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5 shadow-lg shadow-[#2B1A10]/10">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-[#C9A435] text-white flex items-center justify-center shrink-0">
                  <PriorityIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">{priorityAction.eyebrow}</p>
                  <h2 className="text-lg font-semibold mt-1 leading-snug">{priorityAction.title}</h2>
                  <p className="text-sm text-[#F4EFE4]/65 mt-1 leading-relaxed">{priorityAction.description}</p>
                </div>
              </div>
              {priorityAction.kind === "protocol" && firstIncompleteItem ? (
                <button onClick={() => toggleCheckin(firstIncompleteItem.id, false)} className="mt-4 w-full rounded-2xl bg-[#F4EFE4] text-[#2B1A10] py-3.5 text-sm font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={17} /> Marcar como concluída
                </button>
              ) : priorityAction.href ? (
                <Link href={priorityAction.href} className="mt-4 w-full rounded-2xl bg-[#F4EFE4] text-[#2B1A10] py-3.5 text-sm font-bold flex items-center justify-center gap-2">
                  Fazer agora <ChevronRight size={16} />
                </Link>
              ) : null}
            </section>
          )}

          <PatientEvolutionSummary />

          <section className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Hoje</p>
                <h2 className="font-serif text-xl font-semibold">Sua jornada de hoje</h2>
              </div>
              {currentDayItems.length > 0 && <span className="text-xs font-bold text-[#2B1A10]/45">{completedCount}/{currentDayItems.length}</span>}
            </div>

            {!activeProtocol ? (
              <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-6 text-center shadow-sm">
                <Sparkles className="mx-auto text-[#C9A435] mb-3" size={24} />
                <h3 className="font-semibold">Seu protocolo está sendo preparado</h3>
                <p className="text-sm text-[#2B1A10]/50 mt-1">Quando estiver pronto, suas ações aparecerão aqui em ordem de prioridade.</p>
              </div>
            ) : currentDayItems.length === 0 ? (
              <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 text-center shadow-sm">
                <Award className="mx-auto text-[#C9A435] mb-2" size={22} />
                <p className="font-semibold">Hoje é um dia mais leve</p>
                <p className="text-sm text-[#2B1A10]/50 mt-1">Aproveite para manter o básico e cuidar de você.</p>
              </div>
            ) : (
              <div className="rounded-3xl bg-white border border-[#2B1A10]/10 overflow-hidden shadow-sm divide-y divide-[#2B1A10]/5">
                {currentDayItems.map((item, index) => {
                  const done = !!progress[item.id]
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="p-4 flex items-center gap-3">
                      <button onClick={() => toggleCheckin(item.id, done)} className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition ${done ? "bg-[#C9A435] text-white" : "bg-[#F4EFE4] text-[#2B1A10]/35"}`}>
                        {done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                      </button>
                      <button onClick={() => toggleCheckin(item.id, done)} className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-semibold ${done ? "line-through text-[#2B1A10]/40" : ""}`}>{item.title}</p>
                        {item.description && <p className="text-xs text-[#2B1A10]/45 truncate mt-0.5">{item.description}</p>}
                      </button>
                      {!done && (
                        <div className="flex gap-1.5">
                          {uploadingItemId === item.id ? <Loader2 className="animate-spin text-[#C9A435]" size={15} /> : <>
                            <button onClick={() => requestProof(item.id, "gallery")} className="h-8 w-8 rounded-xl bg-[#F4EFE4] flex items-center justify-center" title="Enviar foto"><ImageIcon size={14} /></button>
                            <button onClick={() => requestProof(item.id, "camera")} className="h-8 w-8 rounded-xl bg-[#F4EFE4] flex items-center justify-center" title="Tirar foto"><Camera size={14} /></button>
                          </>}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-2xl bg-white border border-[#2B1A10]/10 p-3 text-center shadow-sm">
              <Flame size={17} className="mx-auto text-[#C9A435] mb-1" />
              <p className="text-lg font-bold">{stats.currentStreak}</p>
              <p className="text-[10px] text-[#2B1A10]/45">dias em sequência</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#2B1A10]/10 p-3 text-center shadow-sm">
              <Sparkles size={17} className="mx-auto text-[#C9A435] mb-1" />
              <p className="text-lg font-bold">{stats.totalPoints}</p>
              <p className="text-[10px] text-[#2B1A10]/45">XP acumulado</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#2B1A10]/10 p-3 text-center shadow-sm">
              <Crown size={17} className="mx-auto text-[#C9A435] mb-1" />
              <p className="text-lg font-bold">{nutriCoins}</p>
              <p className="text-[10px] text-[#2B1A10]/45">NutriCoins</p>
            </div>
          </section>

          {dietaHoje && dietaHoje.meta > 0 && (
            <Link href="/patient/diario" className="block mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <ProgressRing value={dietaHoje.consumidas} max={dietaHoje.meta} size={56} strokeWidth={5} color="#C9A435">
                  <UtensilsCrossed size={14} />
                </ProgressRing>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Diário alimentar</p>
                  <p className="text-sm font-semibold mt-1">{Math.round(dietaHoje.consumidas)} de {Math.round(dietaHoje.meta)} kcal registradas</p>
                  <p className="text-xs text-[#2B1A10]/45 mt-0.5">Veja refeições e registros de hoje</p>
                </div>
                <ChevronRight size={16} className="text-[#2B1A10]/35" />
              </div>
            </Link>
          )}

          <section className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435] mb-3">Registrar agora</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "water" as const, label: "Água", icon: Droplet, xp: DAILY_LOG_XP.water_check },
                { key: "meal" as const, label: "Refeição", icon: UtensilsCrossed, xp: DAILY_LOG_XP.meal_plan_check },
                { key: "workout" as const, label: "Exercício", icon: Dumbbell, xp: DAILY_LOG_XP.workout_check },
              ].map(({ key, label, icon: Icon, xp }) => (
                <motion.button whileTap={{ scale: 0.96 }} key={key} onClick={() => handleQuickTap(key)} className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 shadow-sm ${quickTaps[key] ? "bg-[#C9A435]/10 border-[#C9A435]/35" : "bg-white border-[#2B1A10]/10"}`}>
                  <Icon size={19} className="text-[#C9A435]" />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[9px] text-[#2B1A10]/40 font-bold">{quickTaps[key] ? "✓ feito" : `+${xp} XP`}</span>
                </motion.button>
              ))}
            </div>
          </section>

          <section className="mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Vitória do dia</p>
            <p className="text-xs text-[#2B1A10]/45 mt-1 mb-3">Registrar pequenas conquistas também faz parte da evolução.</p>
            <textarea value={dailyVictory} onChange={e => setDailyVictory(e.target.value)} rows={2} placeholder="O que você conseguiu fazer por você hoje?" className="w-full rounded-2xl bg-[#F4EFE4]/70 border border-[#2B1A10]/10 px-3 py-3 text-sm outline-none resize-none placeholder:text-[#2B1A10]/30" />
            {dailyVictory.trim() && dailyVictory !== savedVictory && (
              <button onClick={saveVictory} disabled={savingVictory} className="mt-2 text-xs font-bold text-[#C9A435] flex items-center gap-1">
                {savingVictory && <Loader2 size={11} className="animate-spin" />} Salvar vitória
              </button>
            )}
          </section>

          {nextAppointment && (
            <Link href="/patient/appointments" className="block mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#F4EFE4] flex items-center justify-center"><Calendar size={17} className="text-[#C9A435]" /></div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Próxima consulta</p>
                  <p className="text-sm font-semibold mt-0.5">{new Date(nextAppointment.scheduled_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} às {new Date(nextAppointment.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</p>
                </div>
                <ChevronRight size={16} className="text-[#2B1A10]/35" />
              </div>
            </Link>
          )}

          {nextReward && (
            <Link href="/patient/store" className="block mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{nextReward.emoji || "🎁"}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Próxima conquista</p>
                  <p className="text-sm font-semibold truncate mt-0.5">{nextReward.name}</p>
                  <div className="h-1.5 bg-[#2B1A10]/5 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-[#C9A435] rounded-full" style={{ width: `${Math.min(100, (nutriCoins / nextReward.cost) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-[#2B1A10]/40 mt-1">{nutriCoins} de {nextReward.cost} NutriCoins</p>
                </div>
                <ChevronRight size={16} className="text-[#2B1A10]/35" />
              </div>
            </Link>
          )}

          {currentPlan === "community" && trialDaysLeft !== null && trialDaysLeft > 3 && (
            <Link href="/patient/upgrade" className="block mb-5 rounded-2xl border border-[#C9A435]/25 bg-[#C9A435]/5 px-4 py-3 text-xs text-[#2B1A10]/65">
              Você ainda tem <strong>{trialDaysLeft} dias</strong> de acesso de teste. Conheça as opções para continuar quando quiser.
            </Link>
          )}

          <Link href="/patient/feed" className="block rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[#C9A435] flex items-center justify-center"><Crown size={18} /></div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Comunidade</p>
                <p className="text-sm font-semibold mt-0.5">Veja conquistas e conteúdos do clube</p>
              </div>
              <ChevronRight size={17} className="text-[#F4EFE4]/55" />
            </div>
          </Link>
        </div>
      </main>
    </>
  )
}
