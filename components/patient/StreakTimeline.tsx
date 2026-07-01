"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Flame, ShieldCheck, Trophy } from "lucide-react"

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

export function StreakTimeline({ userId }: { userId?: string }) {
    const [data, setData] = useState<StreakData | null>(null)
    const [showRecord, setShowRecord] = useState(false)

    useEffect(() => {
        let cancelled = false
        fetch('/api/patient/streak')
            .then(res => res.ok ? res.json() : null)
            .then((result: StreakData | null) => {
                if (cancelled || !result) return
                setData(result)

                if (userId && result.currentStreak > 0 && result.currentStreak === result.longestStreak) {
                    const key = `streak_record_seen_${userId}`
                    const lastSeen = Number(localStorage.getItem(key) ?? 0)
                    if (result.currentStreak > lastSeen) {
                        setShowRecord(true)
                        localStorage.setItem(key, String(result.currentStreak))
                        setTimeout(() => setShowRecord(false), 3500)
                    }
                }
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [userId])

    if (!data) return null

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <Flame className="text-orange-400 shrink-0" size={18} />
                <span className="font-black text-white text-lg leading-none">{data.currentStreak}</span>
                <span className="text-orange-400/70 text-xs">dias seguidos</span>
                <span className="ml-auto text-[9px] text-slate-600 uppercase font-black tracking-widest">
                    Recorde: {data.longestStreak}
                </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
                {data.timeline.map((day) => {
                    const weekday = new Date(day.date + 'T00:00:00').getDay()
                    return (
                        <div key={day.date} className="flex flex-col items-center gap-1">
                            <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                                    day.completed
                                        ? 'bg-emerald-500/20 border-emerald-500/40'
                                        : 'bg-white/5 border-white/10'
                                }`}
                            >
                                {day.usedGrace ? (
                                    <ShieldCheck size={13} className="text-amber-400" />
                                ) : day.completed ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                                )}
                            </div>
                            <span className="text-[9px] text-slate-600 font-bold">{WEEKDAY_LABELS[weekday]}</span>
                        </div>
                    )
                })}
            </div>

            <AnimatePresence>
                {showRecord && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3 py-2"
                    >
                        <Trophy size={14} className="text-amber-400 shrink-0" />
                        <span className="text-amber-400 text-xs font-bold">Novo recorde de streak!</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
