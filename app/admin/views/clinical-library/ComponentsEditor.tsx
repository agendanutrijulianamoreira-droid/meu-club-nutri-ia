"use client"

import { useState } from "react"
import { Plus, Trash2, Search } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"

interface ComponentRow {
    id: string
    quantity: number | null
    unit: string | null
    serving_label: string | null
    food_id: string | null
    recipe_id: string | null
    supplement_id: string | null
    food?: { name: string } | null
    recipe?: { title: string } | null
    supplement?: { title: string } | null
}

interface ComponentsHook {
    components: ComponentRow[]
    addComponent: (c: any) => Promise<any>
    removeComponent: (id: string) => Promise<any>
}

// Editor de composição relacional (ADR-0003) — busca um alimento existente
// na base global (foods) e adiciona como componente, com quantidade/unidade.
// Reaproveitado por Receitas, Shots, Chás e Refeições.
export function ComponentsEditor({ hook, tenantId }: { hook: ComponentsHook; tenantId: string }) {
    const { components, addComponent, removeComponent } = hook
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<{ id: string; name: string }[]>([])
    const [selectedFood, setSelectedFood] = useState<{ id: string; name: string } | null>(null)
    const [quantity, setQuantity] = useState('')
    const [unit, setUnit] = useState('')
    const [adding, setAdding] = useState(false)

    const search = async (q: string) => {
        setQuery(q)
        setSelectedFood(null)
        if (q.trim().length < 2) { setResults([]); return }
        const { data } = await supabase.from('foods').select('id, name').ilike('name', `%${q.trim()}%`).limit(8)
        setResults(data || [])
    }

    const handleAdd = async () => {
        if (!selectedFood) return
        setAdding(true)
        await addComponent({
            tenant_id: tenantId,
            food_id: selectedFood.id,
            quantity: quantity ? Number(quantity) : null,
            unit: unit || null,
        })
        setQuery(''); setSelectedFood(null); setQuantity(''); setUnit(''); setResults([])
        setAdding(false)
    }

    const label = (c: ComponentRow) => c.serving_label || c.food?.name || c.recipe?.title || c.supplement?.title || '—'

    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Ingredientes / Componentes</p>
            <div className="space-y-1.5 mb-3">
                {components.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-white/[0.02] border border-white/8 rounded-xl px-3 py-2">
                        <span className="flex-1 text-xs text-slate-300">
                            {c.quantity && <span className="font-semibold text-white">{c.quantity}{c.unit ? ` ${c.unit}` : ''} </span>}
                            {label(c)}
                        </span>
                        <button onClick={() => removeComponent(c.id)} className="text-slate-500 hover:text-rose-400">
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
                {components.length === 0 && <p className="text-xs text-slate-600">Nenhum componente adicionado ainda.</p>}
            </div>
            <div className="flex items-center gap-2 relative">
                <div className="relative flex-1">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input value={selectedFood ? selectedFood.name : query} onChange={e => search(e.target.value)}
                        placeholder="Buscar alimento..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-2 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    {results.length > 0 && !selectedFood && (
                        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-[#181828] border border-white/10 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                            {results.map(f => (
                                <button key={f.id} onClick={() => { setSelectedFood(f); setResults([]) }}
                                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qtd" type="number"
                    className="w-16 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="un."
                    className="w-16 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                <button onClick={handleAdd} disabled={!selectedFood || adding}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all">
                    <Plus size={13} />
                </button>
            </div>
        </div>
    )
}
