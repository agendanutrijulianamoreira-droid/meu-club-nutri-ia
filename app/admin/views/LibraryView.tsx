"use client"

import React, { useState, useCallback } from "react"
import {
    Plus, Search, Flame, Clock, Edit3, Trash2,
    Utensils, Zap, X, Loader2, Brain, Sparkles,
    ShieldCheck, FileUp, Wand2, Save, RefreshCw,
    ToggleLeft, ToggleRight, ChevronRight, Image as ImageIcon,
    BookOpen, Tag
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useProtocols, Protocol } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'recipes', label: 'Receitas',  icon: Utensils,   category: 'recipe'   },
    { id: 'shots',   label: 'Shots Bio', icon: Zap,         category: 'shot'     },
    { id: 'diets',   label: 'Protocolos',icon: ShieldCheck, category: 'protocol' },
] as const

const DIETARY_TAGS = ["Low Carb","Vegetariana","Zero Açúcar","Sem Glúten","Zero Lactose","Detox","Cetogênica"]

const MEAL_TYPES = [
    "Café da manhã","Almoço","Jantar","Lanche","Pré-treino","Pós-treino","Shot / Elixir"
]

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ItemDetailModal({ item, onClose, onEdit }: {
    item: Protocol; onClose: () => void; onEdit: () => void
}) {
    const ingredients = item.content_json?.find((c: any) => c.type === 'ingredients')?.content || ''
    const instructions = item.content_json?.find((c: any) => c.type === 'instructions')?.content || ''
    const tags: string[] = item.content_json?.find((c: any) => c.type === 'tags')?.content || []
    const calories = tags.find(t => t.includes('kcal')) || null
    const tab = TABS.find(t => t.category === item.category)

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            {tab && <tab.icon size={18}/>}
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-lg leading-snug">{item.title}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500">{tab?.label}</span>
                                {item.duration_days > 0 && <>
                                    <span className="text-slate-700">·</span>
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock size={9}/> {item.duration_days}d</span>
                                </>}
                                {calories && <>
                                    <span className="text-slate-700">·</span>
                                    <span className="text-[10px] text-amber-400 flex items-center gap-1"><Flame size={9}/> {calories}</span>
                                </>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onEdit}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold transition-all">
                            <Edit3 size={12}/> Editar
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors">
                            <X size={16}/>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {item.description && (
                        <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                    )}

                    {tags.filter(t => !t.includes('kcal')).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.filter(t => !t.includes('kcal')).map((tag, i) => (
                                <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ingredients && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Ingredientes</p>
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                    {ingredients}
                                </div>
                            </div>
                        )}
                        {instructions && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Modo de preparo</p>
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                    {instructions}
                                </div>
                            </div>
                        )}
                    </div>

                    {!ingredients && !instructions && (
                        <p className="text-sm text-slate-600 text-center py-8 italic">Nenhum conteúdo detalhado cadastrado.</p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Create / Edit Form ───────────────────────────────────────────────────────
function ItemForm({ item, tenantId, category, type, onClose, createItem, updateItem }: {
    item?: Protocol | null; tenantId: string; category: string; type: string
    onClose: () => void; createItem: (d: any) => Promise<any>; updateItem: (id: string, d: any) => Promise<any>
}) {
    const isEditing = !!item
    const existingTags: string[] = item?.content_json?.find((c: any) => c.type === 'tags')?.content || []

    const [title, setTitle] = useState(item?.title || '')
    const [description, setDescription] = useState(item?.description || '')
    const [ingredients, setIngredients] = useState(item?.content_json?.find((c: any) => c.type === 'ingredients')?.content || '')
    const [instructions, setInstructions] = useState(item?.content_json?.find((c: any) => c.type === 'instructions')?.content || '')
    const [tags, setTags] = useState<string[]>(existingTags)
    const [calories, setCalories] = useState(existingTags.find(t => t.includes('kcal'))?.replace(' kcal','') || '')
    const [mealType, setMealType] = useState(item?.content_json?.find((c: any) => c.type === 'meal_type')?.content || '')
    const [isActive, setIsActive] = useState(item?.is_active ?? true)
    const [saving, setSaving] = useState(false)
    const [parsing, setParsing] = useState(false)
    const [coverUrl, setCoverUrl] = useState<string | null>(item?.cover_image_url || null)
    const { uploadImage, uploading } = useStorage()

    const toggleTag = (tag: string) => setTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

    const buildContentJson = () => {
        const allTags = [...tags.filter(t => !t.includes('kcal')), ...(calories ? [`${calories} kcal`] : [])]
        return [
            { type: 'tags', content: allTags },
            { type: 'ingredients', content: ingredients },
            { type: 'instructions', content: instructions },
            { type: 'meal_type', content: mealType },
        ]
    }

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || file.type !== 'application/pdf') return
        setParsing(true)
        try {
            const formData = new FormData(); formData.append('file', file)
            const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
            if (!res.ok) throw new Error((await res.json()).error || 'Erro no PDF')
            const { text } = await res.json()
            const lines = text.split('\n').filter((l: string) => l.trim().length > 3)
            setTitle(lines[0]?.substring(0, 60) || 'Nova Receita')
            setIngredients(lines.slice(1, 12).join('\n'))
            setInstructions(text.substring(0, 600))
            const kcalMatch = text.match(/(\d+)\s*kcal/i)
            if (kcalMatch) setCalories(kcalMatch[1])
        } catch (err: any) {
            alert('Erro ao processar PDF: ' + err.message)
        } finally { setParsing(false) }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        const { url, error } = await uploadImage(file, 'library')
        if (error) alert('Erro ao subir imagem: ' + error)
        else setCoverUrl(url)
    }

    const handleSave = async () => {
        if (!title.trim()) { alert('Nome é obrigatório'); return }
        setSaving(true)
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                cover_image_url: coverUrl,
                duration_days: category === 'protocol' ? 7 : 0,
                content_json: buildContentJson(),
                category,
                status: 'published',
                is_active: isActive,
                is_template: true,
                tenant_id: tenantId || null,
            }
            const result = isEditing ? await updateItem(item!.id, payload) : await createItem(payload)
            if (result.error) throw new Error(result.error)
            onClose()
        } catch (err: any) {
            alert('Erro ao salvar: ' + err.message)
        } finally { setSaving(false) }
    }

    const typeLabel = type === 'recipes' ? 'Receita' : type === 'shots' ? 'Shot Bio' : 'Protocolo'

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">

            <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-base">{isEditing ? 'Editar' : 'Novo'} {typeLabel}</h2>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsActive(v => !v)} className="flex items-center gap-1.5 text-xs font-bold transition-all">
                        {isActive ? <ToggleRight size={18} className="text-emerald-400"/> : <ToggleLeft size={18} className="text-slate-600"/>}
                        <span className={isActive ? 'text-emerald-400' : 'text-slate-600'}>{isActive ? 'Ativo' : 'Inativo'}</span>
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white">
                        <X size={16}/>
                    </button>
                </div>
            </div>

            {/* PDF Import */}
            {type === 'recipes' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Wand2 size={14} className="text-indigo-400"/>
                        <span className="text-xs text-indigo-200">Importar de PDF com IA</span>
                    </div>
                    <input type="file" id="pdf-upload" className="hidden" accept=".pdf" onChange={handlePdfUpload}/>
                    <button onClick={() => document.getElementById('pdf-upload')?.click()} disabled={parsing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {parsing ? <Loader2 size={11} className="animate-spin"/> : <FileUp size={11}/>}
                        {parsing ? 'Lendo...' : 'Selecionar PDF'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Nome *</label>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder={type === 'recipes' ? 'Ex: Omelete de Espinafre' : type === 'shots' ? 'Ex: Shot Termogênico Matinal' : 'Ex: Protocolo Low Carb 14 dias'}/>
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Descrição</label>
                    <input value={description} onChange={e => setDescription(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="Breve descrição e benefícios"/>
                </div>
                {type !== 'diets' && (
                    <>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Tipo de refeição</label>
                            <select value={mealType} onChange={e => setMealType(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none">
                                <option value="">Selecionar...</option>
                                {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Calorias (kcal)</label>
                            <input type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Ex: 320"/>
                        </div>
                    </>
                )}
            </div>

            {/* Dietary tags */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-1"><Tag size={10}/> Tags</label>
                <div className="flex flex-wrap gap-2">
                    {DIETARY_TAGS.map(tag => (
                        <button key={tag} onClick={() => toggleTag(tag)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all
                                ${tags.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                        {type === 'diets' ? 'Descrição detalhada' : 'Ingredientes'}
                    </label>
                    <textarea value={ingredients} onChange={e => setIngredients(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-32"
                        placeholder={type === 'diets' ? 'Descreva o protocolo...' : 'Um ingrediente por linha...'}/>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                        {type === 'diets' ? 'Instruções / Regras' : 'Modo de preparo'}
                    </label>
                    <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-32"
                        placeholder="Passo a passo..."/>
                </div>
            </div>

            {/* Image upload */}
            <div onClick={() => document.getElementById('lib-img-upload')?.click()}
                className="border border-dashed border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:border-indigo-500/30 transition-all group">
                <input type="file" id="lib-img-upload" className="hidden" accept="image/*" onChange={handleImageUpload}/>
                {uploading ? (
                    <div className="flex items-center justify-center gap-2 py-2"><Loader2 size={16} className="animate-spin text-indigo-400"/> <span className="text-xs text-slate-400">Enviando...</span></div>
                ) : coverUrl ? (
                    <div className="relative group/img">
                        <img src={coverUrl} alt="Cover" className="max-h-28 mx-auto rounded-xl object-cover"/>
                        <p className="text-[10px] text-slate-500 mt-1">Clique para trocar</p>
                    </div>
                ) : (
                    <div className="py-2 flex items-center justify-center gap-2 text-slate-600 group-hover:text-slate-400 transition-colors">
                        <ImageIcon size={16}/> <span className="text-xs font-bold">Adicionar imagem de capa</span>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold hover:bg-white/10 transition-all">Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                    {isEditing ? 'Atualizar' : 'Salvar'}
                </button>
            </div>
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LibraryView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
    const { protocols, loading, createProtocol, updateProtocol, deleteProtocol, refresh } = useProtocols()
    const [activeTab, setActiveTab] = useState<'recipes' | 'shots' | 'diets'>('recipes')
    const [showForm, setShowForm] = useState(false)
    const [editingItem, setEditingItem] = useState<Protocol | null>(null)
    const [viewingItem, setViewingItem] = useState<Protocol | null>(null)
    const [search, setSearch] = useState('')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)

    const tab = TABS.find(t => t.id === activeTab)!

    const filtered = protocols.filter(p => {
        const correctType = p.category === tab.category
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(search.toLowerCase())
        const itemTags: string[] = p.content_json?.find((c: any) => c.type === 'tags')?.content || []
        const matchTag = !selectedTag || itemTags.includes(selectedTag)
        return correctType && matchSearch && matchTag
    })

    const handleToggleActive = async (item: Protocol) => {
        await updateProtocol(item.id, { is_active: !item.is_active })
    }

    const handleDelete = async (item: Protocol) => {
        if (!confirm(`Excluir "${item.title}"?`)) return
        await deleteProtocol(item.id)
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Biblioteca do <span className="font-bold">Reino</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Receitas, shots bio-ativos e protocolos clínicos.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => refresh()} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-500">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
                    </button>
                    {!showForm && (
                        <button onClick={() => { setEditingItem(null); setShowForm(true) }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl transition-all">
                            <Plus size={15}/> Cadastrar
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs + search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedTag(null) }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all
                                ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            <t.icon size={14}/> {t.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={`Buscar ${tab.label.toLowerCase()}...`}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                </div>
            </div>

            {/* Tag filter (recipes only) */}
            {activeTab === 'recipes' && (
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedTag(null)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all
                            ${!selectedTag ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                        Todos
                    </button>
                    {DIETARY_TAGS.map(tag => (
                        <button key={tag} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all
                                ${selectedTag === tag ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Form */}
            <AnimatePresence>
                {(showForm || editingItem) && (
                    <ItemForm
                        item={editingItem}
                        tenantId={tenantId}
                        category={tab.category}
                        type={activeTab}
                        onClose={() => { setShowForm(false); setEditingItem(null); refresh() }}
                        createItem={createProtocol}
                        updateItem={updateProtocol}
                    />
                )}
            </AnimatePresence>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-600"/></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <tab.icon size={28}/>
                    </div>
                    <p className="text-white font-bold mb-1">{search ? 'Nenhum resultado' : `Sem ${tab.label.toLowerCase()} cadastrados`}</p>
                    <p className="text-slate-500 text-sm mb-5">{search ? 'Tente outro termo' : 'Comece cadastrando o primeiro item'}</p>
                    {!search && (
                        <button onClick={() => { setEditingItem(null); setShowForm(true) }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all">
                            <Plus size={14}/> Cadastrar agora
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(item => {
                        const itemTags: string[] = item.content_json?.find((c: any) => c.type === 'tags')?.content || []
                        const calories = itemTags.find(t => t.includes('kcal')) || null
                        const displayTags = itemTags.filter(t => !t.includes('kcal'))
                        const mealType = item.content_json?.find((c: any) => c.type === 'meal_type')?.content || null

                        return (
                            <div key={item.id} className={`bg-white/5 border rounded-3xl p-5 group relative flex flex-col gap-3 transition-all ${item.is_active ? 'border-white/10 hover:border-indigo-500/25' : 'border-white/5 opacity-60'}`}>
                                {/* Icon + title */}
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                                        <tab.icon size={18}/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-sm truncate">{item.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {mealType && <span className="text-[9px] text-slate-500">{mealType}</span>}
                                            {calories && <>
                                                {mealType && <span className="text-slate-700">·</span>}
                                                <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><Flame size={8}/> {calories}</span>
                                            </>}
                                            {item.duration_days > 0 && <>
                                                <span className="text-slate-700">·</span>
                                                <span className="text-[9px] text-slate-500 flex items-center gap-0.5"><Clock size={8}/> {item.duration_days}d</span>
                                            </>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggleActive(item)}
                                        className="flex-shrink-0 hover:scale-110 transition-all ml-1">
                                        {item.is_active
                                            ? <ToggleRight size={18} className="text-emerald-400"/>
                                            : <ToggleLeft size={18} className="text-slate-600"/>}
                                    </button>
                                </div>

                                {/* Description */}
                                {item.description && (
                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
                                )}

                                {/* Tags */}
                                {displayTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {displayTags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15 text-indigo-300">
                                                {tag}
                                            </span>
                                        ))}
                                        {displayTags.length > 3 && (
                                            <span className="text-[9px] text-slate-600">+{displayTags.length - 3}</span>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-auto">
                                    <button onClick={() => setViewingItem(item)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold transition-all">
                                        <BookOpen size={12}/> Ver ficha
                                    </button>
                                    <button onClick={() => { setEditingItem(item); setShowForm(false); }}
                                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                                        <Edit3 size={13}/>
                                    </button>
                                    <button onClick={() => handleDelete(item)}
                                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all">
                                        <Trash2 size={13}/>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Detail modal */}
            <AnimatePresence>
                {viewingItem && (
                    <ItemDetailModal
                        item={viewingItem}
                        onClose={() => setViewingItem(null)}
                        onEdit={() => { setEditingItem(viewingItem); setViewingItem(null) }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
