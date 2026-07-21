"use client"

import { useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { motion } from "framer-motion"
import { ClinicalCategory } from "@/lib/services/clinicalAssets"

interface AIGenerateModalProps {
    entityLabel: string
    categories: ClinicalCategory[]
    saving: boolean
    onClose: () => void
    onGenerate: (theme: string, categoryId: string) => Promise<void>
}

export function AIGenerateModal({ entityLabel, categories, saving, onClose, onGenerate }: AIGenerateModalProps) {
    const [theme, setTheme] = useState('')
    const [categoryId, setCategoryId] = useState(categories[0]?.id || '')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-md bg-[#11111f] border border-white/10 rounded-3xl p-6 shadow-2xl z-10">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles size={17} className="text-violet-400" /> Gerar {entityLabel} com IA
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tema</p>
                        <input value={theme} onChange={e => setTheme(e.target.value)}
                            placeholder={`Ex: ${entityLabel.toLowerCase()} anti-inflamatório com gengibre`}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    {categories.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Categoria</p>
                            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={() => onGenerate(theme, categoryId)} disabled={saving || !theme.trim()}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                        {saving ? 'Gerando...' : 'Gerar'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
