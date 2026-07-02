"use client"

import { useEffect, useState } from "react"
import { Flame, ShieldCheck, Loader2 } from "lucide-react"

interface StreakDay {
  date: string
  completed: boolean
  usedGrace: boolean
}

interface StreakData {
  currentStreak: number
  longestStreak: number
  timeline: StreakDay[]
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const CALENDAR_DAYS = 35

export function StreakCalendar() {
  const [data, setData] = useState<StreakData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patient/streak?days=${CALENDAR_DAYS}`)
      .then(res => res.ok ? res.json() : null)
      .then((result: StreakData | null) => { if (!cancelled) setData(result) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-orange-400" />
      </div>
    )
  }

  // Preenche células vazias até o dia da semana do primeiro dia da timeline
  const firstWeekday = data.timeline.length > 0 ? new Date(data.timeline[0].date + 'T00:00:00').getDay() : 0
  const cells: (StreakDay | null)[] = [...Array(firstWeekday).fill(null), ...data.timeline]

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[10px] font-black text-slate-600 uppercase">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dayNum = new Date(day.date + 'T12:00:00').getDate()
          const isToday = day.date === new Date().toISOString().split('T')[0]
          return (
            <div
              key={day.date}
              className={`aspect-square rounded-lg flex items-center justify-center border text-[11px] font-bold relative ${
                day.completed
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : isToday
                  ? 'bg-white/10 border-indigo-500/40 text-white'
                  : 'bg-white/[0.02] border-white/5 text-slate-600'
              }`}
            >
              {day.usedGrace ? <ShieldCheck size={12} className="text-amber-400" /> : dayNum}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-4 py-2.5">
        <Flame size={14} className="text-orange-400" />
        <span className="text-orange-300 text-xs font-bold">Sequência de {data.currentStreak} dias</span>
        <span className="text-slate-600 text-[10px] ml-auto">Recorde: {data.longestStreak}</span>
      </div>
    </div>
  )
}
