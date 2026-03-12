"use client"

import { useState, useEffect, useCallback } from "react"
import {
    ClipboardList, AlertCircle, CheckCircle, BarChart2, Edit,
    Search, Sparkles, Activity, X, Save, Loader2, Brain,
    ShieldCheck, RefreshCw, Flame, Zap, TrendingDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

interface PatientRow {
    id: string
    userName: string
    userAvatar: string
    date: string
    riskScore: number
    riskLevel: 'low' | 'medium' | 'high'
    summary: string
    streak: number
    xp: number
    plan: string
    adherenceRate: number
    hasCheckin: boolean
    checkinScore: number | null
}

interface Stats { total: number; low: number; medium: number; high: number }

interface Question {
    id: string
    type: 'scale' | 'text' | 'select' | 'yesno'
    text: string
    options?: string[]
    required: boolean
}

const DEFAULT_QUESTIONS: Question[] = [
    { id: 'q1', type: 'scale', text: 'De 0 a 10, qual sua nota para a dieta esta semana?', required: true },
    { id: 'q2', type: 'text', text: 'Qual foi sua maior dificuldade?', required: true },
    { id: 'q3', type: 'select', text: 'Como está seu intestino?', options: ['Normal', 'Preso', 'Solto'], required: true },
    { id: 'q4', type: 'yesno', text: 'Sentiu compulsão alimentar?', required: true },
    { id: 'q5', type: 'select', text: 'Como está seu humor?', options: ['Ótimo', 'Bom', 'Regular', 'Ruim'], required: false },
]

export function CheckinsView({ setView: setMainView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
    const [view, setLocalView] = useState<'dashboard' | 'editor'>('dashboard')
    const [responses, setResponses] = useState<PatientRow[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, low: 0, medium: 0, high: 0 })
    const [loading, setLoading] = useState(true)
    const [selectedResponse, setSelectedResponse] = useState<PatientRow | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')
    const [questions, setQuestions] = useState(DEFAULT_QUESTIONS)
    const [saving, setSaving] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/checkins')
            if (res.ok) {
                const data = await res.json()
                setResponses(data.responses || [])
                setStats(data.stats || { total: 0, low: 0, medium: 0, high: 0 })
            }
        } catch (err) {
            console.error('[CheckinsView] Load error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const filteredResponses = responses.filter(r => {
        if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false
        if (searchQuery && !r.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    const getRiskBadge = (level: string) => {
        if (level === 'high') return (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle size={12} /> CRÍTICO
            </span>
        )
        if (level === 'medium') return (
            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} /> ATENÇÃO
            </span>
        )
        return (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle size={12} /> ESTÁVEL
            </span>
        )
    }

    const getPlanBadge = (plan: string) => {
        if (plan === 'vip') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        if (plan === 'tech_diet') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }

    const handleSaveQuestions = async () => {
        setSaving(true)
        await new Promise(r => setTimeout(r, 800))
        setSaving(false)
    }

    const addQuestion = () => setQuestions(prev => [...prev, {
        id: `q-${Date.now()}`, type: 'text', text: 'Nova pergunta...', required: false
    }])

    return (
        <div className="space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
                            <Brain size={20} className="text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Monitoramento em Tempo Real</span>
                    </div>
                    <h1 className="text-4xl font-light text-white tracking-tight">
                        Check-ins <span className="font-bold">Inteligentes</span>
                    </h1>
                    <p className="text-slate-400">
                        {loading ? 'Carregando...' : `${stats.total} rainhas · dados reais`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                    >
                        <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex bg-slate-950 p-1.5 rounded-[1.25rem] border border-white/10">
                        <button
                            onClick={() => setLocalView('dashboard')}
                            className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            <BarChart2 size={14} className="inline mr-2" />Monitoramento
                        </button>
                        <button
                            onClick={() => setLocalView('editor')}
                            className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${view === 'editor' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Edit size={14} className="inline mr-2" />Configuração
                        </button>
                    </div>
                </div>
            </div>

            {/* Dashboard view */}
            {view === 'dashboard' && (
                <div className="space-y-8">
                    {/* Stats cards */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1,2,3].map(i => (
                                <div key={i} className="glass-panel p-8 rounded-[2rem] border border-white/10 bg-white/5 animate-pulse h-32" />
                            ))}
                        </div>
                    ) : stats.total === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                            <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <ClipboardList size={32} className="text-slate-600" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Nenhuma rainha cadastrada ainda</h3>
                            <p className="text-slate-400 text-sm">Quando suas pacientes se cadastrarem, os dados de risco aparecerão aqui.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass-panel p-8 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5">
                                    <h3 className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <CheckCircle size={16} /> Estável
                                    </h3>
                                    <p className="text-5xl font-black text-white tracking-tighter">
                                        {stats.total > 0 ? Math.round((stats.low / stats.total) * 100) : 0}
                                        <span className="text-2xl text-emerald-500/50">%</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{stats.low} rainhas em adesão total</p>
                                </div>
                                <div className="glass-panel p-8 rounded-[2rem] border border-amber-500/20 bg-amber-500/5">
                                    <h3 className="text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <Activity size={16} /> Atenção
                                    </h3>
                                    <p className="text-5xl font-black text-white tracking-tighter">
                                        {stats.total > 0 ? Math.round((stats.medium / stats.total) * 100) : 0}
                                        <span className="text-2xl text-amber-500/50">%</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{stats.medium} precisam de ajuste leve</p>
                                </div>
                                <div className="glass-panel p-8 rounded-[2rem] border border-rose-500/20 bg-rose-500/5">
                                    <h3 className="text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <AlertCircle size={16} /> Risco de Evasão
                                    </h3>
                                    <p className="text-5xl font-black text-white tracking-tighter">
                                        {stats.total > 0 ? Math.round((stats.high / stats.total) * 100) : 0}
                                        <span className="text-2xl text-rose-500/50">%</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{stats.high} em situação crítica</p>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-col md:flex-row items-center gap-4">
                                <div className="relative flex-1 w-full group">
                                    <Search className="absolute left-4 top-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-11 pr-6 text-white outline-none focus:border-indigo-500/50 transition-all text-sm"
                                        placeholder="Buscar por nome..."
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                                    {(['all', 'high', 'medium', 'low'] as const).map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setFilterRisk(r)}
                                            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${filterRisk === r ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-white/10 text-slate-500 hover:text-white'}`}
                                        >
                                            {r === 'all' ? 'Todas' : r === 'high' ? '⚠️ Crítico' : r === 'medium' ? '⚡ Atenção' : '✅ Estável'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
                                <div className="bg-slate-900/50 px-6 py-4 grid grid-cols-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <span>Rainha</span>
                                    <span>Situação</span>
                                    <span>Engajamento</span>
                                    <span className="text-right">Status</span>
                                </div>

                                {filteredResponses.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">Nenhuma rainha encontrada.</div>
                                )}

                                {filteredResponses.map(r => (
                                    <div
                                        key={r.id}
                                        onClick={() => setSelectedResponse(r)}
                                        className="px-6 py-4 grid grid-cols-4 items-center hover:bg-white/[0.04] cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black border ${r.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : r.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                {r.userAvatar}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">{r.userName}</p>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${getPlanBadge(r.plan)}`}>
                                                    {r.plan === 'vip' ? 'VIP' : r.plan === 'tech_diet' ? 'Tech Diet' : 'Community'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <Sparkles size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                            <span className="text-slate-400 text-xs italic truncate">"{r.summary}"</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1">
                                                <Flame size={12} className="text-orange-400" />
                                                <span className="text-xs font-bold text-slate-300">{r.streak}d</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Zap size={12} className="text-yellow-400" />
                                                <span className="text-xs font-bold text-slate-300">{r.xp} XP</span>
                                            </div>
                                            <div className="hidden md:flex items-center gap-1">
                                                <TrendingDown size={12} className={r.adherenceRate >= 60 ? "text-emerald-400" : "text-rose-400"} />
                                                <span className="text-xs font-bold text-slate-300">{r.adherenceRate}%</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">{getRiskBadge(r.riskLevel)}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Editor view */}
            {view === 'editor' && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="glass-panel p-6 rounded-[2rem] border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-4">
                        <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30 text-indigo-400">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Formulário de Check-in Semanal</h3>
                            <p className="text-sm text-slate-400">A paciente acessa em /patient/checkin toda semana.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, i) => (
                            <div key={q.id} className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-4">
                                <span className="text-slate-600 font-black text-sm mt-0.5">{i + 1}</span>
                                <div className="flex-1">
                                    <input
                                        value={q.text}
                                        onChange={e => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))}
                                        className="w-full bg-transparent text-white font-medium text-sm outline-none border-b border-white/10 pb-1 focus:border-indigo-500/50 transition-all"
                                    />
                                    <span className={`text-[9px] font-black uppercase tracking-widest mt-2 inline-block px-2 py-0.5 rounded border ${q.type === 'scale' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : q.type === 'yesno' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                        {q.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={addQuestion}
                            className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 text-sm font-bold"
                        >
                            + Adicionar pergunta
                        </button>
                        <button
                            onClick={handleSaveQuestions}
                            disabled={saving}
                            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all text-white text-sm font-bold flex items-center justify-center gap-2"
                        >
                            {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando</> : <><Save size={14} /> Salvar</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Patient detail panel */}
            <AnimatePresence>
                {selectedResponse && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
                        onClick={() => setSelectedResponse(null)}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black border ${selectedResponse.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : selectedResponse.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                        {selectedResponse.userAvatar}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{selectedResponse.userName}</p>
                                        <p className="text-xs text-slate-500">{selectedResponse.date}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedResponse(null)} className="text-slate-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-white/5 rounded-xl p-3 text-center">
                                    <p className="text-orange-400 text-lg font-black">{selectedResponse.streak}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Streak</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 text-center">
                                    <p className="text-yellow-400 text-lg font-black">{selectedResponse.xp}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">XP Total</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 text-center">
                                    <p className={`text-lg font-black ${selectedResponse.adherenceRate >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>{selectedResponse.adherenceRate}%</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Adesão 7d</p>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-2xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={14} className="text-indigo-400" />
                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                        {selectedResponse.hasCheckin ? 'Análise IA (check-in)' : 'Score de Risco (dados de comportamento)'}
                                    </p>
                                </div>
                                <p className="text-sm text-slate-300 italic">"{selectedResponse.summary}"</p>
                            </div>

                            <div className="flex justify-between items-center">
                                {getRiskBadge(selectedResponse.riskLevel)}
                                {selectedResponse.checkinScore !== null && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-500">Nota dieta:</span>
                                        <span className={`text-sm font-black ${selectedResponse.checkinScore >= 7 ? 'text-emerald-400' : selectedResponse.checkinScore >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {selectedResponse.checkinScore}/10
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
