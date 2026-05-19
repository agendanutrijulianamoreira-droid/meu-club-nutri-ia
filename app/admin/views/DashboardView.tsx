"use client"

import { useState, useEffect, useCallback } from "react"
import {
    TrendingUp, Users, AlertCircle, MessageCircle, CheckCircle,
    ChevronRight, Crown, DollarSign, ArrowUpRight, Zap, Calendar,
    Trophy, Sparkles, Brain, Activity, Target, Flame, Clock,
    Bell, Send, BarChart2, ChevronUp, RefreshCw, Star, Award,
    Droplets, Check, X as XIcon, AlertTriangle, Heart,
    TrendingDown, Layers, Lightbulb, ChevronDown, Loader2,
    UserCheck, Coins, FileText, Dumbbell, ShieldCheck
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

// ==========================================
// TYPES
// ==========================================

interface RealStats {
    totalPatients: number
    activePatients: number
    todayCheckins: number
    activeProtocols: number
    totalXP: number
    criticalAlerts: number
    avgStreak: number
    aiCreditsRemaining: number | null
}

interface PatientAlert {
    id: string
    name: string
    initials: string
    status: 'risk' | 'inactive' | 'win' | 'question'
    msg: string
    time: string
    daysSinceCheckin: number
    streak: number
}

interface RecentPatient {
    id: string
    name: string
    initials: string
    email: string | null
    current_plan: string
    current_streak: number
    total_xp: number
    updated_at: string
    last_checkin_date: string | null
}

interface TopPlayer {
    id: string
    name: string
    initials: string
    total_xp: number
    current_streak: number
    current_level: number
}

interface ActiveProtocol {
    id: string
    title: string
    description: string | null
    duration_days: number
    category: string
    scheduled_status: string
    created_at: string
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

function Sparkline({ data, color = "#818cf8" }: { data: number[]; color?: string }) {
    if (!data || data.length < 2) return null
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
    const w = 100, h = 36
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
                <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function KPICard({ label, value, sub, icon, trend, color = "indigo", sparkData, delay = 0, onClick }: {
    label: string; value: string; sub: string; icon: React.ReactNode
    trend?: number; color?: string; sparkData?: number[]; delay?: number; onClick?: () => void
}) {
    const colors: Record<string, { bg: string; border: string; text: string; spark: string }> = {
        indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-500/20",  text: "text-indigo-400",  spark: "#818cf8" },
        emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", spark: "#34d399" },
        rose:    { bg: "bg-rose-500/10",    border: "border-rose-500/20",    text: "text-rose-400",    spark: "#fb7185" },
        amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/20",  text: "text-amber-400",   spark: "#fbbf24" },
        violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-400",  spark: "#a78bfa" },
        cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-400",    spark: "#22d3ee" },
    }
    const c = colors[color] || colors.indigo
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4, ease: "easeOut" }}
            onClick={onClick}
            className={`rounded-2xl p-5 ${c.bg} border ${c.border} flex flex-col gap-3 relative overflow-hidden ${onClick ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`}>
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
            {sparkData && sparkData.length > 1 && <div className="mt-1 opacity-70"><Sparkline data={sparkData} color={c.spark} /></div>}
        </motion.div>
    )
}

function ProgressRing({ pct, size = 52, color = "#818cf8", rank }: { pct: number; size?: number; color?: string; rank: number }) {
    const r = (size - 6) / 2, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
    const medals = ['🥇', '🥈', '🥉']
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm">{medals[rank - 1]}</div>
        </div>
    )
}

// ==========================================
// MAIN DASHBOARD
// ==========================================

export function DashboardView({ setView, userName = '', tenantName = '', tenantId = '' }: {
    setView: (v: any) => void; userName?: string; tenantName?: string; tenantId?: string
}) {
    const [greeting, setGreeting] = useState("")
    const [loading, setLoading] = useState(true)
    const [methodName, setMethodName] = useState("")
    const [expandedInsight, setExpandedInsight] = useState<number | null>(null)

    // Real data states
    const [stats, setStats] = useState<RealStats>({
        totalPatients: 0, activePatients: 0, todayCheckins: 0,
        activeProtocols: 0, totalXP: 0, criticalAlerts: 0,
        avgStreak: 0, aiCreditsRemaining: null
    })
    const [alerts, setAlerts] = useState<PatientAlert[]>([])
    const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([])
    const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([])
    const [activeProtocol, setActiveProtocol] = useState<ActiveProtocol | null>(null)
    const [checkinHistory, setCheckinHistory] = useState<number[]>([])
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

    useEffect(() => {
        const h = new Date().getHours()
        if (h < 12) setGreeting("Bom dia")
        else if (h < 18) setGreeting("Boa tarde")
        else setGreeting("Boa noite")
        loadRealData()
    }, [])

    const loadRealData = async () => {
        try {
            // 1. Tenant info
            if (tenantId) {
                const { data: tenant } = await supabase.from('tenants').select('method_name').eq('id', tenantId).single()
                if (tenant?.method_name) setMethodName(tenant.method_name)
            }

            // 2. All patients for this tenant
            const { data: patients, error: patientsErr } = await supabase
                .from('profiles')
                .select('id, name, email, current_plan, current_streak, total_xp, updated_at, last_checkin_date, role')
                .eq('tenant_id', tenantId)
                .eq('role', 'patient')
                .order('updated_at', { ascending: false })

            const allPatients = patients || []
            const today = new Date().toISOString().split('T')[0]
            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            // 3. Today's check-ins
            const { count: todayCheckins } = await supabase
                .from('daily_logs')
                .select('id', { count: 'exact', head: true })
                .eq('log_date', today)

            // 4. Active protocols
            const { data: protocols } = await supabase
                .from('protocols')
                .select('id, title, description, duration_days, category, scheduled_status, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })

            const activeProtos = protocols?.filter(p => p.scheduled_status === 'active') || []
            if (activeProtos.length > 0) setActiveProtocol(activeProtos[0])

            // 5. AI Credits (try, may not exist yet)
            let aiCreditsRemaining: number | null = null
            try {
                const { data: credits } = await supabase
                    .from('ai_credits')
                    .select('credits_remaining')
                    .eq('tenant_id', tenantId)
                    .single()
                if (credits) aiCreditsRemaining = credits.credits_remaining
            } catch {}

            // 6. Check-in history (last 7 days)
            const last7days: number[] = []
            for (let i = 6; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                const { count } = await supabase
                    .from('daily_logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('log_date', date)
                last7days.push(count || 0)
            }
            setCheckinHistory(last7days)

            // 7. Pending agent approvals count
            try {
                const { count: pendingCount } = await supabase
                    .from('agent_pending_actions')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'pending')
                setPendingApprovalsCount(pendingCount || 0)
            } catch {}

            // Build patient alerts (inactive patients = risk)
            const patientAlerts: PatientAlert[] = []
            const recentPats: RecentPatient[] = []

            allPatients.forEach(p => {
                const initials = p.name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '??'
                
                recentPats.push({
                    id: p.id,
                    name: p.name,
                    initials,
                    email: p.email,
                    current_plan: p.current_plan || 'community',
                    current_streak: p.current_streak || 0,
                    total_xp: p.total_xp || 0,
                    updated_at: p.updated_at,
                    last_checkin_date: p.last_checkin_date
                })

                // Detect risk: no check-in in 3+ days
                if (p.last_checkin_date && p.last_checkin_date < twoDaysAgo) {
                    const daysSince = Math.floor((Date.now() - new Date(p.last_checkin_date).getTime()) / (1000 * 60 * 60 * 24))
                    patientAlerts.push({
                        id: p.id,
                        name: p.name,
                        initials,
                        status: daysSince >= 7 ? 'risk' : 'inactive',
                        msg: daysSince >= 7
                            ? `⚠️ Sem check-in há ${daysSince} dias! Risco alto de evasão.`
                            : `📉 Sem check-in há ${daysSince} dias. Atenção.`,
                        time: `${daysSince}d`,
                        daysSinceCheckin: daysSince,
                        streak: p.current_streak || 0
                    })
                } else if (!p.last_checkin_date) {
                    patientAlerts.push({
                        id: p.id,
                        name: p.name,
                        initials,
                        status: 'question',
                        msg: 'Nunca fez check-in. Precisa de onboarding.',
                        time: 'Novo',
                        daysSinceCheckin: 999,
                        streak: 0
                    })
                }

                // Detect wins: high streak
                if ((p.current_streak || 0) >= 7) {
                    patientAlerts.push({
                        id: p.id + '-win',
                        name: p.name,
                        initials,
                        status: 'win',
                        msg: `🔥 ${p.current_streak} dias de streak! Paciente destaque.`,
                        time: `${p.current_streak}d`,
                        daysSinceCheckin: 0,
                        streak: p.current_streak
                    })
                }
            })

            // Sort alerts: risk first, then inactive, then question, then wins
            patientAlerts.sort((a, b) => {
                const order = { risk: 0, inactive: 1, question: 2, win: 3 }
                return (order[a.status] || 99) - (order[b.status] || 99)
            })

            setAlerts(patientAlerts.slice(0, 8))
            setRecentPatients(recentPats.slice(0, 6))

            // Top players by XP
            const tops = [...allPatients].sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0)).slice(0, 3)
            setTopPlayers(tops.map((p, i) => ({
                id: p.id,
                name: p.name,
                initials: p.name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '??',
                total_xp: p.total_xp || 0,
                current_streak: p.current_streak || 0,
                current_level: 1
            })))

            // Calculate stats
            const activePatients = allPatients.filter(p => {
                if (!p.last_checkin_date) return false
                return p.last_checkin_date >= twoDaysAgo
            }).length

            const totalXP = allPatients.reduce((sum, p) => sum + (p.total_xp || 0), 0)
            const avgStreak = allPatients.length > 0
                ? Math.round(allPatients.reduce((sum, p) => sum + (p.current_streak || 0), 0) / allPatients.length)
                : 0
            const criticalAlerts = patientAlerts.filter(a => a.status === 'risk').length

            setStats({
                totalPatients: allPatients.length,
                activePatients,
                todayCheckins: todayCheckins || 0,
                activeProtocols: activeProtos.length,
                totalXP,
                criticalAlerts,
                avgStreak,
                aiCreditsRemaining
            })

        } catch (err) {
            console.error('[Dashboard] Erro ao carregar dados:', err)
        } finally {
            setLoading(false)
        }
    }

    const statusColors: Record<string, string> = {
        risk: 'bg-rose-500', inactive: 'bg-orange-500', win: 'bg-emerald-500', question: 'bg-amber-500',
    }

    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'risk') return <AlertCircle size={12} className="text-white" />
        if (status === 'inactive') return <Clock size={12} className="text-white" />
        if (status === 'win') return <CheckCircle size={12} className="text-white" />
        return <MessageCircle size={12} className="text-white" />
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 text-sm font-medium">Carregando seu painel...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-4 pb-20 space-y-8">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-1">
                        <div className="bg-indigo-600/20 p-1.5 rounded-lg border border-indigo-500/30">
                            <Brain className="text-indigo-400" size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Centro de Comando</span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-light text-white">
                        {greeting}, <span className="font-bold">{userName?.split(' ')[0]}</span>
                    </motion.h1>
                    <p className="text-slate-500 text-xs font-medium">
                        {tenantName}{methodName ? ` • Método ${methodName}` : ''} • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setView('club-plan')} variant="outline" className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs">
                        <Calendar size={15} className="mr-2" /> Plano do Clube
                    </Button>
                    <Button onClick={() => setView('communication')} className="h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-900/30">
                        <Zap size={15} className="mr-2" /> Central de Ação
                    </Button>
                </div>
            </div>

            {/* ============================================ */}
            {/* 0. AÇÕES RÁPIDAS — O QUE FAZER AGORA */}
            {/* ============================================ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Nova Paciente', emoji: '👑', color: 'indigo', action: () => setView('patients') },
                    { label: 'Enviar Comunicado', emoji: '💬', color: 'violet', action: () => setView('communication') },
                    { label: 'Gerar Protocolo', emoji: '📋', color: 'emerald', action: () => setView('protocols') },
                    { label: 'Ver Aprovações IA', emoji: '🤖', color: pendingApprovalsCount > 0 ? 'amber' : 'slate', action: () => setView('agent-approvals'), badge: pendingApprovalsCount },
                ].map(({ label, emoji, color, action, badge }) => (
                    <button key={label} onClick={action}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group
                            ${color === 'indigo' ? 'bg-indigo-500/5 border-indigo-500/15 hover:border-indigo-500/40' :
                              color === 'violet' ? 'bg-violet-500/5 border-violet-500/15 hover:border-violet-500/40' :
                              color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/40' :
                              color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/50' :
                              'bg-white/5 border-white/10 hover:border-white/20'}`}>
                        <span className="text-xl">{emoji}</span>
                        <span className={`text-xs font-bold flex-1 ${
                            color === 'indigo' ? 'text-indigo-300' :
                            color === 'violet' ? 'text-violet-300' :
                            color === 'emerald' ? 'text-emerald-300' :
                            color === 'amber' ? 'text-amber-300' : 'text-slate-300'
                        } group-hover:text-white transition-colors`}>{label}</span>
                        {badge !== undefined && badge > 0 && (
                            <span className="h-5 min-w-5 px-1 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ============================================ */}
            {/* 1. KPIs — DADOS REAIS */}
            {/* ============================================ */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KPICard label="Total Pacientes" value={String(stats.totalPatients)} sub="Cadastrados" icon={<Users size={18}/>} color="indigo" delay={0} onClick={() => setView('patients')} />
                <KPICard label="Ativos Agora" value={String(stats.activePatients)} sub="Check-in recente" icon={<UserCheck size={18}/>} color="emerald" delay={0.06} onClick={() => setView('patients')} />
                <KPICard label="Check-ins Hoje" value={String(stats.todayCheckins)} sub="Registros do dia" icon={<Activity size={18}/>} color="violet" sparkData={checkinHistory} delay={0.12} onClick={() => setView('checkins')} />
                <KPICard label="Alertas Críticos" value={String(stats.criticalAlerts)} sub={stats.criticalAlerts > 0 ? "Requerem ação!" : "Tudo tranquilo"} icon={<AlertCircle size={18}/>} color={stats.criticalAlerts > 0 ? "rose" : "emerald"} delay={0.18} />
                <KPICard label="Protocolos Ativos" value={String(stats.activeProtocols)} sub="Em andamento" icon={<FileText size={18}/>} color="cyan" delay={0.24} onClick={() => setView('protocols')} />
                <KPICard label="Aprovações IA" value={String(pendingApprovalsCount)} sub={pendingApprovalsCount > 0 ? "Aguardando revisão" : "Tudo aprovado"} icon={<ShieldCheck size={18}/>} color={pendingApprovalsCount > 0 ? "amber" : "emerald"} delay={0.30} onClick={() => setView('agent-approvals')} />
            </div>
            {/* CTA for pending approvals */}
            {pendingApprovalsCount > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-3">
                    <ShieldCheck size={18} className="text-amber-400 shrink-0" />
                    <div className="flex-1">
                        <p className="text-amber-400 text-sm font-bold">
                            {pendingApprovalsCount} {pendingApprovalsCount === 1 ? 'ação aguarda' : 'ações aguardam'} sua aprovação
                        </p>
                        <p className="text-amber-600 text-xs">Agentes propuseram ações que precisam da sua revisão antes de serem executadas</p>
                    </div>
                    <button onClick={() => setView('agent-approvals')}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-xl transition-all">
                        Ver aprovações
                        <ChevronRight size={14} />
                    </button>
                </motion.div>
            )}

            {/* ============================================ */}
            {/* 2. ALERTAS DE PACIENTES — MOSTRADO PRIMEIRO */}
            {/* ============================================ */}
            {alerts.length > 0 && (
                <div className="rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Bell size={16} className="text-rose-400" />
                            Alertas de Pacientes
                            <span className="text-slate-600 text-xs font-normal">/ Ações Prioritárias</span>
                        </h3>
                        {stats.criticalAlerts > 0 && (
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1.5">
                                <AlertCircle size={12} /> {stats.criticalAlerts} críticos
                            </span>
                        )}
                    </div>
                    <div className="space-y-3">
                        {alerts.map((item, index) => (
                            <motion.div key={item.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.06 }}
                                className="group rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all overflow-hidden">
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
                                        <p className={`text-xs mt-0.5 truncate ${
                                            item.status === 'risk' ? 'text-rose-300 font-semibold' :
                                            item.status === 'win' ? 'text-emerald-300' : 'text-slate-400'
                                        }`}>
                                            {item.msg}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[11px] text-slate-600 font-bold uppercase hidden sm:block">{item.time}</span>
                                        <button onClick={() => setView('patients')} className="bg-white/5 hover:bg-indigo-600 text-white p-2 rounded-xl transition-all border border-white/5 group-hover:scale-105">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <button onClick={() => setView('patients')} className="w-full mt-4 py-3 text-[11px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 rounded-2xl border border-transparent hover:border-indigo-500/10 transition-all flex items-center justify-center gap-2">
                        Ver todos os pacientes <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* ============================================ */}
            {/* 3. GRID PRINCIPAL */}
            {/* ============================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-8">

                    {/* PROTOCOLO ATIVO */}
                    {activeProtocol ? (
                        <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                            className="relative overflow-hidden rounded-3xl p-7 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 to-transparent" />
                            <div className="absolute -top-20 -right-20 w-56 h-56 bg-indigo-600/8 blur-[80px] rounded-full" />
                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-500/30 flex items-center gap-1.5">
                                            <Sparkles size={12} /> Protocolo Ativo
                                        </span>
                                        <span className="text-slate-500 text-xs font-semibold">
                                            {activeProtocol.duration_days} dias • {activeProtocol.category || 'Custom'}
                                        </span>
                                    </div>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 italic tracking-tight">
                                    {activeProtocol.title}
                                </h2>
                                <p className="text-slate-400 mb-6 text-sm leading-relaxed max-w-xl">
                                    {activeProtocol.description || "Protocolo em andamento com o foco na adesão e engajamento das pacientes."}
                                </p>

                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    {[
                                        { label: 'Pacientes', value: String(stats.activePatients) },
                                        { label: 'Check-ins Hoje', value: String(stats.todayCheckins) },
                                        { label: 'Streak Médio', value: `${stats.avgStreak}d` },
                                    ].map(s => (
                                        <div key={s.label} className="bg-black/20 rounded-2xl p-4 border border-white/5 text-center">
                                            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mb-1">{s.label}</p>
                                            <p className="text-2xl font-bold text-white">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={() => setView('checkins')} className="h-11 bg-white text-indigo-950 font-black px-8 rounded-xl hover:bg-slate-100 shadow-xl text-sm">
                                        <MessageCircle size={16} className="mr-2" /> Ver Check-ins
                                    </Button>
                                    <Button onClick={() => setView('protocols')} variant="outline" className="h-11 border-white/15 text-slate-300 px-8 rounded-xl hover:bg-white/5 text-sm">
                                        Ver Protocolo Completo
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }}
                            className="relative overflow-hidden rounded-3xl p-7 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-center py-12">
                            <FileText size={48} className="mx-auto mb-4 text-slate-700" />
                            <h3 className="text-xl font-bold text-white mb-2">Nenhum protocolo ativo</h3>
                            <p className="text-slate-500 text-sm mb-6">Crie seu primeiro protocolo para começar a engajar suas pacientes.</p>
                            <Button onClick={() => setView('protocols')} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold px-8 py-3 rounded-xl">
                                <Sparkles size={16} className="mr-2" /> Criar Protocolo com IA
                            </Button>
                        </motion.div>
                    )}

                    {/* PACIENTES RECENTES */}
                    <div className="rounded-3xl p-6 bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Users size={16} className="text-indigo-400" />
                                Pacientes Recentes
                            </h3>
                            <button onClick={() => setView('patients')} className="text-[11px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition">
                                Ver todos →
                            </button>
                        </div>
                        {recentPatients.length === 0 ? (
                            <div className="text-center py-12">
                                <Users size={48} className="mx-auto mb-4 text-slate-700" />
                                <p className="text-slate-500 font-bold">Nenhuma paciente cadastrada ainda.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentPatients.map((p, i) => (
                                    <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-xs border border-white/10">
                                            {p.initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                                    p.current_plan === 'vip' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                    p.current_plan === 'tech_diet' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                                    'bg-white/5 text-slate-500 border border-white/10'
                                                }`}>
                                                    {p.current_plan === 'vip' ? '👑 VIP' : p.current_plan === 'tech_diet' ? '🧬 Tech Diet' : '🌱 Community'}
                                                </span>
                                                {p.current_streak > 0 && (
                                                    <span className="text-[10px] text-orange-400 flex items-center gap-1">
                                                        <Flame size={10} /> {p.current_streak}d
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-bold text-white">{p.total_xp.toLocaleString('pt-BR')}</span>
                                            <span className="text-[9px] text-slate-600 font-black uppercase block">XP</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">

                    {/* ENGAJAMENTO OVERVIEW */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="rounded-3xl p-6 bg-gradient-to-br from-indigo-900/20 to-teal-900/10 backdrop-blur-xl border border-indigo-500/20 relative overflow-hidden shadow-xl">
                        <div className="absolute -right-8 -top-8 text-indigo-500/5 rotate-12"><Trophy size={120} /></div>
                        <p className="text-[10px] text-indigo-300 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2 relative z-10">
                            <Activity size={14} /> Engajamento Geral
                        </p>
                        <div className="flex items-end gap-2 mb-1 relative z-10">
                            <span className="text-4xl font-light text-white tracking-tight">{stats.totalXP.toLocaleString('pt-BR')}</span>
                            <span className="text-[11px] text-slate-500 mb-1 font-bold">XP total</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mb-4 relative z-10">Streak médio: {stats.avgStreak} dias</p>
                        <div className="relative z-10 mb-2">
                            {checkinHistory.length > 1 && <Sparkline data={checkinHistory} color="#818cf8" />}
                            <div className="flex justify-between text-[10px] text-slate-700 font-bold mt-1">
                                <span>7 dias atrás</span><span>Hoje</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* RANKING */}
                    <div className="rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black flex items-center gap-2">
                                <Trophy size={14} className="text-amber-400" /> Ranking
                            </h3>
                            <button onClick={() => setView('rewards')} className="text-[11px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition">
                                Ver tudo →
                            </button>
                        </div>
                        {topPlayers.length === 0 ? (
                            <div className="text-center py-8">
                                <Trophy size={36} className="mx-auto mb-3 text-slate-700" />
                                <p className="text-slate-600 text-xs font-bold">Ranking aparecerá quando pacientes começarem.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topPlayers.map((queen, i) => (
                                    <div key={queen.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-all
                                        ${i === 0 ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/[0.02] border border-white/5'}`}>
                                        <ProgressRing pct={Math.min(100, (queen.total_xp / (topPlayers[0]?.total_xp || 1)) * 100)} rank={i + 1}
                                            color={i === 0 ? '#818cf8' : i === 1 ? '#94a3b8' : '#d97706'} />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{queen.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Flame size={11} className="text-orange-400" />
                                                <span className="text-[11px] text-slate-600">{queen.current_streak} dias</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-base font-black block ${i === 0 ? 'text-indigo-300' : 'text-slate-500'}`}>
                                                {queen.total_xp.toLocaleString('pt-BR')}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-700 uppercase">XP</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AÇÕES RÁPIDAS */}
                    <div className="rounded-3xl p-6 bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black mb-4 flex items-center gap-2">
                            <Zap size={13} className="text-indigo-400" /> Ações Rápidas
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Novo Check-in', icon: <MessageCircle size={16} />, view: 'checkins'      },
                                { label: 'Pacientes',     icon: <Users          size={16} />, view: 'patients'     },
                                { label: 'Comunicação',   icon: <Send           size={16} />, view: 'communication'},
                                { label: 'Protocolos',    icon: <Layers         size={16} />, view: 'protocols'    },
                                { label: 'Créditos IA',   icon: <Coins          size={16} />, view: 'ai-credits'   },
                                { label: 'Config. IA',    icon: <Brain          size={16} />, view: 'ai-brain'     },
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
