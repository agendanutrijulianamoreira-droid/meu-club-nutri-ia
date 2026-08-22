"use client"

import { Droplet, HeartPulse, RotateCcw, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { supabase } from "@/lib/supabase-browser"

type RescueState = {
  active: boolean
  inactiveFullDays: number
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function localDateDaysAgo(days: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return localDate(date)
}

function localDateFromIso(value: string) {
  return localDate(new Date(value))
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function differenceInCalendarDays(later: string, earlier: string) {
  const diff = parseLocalDate(later).getTime() - parseLocalDate(earlier).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

export function PatientRescueMode() {
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<RescueState>({ active: false, inactiveFullDays: 0 })

  useEffect(() => {
    const detect = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const today = localDate()
        const historyStart = localDateDaysAgo(14)

        const [assignmentResult, logsResult, checkinsResponse] = await Promise.all([
          supabase
            .from("protocol_assignments")
            .select("id, start_date")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("daily_logs")
            .select("log_date, water_check, water_ml, meal_plan_check, workout_check, daily_victory")
            .eq("user_id", user.id)
            .gte("log_date", historyStart)
            .order("log_date", { ascending: false }),
          fetch("/api/patient/checkin-diario?periodo=14")
            .then(async response => response.ok ? response.json() : { checkins: [] })
            .catch(() => ({ checkins: [] })),
        ])

        const assignment = assignmentResult.data
        if (!assignment?.id || !assignment.start_date) return

        const { data: progressRows } = await supabase
          .from("protocol_progress")
          .select("completed_at, checkin_date")
          .eq("assignment_id", assignment.id)
          .gte("checkin_date", historyStart)

        const activityDates = new Set<string>()

        for (const log of logsResult.data || []) {
          const meaningful = !!log.water_check
            || (log.water_ml || 0) > 0
            || !!log.meal_plan_check
            || !!log.workout_check
            || !!log.daily_victory
          if (meaningful) activityDates.add(log.log_date)
        }

        for (const checkin of checkinsResponse?.checkins || []) {
          if (checkin?.data) activityDates.add(checkin.data)
        }

        for (const row of progressRows || []) {
          if (row.completed_at) activityDates.add(localDateFromIso(row.completed_at))
          else if (row.checkin_date) activityDates.add(row.checkin_date)
        }

        if (activityDates.has(today)) {
          setState({ active: false, inactiveFullDays: 0 })
          return
        }

        const previousDates = [...activityDates]
          .filter(date => date < today)
          .sort()
        const previousActivity = previousDates[previousDates.length - 1]

        // Se nunca houve atividade, a data de início do protocolo vira o marco inicial.
        const baseline = previousActivity && previousActivity > assignment.start_date
          ? previousActivity
          : assignment.start_date

        // Exclui o dia de hoje, que ainda está em andamento.
        const inactiveFullDays = Math.max(0, differenceInCalendarDays(today, baseline) - 1)
        setState({ active: inactiveFullDays >= 3, inactiveFullDays })
      } finally {
        setLoading(false)
      }
    }

    detect()
  }, [])

  if (loading || !state.active) return null

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#F4EFE4] text-[#2B1A10]">
      <div className="min-h-full max-w-[460px] mx-auto px-5 py-10 flex flex-col justify-center">
        <div className="h-14 w-14 rounded-3xl bg-[#C9A435]/15 border border-[#C9A435]/20 flex items-center justify-center mb-6">
          <RotateCcw size={24} className="text-[#9B7A16]" />
        </div>

        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#C9A435]">Modo Resgate</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight mt-2">Hoje, só precisamos recomeçar.</h1>
        <p className="text-sm leading-relaxed text-[#2B1A10]/60 mt-3">
          Há {state.inactiveFullDays} dias completos sem registros. Você não precisa compensar nada nem recuperar tarefas atrasadas. Escolha apenas um passo simples para voltar ao ritmo.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/patient/progresso/checkin"
            className="block rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5 shadow-lg shadow-[#2B1A10]/10"
          >
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-[#C9A435] flex items-center justify-center shrink-0">
                <HeartPulse size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 1</p>
                <p className="font-semibold mt-0.5">Me contar como estou hoje</p>
                <p className="text-xs text-[#F4EFE4]/55 mt-1">Um check-in curto para retomar o acompanhamento.</p>
              </div>
            </div>
          </Link>

          <Link
            href="/patient/hidratacao"
            className="block rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center shrink-0">
                <Droplet size={20} className="text-[#C9A435]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 2</p>
                <p className="font-semibold mt-0.5">Registrar água agora</p>
                <p className="text-xs text-[#2B1A10]/45 mt-1">Comece pelo básico. O restante volta depois.</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-7 rounded-2xl bg-white/60 border border-[#2B1A10]/5 px-4 py-3 flex items-start gap-2.5">
          <Sparkles size={15} className="text-[#C9A435] mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-[#2B1A10]/50">
            Assim que você registrar uma ação hoje, sua Home normal volta automaticamente com a jornada a partir de onde está.
          </p>
        </div>
      </div>
    </div>
  )
}
