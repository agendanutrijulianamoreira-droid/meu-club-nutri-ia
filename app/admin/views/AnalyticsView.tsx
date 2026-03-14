"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
    TrendingUp, Users, Flame, Star, RefreshCw, Loader2,
    AlertTriangle, CheckCircle, ShieldAlert, BarChart3,
    Activity, Coins, Crown, ChevronRight
} from "lucide-react"

// ─── Mini sparkline SVG ──────────────────────────────────────────────────────
function Sparkline({ data, color = "#818cf8", height = 36 }: { data: number[]; color?: string; height?: number }) {
    if (!data.length) return null
    const max = Math.max(...data, 1)
    const w = 100, h = height
    const step = w / (data.length - 1)
    const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ data, color = "#818cf8", valueKey = "value", labelKey = "label" }: {
    data: any[]; color?: string; valueKey?: string; labelKey?: string
}) {
    if (!data.length) return null
    const max = Math.max(...data.map(d => d[valueKey]), 1)
    return (
        <div className="flex items-end gap-1 h-24">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(d[valueKey] / max) * 88}px` }}
                        transition={{ delay: i * 0.04, duration: 0.4 }}
                        className="w-full rounded-t-lg"
                        style={{ backgroundColor: color + "99", minHeight: d[valueKey] > 0 ? 4 : 0 }}
                    />
                    <span className="text-[8px] text-slate-700 font-bold truncate w-full text-center">{d[labelKey]}</span>
                </div>
            ))}
        </div>
    )
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────
function FunnelBar({ label, value, pct, color, delay }: {
    label: string; value: number; pct: number; color: string; delay: number
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{value}</span>
                    <span className="text-[10px] text-slate-600 w-8 text-right">{pct}%</span>
                </div>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay, duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                />
            </div>
        </div>
    )
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon, accent, sparkData }: {
    label: string; value: string | number; sub?: string
    icon: React.ReactNode; accent: string; sparkData?: number[]
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col gap-3"
        >
            <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl border ${accent}`}>{icon}</div>
            </div>
            <div>
                <p className="text-2xl font-bold text-white leading-none">{value}</p>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">{label}</p>
                {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
            </div>
            {sparkData && <Sparkline data={sparkData} color={accent.includes('indigo') ? '#818cf8' : accent.includes('emerald') ? '#34d399' : accent.includes('amber') ? '#fbbf24' : '#f472b6'} />}
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AnalyticsView({ setView }: { setView: (v: any) => void }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'8w' | '4w'>('8w')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/analytics')
            if (res.ok) setData(await res.json())
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    if (loading) return (
        <div className="flex justify-center items-center py-32">
            <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
    )

    if (!data) return (
        <div className="text-center py-32 text-slate-600">
            <p>Erro ao carregar analytics.</p>
            <button onClick={load} className="mt-3 text-indigo-400 text-sm">Tentar novamente</button>
        </div>
    )

    const { summary, weeklyAdherence, weeklyGrowth, funnel, scoreDistrib, topPerformers } = data
    const adherenceSlice = period === '4w' ? weeklyAdherence.slice(4) : weeklyAdherence
    const growthSlice = period === '4w' ? weeklyGrowth.slice(4) : weeklyGrowth

    const riskTotal = summary.highRisk + summary.medRisk + summary.lowRisk || 1

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white tracking-tight">
                        Analytics <span className="font-bold">do Clube</span>
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">Dados reais · Atualiza ao recarregar</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        {(['4w', '8w'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-bold transition-all
                                    ${period === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                {p === '4w' ? '4 sem' : '8 sem'}
                            </button>
                        ))}
                    </div>
                    <button onClick={load} className="p-2 text-slate-600 hover:text-slate-400 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* KPIs row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPI
                    label="Total de pacientes"
                    value={summary.total}
                    sub={`${summary.lowRisk} ativas e saudáveis`}
                    icon={<Users size={16} className="text-indigo-400" />}
                    accent="bg-indigo-500/10 border-indigo-500/20"
                    sparkData={growthSlice.map((w: any) => w.cumulative)}
                />
                <KPI
                    label="Retenção 30d"
                    value={`${summary.retentionRate}%`}
                    sub={`${summary.checkinCount} check-ins no período`}
                    icon={<TrendingUp size={16} className="text-emerald-400" />}
                    accent="bg-emerald-500/10 border-emerald-500/20"
                    sparkData={adherenceSlice.map((w: any) => w.adherence)}
                />
                <KPI
                    label="Streak médio"
                    value={`${summary.avgStreak}d`}
                    sub={`Nota média dieta: ${summary.avgDietScore}/10`}
                    icon={<Flame size={16} className="text-orange-400" />}
                    accent="bg-orange-500/10 border-orange-500/20"
                />
                <KPI
                    label="NutriCoins em jogo"
                    value={summary.totalCoinsCirculating.toLocaleString('pt-BR')}
                    sub={`${summary.totalCoinsRedeemed.toLocaleString('pt-BR')} já resgatados`}
                    icon={<Star size={16} className="text-amber-400" />}
                    accent="bg-amber-500/10 border-amber-500/20"
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Adherence trend */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <Activity size={12} className="text-indigo-400" /> Adesão semanal
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {adherenceSlice[adherenceSlice.length - 1]?.adherence ?? 0}%
                                <span className="text-sm text-slate-500 font-normal ml-1">esta semana</span>
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="flex items-end gap-1.5 h-28">
                            {adherenceSlice.map((w: any, i: number) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                                    <div className="relative w-full flex justify-center">
                                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap z-10">
                                            {w.adherence}% · {w.active} ativas
                                        </div>
                                    </div>
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${Math.max(4, (w.adherence / 100) * 96)}px` }}
                                        transition={{ delay: i * 0.06, duration: 0.4 }}
                                        className="w-full rounded-t-xl"
                                        style={{ background: `linear-gradient(to top, #4f46e5, #818cf8)`, opacity: 0.6 + (i / adherenceSlice.length) * 0.4 }}
                                    />
                                    <span className="text-[8px] text-slate-700 font-bold">{w.week}</span>
                                </div>
                            ))}
                        </div>
                        <div className="absolute left-0 right-0 top-0 flex flex-col justify-between h-28 pointer-events-none">
                            {[100, 75, 50, 25].map(v => (
                                <div key={v} className="flex items-center gap-2">
                                    <span className="text-[8px] text-slate-800 w-6 text-right">{v}%</span>
                                    <div className="flex-1 border-t border-white/5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Growth */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <Users size={12} className="text-violet-400" /> Crescimento da base
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                                +{growthSlice.reduce((acc: number, w: any) => acc + w.new, 0)}
                                <span className="text-sm text-slate-500 font-normal ml-1">no período</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-end gap-1.5 h-28">
                        {growthSlice.map((w: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: w.new > 0 ? `${Math.max(4, (w.new / Math.max(...growthSlice.map((x: any) => x.new), 1)) * 96)}px` : '4px' }}
                                    transition={{ delay: i * 0.06, duration: 0.4 }}
                                    className="w-full rounded-t-xl"
                                    style={{ background: 'linear-gradient(to top, #7c3aed, #a78bfa)', opacity: w.new > 0 ? 0.8 : 0.15 }}
                                />
                                <span className="text-[8px] text-slate-700 font-bold">{w.week}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Funnel + Risk + Score */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Engagement funnel */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <BarChart3 size={12} className="text-indigo-400" /> Funil de engajamento (30d)
                    </p>
                    {funnel.map((step: any, i: number) => {
                        const colors = ['#818cf8', '#a78bfa', '#34d399', '#f59e0b', '#f472b6']
                        return (
                            <FunnelBar
                                key={step.label}
                                label={step.label}
                                value={step.value}
                                pct={step.pct}
                                color={colors[i]}
                                delay={0.2 + i * 0.08}
                            />
                        )
                    })}
                </motion.div>

                {/* Risk breakdown */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-4">
                        <ShieldAlert size={12} className="text-rose-400" /> Distribuição de risco
                    </p>
                    <div className="flex gap-2 mb-4">
                        {[
                            { label: 'Alto', value: summary.highRisk, color: 'bg-rose-500', text: 'text-rose-400' },
                            { label: 'Médio', value: summary.medRisk, color: 'bg-amber-500', text: 'text-amber-400' },
                            { label: 'Baixo', value: summary.lowRisk, color: 'bg-emerald-500', text: 'text-emerald-400' },
                        ].map(r => (
                            <div key={r.label} className="flex-1 bg-white/5 rounded-2xl p-3 text-center">
                                <p className={`text-xl font-bold ${r.text}`}>{r.value}</p>
                                <p className="text-[9px] text-slate-600 uppercase font-bold mt-0.5">{r.label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Stacked bar */}
                    <div className="h-3 rounded-full overflow-hidden flex gap-px">
                        {[
                            { v: summary.highRisk, c: 'bg-rose-500' },
                            { v: summary.medRisk, c: 'bg-amber-500' },
                            { v: summary.lowRisk, c: 'bg-emerald-500' },
                        ].map((r, i) => (
                            <motion.div key={i}
                                initial={{ flex: 0 }}
                                animate={{ flex: r.v / riskTotal }}
                                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                                className={`h-full ${r.c}`}
                                style={{ flex: r.v / riskTotal }}
                            />
                        ))}
                    </div>
                    <div className="mt-4">
                        <button onClick={() => setView('checkins')}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors">
                            Ver pacientes em risco <ChevronRight size={12} />
                        </button>
                    </div>
                </motion.div>

                {/* Diet score distribution */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-4">
                        <Star size={12} className="text-amber-400" /> Notas de dieta (check-ins)
                    </p>
                    {Object.entries(scoreDistrib).map(([range, count], i) => {
                        const total2 = Object.values(scoreDistrib).reduce((a, b) => a + (b as number), 0) || 1
                        const pct = Math.round(((count as number) / total2) * 100)
                        const colors = ['#f43f5e', '#f97316', '#f59e0b', '#22c55e', '#10b981']
                        return (
                            <div key={range} className="flex items-center gap-3 mb-2">
                                <span className="text-[11px] text-slate-500 font-bold w-8">{range}</span>
                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ delay: 0.3 + i * 0.06, duration: 0.5 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: colors[i] }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-white w-5">{count as number}</span>
                            </div>
                        )
                    })}
                    <p className="text-[10px] text-slate-700 mt-2">
                        Média: <strong className="text-white">{summary.avgDietScore}/10</strong> · {summary.checkinCount} respostas
                    </p>
                </motion.div>
            </div>

            {/* Top performers */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Crown size={12} className="text-amber-400" /> Top performers — atividade 30d
                    </p>
                    <button onClick={() => setView('patients')}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                        Ver todas <ChevronRight size={12} />
                    </button>
                </div>
                <div className="space-y-2">
                    {topPerformers.length === 0 ? (
                        <p className="text-sm text-slate-600 py-4 text-center">Nenhuma atividade nos últimos 30 dias.</p>
                    ) : topPerformers.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                            <span className="text-lg font-black text-slate-700 w-6 text-center">{i + 1}</span>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0
                                ${p.streak >= 7 ? 'bg-gradient-to-br from-orange-500 to-rose-600' : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
                                {p.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">{p.name.split(' ')[0]}</p>
                                <p className="text-[10px] text-slate-600">🔥 {p.streak}d streak · ⚡ {p.xp.toLocaleString('pt-BR')} XP</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-indigo-400">{p.logs30}</p>
                                <p className="text-[9px] text-slate-700 uppercase">registros</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-amber-400">🪙 {p.coins.toLocaleString('pt-BR')}</p>
                                <p className="text-[9px] text-slate-700 uppercase">coins</p>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
