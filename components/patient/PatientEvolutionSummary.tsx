"use client"

import { Activity, CheckCircle2, Droplet, HeartPulse, Loader2, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { supabase } from "@/lib/supabase-browser"

type CheckinRow = {
  data: string
  nivel_energia?: number | null
  nivel_inchaco?: number | null
  nivel_compulsao?: number | null
  qualidade_sono?: number | null
  nivel_ansiedade?: number | null
  dor_abdominal?: number | null
  retencao_liquido?: number | null
}

type Trend = {
  label: string
  direction: "better" | "stable" | "worse"
  text: string
}

type EvolutionData = {
  checkinsThisWeek: number
  hydrationDays: number
  activeDays: number
  missionsCompleted: number
  trends: Trend[]
}

function localDateDaysAgo(daysAgo: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function buildTrend(
  label: string,
  currentValues: Array<number | null | undefined>,
  previousValues: Array<number | null | undefined>,
  lowerIsBetter: boolean,
): Trend | null {
  const current = average(currentValues)
  const previous = average(previousValues)
  if (current === null || previous === null || currentValues.filter(v => typeof v === "number").length < 2 || previousValues.filter(v => typeof v === "number").length < 2) return null

  const rawDelta = current - previous
  const meaningful = Math.abs(rawDelta) >= 0.35
  if (!meaningful) return { label, direction: "stable", text: "estável" }

  const improved = lowerIsBetter ? rawDelta < 0 : rawDelta > 0
  return {
    label,
    direction: improved ? "better" : "worse",
    text: improved ? (lowerIsBetter ? "reduzindo" : "melhorando") : (lowerIsBetter ? "aumentando" : "reduzindo"),
  }
}

export function PatientEvolutionSummary() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EvolutionData | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const weekStart = localDateDaysAgo(6)
        const previousStart = localDateDaysAgo(13)

        const [checkinResponse, logsResult, assignmentResult] = await Promise.all([
          fetch("/api/patient/checkin-diario?periodo=14")
            .then(async response => response.ok ? response.json() : { checkins: [] })
            .catch(() => ({ checkins: [] })),
          supabase
            .from("daily_logs")
            .select("log_date, water_check, water_ml, meal_plan_check, workout_check")
            .eq("user_id", user.id)
            .gte("log_date", weekStart)
            .order("log_date", { ascending: true }),
          supabase
            .from("protocol_assignments")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        const checkins = (checkinResponse?.checkins || []) as CheckinRow[]
        const currentWeek = checkins.filter(row => row.data >= weekStart)
        const previousWeek = checkins.filter(row => row.data >= previousStart && row.data < weekStart)
        const logs = logsResult.data || []

        let missionsCompleted = 0
        if (assignmentResult.data?.id) {
          const { count } = await supabase
            .from("protocol_progress")
            .select("id", { count: "exact", head: true })
            .eq("assignment_id", assignmentResult.data.id)
            .gte("checkin_date", weekStart)
          missionsCompleted = count || 0
        }

        const activeDates = new Set<string>()
        logs.forEach(log => {
          if (log.water_check || (log.water_ml || 0) > 0 || log.meal_plan_check || log.workout_check) activeDates.add(log.log_date)
        })
        currentWeek.forEach(row => activeDates.add(row.data))

        const trends = [
          buildTrend("Energia", currentWeek.map(r => r.nivel_energia), previousWeek.map(r => r.nivel_energia), false),
          buildTrend("Inchaço", currentWeek.map(r => r.nivel_inchaco), previousWeek.map(r => r.nivel_inchaco), true),
          buildTrend("Sono", currentWeek.map(r => r.qualidade_sono), previousWeek.map(r => r.qualidade_sono), false),
          buildTrend("Ansiedade", currentWeek.map(r => r.nivel_ansiedade), previousWeek.map(r => r.nivel_ansiedade), true),
          buildTrend("Compulsão", currentWeek.map(r => r.nivel_compulsao), previousWeek.map(r => r.nivel_compulsao), true),
        ].filter((trend): trend is Trend => !!trend)

        setData({
          checkinsThisWeek: currentWeek.length,
          hydrationDays: logs.filter(log => !!log.water_check).length,
          activeDays: Math.min(7, activeDates.size),
          missionsCompleted,
          trends: trends.slice(0, 3),
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const hasEnoughTrendData = (data?.trends.length || 0) > 0
  const consistency = useMemo(() => data ? Math.round((data.activeDays / 7) * 100) : 0, [data])

  if (loading) {
    return (
      <section className="bg-background text-[#2B1A10]">
        <div className="max-w-[460px] mx-auto px-4 pb-5">
          <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm flex items-center justify-center min-h-32">
            <Loader2 size={20} className="animate-spin text-[#C9A435]" />
          </div>
        </div>
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="bg-background text-[#2B1A10]">
      <div className="max-w-[460px] mx-auto px-4 pb-28">
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Últimos 7 dias</p>
          <h2 className="font-serif text-xl font-semibold mt-0.5">Sua evolução</h2>
        </div>

        <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold">Consistência da semana</p>
              <p className="text-xs text-[#2B1A10]/45 mt-0.5">{data.activeDays} de 7 dias com algum registro</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center text-[#9B7A16] font-bold text-sm">
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
              <p className="text-lg font-bold">{data.hydrationDays}/7</p>
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

            {hasEnoughTrendData ? (
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
                <p className="text-xs text-[#2B1A10]/55 leading-relaxed">Continue fazendo seus check-ins. Quando houver dados suficientes de duas semanas, mostramos tendências reais de energia, inchaço, sono e outros sintomas.</p>
              </div>
            )}
          </div>

          <Link href="/patient/progresso" className="mt-4 w-full rounded-2xl border border-[#2B1A10]/10 py-3 text-xs font-bold flex items-center justify-center hover:bg-[#F4EFE4]/50 transition">
            Ver evolução completa
          </Link>
        </div>
      </div>
    </section>
  )
}
