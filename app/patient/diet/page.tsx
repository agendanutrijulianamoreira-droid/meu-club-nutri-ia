"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, ChevronDown, ChevronUp, CheckCircle, Circle, Loader2 } from "lucide-react"
import { useAssignments } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase-browser"

export default function PatientDietPage() {
    const [userId, setUserId] = useState<string | null>(null)
    const [expandedDay, setExpandedDay] = useState(1)

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setUserId(user.id)
        }
        loadUser()
    }, [])

    const { assignments, loading } = useAssignments(userId || undefined)
    const activeProtocol = assignments?.[0]

    // Mapear dias do protocolo real
    const protocolDays = (activeProtocol?.protocol as any)?.days?.sort((a: any, b: any) => a.day_number - b.day_number).map((d: any) => ({
        day: d.day_number,
        title: d.title || `Dia ${d.day_number}`,
        items: d.items?.sort((a: any, b: any) => a.time.localeCompare(b.time)).map((i: any) => ({
            time: i.time,
            type: i.item_type,
            title: i.title,
            description: i.description,
            completed: false // TODO: Conectar com protocol_progress
        })) || []
    })) || []

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <div className="text-slate-400 text-sm">Carregando seu protocolo...</div>
            </div>
        )
    }

    if (!activeProtocol) {
        return (
            <div className="min-h-screen px-4 pt-6 pb-24 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Circle className="text-slate-600" size={40} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Nenhum Protocolo Ativo</h2>
                <p className="text-slate-400 text-sm max-w-sm">
                    Sua nutricionista ainda não atribuiu um plano alimentar para você. Entre em contato com ela!
                </p>
            </div>
        )
    }

    return (
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-6">
                <div className="inline-block bg-indigo-600/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Protocolo Ativo</span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                    {activeProtocol.protocol?.title || "Meu Protocolo"}
                </h1>
                <p className="text-slate-400 text-sm">
                    {activeProtocol.protocol?.description || "Seu plano nutricional personalizado"}
                </p>

                {/* Progress Bar */}
                <div className="mt-4 p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progresso Geral</span>
                        <span className="text-sm font-bold text-white">{activeProtocol.progress_percentage || 0}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${activeProtocol.progress_percentage || 0}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Days Accordion */}
            <div className="space-y-3">
                {protocolDays.map((day: any) => {
                    const isExpanded = expandedDay === day.day
                    const completedItems = day.items.filter((i: any) => i.completed).length
                    const totalItems = day.items.length
                    const dayProgress = (completedItems / totalItems) * 100

                    return (
                        <motion.div
                            key={day.day}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                        >
                            {/* Day Header */}
                            <button
                                onClick={() => setExpandedDay(isExpanded ? 0 : day.day)}
                                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center">
                                        <span className="text-sm font-bold text-indigo-400">{day.day}</span>
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white text-sm">{day.title}</h3>
                                        <p className="text-xs text-slate-500">{completedItems}/{totalItems} completos</p>
                                    </div>
                                </div>
                                {isExpanded ? (
                                    <ChevronUp className="text-slate-400" size={20} />
                                ) : (
                                    <ChevronDown className="text-slate-400" size={20} />
                                )}
                            </button>

                            {/* Mini Progress Bar */}
                            <div className="h-1 bg-white/10">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${dayProgress}%` }}
                                />
                            </div>

                            {/* Day Items */}
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="p-4 space-y-3 border-t border-white/5"
                                >
                                    {day.items.map((item: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-3 rounded-xl border ${item.completed
                                                ? "bg-indigo-600/5 border-indigo-500/20"
                                                : "bg-white/5 border-white/10"
                                                }`}
                                        >
                                            <div className="flex-shrink-0 pt-1">
                                                {item.completed ? (
                                                    <CheckCircle className="text-indigo-400" size={20} />
                                                ) : (
                                                    <Circle className="text-slate-600" size={20} />
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Clock className="text-slate-500" size={12} />
                                                    <span className="text-xs font-bold text-slate-500">{item.time}</span>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.type === 'shot'
                                                        ? 'bg-orange-500/20 text-orange-400'
                                                        : 'bg-green-500/20 text-green-400'
                                                        }`}>
                                                        {item.type === 'shot' ? 'SHOT' : 'REFEIÇÃO'}
                                                    </span>
                                                </div>
                                                <h4 className={`font-bold text-sm mb-1 ${item.completed ? "text-white line-through" : "text-white"
                                                    }`}>
                                                    {item.title}
                                                </h4>
                                                <p className="text-xs text-slate-400">{item.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
