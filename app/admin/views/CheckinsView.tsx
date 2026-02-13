"use client"

import { useState } from "react"
import {
    ClipboardList, Plus, AlertCircle, CheckCircle, BarChart2, Edit, Trash2, Search,
    MessageSquare, Sparkles, TrendingDown, TrendingUp, Activity, X, Save, GripVertical, Loader2, Brain, ShieldCheck, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface Question {
    id: string
    type: 'scale' | 'text' | 'select' | 'yesno'
    text: string
    options?: string[]
    required: boolean
}

interface Response {
    id: string
    userName: string
    userAvatar: string
    date: string
    riskScore: number
    riskLevel: 'low' | 'medium' | 'high'
    summary: string
}

const MOCK_QUESTIONS: Question[] = [
    { id: 'q1', type: 'scale', text: 'De 0 a 10, qual sua nota para a dieta esta semana?', required: true },
    { id: 'q2', type: 'text', text: 'Qual foi sua maior dificuldade?', required: true },
    { id: 'q3', type: 'select', text: 'Como está seu intestino?', options: ['Normal', 'Preso', 'Solto'], required: true },
    { id: 'q4', type: 'yesno', text: 'Sentiu compulsão alimentar?', required: true },
]

const MOCK_RESPONSES: Response[] = [
    { id: 'r1', userName: 'Maria Silva', userAvatar: 'MS', date: 'Hoje, 10:30', riskScore: 8, riskLevel: 'low', summary: 'Está amando a dieta. Emagreceu 2kg.' },
    { id: 'r2', userName: 'Joana Dark', userAvatar: 'JD', date: 'Ontem, 18:00', riskScore: 3, riskLevel: 'high', summary: 'Relatou compulsão por doces.' },
    { id: 'r3', userName: 'Fernanda Lima', userAvatar: 'FL', date: 'Ontem, 14:20', riskScore: 5, riskLevel: 'medium', summary: 'Dificuldade com horários.' },
    { id: 'r4', userName: 'Ana Paula', userAvatar: 'AP', date: 'Ontem, 09:15', riskScore: 9, riskLevel: 'low', summary: 'Excelente adesão ao protocolo.' },
]

export function CheckinsView({ setView: setMainView }: { setView: (v: any) => void }) {
    const [view, setLocalView] = useState<'dashboard' | 'editor'>('dashboard')
    const [questions, setQuestions] = useState(MOCK_QUESTIONS)
    const [responses] = useState(MOCK_RESPONSES)
    const [selectedResponse, setSelectedResponse] = useState<Response | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')
    const [saving, setSaving] = useState(false)

    const lowRiskCount = responses.filter(r => r.riskLevel === 'low').length
    const mediumRiskCount = responses.filter(r => r.riskLevel === 'medium').length
    const highRiskCount = responses.filter(r => r.riskLevel === 'high').length
    const total = responses.length

    const filteredResponses = responses.filter(r => {
        if (filterRisk !== 'all' && r.riskLevel !== filterRisk) return false
        if (searchQuery && !r.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    const getRiskBadge = (level: string) => {
        if (level === 'high') return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={12} /> CRÍTICO</span>
        if (level === 'medium') return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} /> ATENÇÃO</span>
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle size={12} /> ESTÁVEL</span>
    }

    const addQuestion = () => setQuestions(prev => [...prev, { id: `q-${Date.now()}`, type: 'text', text: 'Nova pergunta...', required: false }])
    const deleteQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id))
    const updateQuestion = (id: string, field: string, value: any) => setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
    const handleSave = async () => { setSaving(true); await new Promise(r => setTimeout(r, 1500)); setSaving(false) }

    return (
        <div className="space-y-8 pb-32">
            {/* Header Clinical */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
                            <Brain size={20} className="text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Monitoramento Biométrico</span>
                    </div>
                    <h1 className="text-4xl font-light text-white tracking-tight">Check-ins <span className="font-bold">Inteligentes</span></h1>
                    <p className="text-slate-400 font-medium font-medium">Análise qualitativa e detecção de riscos em tempo real.</p>
                </div>
                <div className="flex bg-slate-950 p-1.5 rounded-[1.25rem] border border-white/10 shadow-xl">
                    <button onClick={() => setLocalView('dashboard')} className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}>
                        <BarChart2 size={16} className="inline mr-2" />Monitoramento
                    </button>
                    <button onClick={() => setLocalView('editor')} className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${view === 'editor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}>
                        <Edit size={16} className="inline mr-2" />Configuração
                    </button>
                </div>
            </div>

            {view === 'dashboard' && (
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-8 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl" />
                            <h3 className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4"><CheckCircle size={16} /> Performance Alta</h3>
                            <p className="text-5xl font-black text-white tracking-tighter">{Math.round((lowRiskCount / total) * 100)}<span className="text-2xl text-emerald-500/50">%</span></p>
                            <p className="text-xs text-slate-500 mt-2 font-medium">{lowRiskCount} rainhas em adesão total</p>
                        </div>
                        <div className="glass-panel p-8 rounded-[2rem] border border-amber-500/20 bg-amber-500/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl" />
                            <h3 className="text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4"><Activity size={16} /> Alerta de Estagnação</h3>
                            <p className="text-5xl font-black text-white tracking-tighter">{Math.round((mediumRiskCount / total) * 100)}<span className="text-2xl text-amber-500/50">%</span></p>
                            <p className="text-xs text-slate-500 mt-2 font-medium">{mediumRiskCount} precisam de ajuste leve</p>
                        </div>
                        <div className="glass-panel p-8 rounded-[2rem] border border-rose-500/20 bg-rose-500/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl" />
                            <h3 className="text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4"><AlertCircle size={16} /> Risco de Evasão</h3>
                            <p className="text-5xl font-black text-white tracking-tighter">{Math.round((highRiskCount / total) * 100)}<span className="text-2xl text-rose-500/50">%</span></p>
                            <p className="text-xs text-slate-500 mt-2 font-medium">{highRiskCount} em situação crítica</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="relative flex-1 w-full group">
                            <Search className="absolute left-4 top-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white outline-none focus:border-indigo-500/50 transition-all font-medium" placeholder="Filtrar por nome da rainha..." />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-2">
                            {['all', 'high', 'medium', 'low'].map((r) => (
                                <button key={r} onClick={() => setFilterRisk(r as any)} className={`px-5 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${filterRisk === r ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-950 border-white/10 text-slate-500 hover:text-white'}`}>
                                    {r === 'all' ? 'Ver Todos' : r === 'high' ? '⚠️ Crítico' : r === 'medium' ? '⚡ Atenção' : '✅ Estável'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl divide-y divide-white/5">
                        <div className="bg-slate-900/50 p-6 grid grid-cols-4 items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            <span>Rainha</span>
                            <span>Insights da IA</span>
                            <span>Data do Registro</span>
                            <span className="text-right">Status Bio</span>
                        </div>
                        {filteredResponses.map((r) => (
                            <div key={r.id} onClick={() => setSelectedResponse(r)} className="p-6 grid grid-cols-4 items-center hover:bg-white/[0.04] cursor-pointer transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black shadow-inner border border-white/10 ${r.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-400' : r.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{r.userAvatar}</div>
                                    <span className="font-bold text-white group-hover:text-indigo-400 transition-colors text-sm">{r.userName}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Sparkles size={16} className="text-indigo-400 shrink-0" />
                                    <span className="text-slate-400 text-sm italic truncate font-light">"{r.summary}"</span>
                                </div>
                                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{r.date}</span>
                                <div className="flex justify-end">{getRiskBadge(r.riskLevel)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'editor' && (
                <div className="max-w-3xl mx-auto space-y-8 mt-10">
                    <div className="glass-panel p-8 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl" />
                        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30 text-indigo-400 shadow-inner">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg tracking-tight">Arquitetura de Check-in</h3>
                            <p className="text-sm text-slate-400 font-medium">Cronograma: Envio automatizado a cada 15 dias para todo o reino.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {questions.map((q, i) => (
                            <div key={q.id} className="glass-panel p-6 rounded-[2rem] border border-white/10 bg-white/5 group flex items-start gap-6 hover:border-indigo-500/30 transition-all shadow-xl">
                                <span className="text-slate-700 font-black text-2xl pt-2">{String(i + 1).padStart(2, '0')}</span>
                                <div className="flex-1 space-y-4">
                                    <input value={q.text} onChange={(e) => updateQuestion(q.id, 'text', e.target.value)} className="w-full bg-transparent font-bold text-white outline-none border-b border-transparent focus:border-indigo-500 pb-2 text-lg transition-all" />
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <select value={q.type} onChange={(e) => updateQuestion(q.id, 'type', e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 appearance-none cursor-pointer focus:border-indigo-500 outline-none">
                                                <option value="scale">Métrica 0-10</option>
                                                <option value="text">Campo de Texto</option>
                                                <option value="select">Múltipla Escolha</option>
                                                <option value="yesno">Decisão Binária (S/N)</option>
                                            </select>
                                            <ChevronRight size={14} className="absolute right-3 top-3 text-slate-600 rotate-90" />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer group/check">
                                            <input
                                                type="checkbox"
                                                checked={q.required}
                                                onChange={(e) => updateQuestion(q.id, 'required', e.target.checked)}
                                                className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-indigo-600 transition-all cursor-pointer"
                                            />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover/check:text-indigo-400 transition-colors">Obrigatório</span>
                                        </label>
                                    </div>
                                </div>
                                <button onClick={() => deleteQuestion(q.id)} className="opacity-0 group-hover:opacity-100 text-rose-500 p-3 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={20} /></button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <button onClick={addQuestion} className="flex-1 py-8 border-2 border-dashed border-white/10 rounded-[2rem] text-slate-600 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs">
                            <Plus size={24} /> Criar Novo Campo de Análise
                        </button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-24 px-12 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 shadow-2xl shadow-indigo-900/40 font-black uppercase tracking-[0.2em] text-sm border-none gap-4"
                        >
                            {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                            {saving ? 'Validando...' : 'Propagar no Reino'}
                        </Button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {selectedResponse && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-6" onClick={() => setSelectedResponse(null)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl">
                            <div className="p-10 border-b border-white/5 flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-inner border border-white/10 ${selectedResponse.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-400' : selectedResponse.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{selectedResponse.userAvatar}</div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">{selectedResponse.userName}</h3>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Registro Biomático: {selectedResponse.date}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedResponse(null)} className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"><X size={20} /></button>
                            </div>
                            <div className="p-10 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Nível de Risco</span>
                                        <div className="pt-2">{getRiskBadge(selectedResponse.riskLevel)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Score Qualitativo</span>
                                        <div className="text-3xl font-black text-white pt-1">{selectedResponse.riskScore}<span className="text-slate-600 font-light">/10</span></div>
                                    </div>
                                </div>

                                <div className="glass-panel p-8 rounded-[2rem] border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl" />
                                    <div className="flex items-center gap-3 mb-4 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                                        <Sparkles size={16} /> Análise Interpretativa Nutri.AI
                                    </div>
                                    <p className="text-slate-300 text-base leading-relaxed font-light italic">"{selectedResponse.summary}"</p>
                                </div>

                                <Button className="w-full h-16 bg-white hover:bg-slate-200 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-2xl shadow-white/5 border-none">
                                    <MessageSquare size={18} /> Iniciar Intervenção Direta
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
