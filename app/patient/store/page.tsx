"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Coins, Gift, Package, Download, Percent, Star,
    Loader2, CheckCircle, Clock, XCircle, Truck,
    Sparkles, Lock, ChevronRight, X, Crown, Zap
} from "lucide-react"

type RewardItem = {
    id: string
    name: string
    description: string
    cost: number
    type: 'digital' | 'fisico' | 'cupom' | 'experiencia'
    emoji: string
    available_stock: number | null
    out_of_stock: boolean
    delivery_info: string | null
}

type Redemption = {
    id: string
    item_name: string
    item_cost: number
    status: 'pending' | 'processing' | 'completed' | 'cancelled'
    created_at: string
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
    digital:     { label: "Digital",     color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20" },
    fisico:      { label: "Físico",      color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    cupom:       { label: "Cupom",       color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
    experiencia: { label: "Experiência", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
}

const STATUS_META: Record<string, { label: string; icon: JSX.Element; color: string }> = {
    pending:    { label: "Aguardando",  icon: <Clock size={11} />,        color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    processing: { label: "Processando", icon: <Truck size={11} />,        color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
    completed:  { label: "Entregue",    icon: <CheckCircle size={11} />,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    cancelled:  { label: "Cancelado",   icon: <XCircle size={11} />,      color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
}

function TypeIcon({ type }: { type: string }) {
    const cls = "text-current"
    if (type === "digital")     return <Download size={16} className={cls} />
    if (type === "fisico")      return <Package size={16} className={cls} />
    if (type === "cupom")       return <Percent size={16} className={cls} />
    if (type === "experiencia") return <Crown size={16} className={cls} />
    return <Gift size={16} className={cls} />
}

function CoinBadge({ amount, size = "md" }: { amount: number; size?: "sm" | "md" | "lg" }) {
    const sizes = { sm: "text-[11px] px-2 py-0.5", md: "text-xs px-2.5 py-1", lg: "text-sm px-3 py-1.5" }
    return (
        <span className={`flex items-center gap-1 font-black rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 ${sizes[size]}`}>
            <span>🪙</span> {amount.toLocaleString('pt-BR')}
        </span>
    )
}

function RedeemModal({
    item, coins, onConfirm, onClose, loading
}: {
    item: RewardItem
    coins: number
    onConfirm: () => void
    onClose: () => void
    loading: boolean
}) {
    const canAfford = coins >= item.cost
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm"
            >
                {/* Item preview */}
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl">
                        {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-base leading-snug">{item.name}</p>
                        <CoinBadge amount={item.cost} size="sm" />
                    </div>
                </div>

                {/* Balance check */}
                <div className={`rounded-2xl p-4 mb-5 border ${canAfford ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Seu saldo</span>
                        <CoinBadge amount={coins} size="sm" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">Custo</span>
                        <CoinBadge amount={item.cost} size="sm" />
                    </div>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Saldo após</span>
                        <span className={`text-sm font-black ${canAfford ? "text-emerald-400" : "text-rose-400"}`}>
                            🪙 {(coins - item.cost).toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>

                {/* Delivery info */}
                {item.delivery_info && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Entrega</p>
                        <p className="text-xs text-slate-400">{item.delivery_info}</p>
                    </div>
                )}

                {!canAfford && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
                        <Lock size={14} className="text-rose-400 flex-shrink-0" />
                        <p className="text-xs text-rose-300">
                            Faltam <strong>{(item.cost - coins).toLocaleString('pt-BR')}</strong> NutriCoins. Continue completando seus dias!
                        </p>
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canAfford || loading}
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Resgatar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

function SuccessToast({ item, onClose }: { item: RewardItem; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
    return (
        <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
            <div className="bg-emerald-950 border border-emerald-500/40 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-emerald-900/50">
                <div className="text-2xl">{item.emoji}</div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-300">Resgate solicitado!</p>
                    <p className="text-[11px] text-emerald-600">{item.name}</p>
                </div>
                <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
            </div>
        </motion.div>
    )
}

export default function PatientStorePage() {
    const [items, setItems] = useState<RewardItem[]>([])
    const [redemptions, setRedemptions] = useState<Redemption[]>([])
    const [coins, setCoins] = useState(0)
    const [loading, setLoading] = useState(true)
    const [redeeming, setRedeeming] = useState(false)
    const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null)
    const [successItem, setSuccessItem] = useState<RewardItem | null>(null)
    const [activeTab, setActiveTab] = useState<"loja" | "meus">("loja")
    const [filterType, setFilterType] = useState<string | null>(null)

    const loadStore = useCallback(async () => {
        try {
            const res = await fetch("/api/patient/store")
            if (res.ok) {
                const data = await res.json()
                setItems(data.items || [])
                setRedemptions(data.myRedemptions || [])
                setCoins(data.myCoins || 0)
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadStore() }, [loadStore])

    const handleRedeem = async () => {
        if (!selectedItem || redeeming) return
        setRedeeming(true)
        try {
            const res = await fetch("/api/patient/store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ item_id: selectedItem.id }),
            })
            const data = await res.json()
            if (!res.ok) { alert(data.error); return }

            setCoins(data.newBalance)
            setSuccessItem(selectedItem)
            setSelectedItem(null)
            await loadStore()
        } finally {
            setRedeeming(false)
        }
    }

    const filteredItems = filterType
        ? items.filter(i => i.type === filterType)
        : items

    const types = [...new Set(items.map(i => i.type))]

    return (
        <div className="min-h-screen pb-28">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-6 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Gift size={20} className="text-indigo-400" />
                            Loja de Recompensas
                        </h1>
                        <p className="text-[11px] text-slate-600 mt-0.5">Troque seus NutriCoins por prêmios reais</p>
                    </div>
                    {/* Coins balance */}
                    <motion.div
                        key={coins}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3 py-2"
                    >
                        <span className="text-lg">🪙</span>
                        <div>
                            <p className="text-xs font-black text-amber-400 leading-none">{coins.toLocaleString('pt-BR')}</p>
                            <p className="text-[8px] text-amber-700 uppercase font-bold tracking-wide">NutriCoins</p>
                        </div>
                    </motion.div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
                    {(["loja", "meus"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                                ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                            {tab === "loja" ? "🏪 Loja" : `🎁 Meus Resgates${redemptions.length ? ` (${redemptions.length})` : ""}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 pt-4 max-w-lg mx-auto">
                <AnimatePresence mode="wait">
                    {/* LOJA TAB */}
                    {activeTab === "loja" && (
                        <motion.div key="loja" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* How to earn coins */}
                            <div className="bg-gradient-to-r from-amber-950/50 to-yellow-950/30 border border-amber-500/20 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                                <Zap size={16} className="text-amber-400 flex-shrink-0" />
                                <p className="text-xs text-amber-200/70 leading-relaxed">
                                    Ganhe moedas completando check-ins, mantendo streak e atingindo metas diárias.
                                </p>
                            </div>

                            {/* Type filter */}
                            {types.length > 1 && (
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                                    <button
                                        onClick={() => setFilterType(null)}
                                        className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all
                                            ${!filterType ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-slate-500"}`}
                                    >
                                        Todos
                                    </button>
                                    {types.map(t => {
                                        const meta = TYPE_META[t]
                                        return (
                                            <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                                                className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1
                                                    ${filterType === t ? `${meta.bg} ${meta.color} border-current/30` : "bg-white/5 border-white/10 text-slate-500"}`}>
                                                <TypeIcon type={t} />
                                                {meta.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {loading ? (
                                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                            ) : filteredItems.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="text-4xl mb-3">🏪</div>
                                    <p className="text-white font-bold mb-1">Loja vazia</p>
                                    <p className="text-slate-500 text-sm">Novidades chegando em breve!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredItems.map((item, i) => {
                                        const meta = TYPE_META[item.type] || TYPE_META.digital
                                        const canAfford = coins >= item.cost
                                        return (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.04 }}
                                                className={`relative bg-slate-900/80 border rounded-3xl p-4 overflow-hidden
                                                    ${item.out_of_stock ? "opacity-60 border-white/5" : "border-white/10 hover:border-white/20 transition-all"}`}
                                            >
                                                {/* Subtle glow for affordable items */}
                                                {canAfford && !item.out_of_stock && (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent pointer-events-none rounded-3xl" />
                                                )}

                                                <div className="flex items-start gap-4 relative">
                                                    {/* Emoji */}
                                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                                                        {item.emoji}
                                                        {item.out_of_stock && (
                                                            <div className="absolute inset-0 bg-slate-900/70 rounded-2xl flex items-center justify-center">
                                                                <span className="text-[8px] text-slate-500 font-black uppercase">Esgotado</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <p className="text-sm font-bold text-white leading-snug">{item.name}</p>
                                                            <span className={`flex-shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${meta.bg} ${meta.color}`}>
                                                                <TypeIcon type={item.type} /> {meta.label}
                                                            </span>
                                                        </div>
                                                        {item.description && (
                                                            <p className="text-xs text-slate-500 leading-relaxed mb-2">{item.description}</p>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <CoinBadge amount={item.cost} size="sm" />
                                                            {item.available_stock !== null && !item.out_of_stock && (
                                                                <span className="text-[10px] text-slate-600 font-bold">{item.available_stock} restantes</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => !item.out_of_stock && setSelectedItem(item)}
                                                    disabled={item.out_of_stock}
                                                    className={`mt-3 w-full py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all
                                                        ${item.out_of_stock
                                                            ? "bg-white/5 text-slate-700 cursor-not-allowed"
                                                            : canAfford
                                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-900/30 active:scale-[0.98]"
                                                                : "bg-white/5 border border-white/10 text-slate-500 hover:text-slate-400"
                                                        }`}
                                                >
                                                    {item.out_of_stock
                                                        ? "Esgotado"
                                                        : canAfford
                                                            ? <><Sparkles size={12} /> Resgatar</>
                                                            : <><Lock size={12} /> Faltam {(item.cost - coins).toLocaleString('pt-BR')} coins</>
                                                    }
                                                </button>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* MEUS RESGATES TAB */}
                    {activeTab === "meus" && (
                        <motion.div key="meus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {redemptions.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="text-4xl mb-3">🎁</div>
                                    <p className="text-white font-bold mb-1">Nenhum resgate ainda</p>
                                    <p className="text-slate-500 text-sm">Explore a loja e troque seus NutriCoins!</p>
                                    <button onClick={() => setActiveTab("loja")}
                                        className="mt-4 flex items-center gap-2 mx-auto text-indigo-400 text-sm font-bold hover:text-indigo-300">
                                        Ver loja <ChevronRight size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {redemptions.map(r => {
                                        const sm = STATUS_META[r.status] || STATUS_META.pending
                                        return (
                                            <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{r.item_name}</p>
                                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                                        {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                        {" · "}🪙 {r.item_cost.toLocaleString('pt-BR')}
                                                    </p>
                                                </div>
                                                <span className={`flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${sm.color}`}>
                                                    {sm.icon} {sm.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {selectedItem && (
                    <RedeemModal
                        item={selectedItem}
                        coins={coins}
                        onConfirm={handleRedeem}
                        onClose={() => setSelectedItem(null)}
                        loading={redeeming}
                    />
                )}
                {successItem && (
                    <SuccessToast item={successItem} onClose={() => setSuccessItem(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}
