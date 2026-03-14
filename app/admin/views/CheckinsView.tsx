"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    AlertCircle, CheckCircle, BarChart2, Search, Sparkles,
    Activity, X, Loader2, Brain, RefreshCw, Flame, Zap,
    Heart, Settings, Send, Clock, TrendingDown, TrendingUp,
    ChevronRight, Users, Shield, Save
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface CheckinDetails {
    diet_score: number | null
    main_difficulty: string | null
    bowel: string | null
    had_binge: boolean | null
    mood: string | null
    extra_notes: string | null
    ai_suggestion: string | null
    week_start: string | null
    created_at: string
}

interface PatientRow {
    id: string; userName: string; userAvatar: string; date: string
    riskScore: number; riskLevel: 'low' | 'medium' | 'high'
    summary: string; streak: number; xp: number; plan: string
    adherenceRate: number; daysSinceActivity: number
    hasCheckin: boolean; checkinScore: number | null
    checkinDetails: CheckinDetails | null
}

interface Stats { total: number; low: number; medium: number; high: number }

const PLAN_LABELS: Record<string, string> = { vip: 'VIP', tech_diet: 'Tech Diet', community: 'Community', manual: 'Manual' }

const RISK_META = {
    high:   { label: 'Crítico',  color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20',    icon: <AlertCircle size={12}/> },
    medium: { label: 'Atenção',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  icon: <Activity size={12}/> },
    low:    { label: 'Estável',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle size={12}/> },
}

const MOOD_LABELS: Record<string, string> = { otimo: '🤩 Ótimo', bem: '😊 Bem', neutro: '😐 Neutro', ruim: '😞 Ruim' }
const BOWEL_LABELS: Record<string, string> = { Normal: '✅ Normal', Preso: '⚠️ Preso', Solto: '⚠️ Solto' }

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function PatientDetailDrawer({ patient, onClose, onRescue, onNavigate }: {
    patient: PatientRow; onClose: () => void
    onRescue: () => Promise<void>; onNavigate: () => void
}) {
    const [rescuing, setRescuing] = useState(false)
    const [rescued, setRescued] = useState(false)
    const rm = RISK_META[patient.riskLevel]
    const d = patient.checkinDetails

    const handleRescue = async () => {
        setRescuing(true)
        await onRescue()
        setRescued(true)
        setRescuing(false)
    }

    const scoreColor = (s: number) => s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-rose-400'

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 28 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-5 w-full max-w-md max-h-[88vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black border ${rm.bg} ${rm.color}`}>
                            {patient.userAvatar}
                        </div>
                        <div>
                            <p className="font-bold text-white">{patient.userName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${rm.bg} ${rm.color} flex items-center gap-1`}>
                                    {rm.icon} {rm.label}
                                </span>
                                <span className="text-[10px] text-slate-600">score {patient.riskScore}/10</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <X size={16}/>
                    </button>
                </div>

                {/* Quick metrics */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                        { label: 'Streak', value: `${patient.streak}d`, color: patient.streak > 0 ? 'text-orange-400' : 'text-slate-600', icon: <Flame size={11}/> },
                        { label: 'Adesão 7d', value: `${patient.adherenceRate}%`, color: patient.adherenceRate >= 60 ? 'text-emerald-400' : 'text-rose-400', icon: <Activity size={11}/> },
                        { label: 'Última ativ.', value: patient.date, color: 'text-slate-300', icon: <Clock size={11}/> },
                    ].map(m => (
                        <div key={m.label} className="bg-white/5 rounded-xl p-2.5 text-center">
                            <p className={`text-base font-bold ${m.color} flex items-center justify-center gap-1`}>
                                <span className={m.color}>{m.icon}</span> {m.value}
                            </p>
                            <p className="text-[9px] text-slate-600 uppercase font-bold mt-0.5">{m.label}</p>
                        </div>
                    ))}
                </div>

                {/* AI Summary */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mb-4">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 mb-2">
                        <Sparkles size={11}/> {patient.hasCheckin ? 'Análise IA — check-in semanal' : 'Avaliação por comportamento'}
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">"{patient.summary}"</p>
                    {d?.ai_suggestion && (
                        <div className="mt-2 bg-white/5 rounded-xl px-3 py-2">
                            <p className="text-[9px] font-bold text-indigo-300 uppercase mb-0.5">Sugestão</p>
                            <p className="text-xs text-slate-300">{d.ai_suggestion}</p>
                        </div>
                    )}
                </div>

                {/* Check-in details */}
                {d && (
                    <div className="space-y-2 mb-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Detalhes do check-in{d.week_start && ` · semana de ${new Date(d.week_start + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                        </p>

                        {d.diet_score !== null && (
                            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                                <span className="text-xs text-slate-400">Nota da dieta</span>
                                <span className={`text-sm font-black ${scoreColor(d.diet_score!)}`}>{d.diet_score}/10</span>
                            </div>
                        )}
                        {d.mood && (
                            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                                <span className="text-xs text-slate-400">Humor</span>
                                <span className="text-xs font-bold text-white">{MOOD_LABELS[d.mood] || d.mood}</span>
                            </div>
                        )}
                        {d.bowel && (
                            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                                <span className="text-xs text-slate-400">Funcionamento intestinal</span>
                                <span className="text-xs font-bold text-white">{BOWEL_LABELS[d.bowel] || d.bowel}</span>
                            </div>
                        )}
                        {d.had_binge !== null && d.had_binge !== undefined && (
                            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                                <span className="text-xs text-slate-400">Compulsão alimentar</span>
                                <span className={`text-xs font-bold ${d.had_binge ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {d.had_binge ? '⚠️ Sim' : '✅ Não'}
                                </span>
                            </div>
                        )}
                        {d.main_difficulty && (
                            <div className="bg-white/5 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] text-slate-500 mb-1">Principal dificuldade</p>
                                <p className="text-xs text-slate-200">"{d.main_difficulty}"</p>
                            </div>
                        )}
                        {d.extra_notes && (
                            <div className="bg-white/5 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] text-slate-500 mb-1">Observações extras</p>
                                <p className="text-xs text-slate-200 italic">"{d.extra_notes}"</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                    {patient.riskLevel === 'high' && !rescued && (
                        <button onClick={handleRescue} disabled={rescuing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all disabled:opacity-50">
                            {rescuing ? <Loader2 size={12} className="animate-spin"/> : <Heart size={12}/>}
                            {rescuing ? 'Enviando...' : 'Enviar resgate'}
                        </button>
                    )}
                    {rescued && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                            <CheckCircle size={12}/> Resgate enviado!
                        </div>
                    )}
                    <button onClick={onNavigate}
                        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-300 text-xs font-bold transition-all">
                        Ver perfil <ChevronRight size={12}/>
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel() {
    const [config, setConfig] = useState({
        frequency: 'weekly',
        reminder_day: '1',      // 0=Sun .. 6=Sat
        reminder_hour: '08',
        custom_note: '',
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        fetch('/api/admin/checkins/config')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.config) setConfig(prev => ({ ...prev, ...d.config })); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        await fetch('/api/admin/checkins/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config })
        })
        setSaving(false); setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

    if (loading) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-600"/></div>

    return (
        <div className="max-w-2xl space-y-5">
            {/* Info */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Shield size={16} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
                <div>
                    <p className="text-sm font-bold text-white mb-1">Formulário de Check-in Semanal</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        As pacientes respondem em <strong className="text-white">/patient/checkin</strong>. O formulário coleta: nota da dieta (0-10), principal dificuldade, funcionamento intestinal, compulsão alimentar, humor e observações livres. A IA analisa cada resposta e gera um resumo + nível de risco automático.
                    </p>
                </div>
            </div>

            {/* Config options */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Configurações de notificação</p>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Frequência</label>
                        <select value={config.frequency} onChange={e => setConfig(c => ({...c, frequency: e.target.value}))}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                            <option value="weekly">Semanal</option>
                            <option value="biweekly">Quinzenal</option>
                            <option value="monthly">Mensal</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Dia da semana</label>
                        <select value={config.reminder_day} onChange={e => setConfig(c => ({...c, reminder_day: e.target.value}))}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                            {days.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Horário do lembrete</label>
                        <select value={config.reminder_hour} onChange={e => setConfig(c => ({...c, reminder_hour: e.target.value}))}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                            {['06','07','08','09','10','12','14','18','20'].map(h => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Mensagem personalizada no check-in (opcional)</label>
                    <textarea value={config.custom_note}
                        onChange={e => setConfig(c => ({...c, custom_note: e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-20"
                        placeholder="Ex: Olá rainha! Que semana você teve? Responda com carinho 💜"/>
                </div>
            </div>

            {/* Perguntas do formulário — informativo */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Perguntas do formulário</p>
                {[
                    { q: 'Nota da dieta esta semana (0–10)', type: 'Escala' },
                    { q: 'Principal dificuldade', type: 'Texto livre' },
                    { q: 'Funcionamento intestinal', type: 'Múltipla escolha' },
                    { q: 'Sentiu compulsão alimentar?', type: 'Sim / Não' },
                    { q: 'Como está seu humor?', type: 'Múltipla escolha' },
                    { q: 'Observações extras', type: 'Texto livre' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <span className="text-slate-600 text-xs w-4 font-bold">{i+1}</span>
                        <span className="text-sm text-slate-300 flex-1">{item.q}</span>
                        <span className="text-[9px] text-slate-600 bg-white/5 px-2 py-0.5 rounded font-bold uppercase">{item.type}</span>
                    </div>
                ))}
            </div>

            <button onClick={handleSave} disabled={saving}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all
                    ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} disabled:opacity-50`}>
                {saving ? <Loader2 size={14} className="animate-spin"/> : saved ? <CheckCircle size={14}/> : <Save size={14}/>}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configurações'}
            </button>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function CheckinsView({ setView: setMainView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
    const [tab, setTab] = useState<'dashboard' | 'config'>('dashboard')
    const [responses, setResponses] = useState<PatientRow[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, low: 0, medium: 0, high: 0 })
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<PatientRow | null>(null)
    const [search, setSearch] = useState('')
    const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')
    const [sendingRescue, setSendingRescue] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/checkins')
            if (res.ok) {
                const data = await res.json()
                setResponses(data.responses || [])
                setStats(data.stats || { total: 0, low: 0, medium: 0, high: 0 })
            }
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleRescue = async (patientId: string) => {
        setSendingRescue(patientId)
        await fetch(`/api/admin/patients/${patientId}/action`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-rescue' })
        })
        setSendingRescue(null)
    }

    const filtered = responses.filter(r => {
        const ms = r.userName.toLowerCase().includes(search.toLowerCase())
        const mf = filterRisk === 'all' || r.riskLevel === filterRisk
        return ms && mf
    })

    const checkinRate = stats.total > 0
        ? Math.round((responses.filter(r => r.hasCheckin).length / stats.total) * 100)
        : 0

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">
                        Check-ins <span className="font-bold">Inteligentes</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {loading ? 'Carregando...' : `${stats.total} rainhas monitoradas`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className={`p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${loading ? 'text-indigo-400' : 'text-slate-500'}`}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
                    </button>
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                        {([['dashboard', <BarChart2 size={13}/>, 'Monitoramento'], ['config', <Settings size={13}/>, 'Config']] as const).map(([v, icon, l]) => (
                            <button key={v} onClick={() => setTab(v as any)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                    ${tab === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                {icon} {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {tab === 'config' && <ConfigPanel/>}

            {tab === 'dashboard' && (
                <div className="space-y-5">
                    {/* Stats */}
                    {!loading && stats.total === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                            <Users size={32} className="mx-auto mb-3 text-slate-700 opacity-50"/>
                            <h3 className="text-lg font-bold text-white mb-2">Nenhuma rainha cadastrada ainda</h3>
                            <p className="text-slate-500 text-sm">Os dados de risco aparecerão aqui quando houver pacientes.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Estável', value: stats.low, pct: stats.total ? Math.round((stats.low/stats.total)*100) : 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle size={14} className="text-emerald-400"/> },
                                    { label: 'Atenção', value: stats.medium, pct: stats.total ? Math.round((stats.medium/stats.total)*100) : 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: <Activity size={14} className="text-amber-400"/> },
                                    { label: 'Crítico', value: stats.high, pct: stats.total ? Math.round((stats.high/stats.total)*100) : 0, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: <AlertCircle size={14} className="text-rose-400"/> },
                                    { label: 'Fizeram check-in', value: responses.filter(r => r.hasCheckin).length, pct: checkinRate, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', icon: <Brain size={14} className="text-indigo-400"/> },
                                ].map(s => (
                                    <div key={s.label} className={`${s.bg} border rounded-2xl p-4`}>
                                        <div className="flex items-center gap-2 mb-2">{s.icon}</div>
                                        <p className={`text-3xl font-bold ${s.color}`}>{s.pct}<span className="text-base text-slate-600">%</span></p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{s.label}</p>
                                        <p className="text-[10px] text-slate-700 mt-0.5">{s.value} rainhas</p>
                                    </div>
                                ))}
                            </div>

                            {/* Search + filter */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="relative flex-1 min-w-48">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                                </div>
                                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                                    {(['all','high','medium','low'] as const).map(r => (
                                        <button key={r} onClick={() => setFilterRisk(r)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                                                ${filterRisk === r ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                            {r === 'all' ? 'Todas' : r === 'high' ? '⚠️ Crítico' : r === 'medium' ? '⚡ Atenção' : '✅ Estável'}
                                            {r !== 'all' && ` (${stats[r]})`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                                <div className="hidden md:grid grid-cols-5 px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    <span>Rainha</span>
                                    <span>Situação IA</span>
                                    <span>Check-in</span>
                                    <span>Engajamento</span>
                                    <span className="text-right">Status</span>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-600"/></div>
                                ) : filtered.length === 0 ? (
                                    <div className="py-12 text-center text-slate-600 text-sm">Nenhuma rainha encontrada.</div>
                                ) : filtered.map(r => {
                                    const rm = RISK_META[r.riskLevel as keyof typeof RISK_META]
                                    return (
                                        <div key={r.id} onClick={() => setSelected(r)}
                                            className="grid grid-cols-2 md:grid-cols-5 items-center px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors group">

                                            {/* Name */}
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black border flex-shrink-0 ${rm.bg} ${rm.color}`}>
                                                    {r.userAvatar}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">{r.userName}</p>
                                                    <p className="text-[9px] text-slate-600">{PLAN_LABELS[r.plan] || r.plan}</p>
                                                </div>
                                            </div>

                                            {/* AI summary */}
                                            <div className="hidden md:flex items-start gap-1.5 min-w-0">
                                                <Sparkles size={11} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
                                                <span className="text-slate-500 text-xs italic truncate">"{r.summary}"</span>
                                            </div>

                                            {/* Check-in score */}
                                            <div className="hidden md:flex items-center gap-2">
                                                {r.hasCheckin && r.checkinScore !== null ? (
                                                    <span className={`text-sm font-black ${r.checkinScore >= 7 ? 'text-emerald-400' : r.checkinScore >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                        {r.checkinScore}/10
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-700 italic">sem check-in</span>
                                                )}
                                            </div>

                                            {/* Engagement */}
                                            <div className="hidden md:flex items-center gap-3">
                                                <span className="flex items-center gap-1 text-xs text-orange-400"><Flame size={11}/> {r.streak}d</span>
                                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                                    {r.adherenceRate >= 60 ? <TrendingUp size={11} className="text-emerald-400"/> : <TrendingDown size={11} className="text-rose-400"/>}
                                                    {r.adherenceRate}%
                                                </span>
                                            </div>

                                            {/* Status + quick rescue */}
                                            <div className="flex items-center justify-end gap-2">
                                                {r.riskLevel === 'high' && (
                                                    <button onClick={e => { e.stopPropagation(); handleRescue(r.id) }}
                                                        disabled={sendingRescue === r.id}
                                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 rounded-xl text-[10px] font-bold transition-all">
                                                        {sendingRescue === r.id ? <Loader2 size={10} className="animate-spin"/> : <Heart size={10}/>}
                                                        Resgatar
                                                    </button>
                                                )}
                                                <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl border flex items-center gap-1 ${rm.bg} ${rm.color}`}>
                                                    {rm.icon} {rm.label}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Detail drawer */}
            <AnimatePresence>
                {selected && (
                    <PatientDetailDrawer
                        patient={selected}
                        onClose={() => setSelected(null)}
                        onRescue={() => handleRescue(selected.id)}
                        onNavigate={() => { setSelected(null); setMainView('patients') }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
