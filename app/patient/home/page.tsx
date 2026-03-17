"use client"

import { motion } from "framer-motion"
import {
    Flame,
    Droplet,
    CheckCircle2,
    Circle,
    Sparkles,
    TrendingUp,
    Award,
    Clock,
    Loader2,
    Bell,
    CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePatientEngine } from "@/lib/hooks/usePatientEngine"
import Link from "next/link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

export default function PatientHomePage() {
    const router = useRouter()
    const {
        loading,
        activeProtocol,
        currentDayItems,
        progress,
        stats,
        toggleCheckin
    } = usePatientEngine()
    const [unreadCount, setUnreadCount] = useState(0)
    const [firstName, setFirstName] = useState("Rainha")
    const [cycleData, setCycleData] = useState<{
        enabled: boolean
        phase: string | null
        day: number | null
        length: number
    } | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Load profile name and cycle data
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, cycle_tracking_enabled, last_period_start, cycle_length')
                .eq('user_id', session.user.id)
                .single()

            if (profile?.name) {
                setFirstName(profile.name.split(' ')[0])
            }

            // Calculate cycle phase if tracking enabled
            if (profile?.cycle_tracking_enabled && profile?.last_period_start) {
                const lastPeriod = new Date(profile.last_period_start)
                const today = new Date()
                const diffTime = today.getTime() - lastPeriod.getTime()
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                const cycleLen = profile.cycle_length || 28
                const currentDay = (diffDays % cycleLen) + 1

                let phase = 'menstrual'
                if (currentDay <= 5) phase = 'menstrual'
                else if (currentDay <= 13) phase = 'follicular'
                else if (currentDay <= 16) phase = 'ovulatory'
                else phase = 'luteal'

                setCycleData({
                    enabled: true,
                    phase,
                    day: currentDay,
                    length: cycleLen
                })
            }

            // Load unread count
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .eq('status', 'unread')
            setUnreadCount(count || 0)
        }
        init()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="text-indigo-500 animate-spin" size={32} />
            </div>
        )
    }

    const completedCount = currentDayItems.filter(item => progress[item.id]).length
    const progressPercentage = stats.completionRate

    return (
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{firstName}</span>! 👋
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {activeProtocol ? `Dia ${stats.currentDay} de ${stats.totalDays}` : "Sua jornada de hoje"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/patient/inbox" className="relative group">
                            <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                <Bell className="text-slate-300 group-hover:text-white" size={20} />
                            </div>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-indigo-600 border-2 border-[#020617] rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full h-11">
                            <Flame className="text-orange-400" size={18} />
                            <span className="font-bold text-white">{stats.currentStreak} dias</span>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-yellow-400" size={16} />
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">XP Total</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.totalPoints}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="text-green-400" size={16} />
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Progresso</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{progressPercentage}%</p>
                    </div>
                </div>

                {/* Cycle Tracker Card */}
                {cycleData?.enabled && cycleData.phase && (
                    <CycleTrackerCard phase={cycleData.phase} day={cycleData.day!} length={cycleData.length} />
                )}
            </div>

            {/* Daily Progress Ring */}
            <div className="mb-8">
                <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white mb-1">Missões de Hoje</h2>
                            <p className="text-xs text-slate-400">{completedCount} de {currentDayItems.length} completas</p>
                        </div>
                        <div className="relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                                <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="6"
                                    fill="none"
                                />
                                <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="url(#gradient)"
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 28}`}
                                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                {completedCount}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                </div>
            </div>

            {/* Daily Items List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Missões de Hoje</h3>
                    <button className="text-xs text-indigo-400 font-bold">Ver Histórico</button>
                </div>

                {!activeProtocol ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center p-8 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-3xl border border-purple-500/20"
                    >
                        <div className="h-16 w-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="text-purple-400" size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Protocolo a caminho! 🚀</h3>
                        <p className="text-sm text-slate-400 mb-4 max-w-xs mx-auto">
                            Sua nutricionista está preparando um plano personalizado para você. Em breve ele aparecerá aqui!
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-purple-400">
                            <Loader2 size={14} className="animate-spin" />
                            Aguardando protocolo...
                        </div>
                    </motion.div>
                ) : currentDayItems.length === 0 ? (
                    <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-slate-400">Dia livre! 🎉</p>
                        <p className="text-xs text-slate-500 mt-2">Aproveite o descanso</p>
                    </div>
                ) : (
                    currentDayItems.map((item, index) => {
                        const isCompleted = progress[item.id]
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => toggleCheckin(item.id, isCompleted)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isCompleted
                                    ? "bg-indigo-600/10 border-indigo-500/30"
                                    : "bg-white/5 border-white/10 hover:border-white/20"
                                    }`}
                            >
                                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isCompleted ? "bg-indigo-600/20" : "bg-white/5"
                                    }`}>
                                    <Clock size={20} className={isCompleted ? "text-indigo-400" : "text-slate-400"} />
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.time && (
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                                {item.time}
                                            </span>
                                        )}
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.type === 'shot'
                                            ? 'bg-orange-500/20 text-orange-400'
                                            : 'bg-green-500/20 text-green-400'
                                            }`}>
                                            {item.type === 'shot' ? 'SHOT' : item.type?.toUpperCase() || 'MISSÃO'}
                                        </span>
                                    </div>
                                    <h4 className={`font-bold text-sm ${isCompleted ? "text-white line-through" : "text-white"}`}>
                                        {item.title}
                                    </h4>
                                    {item.description && (
                                        <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-0.5">+{item.points || 10} XP</p>
                                </div>

                                {isCompleted ? (
                                    <CheckCircle2 className="text-indigo-400 flex-shrink-0" size={24} />
                                ) : (
                                    <Circle className="text-slate-600 flex-shrink-0" size={24} />
                                )}
                            </motion.div>
                        )
                    })
                )}
            </div>

            {/* Current Protocol Card */}
            {activeProtocol && (
                <div className="mt-8 bg-gradient-to-br from-purple-600/10 to-pink-600/10 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                            <Award className="text-purple-400" size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-purple-400 tracking-wider">Protocolo Ativo</p>
                            <h3 className="font-bold text-white">{activeProtocol.title}</h3>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">{activeProtocol.description || "Seu plano nutricional personalizado"}</p>
                    </div>
                    <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-none mt-4">
                        Ver Todos os Dias →
                    </Button>
                </div>
            )}
        </div>
    )
}

/* ── Cycle Tracker Card ── */

const CYCLE_PHASES: Record<string, { emoji: string; label: string; tip: string; gradient: string; border: string }> = {
    menstrual: {
        emoji: "\uD83D\uDD34",
        label: "Menstrual",
        tip: "Fase de descanso. Prefira alimentos ricos em ferro e reduza treinos intensos.",
        gradient: "from-red-600/10 to-pink-600/10",
        border: "border-red-500/20"
    },
    follicular: {
        emoji: "\uD83C\uDF31",
        label: "Folicular",
        tip: "Energia em alta! Bom momento para novos hábitos e treinos mais intensos.",
        gradient: "from-green-600/10 to-emerald-600/10",
        border: "border-green-500/20"
    },
    ovulatory: {
        emoji: "\uD83C\uDF38",
        label: "Ovulat\u00f3ria",
        tip: "Pico de energia e disposi\u00e7\u00e3o. Aproveite para socializar e treinar forte!",
        gradient: "from-pink-600/10 to-rose-600/10",
        border: "border-pink-500/20"
    },
    luteal: {
        emoji: "\uD83C\uDF42",
        label: "L\u00fatea",
        tip: "O corpo pede conforto. Aumente magn\u00e9sio e evite a\u00e7\u00facar refinado.",
        gradient: "from-amber-600/10 to-orange-600/10",
        border: "border-amber-500/20"
    }
}

function CycleTrackerCard({ phase, day, length }: { phase: string; day: number; length: number }) {
    const info = CYCLE_PHASES[phase] || CYCLE_PHASES.menstrual
    const progressPct = Math.round((day / length) * 100)

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`mt-3 bg-gradient-to-br ${info.gradient} backdrop-blur-xl border ${info.border} rounded-2xl p-4`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{info.emoji}</span>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ciclo Menstrual</p>
                        <p className="text-sm font-bold text-white">Fase {info.label}</p>
                    </div>
                </div>
                <span className="text-xs font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-full">
                    Dia {day} de {length}
                </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-white/30 to-white/50"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{info.tip}</p>
        </motion.div>
    )
}
