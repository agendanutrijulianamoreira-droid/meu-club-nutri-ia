"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"

interface Protocol {
    id: string
    title: string
    start_date: string | null
    end_date: string | null
    duration_days: number
    category: string
    scheduled_status: string
}

const STATUS_COLORS: Record<string, string> = {
    'draft': 'bg-gray-500',
    'scheduled': 'bg-yellow-500',
    'active': 'bg-green-500',
    'expired': 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
    'draft': '📄 Rascunho',
    'scheduled': '📅 Agendado',
    'active': '✅ Ativo',
    'expired': '⏰ Expirado',
}

export function ProtocolCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [protocols, setProtocols] = useState<Protocol[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)

    // Carregar protocolos do mês
    useEffect(() => {
        loadProtocols()
    }, [currentDate])

    const loadProtocols = async () => {
        setLoading(true)
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const { data, error } = await supabase
            .from('protocols')
            .select('id, title, start_date, end_date, duration_days, category, scheduled_status')
            .or(`start_date.gte.${startOfMonth.toISOString().split('T')[0]},end_date.gte.${startOfMonth.toISOString().split('T')[0]}`)
            .order('start_date')

        if (!error && data) {
            setProtocols(data)
        }
        setLoading(false)
    }

    // Navegar meses
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    // Gerar dias do mês
    const getDaysInMonth = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        const days: (number | null)[] = []

        // Dias vazios antes do primeiro dia
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null)
        }

        // Dias do mês
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i)
        }

        return days
    }

    // Verificar se um dia tem protocolo
    const getProtocolsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const date = new Date(dateStr)

        return protocols.filter(p => {
            if (!p.start_date) return false
            const start = new Date(p.start_date)
            const end = p.end_date ? new Date(p.end_date) : new Date(start.getTime() + (p.duration_days * 24 * 60 * 60 * 1000))
            return date >= start && date <= end
        })
    }

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const days = getDaysInMonth()
    const today = new Date()
    const isToday = (day: number) => {
        return day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear()
    }

    return (
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Calendar className="text-indigo-400" size={24} />
                    <h2 className="text-xl font-bold">Calendário de Protocolos</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={prevMonth}>
                        <ChevronLeft size={20} />
                    </Button>
                    <span className="text-lg font-semibold min-w-[180px] text-center">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </span>
                    <Button variant="ghost" size="sm" onClick={nextMonth}>
                        <ChevronRight size={20} />
                    </Button>
                </div>
            </div>

            {/* Legenda */}
            <div className="flex gap-4 mb-4 text-sm">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[key]}`} />
                        <span className="text-gray-400">{label}</span>
                    </div>
                ))}
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                    <div key={day} className="text-center text-sm text-gray-400 font-medium py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    if (day === null) {
                        return <div key={`empty-${idx}`} className="h-24" />
                    }

                    const dayProtocols = getProtocolsForDay(day)
                    const hasProtocols = dayProtocols.length > 0

                    return (
                        <motion.div
                            key={day}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                            className={`
                                h-24 p-2 rounded-lg border cursor-pointer transition-all
                                ${isToday(day)
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-white/10 hover:border-white/20'}
                                ${hasProtocols ? 'bg-white/5' : ''}
                            `}
                        >
                            <div className={`text-sm font-bold mb-1 ${isToday(day) ? 'text-indigo-400' : 'text-white'}`}>
                                {day}
                            </div>
                            <div className="space-y-1 overflow-hidden">
                                {dayProtocols.slice(0, 2).map(p => (
                                    <div
                                        key={p.id}
                                        className={`text-xs px-1.5 py-0.5 rounded truncate ${STATUS_COLORS[p.scheduled_status || 'draft']} text-white`}
                                    >
                                        {p.title}
                                    </div>
                                ))}
                                {dayProtocols.length > 2 && (
                                    <div className="text-xs text-gray-400">
                                        +{dayProtocols.length - 2} mais
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Detalhes do dia selecionado */}
            {selectedDate && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10"
                >
                    <h3 className="font-bold mb-3">
                        📅 {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    {getProtocolsForDay(selectedDate.getDate()).length > 0 ? (
                        <div className="space-y-2">
                            {getProtocolsForDay(selectedDate.getDate()).map(p => (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
                                >
                                    <div>
                                        <div className="font-medium">{p.title}</div>
                                        <div className="text-sm text-gray-400">
                                            {p.duration_days} dias • {p.category}
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs ${STATUS_COLORS[p.scheduled_status || 'draft']} text-white`}>
                                        {STATUS_LABELS[p.scheduled_status || 'draft']}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400">Nenhum protocolo agendado para este dia.</p>
                    )}
                </motion.div>
            )}
        </div>
    )
}
