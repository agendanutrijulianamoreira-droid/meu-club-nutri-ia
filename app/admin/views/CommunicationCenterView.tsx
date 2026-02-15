"use client"

import { useState, useEffect } from "react"
import {
    Send,
    Plus,
    Calendar,
    Bell,
    MessageSquare,
    Filter,
    Search,
    ChevronRight,
    ChevronLeft,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Copy,
    ArrowLeft,
    Trash2,
    LayoutDashboard,
    Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"

interface Campaign {
    id: string
    title: string
    body: string
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
    scheduled_for: string | null
    created_at: string
    sent_at: string | null
    channels: { push: boolean; inbox: boolean }
    segment: { type: string; days?: number }
    recipient_count?: number
    sent_count?: number
}

const CAMPAIGN_TEMPLATES = [
    {
        id: 'welcome',
        icon: <Sparkles className="text-amber-400" />,
        title: "Bem-vinda, Rainha! 👑",
        body: "Estamos muito felizes em ter você aqui. Explore seus protocolos e comece sua jornada hoje mesmo!",
        cta_label: "Ver Protocolos",
        cta_url: "/patient/home"
    },
    {
        id: 'hydration',
        icon: <Bell className="text-blue-400" />,
        title: "Hora da Água! 💧",
        body: "Já bebeu água hoje? Lembre-se que a hidratação é fundamental para o seu resultado. Vamos juntas!",
        cta_label: "Registrar Agora",
        cta_url: "/patient/logs"
    },
    {
        id: 'reengage',
        icon: <Clock className="text-rose-400" />,
        title: "Sentimos sua falta! ✨",
        body: "Você não registra seus logs há alguns dias. Que tal retomar o foco hoje? Estamos aqui com você!",
        cta_label: "Voltar ao Foco",
        cta_url: "/patient/home"
    },
    {
        id: 'goal',
        icon: <Users className="text-emerald-400" />,
        title: "Meta de Hoje batida? 🌿",
        body: "Não esqueça de registrar seu check-in diário. Cada pequeno passo conta para a sua grande transformação!",
        cta_label: "Fazer Check-in",
        cta_url: "/patient/home"
    }
]

function CustomCalendar({ selectedDate, onSelect }: { selectedDate: string, onSelect: (date: string) => void }) {
    const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
    const [isOpen, setIsOpen] = useState(false);

    const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const days = [];
    const totalDays = daysInMonth(viewDate.getMonth(), viewDate.getFullYear());
    const startDay = firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());

    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedDate === dateStr;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <button
                key={d}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(dateStr);
                    setIsOpen(false);
                }}
                className={`h-10 w-full rounded-xl text-xs font-bold transition-all relative flex items-center justify-center
                    ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'hover:bg-white/10 text-slate-400 hover:text-white'}
                `}
            >
                {d}
                {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" />}
            </button>
        );
    }

    const nextMonth = (e: any) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); }
    const prevMonth = (e: any) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); }

    const formattedDate = selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : "Selecionar data";

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-left flex items-center justify-between group hover:border-indigo-500/50 transition-all"
            >
                <div className="flex items-center gap-3">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-indigo-400 transition-colors" size={18} />
                    <span className={selectedDate ? 'text-white' : 'text-slate-500'}>{formattedDate}</span>
                </div>
                <ChevronRight size={16} className={`text-slate-600 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full mt-2 left-0 right-0 md:w-[320px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl shadow-black/50 z-[101]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-sm font-black uppercase tracking-widest text-white">
                                    {monthNames[viewDate.getMonth()]} <span className="text-slate-500">{viewDate.getFullYear()}</span>
                                </h4>
                                <div className="flex gap-2">
                                    <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft size={16} /></button>
                                    <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight size={16} /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center">
                                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                                    <div key={d} className="text-[10px] font-black text-slate-600 uppercase py-2">{d}</div>
                                ))}
                                {days}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function CommunicationCenterView({ setView }: { setView: (v: any) => void }) {
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list')
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        body: "",
        cta_label: "",
        cta_url: "",
        push: false, // Default false for MVP
        inbox: true,
        segmentType: "all",
        lowAdherenceDays: 3,
        scheduleType: "now",
        recurrenceType: "none",
        scheduledDate: "",
        scheduledTime: "",
        recurrenceDays: [] as number[], // 0 = Sunday, 1 = Monday, etc.
    })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        loadCampaigns()
    }, [])

    const loadCampaigns = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('campaigns')
                .select('*, recipient_count:campaign_recipients(count)')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Format count
            const formatted = data.map((c: any) => ({
                ...c,
                recipient_count: c.recipient_count?.[0]?.count || 0
            }))

            setCampaigns(formatted)
        } catch (err) {
            console.error("Error loading campaigns:", err)
        } finally {
            setLoading(false)
        }
    }

    const toggleDay = (day: number) => {
        const current = [...formData.recurrenceDays]
        const index = current.indexOf(day)
        if (index > -1) {
            current.splice(index, 1)
        } else {
            current.push(day)
        }
        setFormData({ ...formData, recurrenceDays: current })
    }

    const applyTemplate = (template: typeof CAMPAIGN_TEMPLATES[0]) => {
        setFormData({
            ...formData,
            title: template.title,
            body: template.body,
            cta_label: template.cta_label,
            cta_url: template.cta_url
        })
    }

    const handleCreateCampaign = async () => {
        if (!formData.title || !formData.body) {
            alert("Título e mensagem são obrigatórios")
            return
        }

        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) throw new Error("Você precisa estar logado para criar campanhas.")

            // 1. Tentar pegar o perfil vinculado
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id, role')
                .eq('user_id', session.user.id)
                .single()

            let tenantId = profile?.tenant_id

            // 2. Fallback para Master Admin/Desenvolvimento se o perfil estiver incompleto
            if (!tenantId) {
                console.warn("Perfil não encontrado ou sem tenant_id. Tentando fallback para o primeiro tenant disponível...")
                const { data: fallbackTenant } = await supabase
                    .from('tenants')
                    .select('id')
                    .limit(1)
                    .single()

                tenantId = fallbackTenant?.id
                if (!tenantId) throw new Error("Não conseguimos identificar o seu Tenant. Verifique se existe um registro na tabela 'tenants' ou se seu perfil está completo.")
            }

            const scheduledFor = formData.scheduleType === 'now'
                ? new Date().toISOString()
                : `${formData.scheduledDate}T${formData.scheduledTime}`

            const { data, error } = await supabase
                .from('campaigns')
                .insert([{
                    tenant_id: tenantId,
                    created_by: session.user.id,
                    title: formData.title,
                    body: formData.body,
                    cta_label: formData.cta_label || null,
                    cta_url: formData.cta_url || null,
                    channels: { push: formData.push, inbox: formData.inbox },
                    segment: {
                        type: formData.segmentType,
                        days: formData.segmentType === 'low_adherence' ? formData.lowAdherenceDays : undefined
                    },
                    status: 'scheduled', // Always scheduled, engine picks it up
                    scheduled_for: scheduledFor,
                    recurrence_type: formData.recurrenceType === 'none' ? 'none' : formData.recurrenceType,
                    recurrence_config: formData.recurrenceType !== 'none' ? { days: formData.recurrenceDays } : {}
                }])
                .select()
                .single()

            if (error) throw error

            setViewMode('list')
            loadCampaigns()
        } catch (err: any) {
            alert("Erro ao criar campanha: " + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const filteredCampaigns = campaigns.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === "all" || c.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'sent': return 'bg-green-500/20 text-green-400'
            case 'scheduled': return 'bg-blue-500/20 text-blue-400'
            case 'sending': return 'bg-yellow-500/20 text-yellow-400'
            case 'failed': return 'bg-red-500/20 text-red-400'
            default: return 'bg-gray-500/20 text-gray-400'
        }
    }

    if (viewMode === 'create') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" className="p-2" onClick={() => setViewMode('list')}>
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Nova Campanha</h1>
                </div>

                {/* Templates Bank */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Banco de Modelos (Seleção Rápida)</label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {CAMPAIGN_TEMPLATES.map(template => (
                            <button
                                key={template.id}
                                onClick={() => applyTemplate(template)}
                                className="glass-panel p-4 rounded-2xl border border-white/5 hover:border-indigo-500/40 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {template.id === 'welcome' && <Sparkles className="text-amber-400" size={16} />}
                                        {template.id === 'hydration' && <Bell className="text-blue-400" size={16} />}
                                        {template.id === 'reengage' && <Clock className="text-rose-400" size={16} />}
                                        {template.id === 'goal' && <Users className="text-emerald-400" size={16} />}
                                    </div>
                                    <span className="text-xs font-bold text-white leading-tight">{template.title}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-2">{template.body}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form */}
                    <div className="space-y-6">
                        <div className="glass-panel p-8 rounded-3xl border border-white/5 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">Título da Notificação</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                        placeholder="Ex: Meta do dia! 🌿"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">Mensagem</label>
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 transition-all min-h-[120px]"
                                        placeholder="Escreva aqui a mensagem que as rainhas receberão..."
                                        value={formData.body}
                                        onChange={e => setFormData({ ...formData, body: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">Texto do Botão (Opcional)</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="Ex: Ver Meta"
                                            value={formData.cta_label}
                                            onChange={e => setFormData({ ...formData, cta_label: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">Link do Botão (URL)</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="Ex: /patient/home"
                                            value={formData.cta_url}
                                            onChange={e => setFormData({ ...formData, cta_url: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="hidden"> {/* Push desativado para MVP Inbox */}
                                <h3 className="text-sm font-bold text-indigo-400">Canais de Envio</h3>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-white cursor-pointer opacity-50">
                                        <input
                                            type="checkbox"
                                            checked={formData.push}
                                            onChange={(e) => setFormData({ ...formData, push: e.target.checked })}
                                            className="rounded border-white/10 bg-white/5"
                                            disabled
                                        />
                                        Push Notification (Em breve)
                                    </label>
                                    <label className="flex items-center gap-2 text-white cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.inbox}
                                            disabled
                                            className="rounded border-white/10 bg-white/5"
                                        />
                                        Inbox App (Ativado)
                                    </label>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl relative">
                                <label className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3 block">Segmento de Pacientes</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="radio" name="segment" checked={formData.segmentType === 'all'} onChange={() => setFormData({ ...formData, segmentType: 'all' })} className="accent-indigo-500" />
                                        <span className="text-sm">Todas as Rainhas</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="radio" name="segment" checked={formData.segmentType === 'low_adherence'} onChange={() => setFormData({ ...formData, segmentType: 'low_adherence' })} className="accent-indigo-500" />
                                        <span className="text-sm">Baixa Adesão (Inativas há {formData.lowAdherenceDays} dias)</span>
                                    </label>
                                    {formData.segmentType === 'low_adherence' && (
                                        <input
                                            type="range" min="1" max="15" value={formData.lowAdherenceDays}
                                            onChange={e => setFormData({ ...formData, lowAdherenceDays: parseInt(e.target.value) })}
                                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-indigo-400">Envio & Periodicidade</h3>
                                    {formData.scheduleType === 'schedule' && (
                                        <select
                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500"
                                            value={formData.recurrenceType}
                                            onChange={e => setFormData({ ...formData, recurrenceType: e.target.value })}
                                        >
                                            <option value="none">Único</option>
                                            <option value="daily">Diário</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="biweekly">Quinzenal</option>
                                            <option value="monthly">Mensal</option>
                                        </select>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant={formData.scheduleType === 'now' ? 'primary' : 'outline'}
                                        className={`rounded-xl h-12 gap-2 ${formData.scheduleType === 'now' ? 'bg-indigo-600' : 'border-white/10'}`}
                                        onClick={() => setFormData({ ...formData, scheduleType: 'now', recurrenceType: 'none' })}
                                    >
                                        <Send size={16} /> Enviar Agora
                                    </Button>
                                    <Button
                                        variant={formData.scheduleType === 'schedule' ? 'primary' : 'outline'}
                                        className={`rounded-xl h-12 gap-2 ${formData.scheduleType === 'schedule' ? 'bg-indigo-600' : 'border-white/10'}`}
                                        onClick={() => setFormData({ ...formData, scheduleType: 'schedule' })}
                                    >
                                        <Calendar size={16} /> Agendar
                                    </Button>
                                </div>

                                {formData.scheduleType === 'schedule' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecione a Data de Início</label>
                                                <CustomCalendar
                                                    selectedDate={formData.scheduledDate}
                                                    onSelect={(date) => setFormData({ ...formData, scheduledDate: date })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Horário</label>
                                                <div className="relative group">
                                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={16} />
                                                    <input
                                                        type="time"
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-all color-scheme-dark"
                                                        value={formData.scheduledTime}
                                                        onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {['weekly', 'biweekly', 'monthly'].includes(formData.recurrenceType) && (
                                            <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Dias da Semana</label>
                                                <div className="flex justify-between gap-1">
                                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => toggleDay(i)}
                                                            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${formData.recurrenceDays.includes(i) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                                                        >
                                                            {day}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-slate-500 italic">
                                                    {formData.recurrenceType === 'weekly' ? 'Repetirá toda semana nos dias selecionados.' :
                                                        formData.recurrenceType === 'biweekly' ? 'Repetirá a cada duas semanas nos dias selecionados.' :
                                                            'Repetirá todo mês nos dias selecionados.'}
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-500 h-16 rounded-2xl font-bold uppercase tracking-widest text-xs gap-3 shadow-xl shadow-indigo-900/40"
                                disabled={isSaving}
                                onClick={handleCreateCampaign}
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
                                {formData.scheduleType === 'now' ? 'Confirmar e Enviar' : 'Salvar Agendamento'}
                            </Button>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="hidden lg:block space-y-6">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">Preview da Notificação</label>
                        <div className="bg-black/40 rounded-[3rem] p-6 border-8 border-slate-900 w-[320px] mx-auto h-[600px] relative shadow-2xl">
                            <div className="bg-white/10 w-24 h-6 rounded-full mx-auto mb-8 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/40 mr-2"></div>
                                <div className="w-8 h-1 rounded-full bg-white/20"></div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-xl"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                            <Sparkles size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-white/40 uppercase">MEU CLUB NUTRI.AI</p>
                                            <h4 className="text-xs font-bold text-white leading-tight">{formData.title || "Seu Título Aqui"}</h4>
                                        </div>
                                        <span className="text-[10px] text-white/40">Agora</span>
                                    </div>
                                    <p className="text-xs text-white/80 leading-relaxed pl-11">
                                        {formData.body || "Sua mensagem aparecerá aqui para as rainhas..."}
                                    </p>
                                </motion.div>
                            </div>

                            <div className="absolute bottom-8 left-0 right-0 px-8">
                                <div className="h-1.5 w-32 bg-white/20 rounded-full mx-auto" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase tracking-tighter">Central de Comunicação</h1>
                    <p className="text-slate-500 mt-2 font-medium tracking-wide">Fale com suas rainhas em massa. Engajamento em 3 cliques.</p>
                </div>
                <Button
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-6 rounded-2xl font-bold uppercase tracking-widest text-xs gap-3 shadow-xl shadow-indigo-900/40 h-16 group"
                    onClick={() => setViewMode('create')}
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    Criar Mensagem
                </Button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2 group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Enviadas</p>
                    <p className="text-3xl font-black text-white">{campaigns.filter(c => c.status === 'sent').length}</p>
                </div>
                <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2 group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agendadas</p>
                    <p className="text-3xl font-black text-indigo-400">{campaigns.filter(c => c.status === 'scheduled').length}</p>
                </div>
                <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2 group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Média Alcance</p>
                    <p className="text-3xl font-black text-emerald-400">92%</p>
                </div>
                <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2 group hover:border-indigo-500/30 transition-all border-dashed border-indigo-500/20">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">IA Recomendação</p>
                    <p className="text-sm font-bold text-slate-400">Pique de atividade às 20:30</p>
                </div>
            </div>

            {/* List & Filters */}
            <div className="glass-panel rounded-[2.5rem] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
                    <div className="flex bg-white/5 rounded-2xl p-1.5 gap-1">
                        {['all', 'sent', 'scheduled', 'failed'].map((stat) => (
                            <button
                                key={stat}
                                onClick={() => setStatusFilter(stat)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === stat ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                            >
                                {stat === 'all' ? 'Ver Tudo' : stat === 'sent' ? 'Enviadas' : stat === 'scheduled' ? 'Calendário' : 'Falhas'}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 max-w-md relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input
                            placeholder="Buscar campanhas..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                <th className="px-8 py-6">Campanha</th>
                                <th className="px-8 py-6">Status</th>
                                <th className="px-8 py-6 text-center">Alcance</th>
                                <th className="px-8 py-6 text-center">Canais</th>
                                <th className="px-8 py-6 text-right">Data</th>
                                <th className="px-8 py-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-slate-500">
                                        <Loader2 className="animate-spin mx-auto mb-4" />
                                        Carregando seu histórico...
                                    </td>
                                </tr>
                            ) : filteredCampaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center space-y-4">
                                        <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                                            <Send size={32} className="text-slate-700" />
                                        </div>
                                        <p className="text-slate-500 text-sm font-black uppercase tracking-widest">Nenhuma campanha encontrada</p>
                                        <Button variant="outline" className="border-white/10 rounded-xl" onClick={() => setViewMode('create')}>Começar Minha Primeira</Button>
                                    </td>
                                </tr>
                            ) : filteredCampaigns.map((camp) => (
                                <tr key={camp.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                                    <td className="px-8 py-6">
                                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{camp.title}</h4>
                                        <p className="text-xs text-slate-500 truncate max-w-xs">{camp.body}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(camp.status)}`}>
                                            {camp.status === 'sent' && <CheckCircle2 size={12} />}
                                            {camp.status === 'scheduled' && <Clock size={12} />}
                                            {camp.status === 'failed' && <XCircle size={12} />}
                                            {camp.status === 'sending' && <Loader2 size={12} className="animate-spin" />}
                                            {camp.status === 'sent' ? 'Enviada' : camp.status === 'scheduled' ? 'Agendada' : camp.status === 'sending' ? 'Enviando' : 'Erro'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm font-black text-white">{camp.recipient_count}</span>
                                            <span className="text-[10px] font-black text-slate-600 uppercase">Pessoas</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex justify-center gap-2">
                                            {camp.channels.push && (
                                                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400" title="Push">
                                                    <Bell size={14} />
                                                </div>
                                            )}
                                            {camp.channels.inbox && (
                                                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400" title="Inbox">
                                                    <MessageSquare size={14} />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <p className="text-xs font-bold text-white">
                                            {camp.scheduled_for ? new Date(camp.scheduled_for).toLocaleDateString('pt-BR') : new Date(camp.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                        <p className="text-[10px] text-slate-500 uppercase font-black">
                                            {camp.scheduled_for ? new Date(camp.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date(camp.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white" title="Duplicar">
                                                <Copy size={18} />
                                            </button>
                                            <button className="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-red-400" title="Excluir">
                                                <Trash2 size={18} />
                                            </button>
                                            <div className="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-indigo-400">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
