"use client"

import { Lock, Check, Star, Zap, CheckCircle2, Play } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ChallengesPage() {
    const weeks = [
        {
            title: "Semana 1: Detox Real 🌿",
            description: "Limpeza do organismo e desinflamação.",
            days: [
                { day: 1, title: "Adeus Açúcar", status: "completed" },
                { day: 2, title: "Hidratação Master", status: "completed" },
                { day: 3, title: "Jantar Leve", status: "active" },
                { day: 4, title: "Jejum de 12h", status: "locked" },
                { day: 5, title: "Sem Glúten", status: "locked" },
                { day: 6, title: "Chá Diurético", status: "locked" },
                { day: 7, title: "Dia Livre (com moderação)", status: "locked", isBoss: true },
            ]
        },
        {
            title: "Semana 2: Aceleração 🔥",
            description: "Ativando o metabolismo com trocas inteligentes.",
            locked: true,
            days: Array.from({ length: 7 }, (_, i) => ({ day: i + 8, title: "???", status: "locked" }))
        }
    ]

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Sua Jornada 🗺️</h1>
                <p className="text-sm text-gray-400">Protocolo: <span className="text-indigo-400 font-medium">Desafio 21 Dias</span></p>
            </div>

            <div className="space-y-8 relative">
                {/* Connecting Line (Absolute centered) */}
                <div className="absolute left-[27px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 to-transparent opacity-30 z-0" />

                {weeks.map((week, wIndex) => (
                    <div key={wIndex} className="relative z-10 mb-10">
                        {/* Week Header */}
                        <div className="flex items-center gap-3 mb-6 bg-black/40 backdrop-blur rounded-xl p-3 border border-white/5 mx-auto w-fit shadow-lg">
                            {week.locked ? <Lock size={16} className="text-gray-500" /> : <Zap size={16} className="text-amber-400" />}
                            <span className={cn("text-sm font-bold uppercase tracking-widest", week.locked ? "text-gray-500" : "text-white")}>
                                {week.title}
                            </span>
                        </div>

                        <div className="space-y-6">
                            {week.days.map((day, dIndex) => (
                                <div key={dIndex} className="flex items-center group">

                                    {/* Timeline Node */}
                                    <div className="relative mr-4 pl-1">
                                        <div className={cn(
                                            "h-14 w-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 relative z-10",
                                            day.status === 'completed' ? "bg-indigo-500 border-indigo-500 text-white shadow-[0_0_15px_rgba(255,20,147,0.5)]" :
                                                day.status === 'active' ? "bg-white border-indigo-500 text-indigo-400 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]" :
                                                    "bg-gray-900 border-gray-800 text-gray-600"
                                        )}>
                                            {day.status === 'completed' ? (
                                                <CheckCircle2 size={24} />
                                            ) : day.status === 'locked' ? (
                                                <Lock size={20} />
                                            ) : (
                                                <span className="font-bold text-lg">{day.day}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Card */}
                                    <div className={cn(
                                        "flex-1 p-4 rounded-2xl border transition-all duration-300",
                                        day.status === 'active' ? "bg-white/[0.03] border-indigo-500/50 translate-x-1 bg-white/5" :
                                            day.status === 'completed' ? "bg-white/5 border-white/5 opacity-80" :
                                                "bg-transparent border-transparent opacity-50"
                                    )}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn("text-sm font-bold", day.status === 'active' ? "text-white" : "text-gray-400")}>
                                                Dia {day.day}
                                            </span>
                                            {day.status === 'active' && <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded-full text-white font-bold animate-pulse">HOJE</span>}
                                        </div>

                                        <h4 className={cn("font-medium", day.status === 'locked' ? "text-gray-600" : "text-gray-200")}>
                                            {day.title}
                                        </h4>

                                        {day.status === 'active' && (
                                            <button className="mt-3 text-xs flex items-center gap-1 text-indigo-400 font-bold hover:underline">
                                                Ver Missão <Play size={10} fill="currentColor" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
