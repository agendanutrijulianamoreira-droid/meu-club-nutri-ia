"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    TrendingUp, Users, CreditCard, CheckCircle, AlertCircle,
    Loader2, RefreshCw, ExternalLink, Save, ChevronDown, ChevronUp,
    Star, Crown, DollarSign, Clock, XCircle, AlertTriangle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingSummary {
    active_subscribers: number
    total_subscriptions: number
    mrr_cents: number
    mrr_brl: number
    status_counts: Record<string, number>
}

interface PlanBreakdown {
    plan: string
    label: string
    count: number
    revenue_cents: number
}

interface RecentEvent {
    id: string
    user_id: string
    plan: string
    plan_label: string
    status: string
    gateway: string
    amount_cents: number | null
    cancel_at_period_end: boolean
    current_period_end: string | null
    updated_at: string
    created_at: string
}

interface BillingData {
    tenant_id: string
    stripe_connected: boolean
    summary: BillingSummary
    plan_breakdown: PlanBreakdown[]
    recent_events: RecentEvent[]
}

interface TenantPlan {
    id?: string
    plan: 'tech_diet' | 'vip'
    price_cents: number
    stripe_price_id: string
    description: string
    features: string[]
    is_active: boolean
}

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
    active:    { label: 'Ativa',       icon: CheckCircle,    color: 'text-emerald-400' },
    trialing:  { label: 'Trial',       icon: Clock,          color: 'text-sky-400' },
    past_due:  { label: 'Inadimplente',icon: AlertTriangle,  color: 'text-amber-400' },
    cancelled: { label: 'Cancelada',   icon: XCircle,        color: 'text-rose-400' },
    pending:   { label: 'Pendente',    icon: Clock,          color: 'text-slate-400' },
}

const PLAN_META: Record<string, { label: string; icon: any; color: string }> = {
    tech_diet: { label: 'Tech Diet', icon: Star,  color: 'text-indigo-400' },
    vip:       { label: 'VIP',       icon: Crown, color: 'text-amber-400' },
    community: { label: 'Comunidade',icon: Users, color: 'text-slate-400' },
}

function fmt(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
    label: string; value: string; sub?: string; icon: any; color: string
}) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
                <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] || STATUS_META.pending
    const Icon = meta.icon
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase ${meta.color}`}>
            <Icon size={11} />
            {meta.label}
        </span>
    )
}

// ─── Plan price config form ────────────────────────────────────────────────────

function PlanPriceEditor({ tenantId }: { tenantId: string }) {
    const [plans, setPlans] = useState<Record<string, TenantPlan>>({
        tech_diet: { plan: 'tech_diet', price_cents: 9700, stripe_price_id: '', description: '', features: [], is_active: true },
        vip:       { plan: 'vip',       price_cents: 19700, stripe_price_id: '', description: '', features: [], is_active: true },
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        fetch('/api/admin/checkout-plans')
            .then(r => r.json())
            .then(data => {
                if (data.plans?.length) {
                    const updated = { ...plans }
                    for (const p of data.plans) {
                        updated[p.plan] = {
                            plan: p.plan,
                            price_cents: p.price_cents || 0,
                            stripe_price_id: p.stripe_price_id || '',
                            description: p.description || '',
                            features: Array.isArray(p.features) ? p.features : [],
                            is_active: p.is_active !== false,
                        }
                    }
                    setPlans(updated)
                }
            })
            .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }

    const savePlan = async (planKey: 'tech_diet' | 'vip') => {
        setSaving(planKey)
        try {
            const p = plans[planKey]
            const res = await fetch('/api/admin/checkout-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: p.plan,
                    price_cents: p.price_cents,
                    stripe_price_id: p.stripe_price_id || null,
                    description: p.description,
                    features: p.features,
                }),
            })
            if (res.ok) showToast('success', `Plano ${PLAN_META[planKey].label} salvo!`)
            else showToast('error', 'Erro ao salvar plano.')
        } finally {
            setSaving(null)
        }
    }

    const updatePlan = (key: string, field: keyof TenantPlan, value: any) => {
        setPlans(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
    }

    if (loading) return null

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition"
            >
                <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-indigo-400" />
                    <span className="text-sm font-bold text-white">Configurar Preços dos Planos</span>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-5">
                            {(['tech_diet', 'vip'] as const).map(key => {
                                const p = plans[key]
                                const meta = PLAN_META[key]
                                const Icon = meta.icon
                                return (
                                    <div key={key} className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon size={15} className={meta.color} />
                                            <span className="text-sm font-bold text-white">{meta.label}</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Preço (em centavos)</label>
                                            <input
                                                type="number"
                                                value={p.price_cents}
                                                onChange={e => updatePlan(key, 'price_cents', Number(e.target.value))}
                                                placeholder="9700 = R$97,00"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                                            />
                                            <p className="text-[10px] text-slate-600 mt-1">= {fmt(p.price_cents)}/mês</p>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Stripe Price ID</label>
                                            <input
                                                type="text"
                                                value={p.stripe_price_id}
                                                onChange={e => updatePlan(key, 'stripe_price_id', e.target.value)}
                                                placeholder="price_xxxxx (opcional)"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Descrição</label>
                                            <input
                                                type="text"
                                                value={p.description}
                                                onChange={e => updatePlan(key, 'description', e.target.value)}
                                                placeholder="Ex: Acesso completo ao clube"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <button
                                            onClick={() => savePlan(key)}
                                            disabled={saving === key}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                                        >
                                            {saving === key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            Salvar {meta.label}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        <AnimatePresence>
                            {toast && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`mx-5 mb-5 p-3 rounded-xl text-sm font-bold ${
                                        toast.type === 'success'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}
                                >
                                    {toast.msg}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function BillingView({ tenantId = '' }: { setView?: (v: any) => void; tenantId?: string }) {
    const [data, setData] = useState<BillingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [portalLoading, setPortalLoading] = useState(false)

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        else setRefreshing(true)
        try {
            const res = await fetch('/api/admin/billing')
            if (res.ok) setData(await res.json())
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const openBillingPortal = async () => {
        setPortalLoading(true)
        try {
            const res = await fetch('/api/admin/billing/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            const d = await res.json()
            if (d.url) window.open(d.url, '_blank')
        } finally {
            setPortalLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="animate-spin text-slate-600" size={28} />
            </div>
        )
    }

    const summary = data?.summary
    const mrrBrl = summary ? fmt(summary.mrr_cents) : 'R$0,00'

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">
                        Fatura<span className="font-bold">mento</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Receita, assinaturas e configuração de planos</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-xl transition-all"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                    <button
                        onClick={openBillingPortal}
                        disabled={portalLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                    >
                        {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                        Portal Stripe
                    </button>
                </div>
            </div>

            {/* Stripe status */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl w-fit text-sm font-bold border ${
                data?.stripe_connected
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
                {data?.stripe_connected
                    ? <><CheckCircle size={14} /> Stripe conectado</>
                    : <><AlertCircle size={14} /> Stripe não configurado — adicione STRIPE_SECRET_KEY</>
                }
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                    label="MRR"
                    value={mrrBrl}
                    sub="Receita recorrente mensal"
                    icon={TrendingUp}
                    color="text-emerald-400"
                />
                <KpiCard
                    label="Assinantes Ativos"
                    value={String(summary?.active_subscribers ?? 0)}
                    sub="Planos ativos + trial"
                    icon={Users}
                    color="text-indigo-400"
                />
                <KpiCard
                    label="Total de Assinaturas"
                    value={String(summary?.total_subscriptions ?? 0)}
                    sub="Todos os status"
                    icon={CreditCard}
                    color="text-slate-400"
                />
                <KpiCard
                    label="Inadimplentes"
                    value={String(summary?.status_counts?.past_due ?? 0)}
                    sub="Precisam de atenção"
                    icon={AlertTriangle}
                    color="text-amber-400"
                />
            </div>

            {/* Plan Breakdown */}
            {data?.plan_breakdown && data.plan_breakdown.length > 0 && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Breakdown por Plano</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.plan_breakdown.map(bp => {
                            const meta = PLAN_META[bp.plan] || { label: bp.label, icon: Star, color: 'text-slate-400' }
                            const Icon = meta.icon
                            return (
                                <div key={bp.plan} className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center">
                                            <Icon size={18} className={meta.color} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{meta.label}</p>
                                            <p className="text-slate-500 text-xs">{bp.count} assinante{bp.count !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-emerald-400">{fmt(bp.revenue_cents)}</p>
                                        <p className="text-slate-600 text-xs">por mês</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Plan price config */}
            <PlanPriceEditor tenantId={tenantId} />

            {/* Checkout link */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Link de Checkout para Pacientes</p>
                <div className="flex items-center gap-3">
                    <code className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-indigo-300 font-mono truncate">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/[slug-do-clube]/checkout
                    </code>
                    <button
                        onClick={() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : ''
                            navigator.clipboard.writeText(`${origin}/[slug-do-clube]/checkout`)
                        }}
                        className="px-3 py-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition"
                    >
                        Copiar
                    </button>
                </div>
                <p className="text-xs text-slate-600 mt-2">Substitua [slug-do-clube] pelo slug configurado nas Configurações.</p>
            </div>

            {/* Recent subscription events */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Histórico de Assinaturas</p>
                {!data?.recent_events?.length ? (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                        <CreditCard size={32} className="text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold">Nenhuma assinatura ainda</p>
                        <p className="text-slate-600 text-sm mt-1">Configure os preços e compartilhe o link de checkout com suas pacientes.</p>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Paciente</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Plano</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Status</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Valor</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Renova em</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-500 px-5 py-3">Gateway</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recent_events.map((ev, i) => {
                                        const planMeta = PLAN_META[ev.plan] || { label: ev.plan_label, icon: Star, color: 'text-slate-400' }
                                        const PlanIcon = planMeta.icon
                                        return (
                                            <motion.tr
                                                key={ev.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: i * 0.03 }}
                                                className="border-b border-white/5 last:border-0 hover:bg-white/5"
                                            >
                                                <td className="px-5 py-3">
                                                    <span className="text-slate-400 font-mono text-xs">{ev.user_id.slice(0, 8)}…</span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`flex items-center gap-1.5 font-bold ${planMeta.color}`}>
                                                        <PlanIcon size={13} />
                                                        {planMeta.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <StatusBadge status={ev.status} />
                                                    {ev.cancel_at_period_end && (
                                                        <span className="ml-2 text-[9px] font-black uppercase text-amber-500">cancela no fim</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-white font-bold">
                                                    {ev.amount_cents ? fmt(ev.amount_cents) : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-slate-500 text-xs">
                                                    {ev.current_period_end ? fmtDate(ev.current_period_end) : '—'}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{ev.gateway}</span>
                                                </td>
                                            </motion.tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
