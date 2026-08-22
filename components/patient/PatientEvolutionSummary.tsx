"use client"

import { CheckCircle2, ChevronRight, Droplet, HeartPulse, Loader2, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { usePatientHomeData } from "@/components/patient/PatientHomeDataProvider"

type CheckinRow = {
  data: string
  nivel_energia?: number | null
  nivel_inchaco?: number | null
  nivel_compulsao?: number | null
  qualidade_sono?: number | null
  nivel_ansiedade?: number | null
}

type Trend = { label: string; direction: "better" | "stable" | "worse"; text: string }
type EvolutionData = {
  checkinsThisWeek: number
  hydrationDays: number
  activeDays: number
  eligibleDays: number
  missionsCompleted: number
  trends: Trend[]
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function daysInclusive(later: string, earlier: string) {
  const laterDate = new Date(`${later}T00:00:00Z`)
  const earlierDate = new Date(`${earlier}T00:00:00Z`)
  return Math.max(1, Math.floor((laterDate.getTime() - earlierDate.getTime()) / 86400000) + 1)
}

function buildTrend(
  label: string,
  currentValues: Array<number | null | undefined>,
  previousValues: Array<number | null | undefined>,
  lowerIsBetter: boolean,
): Trend | null {
  const currentValid = currentValues.filter((v): v is number => typeof v === "number")
  const previousValid = previousValues.filter((v): v is number => typeof v === "number")
  const current = average(currentValid)
  const previous = average(previousValid)
  if (current === null || previous === null || currentValid.length < 2 || previousValid.length < 2) return null

  const rawDelta = current - previous
  if (Math.abs(rawDelta) < 0.35) return { label, direction: "stable", text: "estável" }

  const improved = lowerIsBetter ? rawDelta < 0 : rawDelta > 0
  if (improved) {
    return {
      label,
      direction: "better",
      text: lowerIsBetter ? "reduzindo" : "melhorando",
    }
  }

  return {
    label,
    direction: "worse",
    text: lowerIsBetter ? "aumentando" : label === "Energia" ? "caindo" : "piorando",
  }
}

export function PatientEvolutionSummary() {
  const { payload, loading } = usePatientHomeData()

  const data = useMemo<EvolutionData | null>(() => {
    if (!payload) return null

    const checkins = (payload.checkins || []) as CheckinRow[]
    const currentWeek = checkins.filter(row => row.data >= payload.weekStart)
    const previousWeek = checkins.filter(row => row.data >= payload.historyStart && row.data < payload.weekStart)
    const logs = (payload.dailyLogs || []).filter((log: any) => log.log_date >= payload.weekStart)
    const progressHistory = payload.progressHistory || []

    const activeDates = new Set<string>()
    logs.forEach((log: any) => {
      if (log.water_check || (log.water_ml || 0) > 0 || log.meal_plan_check || log.workout_check || log.daily_victory) activeDates.add(log.log_date)
    })
    currentWeek.forEach(row => activeDates.add(row.data))
    progressHistory
      .filter((row: any) => row.checkin_date >= payload.weekStart)
      .forEach((row: any) => activeDates.add(row.checkin_date))

    const candidateStarts = [
      payload.weekStart,
      payload.protocol?.startDate,
      payload.clinicalJourney?.startedAt,
      payload.profile?.created_at?.slice?.(0, 10),
    ].filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))

    candidateStarts.sort()
    const eligibleStart = candidateStarts[candidateStarts.length - 1] || payload.weekStart
    const eligibleDays = Math.min(7, daysInclusive(payload.today, eligibleStart))

    const trends = [
      buildTrend("Energia", currentWeek.map(r => r.nivel_energia), previousWeek.map(r => r.nivel_energia), false),
      buildTrend("Inchaço", currentWeek.map(r => r.nivel_inchaco), previousWeek.map(r => r.nivel_inchaco), true),
      buildTrend("Sono", currentWeek.map(r => r.qualidade_sono), previousWeek.map(r => r.qualidade_sono), false),
      buildTrend("Ansiedade", currentWeek.map(r => r.nivel_ansiedade), previousWeek.map(r => r.nivel_ansiedade), true),
      buildTrend("Compulsão", currentWeek.map(r => r.nivel_compulsao), previousWeek.map(r => r.nivel_compulsao), true),
    ].filter((trend): trend is Trend => !!trend)

    return {
      checkinsThisWeek: currentWeek.length,
      hydrationDays: logs.filter((log: any) => !!log.water_check).length,
      activeDays: Math.min(eligibleDays, activeDates.size),
      eligibleDays,
      missionsCompleted: progressHistory.filter((row: any) => row.checkin_date >= payload.weekStart).length,
      trends: trends.slice(0, 3),
    }
  }, [payload])

  const consistency = useMemo(
    () => data ? Math.round((data.activeDays / Math.max(1, data.eligibleDays)) * 100) : 0,
    [data],
  )

  if (loading) {
    return (
      <section className="mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm flex items-center justify-center min-h-24">
        <Loader2 size={20} className="animate-spin text-[#C9A435]" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mb-5 text-[#2B1A10]">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Sua semana</p>
          <h2 className="font-serif text-xl font-semibold mt-0.5">Sua evolução</h2>
        </div>
        <Link href="/patient/progresso" className="text-[11px] font-bold text-[#2B1A10]/50 flex items-center gap-1 pb-0.5">
          Ver detalhes <ChevronRight size={13} />
        </Link>
      </div>

      <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{data.activeDays} de {data.eligibleDays} {data.eligibleDays === 1 ? "dia ativo" : "dias ativos"}</p>
            <p className="text-[11px] text-[#2B1A10]/45 mt-0.5">Consistência da semana</p>
          </div>
          <div className="rounded-xl bg-[#C9A435]/10 px-2.5 py-1.5 text-[#9B7A16] font-bold text-sm shrink-0">{consistency}%</div>
        </div>

        <div className="h-1.5 rounded-full bg-[#2B1A10]/5 overflow-hidden mt-3 mb-4">
          <div className="h-full rounded-full bg-[#C9A435]" style={{ width: `${consistency}%` }} />
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#2B1A10]/5 mb-4">
          <div className="px-2 text-center">
            <HeartPulse size={15} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-base font-bold leading-none">{data.checkinsThisWeek}</p>
            <p className="text-[9px] text-[#2B1A10]/45 mt-1">check-ins</p>
          </div>
          <div className="px-2 text-center">
            <Droplet size={15} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-base font-bold leading-none">{data.hydrationDays}/{data.eligibleDays}</p>
            <p className="text-[9px] text-[#2B1A10]/45 mt-1">água</p>
          </div>
          <div className="px-2 text-center">
            <CheckCircle2 size={15} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-base font-bold leading-none">{data.missionsCompleted}</p>
            <p className="text-[9px] text-[#2B1A10]/45 mt-1">missões</p>
          </div>
        </div>

        {data.trends.length ? (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#2B1A10]/5">
            {data.trends.map(trend => {
              const Icon = trend.direction === "better" ? TrendingUp : trend.direction === "worse" ? TrendingDown : Minus
              return (
                <span key={trend.label} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1 ${trend.direction === "better" ? "bg-emerald-50 text-emerald-700" : trend.direction === "worse" ? "bg-amber-50 text-amber-700" : "bg-[#F4EFE4] text-[#2B1A10]/50"}`}>
                  <Icon size={11} /> {trend.label} {trend.text}
                </span>
              )
            })}
          </div>
        ) : (
          <div className="pt-3 border-t border-[#2B1A10]/5 flex items-start gap-2">
            <Sparkles size={13} className="text-[#C9A435] mt-0.5 shrink-0" />
            <p className="text-[11px] text-[#2B1A10]/50 leading-relaxed">Continue registrando. As tendências aparecem quando houver dados suficientes.</p>
          </div>
        )}
      </div>
    </section>
  )
}
