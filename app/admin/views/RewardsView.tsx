"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Gift, Clock, CheckCircle, Plus, Trash2, Edit3,
    Package, Percent, Star, Loader2, X, Crown,
    ShoppingBag, Truck, Download, Award, RefreshCw,
    Sparkles, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface RewardItem {
    id: string; name: string; description: string; cost: number
    type: 'digital' | 'fisico' | 'cupom' | 'experiencia'
    emoji: string; stock?: number | null; active: boolean
    delivery_info?: string | null; redemption_count?: number
}

interface Redemption {
    id: string; user_name: string; user_initials: string
    item_name: string; item_cost: number; item_id: string
    status: 'pending' | 'processing' | 'completed' | 'cancelled'
    created_at: string; admin_notes?: string
}

const TYPE_META: Record<string, { label: string; icon: JSX.Element; color: string; bg: string }> = {
    digital:     { label: "Digital",     icon: <Download size={13}/>,  color: "text-sky-400",     bg: "bg-sky-500/15 border-sky-500/25" },
    fisico:      { label: "Físico",      icon: <Package size={13}/>,   color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/25" },
    cupom:       { label: "Cupom",       icon: <Percent size={13}/>,   color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25" },
    experiencia: { label: "Experiência", icon: <Crown size={13}/>,     color: "text-violet-400",  bg: "bg-violet-500/15 border-violet-500/25" },
}

const STATUS_META: Record<string, { label: string; next?: string; nextLabel?: string; color: string }> = {
    pending:    { label: "Pendente",    next: "processing", nextLabel: "Iniciar",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    processing: { label: "Processando", next: "completed",  nextLabel: "Entregar",  color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
    completed:  { label: "Entregue",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    cancelled:  { label: "Cancelado",   color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
}

const EMOJIS = ['🎁','📘','🏷️','☕','💪','👑','🎯','🌟','💎','🎉','🍎','💌','🧴','🏆','✨']

function ItemForm({ item, tenantId, onSave, onCancel }: {
    item?: RewardItem | null; tenantId?: string; onSave: () => void; onCancel: () => void
}) {
    const [form, setForm] = useState({
        name: item?.name || '',
        description: item?.description || '',
        cost: item?.cost || 500,
        type: item?.type || 'digital',
        emoji: item?.emoji || '🎁',
        stock: item?.stock ?? '',
        delivery_info: item?.delivery_info || '',
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSave = async () => {
        if (!form.name.trim() || !form.cost) { setError('Nome e custo são obrigatórios'); return }
        setSaving(true)
        try {
            const body = { ...form, cost: Number(form.cost), stock: form.stock !== '' ? Number(form.stock) : null }
            const res = await fetch('/api/admin/rewards', {
                method: item ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item ? { id: item.id, ...body } : body),
            })
            if (res.ok) { onSave() } else {
                const d = await res.json(); setError(d.error || 'Erro ao salvar')
            }
        } finally { setSaving(false) }
    }

    return (
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                {item ? 'Editar recompensa' : 'Nova recompensa'}
            </h3>

            {/* Emoji picker */}
            <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({...f, emoji: e}))}
                        className={`w-9 h-9 rounded-xl text-lg transition-all ${form.emoji === e ? 'bg-indigo-600 scale-110' : 'bg-white/5 hover:bg-white/10'}`}>
                        {e}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Nome *</label>
                    <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="Ex: E-book Receitas Fit" />
                </div>
                <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Descrição</label>
                    <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="Breve descrição da recompensa" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">NutriCoins *</label>
                    <input type="number" value={form.cost} onChange={e => setForm(f=>({...f,cost:Number(e.target.value)}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50" min="1" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Tipo</label>
                    <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as any}))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                        {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Estoque (vazio = ilimitado)</label>
                    <input type="number" value={form.stock} onChange={e => setForm(f=>({...f,stock:e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="∞" min="0" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Instruções de entrega</label>
                    <input value={form.delivery_info} onChange={e => setForm(f=>({...f,delivery_info:e.target.value}))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="Link por e-mail em 24h" />
                </div>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex gap-3 pt-2">
                <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {item ? 'Salvar' : 'Criar'}
                </button>
            </div>
        </div>
    )
}

export function RewardsView({ setView }: { setView: (v: any) => void }) {
    const [items, setItems] = useState<RewardItem[]>([])
    const [redemptions, setRedemptions] = useState<Redemption[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'catalogo' | 'pedidos'>('catalogo')
    const [showForm, setShowForm] = useState(false)
    const [editingItem, setEditingItem] = useState<RewardItem | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/rewards')
            if (res.ok) {
                const data = await res.json()
                setItems(data.items || [])
                setRedemptions(data.redemptions || [])
            }
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleDelete = async (id: string) => {
        if (!confirm('Desativar esta recompensa?')) return
        await fetch('/api/admin/rewards', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        await loadData()
    }

    const handleStatusChange = async (redemptionId: string, newStatus: string) => {
        setUpdatingId(redemptionId)
        try {
            await fetch(`/api/admin/rewards/${redemptionId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            await loadData()
        } finally { setUpdatingId(null) }
    }

    const pendingCount = redemptions.filter(r => r.status === 'pending').length
    const processingCount = redemptions.filter(r => r.status === 'processing').length
    const completedTotal = redemptions.filter(r => r.status === 'completed').reduce((acc, r) => acc + r.item_cost, 0)

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Itens ativos", value: items.filter(i => i.active).length, icon: <Gift size={16} className="text-indigo-400" /> },
                    { label: "Pendentes", value: pendingCount, icon: <Clock size={16} className="text-amber-400" /> },
                    { label: "Processando", value: processingCount, icon: <Truck size={16} className="text-sky-400" /> },
                    { label: "Coins resgatados", value: completedTotal.toLocaleString('pt-BR'), icon: <Award size={16} className="text-emerald-400" /> },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="mb-2">{s.icon}</div>
                        <p className="text-xl font-bold text-white">{s.value}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 rounded-2xl p-1 w-fit">
                {(['catalogo', 'pedidos'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
                            ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {tab === 'catalogo' ? '🏪 Catálogo' : `📦 Pedidos${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
                    </button>
                ))}
                <button onClick={loadData} className="px-3 py-2 text-slate-600 hover:text-slate-400 transition-colors">
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* CATÁLOGO */}
            <AnimatePresence mode="wait">
            {activeTab === 'catalogo' && (
                <motion.div key="cat" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
                    {!showForm && !editingItem && (
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
                            <Plus size={14} /> Nova Recompensa
                        </button>
                    )}
                    <AnimatePresence>
                    {(showForm || editingItem) && (
                        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                            <ItemForm
                                item={editingItem}
                                onSave={() => { setShowForm(false); setEditingItem(null); loadData() }}
                                onCancel={() => { setShowForm(false); setEditingItem(null) }}
                            />
                        </motion.div>
                    )}
                    </AnimatePresence>

                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {items.map(item => {
                                const meta = TYPE_META[item.type] || TYPE_META.digital
                                return (
                                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 group relative">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="text-3xl w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0">{item.emoji}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{item.name}</p>
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1 mt-1 ${meta.bg} ${meta.color}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </div>
                                        </div>
                                        {item.description && <p className="text-xs text-slate-500 mb-3 leading-relaxed">{item.description}</p>}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-black text-amber-400">🪙 {item.cost.toLocaleString('pt-BR')}</span>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                                {item.stock != null ? <span>{item.stock} unid.</span> : <span>∞</span>}
                                                {(item.redemption_count || 0) > 0 && <span>· {item.redemption_count} resgates</span>}
                                            </div>
                                        </div>
                                        {/* Hover actions */}
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingItem(item); setShowForm(false) }}
                                                className="w-7 h-7 rounded-lg bg-white/10 text-slate-400 hover:text-white flex items-center justify-center">
                                                <Edit3 size={11} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)}
                                                className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            )}

            {/* PEDIDOS */}
            {activeTab === 'pedidos' && (
                <motion.div key="ped" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                    ) : redemptions.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
                            <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Nenhum pedido ainda.</p>
                        </div>
                    ) : (
                        redemptions.map(r => {
                            const sm = STATUS_META[r.status] || STATUS_META.pending
                            const isExpanded = expandedOrder === r.id
                            return (
                                <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setExpandedOrder(isExpanded ? null : r.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                            {r.user_initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{r.user_name.split(' ')[0]} · {r.item_name}</p>
                                            <p className="text-[10px] text-slate-600">
                                                {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                {' · '}🪙 {r.item_cost.toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${sm.color}`}>{sm.label}</span>
                                        {isExpanded ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                                    </button>

                                    <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                                            className="border-t border-white/10 px-4 py-3 flex gap-2 flex-wrap">
                                            {sm.next && (
                                                <button
                                                    onClick={() => handleStatusChange(r.id, sm.next!)}
                                                    disabled={updatingId === r.id}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                                                    {updatingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                                    {sm.nextLabel}
                                                </button>
                                            )}
                                            {r.status !== 'completed' && r.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleStatusChange(r.id, 'cancelled')}
                                                    disabled={updatingId === r.id}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-bold rounded-xl transition-all">
                                                    <X size={11} /> Cancelar
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                    </AnimatePresence>
                                </div>
                            )
                        })
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    )
}
