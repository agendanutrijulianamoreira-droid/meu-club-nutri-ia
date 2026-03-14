"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Send, Plus, Calendar, Bell, MessageSquare, Search,
    ChevronRight, ChevronLeft, Users, Clock, CheckCircle2,
    XCircle, Loader2, Copy, ArrowLeft, Trash2, Sparkles,
    AlertTriangle, Zap, RefreshCw, Eye, Bot
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { processCampaignAction } from "../actions/campaignActions"

// ─── Types ───────────────────────────────────────────────────────────────────
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
}

// ─── Templates ───────────────────────────────────────────────────────────────
const CAMPAIGN_TEMPLATES = [
    { id: 'welcome', icon: '👑', title: "Bem-vinda, Rainha! 👑", body: "Estamos muito felizes em ter você aqui. Explore seus protocolos e comece sua jornada hoje mesmo!", cta_label: "Ver Protocolos", cta_url: "/patient/home" },
    { id: 'hydration', icon: '💧', title: "Hora da Água! 💧", body: "Já bebeu água hoje? A hidratação é fundamental para o seu resultado. Vamos juntas!", cta_label: "Registrar Agora", cta_url: "/patient/logs" },
    { id: 'reengage', icon: '💜', title: "Sentimos sua falta! ✨", body: "Você não registra há alguns dias. Que tal retomar o foco hoje? Estamos aqui com você!", cta_label: "Voltar ao Foco", cta_url: "/patient/home" },
    { id: 'checkin', icon: '✅', title: "Check-in de hoje 📝", body: "Como foi seu dia? Não esqueça de marcar seus check-ins — cada registro conta!", cta_label: "Fazer Check-in", cta_url: "/patient/home" },
]

const SEGMENTS = [
    { value: 'all', label: 'Todas as rainhas', icon: '👥', desc: 'Toda a base de pacientes' },
    { value: 'active', label: 'Ativas (últimos 3 dias)', icon: '🔥', desc: 'Engajadas recentemente' },
    { value: 'low_adherence', label: 'Baixa adesão', icon: '⚡', desc: 'Inativas há X dias' },
    { value: 'high_risk', label: 'Alto risco de evasão', icon: '🚨', desc: 'Score de risco crítico' },
]

// ─── Calendar picker ──────────────────────────────────────────────────────────
function CustomCalendar({ selectedDate, onSelect }: { selectedDate: string; onSelect: (d: string) => void }) {
    const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date())
    const [isOpen, setIsOpen] = useState(false)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
    const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
    const todayStr = new Date().toISOString().split('T')[0]

    const cells = []
    for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= totalDays; d++) {
        const ds = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const isPast = ds < todayStr
        cells.push(
            <button key={d} disabled={isPast} onClick={e => { e.stopPropagation(); onSelect(ds); setIsOpen(false) }}
                className={`h-9 w-full rounded-xl text-xs font-bold transition-all
                    ${ds === selectedDate ? 'bg-indigo-600 text-white' : isPast ? 'text-slate-800 cursor-not-allowed' : 'hover:bg-white/10 text-slate-400 hover:text-white'}
                    ${ds === todayStr && ds !== selectedDate ? 'ring-1 ring-indigo-500/50' : ''}`}>
                {d}
            </button>
        )
    }

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-left flex items-center gap-3 hover:border-indigo-500/50 transition-all">
                <Calendar size={16} className="text-slate-500 flex-shrink-0" />
                <span className={selectedDate ? 'text-white' : 'text-slate-500'}>
                    {selectedDate ? new Date(selectedDate + 'T12:00').toLocaleDateString('pt-BR') : "Selecionar data"}
                </span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                            onClick={e => e.stopPropagation()}
                            className="absolute top-full mt-2 left-0 bg-slate-900 border border-white/10 rounded-2xl p-4 w-72 shadow-2xl z-[101]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-white">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                                <div className="flex gap-1">
                                    <button onClick={e => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)) }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft size={14} /></button>
                                    <button onClick={e => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)) }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight size={14} /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={i} className="text-[9px] text-slate-600 text-center font-bold py-1">{d}</div>)}
                                {cells}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function SendConfirmModal({ onConfirm, onCancel, title, segmentLabel, recipientCount, scheduleType, loading }: {
    onConfirm: () => void; onCancel: () => void; title: string
    segmentLabel: string; recipientCount: number; scheduleType: string; loading: boolean
}) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onCancel}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                        <Send size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white">Confirmar envio</p>
                        <p className="text-xs text-slate-500">Revise antes de disparar</p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Campanha</span>
                        <span className="text-white font-bold truncate max-w-[180px]">{title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Segmento</span>
                        <span className="text-white font-bold">{segmentLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Destinatárias</span>
                        <span className="text-indigo-400 font-bold">{recipientCount} rainhas</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Envio</span>
                        <span className="text-white font-bold">{scheduleType === 'now' ? 'Imediato' : 'Agendado'}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">Cancelar</button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {scheduleType === 'now' ? 'Enviar agora' : 'Agendar'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function CommunicationCenterView({ setView }: { setView: (v: any) => void }) {
    const [viewMode, setViewMode] = useState<'list' | 'create'>('list')
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [stats, setStats] = useState({ sent: 0, scheduled: 0, total: 0, adherence: 0 })

    // Create form
    const [form, setForm] = useState({
        title: "", body: "", cta_label: "", cta_url: "",
        segmentType: "all", lowAdherenceDays: 3,
        scheduleType: "now", scheduledDate: "", scheduledTime: "09:00",
        recurrenceType: "none",
    })
    const [charCount, setCharCount] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [segmentCount, setSegmentCount] = useState<number | null>(null)
    const [segmentLoading, setSegmentLoading] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiTone, setAiTone] = useState<'motivadora' | 'acolhedora' | 'tecnica'>('motivadora')
    const [aiGoal, setAiGoal] = useState('reengage')

    const globalFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch

    const loadCampaigns = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from('campaigns')
                .select('*, recipient_count:campaign_recipients(count)')
                .order('created_at', { ascending: false })

            const formatted = (data || []).map((c: any) => ({
                ...c, recipient_count: c.recipient_count?.[0]?.count || 0
            }))
            setCampaigns(formatted)

            const sent = formatted.filter((c: Campaign) => c.status === 'sent').length
            const scheduled = formatted.filter((c: Campaign) => c.status === 'scheduled').length
            setStats(s => ({ ...s, sent, scheduled, total: formatted.length }))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadCampaigns() }, [loadCampaigns])

    // Segment preview
    useEffect(() => {
        const doFetch = async () => {
            setSegmentLoading(true)
            try {
                const params = new URLSearchParams({ type: form.segmentType, days: String(form.lowAdherenceDays) })
                const res = await globalFetch(`/api/admin/segment-preview?${params}`)
                if (res.ok) {
                    const d = await res.json()
                    setSegmentCount(d.count)
                }
            } finally { setSegmentLoading(false) }
        }
        doFetch()
    }, [form.segmentType, form.lowAdherenceDays])

    const handleAiGenerate = async () => {
        setAiLoading(true)
        try {
            const res = await window.fetch('/api/admin/campaign-ai', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal: aiGoal, segment: form.segmentType, tone: aiTone }),
            })
            if (res.ok) {
                const d = await res.json()
                setForm(f => ({ ...f, title: d.title || f.title, body: d.body || f.body, cta_label: d.cta_label || f.cta_label }))
                setCharCount((d.body || '').length)
            }
        } finally { setAiLoading(false) }
    }

    const handleDuplicate = async (camp: Campaign) => {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', session!.user.id).single()
        await supabase.from('campaigns').insert([{
            tenant_id: profile?.tenant_id,
            created_by: session!.user.id,
            title: `${camp.title} (Cópia)`,
            body: camp.body,
            channels: camp.channels,
            segment: camp.segment,
            status: 'draft',
            scheduled_for: null,
        }])
        loadCampaigns()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta campanha?')) return
        await supabase.from('campaigns').delete().eq('id', id)
        loadCampaigns()
    }

    const handleSubmit = async () => {
        if (!form.title || !form.body) { alert("Título e mensagem são obrigatórios"); return }
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', session!.user.id).single()

            const scheduledFor = form.scheduleType === 'now'
                ? new Date().toISOString()
                : `${form.scheduledDate}T${form.scheduledTime}`

            const { data, error } = await supabase.from('campaigns').insert([{
                tenant_id: profile?.tenant_id,
                created_by: session!.user.id,
                title: form.title,
                body: form.body,
                cta_label: form.cta_label || null,
                cta_url: form.cta_url || null,
                channels: { push: false, inbox: true },
                segment: { type: form.segmentType, days: form.segmentType === 'low_adherence' ? form.lowAdherenceDays : undefined },
                status: 'scheduled',
                scheduled_for: scheduledFor,
                recurrence_type: form.recurrenceType,
            }]).select().single()

            if (error) throw error

            if (form.scheduleType === 'now' && data) {
                await processCampaignAction(data.id)
            }

            setShowConfirm(false)
            setViewMode('list')
            loadCampaigns()
        } catch (err: any) {
            alert("Erro: " + err.message)
        } finally { setIsSaving(false) }
    }

    const applyTemplate = (t: typeof CAMPAIGN_TEMPLATES[0]) => {
        setForm(f => ({ ...f, title: t.title, body: t.body, cta_label: t.cta_label, cta_url: t.cta_url }))
        setCharCount(t.body.length)
    }

    const statusStyle = (s: string) => ({
        sent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        scheduled: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
        sending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        failed: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
        draft: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    }[s] || 'bg-slate-500/15 text-slate-400')

    const statusLabel = (s: string) => ({ sent: 'Enviada', scheduled: 'Agendada', sending: 'Enviando', failed: 'Erro', draft: 'Rascunho' }[s] || s)

    const segmentLabel = SEGMENTS.find(s => s.value === form.segmentType)?.label || 'Todas'
    const filtered = campaigns.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (statusFilter === 'all' || c.status === statusFilter)
    )

    // ─── CREATE VIEW ──────────────────────────────────────────────────────────
    if (viewMode === 'create') {
        return (
            <div className="space-y-6 max-w-5xl">
                <div className="flex items-center gap-3">
                    <button onClick={() => setViewMode('list')} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-white">Nova Campanha</h1>
                </div>

                {/* Templates */}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Modelos rápidos</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {CAMPAIGN_TEMPLATES.map(t => (
                            <button key={t.id} onClick={() => applyTemplate(t)}
                                className="bg-white/5 border border-white/10 hover:border-indigo-500/40 rounded-2xl p-3 text-left transition-all group">
                                <span className="text-xl">{t.icon}</span>
                                <p className="text-xs font-bold text-white mt-2 leading-snug group-hover:text-indigo-300">{t.title}</p>
                                <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{t.body}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Form */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* AI Generator */}
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4">
                            <p className="text-xs font-bold text-indigo-400 flex items-center gap-2 mb-3">
                                <Bot size={14} /> Gerar com IA
                            </p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <select value={aiGoal} onChange={e => setAiGoal(e.target.value)}
                                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                                    <option value="reengage">Reengajar inativas</option>
                                    <option value="motivate">Motivar consistência</option>
                                    <option value="hydration">Lembrete de água</option>
                                    <option value="checkin">Fazer check-in</option>
                                    <option value="upsell">Oportunidade de upgrade</option>
                                </select>
                                <select value={aiTone} onChange={e => setAiTone(e.target.value as any)}
                                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                                    <option value="motivadora">Tom motivador</option>
                                    <option value="acolhedora">Tom acolhedor</option>
                                    <option value="tecnica">Tom técnico</option>
                                </select>
                            </div>
                            <button onClick={handleAiGenerate} disabled={aiLoading}
                                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                {aiLoading ? 'Gerando...' : 'Gerar mensagem'}
                            </button>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Título *</label>
                            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Ex: Sua meta de hoje 🎯" />
                        </div>

                        {/* Body */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mensagem *</label>
                                <span className={`text-[10px] font-bold ${charCount > 160 ? 'text-rose-400' : charCount > 120 ? 'text-amber-400' : 'text-slate-600'}`}>
                                    {charCount}/160
                                </span>
                            </div>
                            <textarea value={form.body}
                                onChange={e => { setForm(f => ({ ...f, body: e.target.value })); setCharCount(e.target.value.length) }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 min-h-[100px] resize-none"
                                placeholder="Escreva aqui a mensagem..." maxLength={160} />
                        </div>

                        {/* CTA */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Texto do botão</label>
                                <input value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    placeholder="Ver agora" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">URL</label>
                                <input value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    placeholder="/patient/home" />
                            </div>
                        </div>

                        {/* Segment */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Segmento</label>
                                {segmentCount !== null && (
                                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                                        {segmentLoading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                                        {segmentCount} destinatárias
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2">
                                {SEGMENTS.map(s => (
                                    <label key={s.value} className="flex items-center gap-3 cursor-pointer group">
                                        <input type="radio" name="seg" checked={form.segmentType === s.value}
                                            onChange={() => setForm(f => ({ ...f, segmentType: s.value }))}
                                            className="accent-indigo-500 flex-shrink-0" />
                                        <span className="text-lg">{s.icon}</span>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{s.label}</p>
                                            <p className="text-[10px] text-slate-600">{s.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {form.segmentType === 'low_adherence' && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-400">Inativas há pelo menos</span>
                                        <span className="text-sm font-bold text-indigo-400">{form.lowAdherenceDays} dias</span>
                                    </div>
                                    <input type="range" min="1" max="14" value={form.lowAdherenceDays}
                                        onChange={e => setForm(f => ({ ...f, lowAdherenceDays: parseInt(e.target.value) }))}
                                        className="w-full accent-indigo-500" />
                                </div>
                            )}
                        </div>

                        {/* Schedule */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quando enviar</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[{ v: 'now', label: 'Enviar agora', icon: <Send size={14} /> }, { v: 'schedule', label: 'Agendar', icon: <Calendar size={14} /> }].map(opt => (
                                    <button key={opt.v} onClick={() => setForm(f => ({ ...f, scheduleType: opt.v }))}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all
                                            ${form.scheduleType === opt.v ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                            {form.scheduleType === 'schedule' && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
                                    <CustomCalendar selectedDate={form.scheduledDate} onSelect={d => setForm(f => ({ ...f, scheduledDate: d }))} />
                                    <div className="relative">
                                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input type="time" value={form.scheduledTime}
                                            onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        <button
                            onClick={() => { if (!form.title || !form.body) { alert('Título e mensagem são obrigatórios'); return } setShowConfirm(true) }}
                            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                            <Send size={16} />
                            {form.scheduleType === 'now' ? 'Revisar e enviar' : 'Revisar e agendar'}
                        </button>
                    </div>

                    {/* Preview */}
                    <div className="lg:col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Preview</p>
                        <div className="bg-black/40 rounded-[2.5rem] p-5 border-4 border-slate-900 w-full max-w-[280px] mx-auto shadow-2xl">
                            <div className="w-16 h-4 bg-white/10 rounded-full mx-auto mb-6" />
                            <motion.div key={form.title + form.body}
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                        <Sparkles size={13} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-white/40 uppercase font-bold">MEU CLUB NUTRI</p>
                                        <p className="text-xs font-bold text-white leading-tight truncate">{form.title || "Título aqui"}</p>
                                    </div>
                                    <span className="text-[9px] text-white/30 flex-shrink-0">Agora</span>
                                </div>
                                <p className="text-[11px] text-white/70 leading-relaxed pl-9">
                                    {form.body || "Sua mensagem aparecerá aqui..."}
                                </p>
                                {form.cta_label && (
                                    <div className="mt-2 pl-9">
                                        <span className="text-[10px] font-bold text-indigo-400 border-b border-indigo-400/50">{form.cta_label} →</span>
                                    </div>
                                )}
                            </motion.div>
                            {/* Segment chip */}
                            <div className="mt-4 text-center">
                                <span className="text-[10px] text-slate-600">
                                    {segmentLoading ? '...' : segmentCount !== null ? `${segmentCount} rainhas receberão` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {showConfirm && (
                        <SendConfirmModal
                            title={form.title}
                            segmentLabel={segmentLabel}
                            recipientCount={segmentCount || 0}
                            scheduleType={form.scheduleType}
                            loading={isSaving}
                            onConfirm={handleSubmit}
                            onCancel={() => setShowConfirm(false)}
                        />
                    )}
                </AnimatePresence>
            </div>
        )
    }

    // ─── LIST VIEW ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Central de Comunicação</h1>
                    <p className="text-slate-500 text-sm mt-1">Transforme adesão em resultado com 1 clique.</p>
                </div>
                <button onClick={() => setViewMode('create')}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl transition-all">
                    <Plus size={16} /> Nova Campanha
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total enviadas', value: stats.sent, color: 'text-white' },
                    { label: 'Agendadas', value: stats.scheduled, color: 'text-indigo-400' },
                    { label: 'Histórico', value: stats.total, color: 'text-slate-300' },
                    { label: 'IA 24h', value: 'Ativa', color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Quick actions */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Ações rápidas</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: 'Reengajar inativas', goal: 'reengage', seg: 'low_adherence' },
                        { label: 'Lembrete de hidratação', goal: 'hydration', seg: 'all' },
                        { label: 'Fazer check-in hoje', goal: 'checkin', seg: 'all' },
                        { label: 'Resgatar alto risco', goal: 'reengage', seg: 'high_risk' },
                    ].map(q => (
                        <button key={q.label}
                            onClick={() => { setForm(f => ({ ...f, segmentType: q.seg })); setAiGoal(q.goal); setViewMode('create') }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-300 transition-all">
                            <Sparkles size={12} className="text-indigo-400" />
                            {q.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Campaign list */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center gap-3 flex-wrap">
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                        {[['all','Todas'],['sent','Enviadas'],['scheduled','Agendadas'],['failed','Erros']].map(([v,l]) => (
                            <button key={v} onClick={() => setStatusFilter(v)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                    ${statusFilter === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    <button onClick={loadCampaigns} className="p-2 text-slate-600 hover:text-slate-400 transition-colors">
                        <RefreshCw size={15} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-600">
                        <Send size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm mb-3">Nenhuma campanha encontrada</p>
                        <button onClick={() => setViewMode('create')} className="text-indigo-400 text-sm font-bold">Criar primeira campanha</button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filtered.map(camp => (
                            <div key={camp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] group transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">{camp.title}</p>
                                    <p className="text-[11px] text-slate-600 truncate mt-0.5">{camp.body}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border flex items-center gap-1 flex-shrink-0 ${statusStyle(camp.status)}`}>
                                    {camp.status === 'sent' && <CheckCircle2 size={10} />}
                                    {camp.status === 'scheduled' && <Clock size={10} />}
                                    {camp.status === 'sending' && <Loader2 size={10} className="animate-spin" />}
                                    {camp.status === 'failed' && <XCircle size={10} />}
                                    {statusLabel(camp.status)}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-slate-600 w-24 text-right">
                                        {new Date(camp.scheduled_for || camp.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                        <button onClick={() => handleDuplicate(camp)} title="Duplicar"
                                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                            <Copy size={13} />
                                        </button>
                                        <button onClick={() => handleDelete(camp.id)} title="Excluir"
                                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
