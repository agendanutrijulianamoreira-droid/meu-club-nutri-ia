"use client"

import { useState } from "react"
import { Plus, Search, Copy, Archive, ArchiveRestore, Pencil, Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { BaseClinicalEntity, ClinicalCategory } from "@/lib/services/clinicalAssets"

interface AssetListProps<T extends BaseClinicalEntity & { category_id?: string | null }> {
    items: T[]
    loading: boolean
    categories: ClinicalCategory[]
    entityLabel: string
    entityLabelPlural: string
    onCreate: () => void
    onGenerateAI?: () => void
    onEdit: (item: T) => void
    onToggleActive: (id: string) => void
    onDuplicate: (id: string) => void
    renderExtra?: (item: T) => React.ReactNode
}

export function AssetList<T extends BaseClinicalEntity & { category_id?: string | null }>({
    items, loading, categories, entityLabel, entityLabelPlural,
    onCreate, onGenerateAI, onEdit, onToggleActive, onDuplicate, renderExtra,
}: AssetListProps<T>) {
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('')
    const [showInactive, setShowInactive] = useState(false)

    const categoryName = (id: string | null | undefined) => categories.find(c => c.id === id)?.name

    const filtered = items.filter(item => {
        if (!showInactive && !item.is_active) return false
        if (categoryFilter && item.category_id !== categoryFilter) return false
        if (search) {
            const q = search.toLowerCase()
            const matchesText = item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
            const matchesTags = item.tags?.some(t => t.toLowerCase().includes(q))
            if (!matchesText && !matchesTags) return false
        }
        return true
    })

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={`Buscar ${entityLabelPlural.toLowerCase()}...`}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                    <option value="">Todas categorias</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowInactive(v => !v)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showInactive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                    {showInactive ? 'Mostrando arquivados' : 'Ocultando arquivados'}
                </button>
                {onGenerateAI && (
                <button onClick={onGenerateAI}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-xl transition-all">
                    <Sparkles size={14} className="text-violet-400" /> Gerar com IA
                </button>
                )}
                <button onClick={onCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                    <Plus size={15} /> Nova {entityLabel}
                </button>
            </div>

            {loading && (
                <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-10 text-center">
                    <p className="text-white font-bold mb-1">Nenhuma {entityLabel.toLowerCase()} encontrada</p>
                    <p className="text-slate-500 text-sm">Crie manualmente ou gere com IA.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                    {filtered.map(item => (
                        <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`bg-white/5 border rounded-3xl p-5 space-y-3 transition-all hover:border-indigo-500/30 ${item.is_active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-white font-bold truncate">{item.title}</p>
                                    {categoryName(item.category_id) && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400 inline-block mt-1">
                                            {categoryName(item.category_id)}
                                        </span>
                                    )}
                                </div>
                                {item.is_ai_generated && <Sparkles size={13} className="text-violet-400 flex-shrink-0 mt-1" />}
                            </div>
                            {item.description && <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>}
                            {renderExtra?.(item)}
                            {item.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {item.tags.map(t => (
                                        <span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{t}</span>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                <button onClick={() => onEdit(item)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[11px] font-bold rounded-lg transition-all">
                                    <Pencil size={11} /> Editar
                                </button>
                                <button onClick={() => onDuplicate(item.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[11px] font-bold rounded-lg transition-all">
                                    <Copy size={11} /> Duplicar
                                </button>
                                <button onClick={() => onToggleActive(item.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 text-[11px] font-bold rounded-lg transition-all ml-auto">
                                    {item.is_active ? <><Archive size={11} /> Arquivar</> : <><ArchiveRestore size={11} /> Reativar</>}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
