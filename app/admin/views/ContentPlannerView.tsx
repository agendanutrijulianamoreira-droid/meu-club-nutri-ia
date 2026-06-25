"use client"

import { useState, useEffect } from "react"
import { List, Trophy, ChevronLeft, ChevronRight, Download, Sparkles, CalendarDays } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { ANNUAL_TEMPLATES, AnnualTemplateItem } from "@/lib/templates/annual-plans"
import { supabase } from "@/lib/supabase"

export function ContentPlannerView() {
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedMonth, setSelectedMonth] = useState<AnnualTemplateItem | null>(null)
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

    // Pegamos o template de emagrecimento como padrão
    const templates = ANNUAL_TEMPLATES.emagrecimento

    useEffect(() => {
        const monthIndex = currentDate.getMonth()
        const monthData = templates.find(t => t.month_index === monthIndex)
        setSelectedMonth(monthData || null)
    }, [currentDate])

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))
    }

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold font-outfit">Planejador Estratégico</h1>
                        <span className="text-3xl">📅</span>
                    </div>
                    <p className="text-gray-400 mt-1">Sua régua anual de conteúdo e vendas.</p>
                </div>

                <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 self-start">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <CalendarDays size={18} />
                        <span className="text-sm font-bold">Calendário</span>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <List size={18} />
                        <span className="text-sm font-bold">Lista Anual</span>
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {viewMode === 'calendar' ? (
                    <motion.div
                        key="calendar"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                        {/* Calendar Grid */}
                        <div className="lg:col-span-2 bg-white/[0.03] p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold capitalize">
                                    {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(currentDate)}
                                    <span className="text-gray-500 font-medium ml-2">{currentDate.getFullYear()}</span>
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded-lg border border-white/10 transition-colors">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded-lg border border-white/10 transition-colors">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-bold text-gray-500 tracking-widest py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className="aspect-square rounded-2xl bg-white/[0.02] border border-white/[0.03] p-2 flex flex-col justify-between group hover:border-indigo-500/30 hover:bg-indigo-500/[0.02] transition-all cursor-pointer">
                                        <span className="text-xs font-bold text-gray-700 group-hover:text-white transition-colors">{i + 1 > 31 ? '' : i + 1}</span>
                                        {i === 4 && (
                                            <div className="bg-white/10 backdrop-blur-md text-white text-[9px] font-bold px-2 py-1 rounded-lg border border-white/20 truncate shadow-xl">
                                                INÍCIO: {selectedMonth?.title.split(' ')[0]}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Month Info Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white/[0.03] p-8 rounded-[32px] border border-white/10 space-y-8 h-full flex flex-col shadow-2xl">
                                <div className="space-y-6 flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Estratégia do Mês</span>
                                        <button className="text-[10px] font-bold text-gray-400 hover:text-indigo-400 transition-colors uppercase border-b border-transparent hover:border-indigo-400">Editar</button>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-bold font-outfit leading-tight">{selectedMonth?.title}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                            {selectedMonth?.description}
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5 space-y-3">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Gancho de Marketing</span>
                                            <p className="text-sm font-bold text-white leading-relaxed">
                                                "{selectedMonth?.marketing_hook}"
                                            </p>
                                        </div>

                                        <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5 space-y-3">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Foco no Hábito</span>
                                            <div className="flex items-center gap-3">
                                                <Trophy size={20} className="text-indigo-400" />
                                                <p className="text-base font-bold text-white tracking-tight">
                                                    {selectedMonth?.habit_focus}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-[0.15em] text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                                    <Download size={16}/> Exportar Calendário
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {templates.map((month) => (
                            <div key={month.month_index} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/[0.02] transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full">
                                {month.month_index === new Date().getMonth() && (
                                    <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/20 uppercase tracking-widest">
                                        ATUAL
                                    </div>
                                )}
                                <div className="space-y-6 flex-1">
                                    <span className="text-[11px] uppercase font-bold tracking-[0.2em] text-gray-500 group-hover:text-indigo-400 transition-colors">
                                        {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month.month_index, 1))}
                                    </span>
                                    <div className="space-y-3">
                                        <h3 className="text-xl font-bold group-hover:text-white transition-colors leading-tight">{month.title}</h3>
                                        <div className="flex gap-2">
                                            <Sparkles size={14} className="text-gray-600 shrink-0 mt-1 group-hover:text-queen-pink" />
                                            <p className="text-sm italic text-gray-400 group-hover:text-gray-300 transition-colors line-clamp-2 leading-relaxed">
                                                {month.marketing_hook}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-xs font-bold text-gray-500 group-hover:text-gray-300">
                                        <Trophy size={16} className="text-indigo-400/40 group-hover:text-indigo-400" />
                                        {month.habit_focus}
                                    </div>
                                    <ChevronRight size={18} className="text-gray-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
