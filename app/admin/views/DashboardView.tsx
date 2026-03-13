"use client"

import { useState, useEffect, useCallback } from "react"
import {
    TrendingUp, Users, AlertCircle, MessageCircle, CheckCircle,
    ChevronRight, Crown, DollarSign, ArrowUpRight, Zap, Calendar,
    Trophy, Sparkles, Brain, Activity, Target, Flame, Clock, FileText,
    Bell, Send, BarChart2, ChevronUp, RefreshCw, Star, Award,
    Droplets, Check, X as XIcon, AlertTriangle, Heart,
    TrendingDown, Layers, Lightbulb, ChevronDown
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

// ─── Types ───────────────────────────────────────────────────────────────────

interface InboxItem {
    id: number
    name: string
    initials: string
    status: 'risk' | 'question' | 'win' | 'warning'
    msg: string
    time: string
    aiAction?: string
}

interface Queen {
    id: number
    name: string
    initials: string
    xp: number
    progress: number
    streak: number
    rank: 1 | 2 | 3
}

interface AgendaItem {
    id: number
    time: string
    title: string
    type: 'protocol' | 'check' | 'campaign' | 'consult'
    done: boolean
}

interface AIInsight {
    id: number
    icon?: React.ReactNode
    iconType?: string
    title: string
    body: string
    action: string
    view: string
    urgency: 'high' | 'medium' | 'low'
}

function InsightIcon({ iconType }: { iconType?: string }) {
    if (iconType === 'alert') return <AlertTriangle size={18} className="text-rose-400" />
    if (iconType === 'trend') return <TrendingUp size={18} className="text-amber-400" />
    if (iconType === 'trophy') return <Trophy size={18} className="text-yellow-400" />
    return <Lightbulb size={18} className="text-indigo-400" />
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#818cf8" }: { data: number[]; color?: string }) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const w = 100
    const h = 36
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((v - min) / range) * (h - 4) - 2
        return `${x},${y}`
    })
    const path = `M${pts.join(" L")}`
    const fill = `M${pts[0]} ${pts.map(p => `L${p}`).join(" ")} L${w},${h} L0,${h} Z`

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
            <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={fill} fill="url(#sg)" />
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 52, color = "#818cf8", rank }: { pct: number; size?: number; color?: string; rank: number }) {
    const r = (size - 6) / 2
    const circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ
    const medals = ['🥇', '🥈', '🥉']
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm">
                {medals[rank - 1]}
            </div>
        </div>
    )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
    label, value, sub, icon, trend, color = "indigo", sparkData, delay = 0
}: {
    label: string; value: string; sub: string; icon: React.ReactNode
    trend?: number | null; color?: string; sparkData?: number[]; delay?: number
}) {
    const colors: Record<string, { bg: string; border: string; text: string; spark: string }> = {
        indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", spark: "#818cf8" },
        emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", spark: "#34d399" },
        rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", spark: "#fb7185" },
        amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", spark: "#fbbf24" },
        violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", spark: "#a78bfa" },
    }
    const c = colors[color] || colors.indigo
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4, ease: "easeOut" }}
            className={`rounded-2xl p-5 ${c.bg} border ${c.border} flex flex-col gap-3 relative overflow-hidden`}
        >
            <div className="flex items-start justify-between">
                <div className={`${c.bg} border ${c.border} p-2 rounded-xl`}>
                    <div className={c.text}>{icon}</div>
                </div>
                {trend !== undefined && (
                    <span className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg
                        ${trend >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {trend >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
            </div>
            {sparkData && (
                <div className="mt-1 opacity-70">
                    <Sparkline data={sparkData} color={c.spark} />
                </div>
            )}
        </motion.div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardView({
    setView, userName = '', tenantName = '', tenantId = ''
}: {
    setView: (v: any) => void; userName?: string; tenantName?: string; tenantId?: string
}) {
    const [greeting, setGreeting] = useState("")
    const [loading, setLoading] = useState(true)
    const [activeProtocol, setActiveProtocol] = useState<any>(null)
    const [methodName, setMethodName] = useState("")
    const [expandedInsight, setExpandedInsight] = useState<number | null>(null)
    const [agendaDone, setAgendaDone] = useState<number[]>([])
    const [stats, setStats] = useState({
        activeQueens: 0,
        totalPatients: 0,
        adherence: 0,
        criticalAlerts: 0,
        totalXP: 0,
        activeProtocols: 0,
    })
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([])
    const [topQueens, setTopQueens] = useState<Queen[]>([])
    const [insights, setInsights] = useState<AIInsight[]>([])

    const agenda: AgendaItem[] = [
        { id: 1, time: '09:00', title: 'IA de engajamento — análise diária das pacientes', type: 'check', done: new Date().getHours() >= 9 },
        { id: 2, time: '12:00', title: 'Janela de check-in disponível para pacientes', type: 'check', done: new Date().getHours() >= 12 },
        { id: 3, time: '18:00', title: 'Disparo automático de lembretes para inativas', type: 'campaign', done: new Date().getHours() >= 18 },
        { id: 4, time: '20:00', title: 'Consolidação de XP e atualização de rankings', type: 'check', done: new Date().getHours() >= 20 },
    ]

    const revenueHistory = [0, 0, 0, 0, 0, 0, 0]
    const adherenceHistory = [0, 0, 0, 0, 0, 0, stats.adherence]
    const queensHistory = [0, 0, 0, 0, 0, 0, stats.activeQueens]

    useEffect(() => {
        const h = new Date().getHours()
        if (h < 12) setGreeting("Bom dia")
        else if (h < 18) setGreeting("Boa tarde")
        else setGreeting("Boa noite")
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const res = await fetch('/api/admin/dashboard')
            if (res.ok) {
                const data = await res.json()
                setStats(data.stats)
                setMethodName(data.methodName || '')
                setActiveProtocol(data.activeProtocol)
                const inbox = (data.atRisk || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    initials: p.initials,
                    status: p.riskLevel === 'high' ? 'risk' : 'warning',
                    msg: p.summary,
                    time: p.daysSince === 0 ? 'hoje' : p.daysSince === 1 ? '1d' : String(p.daysSince) + 'd',
                    aiAction: p.riskLevel === 'high' ? 'Enviar mensagem de resgate' : 'Enviar dica motivacional',
                }))
                setInboxItems(inbox)
                setTopQueens(data.topQueens || [])
                const iconMap: Record<string, string> = {
                    alert: 'alert', trend: 'trend', trophy: 'trophy', star: 'star',
                }
                setInsights((data.insights || []).map((ins: any) => ({ ...ins, iconType: ins.iconType })))
            }
        } catch (err) {
            console.error('[Dashboard] loadData error:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleAgenda = (id: number) => {
        setAgendaDone(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const agendaTypeStyle: Record<string, { dot: string; label: string }> = {
        protocol: { dot: 'bg-indigo-400', label: 'Protocolo' },
        check: { dot: 'bg-violet-400', label: 'Check-in' },
        campaign: { dot: 'bg-amber-400', label: 'Campanha' },
        consult: { dot: 'bg-emerald-400', label: 'Consulta' },
    }

    const statusColors: Record<string, string> = {
        risk: 'bg-rose-500',
        question: 'bg-amber-500',
        win: 'bg-emerald-500',
        warning: 'bg-orange-500',
    }
    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'risk') return <AlertCircle size={12} className="text-white" />
        if (status === 'question') return <MessageCircle size={12} className="text-white" />
        if (status === 'win') return <CheckCircle size={12} className="text-white" />
        return <AlertTriangle size={12} className="text-white" />
    }

    const protocolDays = Array.from({ length: activeProtocol?.duration_days || 21 }, (_, i) => i + 1)
    const protocolDay = 1
    const protocolTotal = activeProtocol?.duration_days || 21

    const urgencyBorder: Record<string, string> = {
        high: 'border-rose-500/30 bg-rose-500/5',
        medium: 'border-amber-500/30 bg-amber-500/5',
        low: 'border-indigo-500/20 bg-indigo-500/5',
    }

    return (
        <div className="min-h-screen pt-4 pb-20 space-y-8">

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 mb-1">
                        <div className="bg-indigo-600/20 p-1.5 rounded-lg border border-indigo-500/30">
                            <Brain className="text-indigo-400" size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                            Centro de Comando
                        </span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-light text-white">
                        {greeting}, <span className="font-bold">{userName?.split(' ')[0]}</span>
                    </motion.h1>
                    <p className="text-slate-500 text-xs font-medium">
                        {tenantName}{methodName ? ` • Método ${methodName}` : ''} • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setView('club-plan')} variant="outline"
                        className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs">
                        <Calendar size={15} className="mr-2" /> Plano do Clube
                    </Button>
                    <Button onClick={() => setView('communication')}
                        className="h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-900/30">
                        <Zap size={15} className="mr-2" /> Central de Ação
                    </Button>
                </div>
            </div>

            {/* ── KPI GRID (5 cards) ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard label="Protocolo Ativo" value={String(stats.activeProtocols || 0)} sub="Atribuídos agora"
                    icon={<FileText size={18} />} color="indigo"
                    delay={0} />
                <KPICard label="Rainhas Ativas" value={String(stats.activeQueens)} sub="Em protocolo"
                    icon={<Users size={18} />} color="violet" trend={5}
                    sparkData={queensHistory} delay={0.06} />
                <KPICard label="Adesão Média" value={`${stats.adherence}%`} sub="Esta semana"
                    icon={<Activity size={18} />} color="emerald" trend={8}
                    sparkData={adherenceHistory} delay={0.12} />
                <KPICard label="Alertas Críticos" value={String(stats.criticalAlerts)} sub="Requerem ação"
                    icon={<AlertCircle size={18} />} color="rose" delay={0.18} />
                <KPICard label="Total de XP" value={stats.totalXP.toLocaleString('pt-BR')} sub="Engajamento do clube"
                    icon={<Trophy size={18} />} color="amber" trend={3} delay={0.24} />
            </div>

            {/* ── AI INSIGHTS ───────────────────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Insights da IA
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {insights.map((ins, i) => (
                        <motion.div key={ins.id}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                            className={`rounded-2xl border p-4 cursor-pointer transition-all ${urgencyBorder[ins.urgency]} hover:brightness-110`}
                            onClick={() => setExpandedInsight(expandedInsight === ins.id ? null : ins.id)}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">{ins.icon || <InsightIcon iconType={ins.iconType} />}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white leading-snug">{ins.title}</p>
                                    <AnimatePresence>
                                        {expandedInsight === ins.id && (
                                            <motion.div initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}>
                                                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{ins.body}</p>
                                                <button onClick={(e) => { e.stopPropagation(); setView(ins.view) }}
                                                    className="mt-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1">
                                                    {ins.action} <ChevronRight size={12} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <ChevronDown size={14} className={`text-slate-600 shrink-0 transition-transform ${expandedInsight === ins.id ? 'rotate-180' : ''}`} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* ── MAIN GRID ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN (60%) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* ── PROTOCOLO ATIVO ───────────────────────────────── */}
                    <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="relative overflow-hidden rounded-3xl p-7 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 to-transparent" />
                        <div className="absolute -top-20 -right-20 w-56 h-56 bg-indigo-600/8 blur-[80px] rounded-full" />

                        <div className="relative z-10">
                            {/* Protocol header */}
                            <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-500/30 flex items-center gap-1.5">
                                        <Sparkles size={12} /> Protocolo Ativo
                                    </span>
                                    <span className="text-slate-500 text-xs font-semibold">
                                        Protocolo ativo
                                    </span>
                                </div>
                                <span className="text-emerald-400 flex items-center gap-1.5 text-[11px] font-bold bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-800/50">
                                    <ArrowUpRight size={14} /> Alta Adesão
                                </span>
                            </div>

                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 italic tracking-tight">
                                {activeProtocol?.title || "Folia & Hidratação 💧"}
                            </h2>
                            <p className="text-slate-400 mb-6 text-sm leading-relaxed max-w-xl">
                                {activeProtocol?.description || "Foco atual: adesão aos shots matinais e registro diário de água. Semana 2 rodando com alta performance."}
                            </p>

                            {/* Progress + Stats row */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-center">
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mb-1">Adesão</p>
                                    <p className="text-2xl font-bold text-white">{stats.adherence}<span className="text-base text-slate-500">%</span></p>
                                </div>
                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-center">
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mb-1">Rainhas</p>
                                    <p className="text-2xl font-bold text-white">{stats.activeQueens}</p>
                                </div>
                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-center">
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mb-1">Check-ins Hoje</p>
                                    <p className="text-2xl font-bold text-white">89</p>
                                </div>
                            </div>

                            {/* Day pills */}
                            <div className="mb-6">
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mb-2">Progresso do Protocolo</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {protocolDays.map(d => (
                                        <div key={d}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all
                                            ${d < protocolDay
                                                ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-300'
                                                : d === protocolDay
                                                    ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-110'
                                                    : 'bg-white/3 border-white/5 text-slate-700'}`}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mb-6 bg-black/20 p-4 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Adesão Clínica Geral</span>
                                    <span className="text-white text-sm font-bold">{stats.adherence}%</span>
                                </div>
                                <div className="w-full bg-slate-800/50 h-2 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${stats.adherence}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="bg-gradient-to-r from-indigo-400 to-violet-500 h-full rounded-full relative">
                                        <div className="absolute right-0 top-0 h-full w-0.5 bg-white/40" />
                                    </motion.div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => setView('checkins')}
                                    className="h-11 bg-white text-indigo-950 font-black px-8 rounded-xl hover:bg-slate-100 shadow-xl text-sm">
                                    <MessageCircle size={16} className="mr-2" /> Incentivar Tribo
                                </Button>
                                <Button onClick={() => setView('protocols')} variant="outline"
                                    className="h-11 border-white/15 text-slate-300 px-8 rounded-xl hover:bg-white/5 text-sm">
                                    Ver Protocolo Completo
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* ── AGENDA DO DIA ─────────────────────────────────── */}
                    <div className="rounded-3xl p-6 bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Clock size={16} className="text-indigo-400" />
                                Agenda de Hoje
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                {agendaDone.length + agenda.filter(a => a.done).length}/{agenda.length} concluídos
                            </span>
                        </div>
                        <div className="space-y-2">
                            {agenda.map((item, i) => {
                                const isDone = item.done || agendaDone.includes(item.id)
                                const ts = agendaTypeStyle[item.type]
                                return (
                                    <motion.div key={item.id}
                                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06 }}
                                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all
                                            ${isDone ? 'bg-white/2 border-white/5 opacity-50' : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.05]'}`}>
                                        <span className="text-[11px] font-bold text-slate-600 w-12 shrink-0">{item.time}</span>
                                        <div className={`w-2 h-2 rounded-full ${ts.dot} shrink-0`} />
                                        <p className={`flex-1 text-sm ${isDone ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                                            {item.title}
                                        </p>
                                        <span className="text-[10px] text-slate-700 font-black uppercase tracking-widest hidden md:block">{ts.label}</span>
                                        <button onClick={() => toggleAgenda(item.id)}
                                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0
                                                ${isDone ? 'bg-emerald-500/20 border-emerald-500/40' : 'border-white/10 hover:border-emerald-500/40'}`}>
                                            <Check size={13} className={isDone ? 'text-emerald-400' : 'text-slate-700'} />
                                        </button>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── PRIORIDADES CLÍNICAS ───────────────────────────── */}
                    <div className="rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Bell size={16} className="text-rose-400" />
                                Prioridades Clínicas
                                <span className="text-slate-600 text-xs font-normal">/ Inbox</span>
                            </h3>
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1.5">
                                <AlertCircle size={12} /> {inboxItems.filter(i => i.status === 'risk').length} críticos
                            </span>
                        </div>

                        <div className="space-y-3">
                            {inboxItems.map((item, index) => (
                                <motion.div key={item.id}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.08 }}
                                    className="group rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all overflow-hidden"
                                >
                                    <div className="flex items-center gap-4 p-4">
                                        <div className="relative shrink-0">
                                            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-sm border border-white/10 group-hover:border-indigo-500/40 transition-colors">
                                                {item.initials}
                                            </div>
                                            <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-lg border-2 border-[#0f172a] ${statusColors[item.status]}`}>
                                                <StatusIcon status={item.status} />
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                            <p className={`text-xs mt-0.5 truncate ${item.status === 'risk' ? 'text-rose-300 font-semibold' : item.status === 'win' ? 'text-emerald-300' : 'text-slate-400'}`}>
                                                {item.msg}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[11px] text-slate-600 font-bold uppercase hidden sm:block">{item.time}</span>
                                            <button onClick={() => setView('checkins')}
                                                className="bg-white/5 hover:bg-indigo-600 text-white p-2 rounded-xl transition-all border border-white/5 group-hover:scale-105">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI action suggestion */}
                                    {item.aiAction && (
                                        <div className="px-4 pb-3 flex items-center gap-2">
                                            <Sparkles size={11} className="text-indigo-500 shrink-0" />
                                            <p className="text-[11px] text-slate-600 flex-1 truncate">IA sugere: {item.aiAction}</p>
                                            <button onClick={() => setView('checkins')}
                                                className="text-[11px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition shrink-0">
                                                Executar →
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        <button onClick={() => setView('checkins')}
                            className="w-full mt-4 py-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 rounded-2xl border border-transparent hover:border-indigo-500/10 transition-all flex items-center justify-center gap-2">
                            Ver todos os pacientes <ChevronRight size={14} />
                        </button>
                    </div>
                </div>

                {/* RIGHT COLUMN (40%) */}
                <div className="space-y-6">

                    {/* ── FINANCEIRO ────────────────────────────────────── */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="rounded-3xl p-6 bg-gradient-to-br from-indigo-900/20 to-teal-900/10 backdrop-blur-xl border border-indigo-500/20 relative overflow-hidden shadow-xl">
                        <div className="absolute -right-8 -top-8 text-indigo-500/5 rotate-12">
                            <DollarSign size={120} />
                        </div>

                        <p className="text-[10px] text-indigo-300 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2 relative z-10">
                            <Users size={14} /> Visão Geral do Clube
                        </p>

                        <div className="flex items-end gap-2 mb-1 relative z-10">
                            <span className="text-4xl font-light text-white tracking-tight">{stats.activeQueens}</span>
                            <span className="text-sm text-slate-500 mb-1">ativas</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mb-4 relative z-10">de {stats.totalPatients} total</p>

                        <div className="relative z-10 mb-5">
                            <Sparkline data={queensHistory} color="#818cf8" />
                            <div className="flex justify-between text-[10px] text-slate-700 font-bold mt-1">
                                <span>6 meses atrás</span><span>Hoje</span>
                            </div>
                        </div>

                        {/* Upsell opportunity */}
                        <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/20 border border-amber-500/20 rounded-2xl p-4 relative z-10">
                            <div className="flex items-start gap-3">
                                <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-500/30 shrink-0">
                                    <Crown size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-100 text-sm mb-1">Oportunidade Upsell</h4>
                                    <p className="text-xs text-amber-100/60 leading-relaxed">
                                        <strong className="text-white">{stats.activeQueens} Rainhas</strong> com protocolo ativo.
                                        Potencial: <strong className="text-amber-400">+R$ 10.680</strong>
                                    </p>
                                    <Button onClick={() => setView('patients')}
                                        className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-xs py-2.5 rounded-xl shadow-lg shadow-amber-900/30 h-auto">
                                        Disparar Convite VIP →
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ── RANKING ───────────────────────────────────────── */}
                    <div className="rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black flex items-center gap-2">
                                <Trophy size={14} className="text-amber-400" /> Ranking
                            </h3>
                            <button onClick={() => setView('rewards')}
                                className="text-[11px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition">
                                Ver tudo →
                            </button>
                        </div>

                        <div className="space-y-4">
                            {topQueens.map((queen) => (
                                <div key={queen.id}
                                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all
                                        ${queen.rank === 1 ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/[0.02] border border-white/5'}`}>
                                    <ProgressRing pct={queen.progress} rank={queen.rank}
                                        color={queen.rank === 1 ? '#818cf8' : queen.rank === 2 ? '#94a3b8' : '#d97706'} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-white truncate">{queen.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Flame size={11} className="text-orange-400" />
                                            <span className="text-[11px] text-slate-600">{queen.streak} dias</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`text-base font-black block ${queen.rank === 1 ? 'text-indigo-300' : 'text-slate-500'}`}>
                                            {queen.xp.toLocaleString('pt-BR')}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-700 uppercase">XP</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button onClick={() => setView('rewards')} variant="outline"
                            className="w-full mt-5 h-10 border-white/10 text-indigo-400 hover:bg-indigo-500/5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2">
                            Postar Ranking no Stories 📸
                        </Button>
                    </div>

                    {/* ── AÇÕES RÁPIDAS ─────────────────────────────────── */}
                    <div className="rounded-3xl p-6 bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black mb-4 flex items-center gap-2">
                            <Zap size={13} className="text-indigo-400" /> Ações Rápidas
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Novo Check-in', icon: <MessageCircle size={16} />, view: 'checkins' },
                                { label: 'Ver Rainhas', icon: <Users size={16} />, view: 'patients' },
                                { label: 'Comunicação', icon: <Send size={16} />, view: 'communication' },
                                { label: 'Protocolos', icon: <Layers size={16} />, view: 'protocols' },
                            ].map((a) => (
                                <button key={a.label} onClick={() => setView(a.view)}
                                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/8 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-slate-500 hover:text-indigo-400 transition-all group">
                                    <div className="group-hover:scale-110 transition-transform">{a.icon}</div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight">{a.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
