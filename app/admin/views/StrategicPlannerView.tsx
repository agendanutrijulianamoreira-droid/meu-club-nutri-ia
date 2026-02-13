"use client"

import { useState, useEffect } from "react"
import {
    Calendar,
    Bell,
    FileText,
    Trophy,
    Plus,
    ChevronLeft,
    ChevronRight,
    Clock,
    Send,
    Smartphone,
    X,
    Sparkles,
    Trash2,
    Loader2,
    Droplets,
    Apple,
    Video,
    Image
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

interface ScheduledEvent {
    id: string
    day: number
    type: 'push' | 'content' | 'challenge'
    title: string
    message?: string
    time: string
    contentType?: 'diet' | 'recipe' | 'video' | 'pdf'
}

export function StrategicPlannerView({ setView }: { setView: (v: any) => void }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<number | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [modalType, setModalType] = useState<'push' | 'content'>('push')
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        title: "",
        message: "",
        time: "09:00",
        contentType: "diet"
    })

    // Events loaded from database or setup
    const [events, setEvents] = useState<ScheduledEvent[]>([
        // Mock data - would come from database
        { id: '1', day: 2, type: 'content', title: 'Liberação: Dieta Fase 1', time: '08:00', contentType: 'diet' },
        { id: '2', day: 2, type: 'push', title: 'Começou! Acesse sua dieta.', message: 'Sua nova fase está liberada no app. Clique para ver!', time: '08:05' },
        { id: '3', day: 5, type: 'challenge', title: 'Missão: Foto do Almoço', time: '12:00' },
        { id: '4', day: 10, type: 'push', title: 'Metade do caminho!', message: 'Você está indo muito bem! Continue assim 💪', time: '10:00' },
        { id: '5', day: 15, type: 'push', title: 'Bebeu água hoje?', message: 'Sua meta está quase batida. Vamos lá? 💧', time: '15:00' },
        { id: '6', day: 21, type: 'content', title: 'Receita: Shot Detox', time: '07:00', contentType: 'recipe' },
        { id: '7', day: 28, type: 'push', title: 'Parabéns! Mês concluído!', message: 'Você completou o protocolo. Confira seu progresso! 🎉', time: '18:00' },
    ])

    // Strategy context from setup
    const [strategy, setStrategy] = useState({
        name: "Protocolo Folia: Energia & Hidratação",
        description: "Foco total em retenção de líquidos e energia rápida para o pré-carnaval.",
        suggestedPush: "Faltam 5 dias para a folia! Já garantiu seu shot de imunidade hoje? 💉"
    })

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    }

    const handleDayClick = (day: number) => {
        setSelectedDate(day)
        setFormData({ title: "", message: "", time: "09:00", contentType: "diet" })
        setModalType('push')
        setShowModal(true)
    }

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const getEventsForDay = (day: number) => {
        return events.filter(e => e.day === day)
    }

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'push': return <Bell size={8} />
            case 'content': return <FileText size={8} />
            case 'challenge': return <Trophy size={8} />
            default: return <Bell size={8} />
        }
    }

    const getEventStyle = (type: string) => {
        switch (type) {
            case 'push': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            case 'content': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            case 'challenge': return 'bg-green-500/20 text-green-400 border-green-500/30'
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        }
    }

    const handleSaveEvent = async () => {
        if (!selectedDate || !formData.title) return

        setSaving(true)

        // Simulate API call
        await new Promise(r => setTimeout(r, 1000))

        const newEvent: ScheduledEvent = {
            id: `evt-${Date.now()}`,
            day: selectedDate,
            type: modalType,
            title: formData.title,
            message: formData.message,
            time: formData.time,
            contentType: formData.contentType as any
        }

        setEvents(prev => [...prev, newEvent])
        setShowModal(false)
        setSaving(false)
    }

    const deleteEvent = (eventId: string) => {
        setEvents(prev => prev.filter(e => e.id !== eventId))
    }

    const useSuggestedPush = () => {
        setFormData(prev => ({
            ...prev,
            title: "Dica do Dia",
            message: strategy.suggestedPush
        }))
        setModalType('push')
        setSelectedDate(new Date().getDate() + 1)
        setShowModal(true)
    }

    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const today = new Date().getDate()
    const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() &&
        currentMonth.getFullYear() === new Date().getFullYear()

    return (
        <div className="flex h-[calc(100vh-80px)] bg-[#0a0a16] text-white overflow-hidden">

            {/* ===== MAIN AREA (CALENDAR) ===== */}
            <div className="flex-1 p-6 overflow-y-auto">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Calendar className="text-purple-400" />
                            {monthNames[currentMonth.getMonth()]}
                            <span className="text-gray-500 font-normal">{currentMonth.getFullYear()}</span>
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Planeje conteúdos, notificações e desafios</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={handlePrevMonth} className="h-10 w-10 p-0">
                            <ChevronLeft size={20} />
                        </Button>
                        <Button variant="ghost" onClick={handleNextMonth} className="h-10 w-10 p-0">
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {/* Week Days Header */}
                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-500 py-2">{d}</div>
                    ))}

                    {/* Empty cells for offset */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[120px] bg-white/[0.01] rounded-xl" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1
                        const dayEvents = getEventsForDay(day)
                        const isToday = isCurrentMonth && day === today

                        return (
                            <motion.div
                                key={day}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => handleDayClick(day)}
                                className={`min-h-[120px] glass-panel rounded-xl p-2 cursor-pointer transition-all group relative ${isToday ? 'ring-2 ring-purple-500 bg-purple-500/5' : 'hover:border-purple-500/30'
                                    }`}
                            >
                                {/* Day Number */}
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-sm font-bold ${isToday ? 'text-purple-400' :
                                        dayEvents.length > 0 ? 'text-white' : 'text-gray-500'
                                        }`}>
                                        {day}
                                    </span>

                                    {/* Add Button (on hover) */}
                                    <button
                                        className="opacity-0 group-hover:opacity-100 bg-purple-600 text-white p-1 rounded-md transition hover:scale-110"
                                        onClick={(e) => { e.stopPropagation(); handleDayClick(day) }}
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>

                                {/* Event Pills */}
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((evt) => (
                                        <div
                                            key={evt.id}
                                            className={`text-[10px] px-2 py-1 rounded border truncate font-medium flex items-center gap-1 ${getEventStyle(evt.type)}`}
                                        >
                                            {getEventIcon(evt.type)}
                                            <span className="truncate">{evt.title}</span>
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[10px] text-gray-500 pl-1">
                                            +{dayEvents.length - 3} mais
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            {/* ===== SIDEBAR (Strategy Context) ===== */}
            <div className="w-80 bg-[#0f0f1a] border-l border-white/5 p-6 flex flex-col overflow-y-auto">

                {/* Strategy from Setup */}
                <div className="mb-8">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estratégia do Mês</span>
                    <h3 className="text-lg font-bold mt-2 text-purple-400">{strategy.name}</h3>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">{strategy.description}</p>
                </div>

                {/* AI Push Suggestion */}
                <div className="glass-panel p-4 rounded-xl border border-yellow-500/20 mb-6">
                    <div className="flex items-center gap-2 mb-2 text-yellow-400 font-bold text-sm">
                        <Sparkles size={16} />
                        Sugestão de Push (IA)
                    </div>
                    <p className="text-sm italic text-gray-300 leading-relaxed">
                        "{strategy.suggestedPush}"
                    </p>
                    <Button
                        onClick={useSuggestedPush}
                        className="mt-3 w-full bg-yellow-600/20 text-yellow-400 text-xs font-bold hover:bg-yellow-600/30"
                    >
                        <Bell size={14} className="mr-2" />
                        Usar este Push
                    </Button>
                </div>

                {/* Quick Stats */}
                <div className="glass-panel p-4 rounded-xl border border-white/5 mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Este Mês</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                Push Notifications
                            </span>
                            <span className="font-bold text-yellow-400">
                                {events.filter(e => e.type === 'push').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                Conteúdos
                            </span>
                            <span className="font-bold text-purple-400">
                                {events.filter(e => e.type === 'content').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Desafios
                            </span>
                            <span className="font-bold text-green-400">
                                {events.filter(e => e.type === 'challenge').length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-auto">
                    <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase">Legenda</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-purple-300">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <FileText size={12} />
                            Conteúdo (App)
                        </div>
                        <div className="flex items-center gap-2 text-yellow-300">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <Bell size={12} />
                            Notificação Push
                        </div>
                        <div className="flex items-center gap-2 text-green-300">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <Trophy size={12} />
                            Desafio/Missão
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== SCHEDULING MODAL ===== */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#1a1a2e] border border-white/10 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="bg-white/[0.02] p-6 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Calendar className="text-purple-400" size={20} />
                                        Agendar para Dia {selectedDate}
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">O que vai acontecer neste dia?</p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-lg transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex h-[420px]">
                                {/* Left: Form */}
                                <div className="flex-1 p-6 space-y-5 overflow-y-auto">

                                    {/* Type Selector */}
                                    <div className="flex bg-white/5 p-1 rounded-xl">
                                        <button
                                            onClick={() => setModalType('push')}
                                            className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${modalType === 'push'
                                                ? 'bg-yellow-500 text-black'
                                                : 'text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            <Bell size={16} />
                                            Notificação Push
                                        </button>
                                        <button
                                            onClick={() => setModalType('content')}
                                            className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${modalType === 'content'
                                                ? 'bg-purple-600 text-white'
                                                : 'text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            <FileText size={16} />
                                            Conteúdo no App
                                        </button>
                                    </div>

                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                            Título
                                        </label>
                                        <input
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                                            placeholder={modalType === 'push' ? "Ex: Hora de beber água!" : "Ex: Receita de Shot Matinal"}
                                        />
                                    </div>

                                    {/* Push Message */}
                                    {modalType === 'push' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Mensagem
                                            </label>
                                            <textarea
                                                value={formData.message}
                                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none h-24 resize-none"
                                                placeholder="Digite a notificação que aparecerá na tela da paciente..."
                                            />
                                        </div>
                                    )}

                                    {/* Content Type */}
                                    {modalType === 'content' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Tipo de Conteúdo
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {[
                                                    { id: 'diet', label: 'Dieta', icon: Apple },
                                                    { id: 'recipe', label: 'Receita', icon: FileText },
                                                    { id: 'video', label: 'Vídeo', icon: Video },
                                                    { id: 'pdf', label: 'PDF', icon: Image }
                                                ].map(item => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => setFormData({ ...formData, contentType: item.id })}
                                                        className={`p-4 rounded-xl border transition flex flex-col items-center gap-2 ${formData.contentType === item.id
                                                            ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                                                            : 'border-white/10 text-gray-400 hover:border-white/20'
                                                            }`}
                                                    >
                                                        <item.icon size={24} />
                                                        <span className="text-xs font-bold">{item.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Time */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                            Horário de Envio
                                        </label>
                                        <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-4">
                                            <Clock size={18} className="text-gray-500" />
                                            <input
                                                type="time"
                                                value={formData.time}
                                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                                className="bg-transparent outline-none text-white flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Preview */}
                                <div className="w-72 bg-black/20 border-l border-white/5 p-6 flex flex-col items-center justify-center">
                                    <p className="text-xs text-gray-500 mb-4 font-bold uppercase tracking-wider">
                                        Preview na Tela
                                    </p>

                                    {/* Phone Mockup */}
                                    <div className="w-full max-w-[200px] bg-black border-4 border-gray-800 rounded-[2rem] h-[360px] relative overflow-hidden shadow-2xl">
                                        {/* Wallpaper */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 to-black" />

                                        {/* Status Bar */}
                                        <div className="absolute top-2 left-4 right-4 flex justify-between text-[8px] text-white/60">
                                            <span>{formData.time}</span>
                                            <div className="flex gap-1">
                                                <span>📶</span>
                                                <span>🔋</span>
                                            </div>
                                        </div>

                                        {/* Push Notification Preview */}
                                        {modalType === 'push' && (
                                            <motion.div
                                                initial={{ y: -50, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="absolute top-10 left-2 right-2 bg-white/95 backdrop-blur text-black p-3 rounded-xl shadow-lg"
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[9px] font-bold text-gray-600 flex items-center gap-1">
                                                        <div className="w-3 h-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded" />
                                                        Reino da Nutri
                                                    </span>
                                                    <span className="text-[8px] text-gray-400">Agora</span>
                                                </div>
                                                <p className="text-xs font-bold leading-tight truncate">
                                                    {formData.title || "Título da notificação"}
                                                </p>
                                                <p className="text-[10px] text-gray-600 leading-tight mt-1 line-clamp-2">
                                                    {formData.message || "Mensagem que aparecerá aqui..."}
                                                </p>
                                            </motion.div>
                                        )}

                                        {/* Content Preview */}
                                        {modalType === 'content' && (
                                            <div className="absolute inset-0 pt-14 px-3">
                                                <h4 className="text-white font-bold text-sm mb-3">Novo Conteúdo</h4>
                                                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                                                    <div className="w-full h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg mb-2 flex items-center justify-center">
                                                        {formData.contentType === 'diet' && <Apple className="text-green-400" />}
                                                        {formData.contentType === 'recipe' && <FileText className="text-purple-400" />}
                                                        {formData.contentType === 'video' && <Video className="text-blue-400" />}
                                                        {formData.contentType === 'pdf' && <Image className="text-orange-400" />}
                                                    </div>
                                                    <p className="text-white text-xs font-bold truncate">
                                                        {formData.title || "Título do conteúdo"}
                                                    </p>
                                                    <p className="text-gray-400 text-[10px] mt-1">
                                                        Disponível às {formData.time}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Home Indicator */}
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-white/[0.02] border-t border-white/5 flex justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSaveEvent}
                                    disabled={saving || !formData.title}
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 font-bold"
                                >
                                    {saving ? (
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                    ) : (
                                        <Send size={16} className="mr-2" />
                                    )}
                                    {saving ? 'Agendando...' : 'Agendar Liberação'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
