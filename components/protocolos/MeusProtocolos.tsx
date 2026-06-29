"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, CheckCircle, Circle, ChevronRight, Sparkles, Target } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"

interface ProtocolWithDays {
    id: string
    title: string
    description: string | null
    start_date: string
    end_date: string
    duration_days: number
    category: string
    days: Array<{
        day_number: number
        title: string
        items: Array<{
            id: string
            title: string
            type: string
            time?: string
            is_completed?: boolean
        }>
    }>
}

export function MeusProtocolos() {
    const [activeProtocol, setActiveProtocol] = useState<ProtocolWithDays | null>(null)
    const [currentDayNumber, setCurrentDayNumber] = useState(1)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadActiveProtocol()
    }, [])

    const loadActiveProtocol = async () => {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // Buscar protocolo ativo para hoje
        const { data: protocols, error } = await supabase
            .from('protocols')
            .select(`
                id,
                title,
                description,
                start_date,
                end_date,
                duration_days,
                category,
                scheduled_status
            `)
            .eq('scheduled_status', 'active')
            .lte('start_date', today)
            .gte('end_date', today)
            .order('start_date', { ascending: false })
            .limit(1)

        if (error || !protocols || protocols.length === 0) {
            setLoading(false)
            return
        }

        const protocol = protocols[0]

        // Calcular dia atual do protocolo
        const startDate = new Date(protocol.start_date)
        const todayDate = new Date(today)
        const daysDiff = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const currentDay = Math.min(daysDiff + 1, protocol.duration_days)
        setCurrentDayNumber(currentDay)

        // Buscar dias e itens
        const { data: days, error: daysError } = await supabase
            .from('protocol_days')
            .select(`
                id,
                day_number,
                title,
                protocol_items (
                    id,
                    title,
                    type,
                    time,
                    order_index
                )
            `)
            .eq('protocol_id', protocol.id)
            .order('day_number')

        if (!daysError && days) {
            setActiveProtocol({
                ...protocol,
                days: days.map(d => ({
                    day_number: d.day_number,
                    title: d.title,
                    items: d.protocol_items?.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)) || []
                }))
            })
        }

        setLoading(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-queen-pink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Carregando seu protocolo...</p>
                </div>
            </div>
        )
    }

    if (!activeProtocol) {
        return (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 text-center">
                <Sparkles className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Nenhum protocolo ativo</h2>
                <p className="text-gray-400">
                    Você ainda não tem um protocolo ativo para hoje.
                    Aguarde sua nutricionista liberar um protocolo para você!
                </p>
            </div>
        )
    }

    const currentDay = activeProtocol.days.find(d => d.day_number === currentDayNumber)
    const progress = Math.round((currentDayNumber / activeProtocol.duration_days) * 100)

    return (
        <div className="space-y-6">
            {/* Header do Protocolo */}
            <div className="bg-white/5 p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-indigo-600/5">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">{activeProtocol.title}</h1>
                        <p className="text-gray-400">{activeProtocol.description}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Progresso</div>
                        <div className="text-3xl font-bold text-queen-pink">{progress}%</div>
                    </div>
                </div>

                {/* Barra de progresso */}
                <div className="mt-4">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-queen-pink to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-400">
                        <span>Dia {currentDayNumber} de {activeProtocol.duration_days}</span>
                        <span>{new Date(activeProtocol.start_date).toLocaleDateString('pt-BR')} - {new Date(activeProtocol.end_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
            </div>

            {/* Navegação por dias */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {activeProtocol.days.map((day) => (
                    <button
                        key={day.day_number}
                        onClick={() => setCurrentDayNumber(day.day_number)}
                        className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${day.day_number === currentDayNumber
                            ? 'bg-queen-pink text-white'
                            : day.day_number < currentDayNumber
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10'
                            }`}
                    >
                        {day.day_number < currentDayNumber && <CheckCircle size={14} />}
                        {day.day_number === currentDayNumber && <Target size={14} />}
                        Dia {day.day_number}
                    </button>
                ))}
            </div>

            {/* Conteúdo do dia */}
            <AnimatePresence mode="wait">
                {currentDay && (
                    <motion.div
                        key={currentDayNumber}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel p-6 rounded-2xl border border-white/10"
                    >
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Calendar className="text-queen-pink" />
                            {currentDay.title}
                        </h2>

                        <div className="space-y-3">
                            {currentDay.items.length > 0 ? (
                                currentDay.items.map((item, idx) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-queen-pink/50 transition-all cursor-pointer"
                                    >
                                        <button className="w-8 h-8 rounded-full border-2 border-queen-pink/50 flex items-center justify-center hover:bg-queen-pink/20 transition-all">
                                            {item.is_completed ? (
                                                <CheckCircle className="text-queen-pink" size={20} />
                                            ) : (
                                                <Circle className="text-gray-500" size={20} />
                                            )}
                                        </button>

                                        <div className="flex-1">
                                            <div className="font-medium">{item.title}</div>
                                            {item.time && (
                                                <div className="text-sm text-gray-400 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {item.time}
                                                </div>
                                            )}
                                        </div>

                                        <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'meal' ? 'bg-green-500/20 text-green-400' :
                                            item.type === 'shot' ? 'bg-orange-500/20 text-orange-400' :
                                                item.type === 'workout' ? 'bg-blue-500/20 text-blue-400' :
                                                    item.type === 'water' ? 'bg-cyan-500/20 text-cyan-400' :
                                                        'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            {item.type === 'meal' ? '🍽️ Refeição' :
                                                item.type === 'shot' ? '☕ Shot' :
                                                    item.type === 'workout' ? '💪 Treino' :
                                                        item.type === 'water' ? '💧 Água' :
                                                            '📖 Conteúdo'}
                                        </span>

                                        <ChevronRight className="text-gray-500" size={20} />
                                    </motion.div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Nenhuma tarefa para este dia.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
