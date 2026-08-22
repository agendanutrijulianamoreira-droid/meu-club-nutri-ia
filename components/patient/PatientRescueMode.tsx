"use client"

import { Droplet, HeartPulse, RotateCcw, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

type RescueState = { active: boolean; inactiveFullDays: number }

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function differenceInCalendarDays(later: string, earlier: string) {
  const diff = parseLocalDate(later).getTime() - parseLocalDate(earlier).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

function localDateFromIso(value: string) {
  return localDate(new Date(value))
}

export function PatientRescueMode() {
  const [state, setState] = useState<RescueState>({ active: false, inactiveFullDays: 0 })

  useEffect(() => {
    const detect = async () => {
      const today = localDate()
      const response = await fetch(`/api/patient/home?date=${today}`, { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const payload = await response.json()
      const protocol = payload.protocol
      if (!protocol?.assignmentId || !protocol?.startDate) return

      const activityDates = new Set<string>()
      for (const log of payload.dailyLogs || []) {
        if (log.water_check || (log.water_ml || 0) > 0 || log.meal_plan_check || log.workout_check || log.daily_victory) activityDates.add(log.log_date)
      }
      for (const checkin of payload.checkins || []) {
        if (checkin?.data) activityDates.add(checkin.data)
      }
      for (const row of payload.progressHistory || []) {
        if (row.completed_at) activityDates.add(localDateFromIso(row.completed_at))
        else if (row.checkin_date) activityDates.add(row.checkin_date)
      }

      if (activityDates.has(today)) return
      const previousDates = [...activityDates].filter(date => date < today).sort()
      const previousActivity = previousDates[previousDates.length - 1]
      const baseline = previousActivity && previousActivity > protocol.startDate ? previousActivity : protocol.startDate
      const inactiveFullDays = Math.max(0, differenceInCalendarDays(today, baseline) - 1)
      setState({ active: inactiveFullDays >= 3, inactiveFullDays })
    }

    detect()
  }, [])

  if (!state.active) return null

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#F4EFE4] text-[#2B1A10]">
      <div className="min-h-full max-w-[460px] mx-auto px-5 py-10 flex flex-col justify-center">
        <div className="h-14 w-14 rounded-3xl bg-[#C9A435]/15 border border-[#C9A435]/20 flex items-center justify-center mb-6"><RotateCcw size={24} className="text-[#9B7A16]" /></div>
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#C9A435]">Modo Resgate</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight mt-2">Hoje, só precisamos recomeçar.</h1>
        <p className="text-sm leading-relaxed text-[#2B1A10]/60 mt-3">Há {state.inactiveFullDays} dias completos sem registros. Você não precisa compensar nada nem recuperar tarefas atrasadas. Escolha apenas um passo simples para voltar ao ritmo.</p>

        <div className="mt-8 space-y-3">
          <Link href="/patient/progresso/checkin" className="block rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5 shadow-lg shadow-[#2B1A10]/10">
            <div className="flex items-center gap-4"><div className="h-11 w-11 rounded-2xl bg-[#C9A435] flex items-center justify-center shrink-0"><HeartPulse size={20} /></div><div><p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 1</p><p className="font-semibold mt-0.5">Me contar como estou hoje</p><p className="text-xs text-[#F4EFE4]/55 mt-1">Um check-in curto para retomar o acompanhamento.</p></div></div>
          </Link>
          <Link href="/patient/hidratacao" className="block rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm">
            <div className="flex items-center gap-4"><div className="h-11 w-11 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center shrink-0"><Droplet size={20} className="text-[#C9A435]" /></div><div><p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 2</p><p className="font-semibold mt-0.5">Registrar água agora</p><p className="text-xs text-[#2B1A10]/45 mt-1">Comece pelo básico. O restante volta depois.</p></div></div>
          </Link>
        </div>

        <div className="mt-7 rounded-2xl bg-white/60 border border-[#2B1A10]/5 px-4 py-3 flex items-start gap-2.5"><Sparkles size={15} className="text-[#C9A435] mt-0.5 shrink-0" /><p className="text-xs leading-relaxed text-[#2B1A10]/50">Assim que você registrar uma ação hoje, sua Home normal volta automaticamente com a jornada a partir de onde está.</p></div>
      </div>
    </div>
  )
}
