"use client"

import { useState, ReactNode } from "react"
import { Loader2, X } from "lucide-react"
import { motion } from "framer-motion"
import { ClinicalCategory } from "@/lib/services/clinicalAssets"

export interface AssetFormValues {
    title: string
    description: string
    category_id: string
    tags: string
    [key: string]: any
}

interface AssetFormModalProps {
    entityLabel: string
    categories: ClinicalCategory[]
    initial?: Record<string, any> | null
    saving: boolean
    onClose: () => void
    onSave: (values: AssetFormValues) => void
    extraFields?: (values: AssetFormValues, setValue: (key: string, value: any) => void) => ReactNode
}

export function AssetFormModal({ entityLabel, categories, initial, saving, onClose, onSave, extraFields }: AssetFormModalProps) {
    const [values, setValues] = useState<AssetFormValues>({
        title: initial?.title || '',
        description: initial?.description || '',
        category_id: initial?.category_id || '',
        tags: (initial?.tags || []).join(', '),
        ...initial,
    })

    const setValue = (key: string, value: any) => setValues(prev => ({ ...prev, [key]: value }))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-lg bg-[#11111f] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 my-8">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white">{initial?.id ? `Editar ${entityLabel}` : `Nova ${entityLabel}`}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Título</p>
                        <input value={values.title} onChange={e => setValue('title', e.target.value)}
                            placeholder={`Nome d${entityLabel.toLowerCase().startsWith('a') ? 'a' : 'o'} ${entityLabel.toLowerCase()}`}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    </div>

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Descrição</p>
                        <textarea value={values.description} onChange={e => setValue('description', e.target.value)}
                            rows={2} placeholder="Uma linha descrevendo o benefício principal"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
                    </div>

                    {categories.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Categoria</p>
                            <select value={values.category_id} onChange={e => setValue('category_id', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                                <option value="">Sem categoria</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {extraFields?.(values, setValue)}

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tags (separadas por vírgula)</p>
                        <input value={values.tags} onChange={e => setValue('tags', e.target.value)}
                            placeholder="ex: anti-inflamatório, SOP, fase 1"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    </div>

                    <button onClick={() => onSave(values)} disabled={saving || !values.title.trim()}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
