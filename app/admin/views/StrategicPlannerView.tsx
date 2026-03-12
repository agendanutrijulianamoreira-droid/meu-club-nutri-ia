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
    X,
    Sparkles,
    Trash2,
    Loader2,
    Apple,
    Video,
    Image,
    Copy,
    Star,
    Repeat
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useScheduledEvents, type ScheduledEvent, type CreateEventData } from "@/lib/hooks/useScheduledEvents"
import { useContentTemplates, type ContentTemplate } from "@/lib/hooks/useContentTemplates"

export function StrategicPlannerView({ setView }: { setView: (v: any) => void }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<number | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [modalType, setModalType] = useState<'push' | 'content'>('push')
    const [saving, setSaving] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null)

    // Hooks para dados reais
    const {
        events,
        loading,
        createEvent,
        createEvents,
        updateEvent,
        updateRecurringEvents,
        deleteEvent: removeEvent,
        deleteRecurringEvents,
        duplicateEvent
    } = useScheduledEvents(currentMonth.getMonth(), currentMonth.getFullYear())

    const { templates, popular, useTemplate: applyTemplate } = useContentTemplates()

    const [formData, setFormData] = useState({
        title: "",
        message: "",
        time: "09:00",
        contentType: "diet" as any,
        recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom',
        recurrenceDays: [] as number[], // 0-6 (Dom-Sab)
        repeatUntil: "" as string // YYYY-MM-DD
    })

    // Strategy context from setup
    const [strategy, setStrategy] = useState({
        name: "Protocolo Folia: Energia & Hidratação",
        description: "Foco total em retenção de líquidos e energia rápida para o pré-carnaval.",
        suggestedPush: "Faltam 5 dias para a folia! Já garantiu seu shot de imunidade hoje? 💉"
    })
    const [isGeneratingPush, setIsGeneratingPush] = useState(false)

    const refreshAISuggestion = async () => {
        setIsGeneratingPush(true)
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'marketing-suggestion',
                    context: `Estratégia: ${strategy.name}. Objetivo: ${strategy.description}`,
                    prompt: `Gere uma notificação push curta e impactante para as pacientes seguirem a estratégia do mês.`
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            
            setStrategy(prev => ({ 
                ...prev, 
                suggestedPush: data.message 
            }))
        } catch (err: any) {
            console.error("Erro AI Push:", err)
        } finally {
            setIsGeneratingPush(false)
        }
    }

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Octubro", "Novembro", "Dezembro"
    ]

    const [showDatePicker, setShowDatePicker] = useState(false)

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    }

    const handleDayClick = (day: number) => {
        setSelectedDate(day)
        setSelectedEvent(null)
        setFormData({ title: "", message: "", time: "09:00", contentType: "diet", recurrence: 'none', recurrenceDays: [], repeatUntil: "" })
        setModalType('push')
        setShowModal(true)
        setShowTemplates(false)
    }

    const handleEventClick = (event: ScheduledEvent, e: React.MouseEvent) => {
        e.stopPropagation()
        const eventDate = new Date(event.scheduled_date)
        setSelectedDate(eventDate.getDate())
        setSelectedEvent(event)
        setFormData({
            title: event.title,
            message: event.message || "",
            time: event.scheduled_time,
            contentType: event.content_type || "diet",
            recurrence: 'none',
            recurrenceDays: [],
            repeatUntil: ""
        })
        setModalType(event.event_type === 'push' ? 'push' : 'content')
        setShowModal(true)
        setShowTemplates(false)
    }

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    // Converter eventos do banco para eventos do dia (agrupados por dia)
    // Usamos split('-') para evitar problemas de fuso horário do JS
    const getEventsForDay = (day: number) => {
        return events.filter(e => {
            const dateParts = e.scheduled_date.split('-')
            const eventDay = parseInt(dateParts[2])
            const eventMonth = parseInt(dateParts[1]) - 1
            const eventYear = parseInt(dateParts[0])

            return eventDay === day &&
                eventMonth === currentMonth.getMonth() &&
                eventYear === currentMonth.getFullYear()
        })
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

        try {
            // Criar data local segura (YYYY-MM-DD)
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`

            const eventData: CreateEventData = {
                scheduled_date: dateStr,
                scheduled_time: formData.time,
                event_type: modalType,
                title: formData.title,
                message: formData.message || undefined,
                content_type: modalType === 'content' ? formData.contentType : undefined
            }

            if (selectedEvent) {
                // Atualizar evento existente
                const isRecurring = !!selectedEvent.recurrence_id
                let updateAll = false

                if (isRecurring) {
                    const choice = confirm('Esta notificação faz parte de uma SÉRIE (repetição).\n\nOK: Aplicar alterações em TODA A SÉRIE?\nCancelar: Aplicar APENAS NESTA data?')
                    if (choice) updateAll = true
                }

                if (updateAll && selectedEvent.recurrence_id) {
                    // Remover a data para não sobrescrever todas as datas da série com o mesmo dia
                    const { scheduled_date: _, ...bulkUpdateData } = eventData
                    await updateRecurringEvents(selectedEvent.recurrence_id, bulkUpdateData)
                } else {
                    await updateEvent(selectedEvent.id, eventData)
                }
            } else if (formData.recurrence !== 'none') {
                // CRIAR RECORRÊNCIA AVANÇADA (BULK)
                const eventsToCreate: CreateEventData[] = [eventData]

                // Definir limite de repetição (Parse local para evitar timezone jumps)
                let limitDate: Date | null = null
                if (formData.repeatUntil) {
                    const [y, m, d] = formData.repeatUntil.split('-').map(Number)
                    limitDate = new Date(y, m - 1, d, 23, 59, 59)
                }

                let nextDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDate)

                // MÁXIMO DE SEGURANÇA para evitar loop infinito caso o usuário coloque uma data muito distante (ex: ano 3000)
                const safetyLimit = 500
                let createdCount = 0

                while (createdCount < safetyLimit) {
                    nextDay.setDate(nextDay.getDate() + 1)

                    if (limitDate && nextDay > limitDate) break
                    // Se não tiver data limite, o padrão antigo era até o fim do mês. 
                    // Agora, se o usuário NÃO preencher, manteremos o limite de 60 dias para não sobrecarregar.
                    if (!limitDate && createdCount >= 60) break

                    const dayOfWeek = nextDay.getDay()
                    let shouldCreate = false

                    if (formData.recurrence === 'daily') {
                        shouldCreate = true
                    } else if (formData.recurrence === 'weekly') {
                        // Agora 'weekly' usa os dias selecionados (ou o dia original)
                        shouldCreate = formData.recurrenceDays.includes(dayOfWeek)
                    } else if (formData.recurrence === 'weekdays') {
                        shouldCreate = dayOfWeek !== 0 && dayOfWeek !== 6
                    } else if (formData.recurrence === 'monthly') {
                        shouldCreate = nextDay.getDate() === selectedDate
                    }

                    if (shouldCreate) {
                        const nextDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
                        eventsToCreate.push({
                            ...eventData,
                            scheduled_date: nextDateStr
                        })
                    }
                    createdCount++
                }

                // Usar o novo hook de criação em massa
                await createEvents(eventsToCreate)
            } else {
                // Criar apenas um evento (padrão)
                await createEvent(eventData)
            }

            setShowModal(false)
            setSelectedEvent(null)
        } catch (error: any) {
            console.error('Error saving event:', error)
            let msg = error?.message || 'Erro ao salvar evento'

            // Dica amigável se a coluna recurrence_id estiver faltando
            if (msg.includes('recurrence_id') || error?.code === '42703') {
                msg = "O banco de dados precisa ser atualizado para suportar eventos repetidos. Por favor, execute o script 'supabase/add_recurrence_id.sql' no seu painel do Supabase."
            }

            alert(`❌ ${msg}`)
        } finally {
            setSaving(false)
        }
    }

    // Handlers para Drag & Drop
    const handleDragStart = (e: React.DragEvent, eventId: string) => {
        e.dataTransfer.setData('eventId', eventId)
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = async (e: React.DragEvent, day: number) => {
        e.preventDefault()
        const eventId = e.dataTransfer.getData('eventId')
        if (!eventId) return

        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        try {
            await updateEvent(eventId, { scheduled_date: dateStr })
        } catch (error: any) {
            console.error('Error dropping event:', error)
            alert('Erro ao mover evento: ' + error.message)
        }
    }

    const handleDeleteEvent = async (deleteAllInSeries = false) => {
        if (!selectedEvent) return

        const isRecurring = !!selectedEvent.recurrence_id

        if (isRecurring && !deleteAllInSeries) {
            // Se for recorrente e ainda não escolheu, confirmar (ou já foi clicado em 'apenas este')
            if (!confirm('Deseja deletar APENAS este evento?')) return
        } else if (!isRecurring) {
            if (!confirm('Tem certeza que deseja deletar este evento?')) return
        }

        try {
            if (deleteAllInSeries && selectedEvent.recurrence_id) {
                await deleteRecurringEvents(selectedEvent.recurrence_id)
            } else {
                await removeEvent(selectedEvent.id)
            }
            setShowModal(false)
            setSelectedEvent(null)
        } catch (error) {
            console.error('Error deleting event:', error)
            alert('Erro ao deletar evento. Tente novamente.')
        }
    }

    const handleDuplicateEvent = async () => {
        if (!selectedEvent) return

        const newDate = prompt('Digite a nova data (DD):', String(selectedDate))
        if (!newDate) return

        const day = parseInt(newDate)
        if (isNaN(day) || day < 1 || day > getDaysInMonth(currentMonth)) {
            alert('Data inválida!')
            return
        }

        try {
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            await duplicateEvent(selectedEvent.id, dateStr)
            setShowModal(false)
        } catch (error) {
            console.error('Error duplicating event:', error)
            alert('Erro ao duplicar evento. Tente novamente.')
        }
    }

    const handleUseTemplate = async (template: ContentTemplate) => {
        try {
            // Se não houver data selecionada (ex: vindo da barra lateral), bota pra hoje
            if (!selectedDate) {
                setSelectedDate(new Date().getDate())
            }

            const templateData = await applyTemplate(template.id)
            setFormData({
                title: templateData.title,
                message: templateData.message,
                time: templateData.scheduled_time,
                contentType: templateData.content_type || 'diet',
                recurrence: 'none',
                recurrenceDays: [],
                repeatUntil: ""
            })
            setModalType(templateData.event_type as any)
            setShowTemplates(false)
            setShowModal(true)
        } catch (error: any) {
            console.error('Error using template:', error)
            alert(`Erro ao carregar template: ${error.message || 'Tente novamente.'}`)
        }
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

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-purple-400" size={40} />
                    </div>
                )}

                {!loading && (
                    <>
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
                                        whileHover={{ scale: 1.01 }}
                                        onClick={() => handleDayClick(day)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, day)}
                                        className={`min-h-[120px] glass-panel rounded-xl p-2 cursor-pointer transition-all group relative ${isToday ? 'ring-2 ring-purple-500 bg-purple-500/5' : 'hover:border-purple-500/30'
                                            }`}
                                    >
                                        {/* Day Number */}
                                        <div className="flex justify-between items-start mb-2 text-gray-400 group-hover:text-gray-200">
                                            <span className={`text-sm font-bold ${isToday ? 'text-purple-400 font-black scale-110' :
                                                dayEvents.length > 0 ? 'text-white' : 'text-gray-500'
                                                }`}>
                                                {day}
                                            </span>

                                            {/* Add Button (on hover) */}
                                            <button
                                                className="opacity-0 group-hover:opacity-100 bg-purple-600/50 hover:bg-purple-600 text-white p-1 rounded-md transition-all hover:scale-110"
                                                onClick={(e) => { e.stopPropagation(); handleDayClick(day) }}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        {/* Event Pills */}
                                        <div className="space-y-1">
                                            {dayEvents.slice(0, 4).map((evt) => (
                                                <div
                                                    key={evt.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, evt.id)}
                                                    onClick={(e) => handleEventClick(evt, e)}
                                                    className={`text-[9px] px-2 py-1 rounded border truncate font-medium flex items-center gap-1 cursor-grab active:cursor-grabbing transition-transform hover:translate-x-1 ${getEventStyle(evt.event_type)}`}
                                                >
                                                    {getEventIcon(evt.event_type)}
                                                    <span className="truncate">{evt.title}</span>
                                                </div>
                                            ))}
                                            {dayEvents.length > 4 && (
                                                <div className="text-[9px] text-gray-500 pl-1 font-bold">
                                                    +{dayEvents.length - 4} mais
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </>
                )}
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
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm">
                            <Sparkles size={16} />
                            Sugestão de Push (IA)
                        </div>
                        <button 
                            onClick={refreshAISuggestion}
                            disabled={isGeneratingPush}
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            <Repeat size={12} className={isGeneratingPush ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <p className="text-sm italic text-gray-300 leading-relaxed">
                        {isGeneratingPush ? "Gerando estratégia..." : `"${strategy.suggestedPush}"`}
                    </p>
                    <Button
                        onClick={useSuggestedPush}
                        className="mt-3 w-full bg-yellow-600/20 text-yellow-400 text-xs font-bold hover:bg-yellow-600/30"
                    >
                        <Bell size={14} className="mr-2" />
                        Usar este Push
                    </Button>
                </div>

                {/* Templates Rápidos */}
                <div className="glass-panel p-4 rounded-xl border border-purple-500/20 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-purple-400 uppercase">Templates Rápidos</span>
                        <Star size={14} className="text-purple-400" />
                    </div>
                    <div className="space-y-2">
                        {popular.slice(0, 3).map((template) => (
                            <button
                                key={template.id}
                                onClick={() => {
                                    setShowTemplates(true)
                                    setShowModal(false)
                                }}
                                className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs"
                            >
                                <span className="mr-1">{template.emoji}</span>
                                {template.name}
                            </button>
                        ))}
                    </div>
                    <Button
                        onClick={() => {
                            setShowTemplates(true)
                            setSelectedDate(new Date().getDate())
                        }}
                        variant="ghost"
                        className="w-full mt-2 text-xs"
                    >
                        Ver Todos
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
                                {events.filter(e => e.event_type === 'push').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                Conteúdos
                            </span>
                            <span className="font-bold text-purple-400">
                                {events.filter(e => e.event_type === 'content').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Desafios
                            </span>
                            <span className="font-bold text-green-400">
                                {events.filter(e => e.event_type === 'challenge').length}
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

            {/* ===== TEMPLATES MODAL ===== */}
            <AnimatePresence>
                {showTemplates && (
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
                            className="bg-[#1a1a2e] border border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
                        >
                            {/* Header */}
                            <div className="bg-white/[0.02] p-6 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Star className="text-purple-400" />
                                        Templates Rápidos
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">Escolha um template para começar rapidamente</p>
                                </div>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-lg transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Templates Grid */}
                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-3">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleUseTemplate(template)}
                                            className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition group"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-2xl">{template.emoji}</span>
                                                <span className="text-xs text-gray-500">Usado {template.usage_count}x</span>
                                            </div>
                                            <h4 className="font-bold text-white mb-1">{template.name}</h4>
                                            <p className="text-xs text-gray-400 line-clamp-2">{template.title}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                {template.event_type === 'push' && <Bell size={12} className="text-yellow-400" />}
                                                {template.event_type === 'content' && <FileText size={12} className="text-purple-400" />}
                                                {template.event_type === 'challenge' && <Trophy size={12} className="text-green-400" />}
                                                <span className="text-xs text-gray-500">{template.event_type}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                        {selectedEvent ? 'Editar Evento' : `Agendar para Dia ${selectedDate}`}
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {selectedEvent ? 'Faça as alterações necessárias' : 'O que vai acontecer neste dia?'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedEvent && (
                                        <>
                                            <button
                                                onClick={handleDuplicateEvent}
                                                className="text-purple-400 hover:text-purple-300 p-2 hover:bg-white/5 rounded-lg transition"
                                                title="Duplicar evento"
                                            >
                                                <Copy size={18} />
                                            </button>

                                            {/* Delete Options for Recurring Events */}
                                            {selectedEvent?.recurrence_id ? (
                                                <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10 ring-1 ring-red-500/20">
                                                    <button
                                                        onClick={() => handleDeleteEvent(false)}
                                                        className="px-3 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500/10 transition border-r border-white/10"
                                                        title="Deletar apenas este"
                                                    >
                                                        ESTE
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEvent(true)}
                                                        className="px-3 py-2 text-[10px] font-bold text-white bg-red-600/20 hover:bg-red-600/40 transition flex items-center gap-1"
                                                        title="Deletar toda a série"
                                                    >
                                                        <Trash2 size={12} className="text-red-500" />
                                                        SÉRIE
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDeleteEvent()}
                                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-white/5 rounded-lg transition border border-white/10"
                                                    title="Deletar evento"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-lg transition"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
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

                                    {/* Date, Time and Recurrence */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Data
                                            </label>
                                            <button
                                                onClick={() => setShowDatePicker(!showDatePicker)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-10 text-[13px] text-white flex items-center gap-2 hover:border-purple-500 transition-all text-left"
                                            >
                                                <Calendar className="absolute left-3 text-gray-500" size={14} />
                                                <span>Dia {selectedDate}</span>
                                            </button>

                                            {/* Mini Calendar Popover */}
                                            {showDatePicker && (
                                                <div className="absolute left-0 top-full mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-4 z-[100] w-[280px]">
                                                    <div className="grid grid-cols-7 gap-1">
                                                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                                                            <div key={d} className="text-center text-[10px] text-gray-600 font-bold py-1">{d}</div>
                                                        ))}
                                                        {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
                                                            <div key={`empty-${i}`} />
                                                        ))}
                                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                                            const d = i + 1
                                                            const isSelected = selectedDate === d
                                                            return (
                                                                <button
                                                                    key={d}
                                                                    onClick={() => {
                                                                        setSelectedDate(d)
                                                                        setShowDatePicker(false)
                                                                    }}
                                                                    className={`w-8 h-8 rounded-lg text-xs transition-all ${isSelected
                                                                        ? 'bg-purple-600 text-white font-bold'
                                                                        : 'text-gray-400 hover:bg-white/5'
                                                                        }`}
                                                                >
                                                                    {d}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Horário
                                            </label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                                <input
                                                    type="time"
                                                    value={formData.time}
                                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-9 text-[13px] text-white focus:border-purple-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Repetir
                                            </label>
                                            <div className="relative">
                                                <Repeat className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                                <select
                                                    value={formData.recurrence || 'none'}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value as any;
                                                        let newDays = formData.recurrenceDays;

                                                        // Se selecionar semanal e não tiver dias marcados, marcar o dia atual
                                                        if (newVal === 'weekly' && newDays.length === 0 && selectedDate !== null) {
                                                            const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDate);
                                                            newDays = [dateObj.getDay()];
                                                        }

                                                        setFormData({ ...formData, recurrence: newVal, recurrenceDays: newDays });
                                                    }}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-9 text-[13px] text-white focus:border-purple-500 outline-none appearance-none"
                                                >
                                                    <option value="none">Não repetir</option>
                                                    <option value="daily">Todo dia</option>
                                                    <option value="weekly">Semanal...</option>
                                                    <option value="weekdays">Seg-Sex</option>
                                                    <option value="monthly">Mensal</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Repeat Until / End Date */}
                                    {formData.recurrence !== 'none' && (
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                                Repetir até:
                                            </label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                                <input
                                                    type="date"
                                                    value={formData.repeatUntil}
                                                    onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-9 text-[13px] text-white focus:border-purple-500 outline-none"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-2 italic">
                                                * Caso vazio, repetirá até o final do mês atual.
                                            </p>
                                        </div>
                                    )}


                                    {/* Custom Days Selector (Visible for Weekly) */}
                                    {formData.recurrence === 'weekly' && (
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <label className="block text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider text-center">
                                                Repetir nestes dias da semana:
                                            </label>
                                            <div className="flex justify-between gap-1">
                                                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => {
                                                    const isSelected = formData.recurrenceDays.includes(i)
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const newDays = isSelected
                                                                    ? formData.recurrenceDays.filter(d => d !== i)
                                                                    : [...formData.recurrenceDays, i]
                                                                setFormData({ ...formData, recurrenceDays: newDays })
                                                            }}
                                                            className={`w-9 h-9 rounded-full text-xs font-bold transition-all border ${isSelected
                                                                ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                                                : 'bg-black/40 border-white/10 text-gray-500 hover:border-gray-500'
                                                                }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

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
                                    {saving ? 'Salvando...' : selectedEvent ? 'Salvar Alterações' : 'Agendar Liberação'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
