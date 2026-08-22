"use client"

import { Activity, CheckCircle2, Droplet, HeartPulse, Loader2, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
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
      <section className="mb-5 rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm flex items-center justify-center min-h-32">
        <Loader2 size={20} className="animate-spin text-[#C9A435]" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mb-5 text-[#2B1A10]">
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Últimos dias</p>
        <h2 className="font-serif text-xl font-semibold mt-0.5">Sua evolução</h2>
      </div>

      <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-semibold">Consistência da semana</p>
            <p className="text-xs text-[#2B1A10]/45 mt-0.5">
              {data.activeDays} de {data.eligibleDays} {data.eligibleDays === 1 ? "dia elegível" : "dias elegíveis"} com algum registro
            </p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center text-[#9B7A16] font-bold text-sm shrink-0">
            {consistency}%
          </div>
        </div>

        <div className="h-2 rounded-full bg-[#2B1A10]/5 overflow-hidden mb-5">
          <div className="h-full rounded-full bg-[#C9A435]" style={{ width: `${consistency}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center">
            <HeartPulse size={17} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-lg font-bold">{data.checkinsThisWeek}</p>
            <p className="text-[10px] text-[#2B1A10]/45">check-ins</p>
          </div>
          <div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center">
            <Droplet size={17} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-lg font-bold">{data.hydrationDays}/{data.eligibleDays}</p>
            <p className="text-[10px] text-[#2B1A10]/45">meta de água</p>
          </div>
          <div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center">
            <CheckCircle2 size={17} className="mx-auto text-[#C9A435] mb-1" />
            <p className="text-lg font-bold">{data.missionsCompleted}</p>
            <p className="text-[10px] text-[#2B1A10]/45">missões feitas</p>
          </div>
        </div>

        <div className="border-t border-[#2B1A10]/5 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={15} className="text-[#C9A435]" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2B1A10]/55">Sinais percebidos</p>
          </div>

          {data.trends.length ? (
            <div className="space-y-2.5">
              {data.trends.map(trend => {
                const Icon = trend.direction === "better" ? TrendingUp : trend.direction === "worse" ? TrendingDown : Minus
                return (
                  <div key={trend.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{trend.label}</span>
                    <span className={`text-xs font-bold flex items-center gap-1 ${trend.direction === "better" ? "text-emerald-700" : trend.direction === "worse" ? "text-amber-700" : "text-[#2B1A10]/45"}`}>
                      <Icon size={13} /> {trend.text}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#F4EFE4]/60 px-4 py-3 flex items-start gap-2.5">
              <Sparkles size={15} className="text-[#C9A435] mt-0.5 shrink-0" />
              <p className="text-xs text-[#2B1A10]/55 leading-relaxed">
                Continue fazendo seus check-ins. Quando houver dados suficientes de duas semanas, mostramos tendências reais.
              </p>
            </div>
          )}
        </div>

        <Link href="/patient/progresso" className="mt-4 w-full rounded-2xl border border-[#2B1A10]/10 py-3 text-xs font-bold flex items-center justify-center hover:bg-[#F4EFE4]/50 transition">
          Ver evolução completa
        </Link>
      </div>
    </section>
  )
}
