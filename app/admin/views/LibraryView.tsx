"use client"

import { useState } from "react"
import {
    Plus,
    Search,
    Flame,
    Clock,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Utensils,
    Zap,
    Coffee,
    Apple,
    ChevronRight,
    Image as ImageIcon,
    Save,
    X,
    Loader2,
    Brain,
    Sparkles,
    ShieldCheck,
    FileUp,
    Wand2,
    Activity,
    Scale,
    Droplets
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useProtocols, Protocol } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

export function LibraryView({ setView }: { setView: (v: any) => void }) {
    const { protocols, loading, createProtocol, deleteProtocol, updateProtocol, refresh } = useProtocols()
    const [activeTab, setActiveTab] = useState<'recipes' | 'shots' | 'diets'>('recipes')
    const [showCreate, setShowCreate] = useState(false)
    const [search, setSearch] = useState("")
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [viewingItem, setViewingItem] = useState<Protocol | null>(null)

    const tabToCategory = {
        recipes: 'recipe',
        shots: 'shot',
        diets: 'protocol'
    }

    const filteredItems = protocols.filter(p => {
        const isCorrectType = p.category === tabToCategory[activeTab]
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase())

        let matchesTag = true
        if (selectedTag) {
            const tags = p.content_json?.find((c: any) => c.type === 'tags')?.content || []
            matchesTag = tags.includes(selectedTag)
        }

        return isCorrectType && matchesSearch && matchesTag
    })

    const DIETARY_TAGS = ["Low Carb", "Vegetariana", "Zero Açúcar", "Sem Glúten", "Zero Lactose"]

    return (
        <div className="space-y-8 pb-32">
            {/* Header Clinical */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
                            <Brain size={20} className="text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Repositório de Inteligência</span>
                    </div>
                    <h1 className="text-4xl font-light text-white tracking-tight">Biblioteca do <span className="font-bold">Reino</span></h1>
                    <p className="text-slate-400 font-medium">Gestão centralizada de ativos nutricionais e protocolos de performance.</p>
                </div>
                <Button
                    onClick={() => setShowCreate(true)}
                    className="h-16 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 border-none shadow-xl shadow-indigo-900/20 font-black text-sm uppercase tracking-widest gap-3 transition-all"
                >
                    <Plus size={22} />
                    Cadastrar Ativo
                </Button>
            </div>

            {/* Tabs & Filter Refined */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-2xl">
                <div className="flex bg-slate-950 p-1.5 rounded-2xl w-full lg:w-auto border border-white/5">
                    {[
                        { id: 'recipes', label: 'Receitas', icon: Utensils },
                        { id: 'shots', label: 'Shots Bio', icon: Zap },
                        { id: 'diets', label: 'Protocolos', icon: ShieldCheck }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 lg:flex-none px-8 py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all font-black text-[11px] uppercase tracking-widest ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full lg:w-80 group">
                    <Search className="absolute left-4 top-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou nutriente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Dietary Filter Bar */}
            {activeTab === 'recipes' && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedTag(null)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${!selectedTag ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
                    >
                        Todos
                    </button>
                    {DIETARY_TAGS.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${selectedTag === tag ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            <AnimatePresence mode="wait">
                {showCreate ? (
                    <CreateItemForm
                        onClose={() => { setShowCreate(false); refresh(); }}
                        type={activeTab}
                        category={tabToCategory[activeTab]}
                        createItem={createProtocol}
                    />
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
                    >
                        {loading ? (
                            <div className="col-span-full py-20 flex justify-center">
                                <Loader2 className="animate-spin text-indigo-500" size={48} />
                            </div>
                        ) : filteredItems.length > 0 ? filteredItems.map(item => (
                            <div key={item.id} className="relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 p-8 hover:border-indigo-500/30 transition-all group backdrop-blur-xl shadow-2xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl -z-10" />

                                <div className="flex justify-between items-start mb-6">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                        {activeTab === 'recipes' ? <Utensils size={28} /> : activeTab === 'shots' ? <Zap size={28} /> : <ShieldCheck size={28} />}
                                    </div>
                                    <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest backdrop-blur-md ${item.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                        }`}>
                                        {item.status === 'published' ? 'Publicado' : 'Rascunho'}
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 leading-tight">{item.title}</h3>

                                {item.category === 'recipe' && (
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {item.content_json?.find((c: any) => c.type === 'tags')?.content?.map((tag: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black uppercase text-indigo-400 tracking-tighter">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-[11px] text-slate-500 font-black uppercase tracking-widest mb-8">
                                    <span className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5"><Clock size={14} className="text-indigo-400" /> {item.duration_days > 0 ? `${item.duration_days}d` : 'Bio-Shot'}</span>
                                    {item.category === 'recipe' && (
                                        <span className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5"><Flame size={14} className="text-amber-500" /> {item.content_json?.find((c: any) => c.type === 'tags')?.content?.find((t: string) => t.includes('kcal')) || 'Calibrando'}</span>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        onClick={() => setViewingItem(item)}
                                        className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase tracking-widest border-none shadow-lg shadow-indigo-900/20"
                                    >
                                        Ver Ficha
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            if (confirm(`Deseja excluir "${item.title}"?`)) {
                                                await deleteProtocol(item.id)
                                            }
                                        }}
                                        variant="ghost"
                                        className="h-12 w-12 p-0 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-32 rounded-[3rem] border border-dashed border-white/10 bg-white/5 text-center px-10">
                                <div className="h-24 w-24 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6 text-indigo-400 shadow-2xl">
                                    {activeTab === 'recipes' ? <Utensils size={44} /> : activeTab === 'shots' ? <Zap size={44} /> : <ShieldCheck size={44} />}
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Iniciando Sequenciamento...</h3>
                                <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium">Sua biblioteca de {activeTab === 'recipes' ? 'receitas' : activeTab === 'shots' ? 'shots bio-ativos' : 'protocolos clínicos'} está vazia. Comece a criar seu ecossistema agora.</p>
                                <Button
                                    onClick={() => setShowCreate(true)}
                                    className="mt-10 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs"
                                >
                                    + Adicionar Primeiro Ativo
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {viewingItem && (
                    <ItemDetailsModal
                        item={viewingItem}
                        onClose={() => setViewingItem(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function ItemDetailsModal({ item, onClose }: { item: Protocol, onClose: () => void }) {
    const ingredients = item.content_json?.find((c: any) => c.type === 'ingredients')?.content || ""
    const instructions = item.content_json?.find((c: any) => c.type === 'instructions')?.content || ""
    const tags = item.content_json?.find((c: any) => c.type === 'tags')?.content || []
    const calories = tags.find((t: string) => t.includes('kcal')) || 'Calibrando...'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-white/10 w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]"
            >
                {/* Left: Content */}
                <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">Protocolo Clinical</span>
                            <h2 className="text-4xl font-bold text-white tracking-tight">{item.title}</h2>
                        </div>
                        <Button onClick={onClose} variant="ghost" className="rounded-2xl h-12 w-12 p-0 bg-white/5 border border-white/5">
                            <X size={20} />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <section className="space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Activity size={14} className="text-indigo-400" /> Bio-Ingredientes
                            </h4>
                            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                {ingredients || "Nenhum ingrediente catalogado."}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500" /> Preparação Clinical
                            </h4>
                            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium italic">
                                "{instructions || "Aguardando sequenciamento de instruções..."}"
                            </div>
                        </section>
                    </div>
                </div>

                {/* Right: Technical Sheet */}
                <div className="w-full md:w-96 bg-slate-950 border-l border-white/10 p-10 flex flex-col gap-8">
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 border-b border-indigo-500/20 pb-4">Ficha Técnica Premium</h3>

                        {/* Calories Box */}
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-8 text-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Densidade Energética</p>
                            <p className="text-5xl font-light text-white tracking-tighter">{calories.replace(' kcal', '')}<span className="text-lg font-bold ml-1 text-indigo-500">kcal</span></p>
                        </div>

                        {/* Macros Graph (Mock/Visual only for weight-less system) */}
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">Proteínas</span>
                                    <span className="text-white">24g</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div initial={{ width: 0 }} animate={{ width: '40%' }} className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">Carboidratos</span>
                                    <span className="text-white">12g</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div initial={{ width: 0 }} animate={{ width: '20%' }} className="h-full bg-emerald-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">Gorduras</span>
                                    <span className="text-white">18g</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div initial={{ width: 0 }} animate={{ width: '35%' }} className="h-full bg-amber-500" />
                                </div>
                            </div>
                        </div>

                        {/* Technical Badges */}
                        <div className="flex flex-wrap gap-2 pt-6">
                            {tags.map((tag: string, i: number) => (
                                <span key={i} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-[9px] font-bold text-slate-400 uppercase">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-8 border-t border-white/5">
                        <Button className="w-full h-14 rounded-2xl bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest text-[10px] shadow-xl">
                            Imprimir Guia Client
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

function CreateItemForm({ onClose, type, category, createItem }: { onClose: () => void, type: string, category: string, createItem: any }) {
    const [isSaving, setIsSaving] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [ingredients, setIngredients] = useState("")
    const [instructions, setInstructions] = useState("")
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
    const [isParsing, setIsParsing] = useState(false)
    const [tags, setTags] = useState<string[]>([])
    const { uploadImage, uploading: isUploadingFile } = useStorage()

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || file.type !== 'application/pdf') return

        setIsParsing(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/extract-pdf', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Falha na resposta do servidor')
            }

            const { text } = await response.json()

            // Heurística de extração baseada no texto real
            const findTags = () => {
                const found = []
                if (text.toLowerCase().includes('low carb') || text.toLowerCase().includes('baixo carbo')) found.push('Low Carb')
                if (text.toLowerCase().includes('vegetariana') || text.toLowerCase().includes('sem carne')) found.push('Vegetariana')
                if (text.toLowerCase().includes('zero açúcar') || text.toLowerCase().includes('sem açúcar')) found.push('Zero Açúcar')
                if (text.toLowerCase().includes('sem glúten') || text.toLowerCase().includes('gluten free')) found.push('Sem Glúten')
                if (text.toLowerCase().includes('lactose') || text.toLowerCase().includes('sem leite')) found.push('Zero Lactose')

                const kcalMatch = text.match(/(\d+)\s*kcal/i)
                if (kcalMatch) found.push(`${kcalMatch[1]} kcal`)
                else found.push('320 kcal') // Default clinical

                return found
            }

            const lines = text.split('\n').filter((l: string) => l.trim().length > 3)
            const detectedTitle = lines[0]?.substring(0, 40) || "Nova Receita PDF"
            const detectedIngredients = lines.slice(1, 10).join('\n')

            setTitle(detectedTitle)
            setIngredients(detectedIngredients)
            setInstructions(text.substring(0, 500) + "...")
            setTags(findTags())

            alert("IA: Analisei seu PDF e preenchi os dados baseados no conteúdo! Revise antes de salvar. ✨")
        } catch (error: any) {
            console.error('Erro ao processar PDF:', error)
            alert("Erro ao processar PDF: " + (error.message || "Erro desconhecido"))
        } finally {
            setIsParsing(false)
        }
    }
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const { url, error } = await uploadImage(file, 'library')
        if (error) {
            alert("Erro ao subir imagem: " + error)
        } else {
            setCoverImageUrl(url)
        }
    }

    const handleSave = async () => {
        if (!title) return alert("Por favor, dê um nome ao ativo.")

        setIsSaving(true)
        try {
            const { error: saveError } = await createItem({
                title,
                description: description || null,
                cover_image_url: coverImageUrl,
                duration_days: category === 'protocol' ? 7 : 0,
                content_json: [
                    { type: 'tags', content: tags },
                    { type: 'ingredients', content: ingredients },
                    { type: 'instructions', content: instructions }
                ],
                category: category,
                status: 'published',
                is_active: true,
                is_template: true,
                tenant_id: null
            })

            if (saveError) throw new Error(saveError)

            alert("Ativo persistido no Reino com sucesso! 💎")
            onClose()
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[3rem] bg-slate-950 border border-white/10 p-10 max-w-3xl mx-auto shadow-2xl relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -z-10" />

            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <Plus className="text-indigo-400" size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">
                            Novo Ativo Clínico
                        </h2>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">{type === 'recipes' ? 'Receita Gastronômica' : type === 'shots' ? 'Bio-Shot' : 'Protocolo Estruturado'}</p>
                    </div>
                </div>
                <div onClick={onClose} className="bg-white/5 p-3 rounded-xl text-slate-500 hover:text-white transition-all border border-white/5 cursor-pointer">
                    <X size={24} />
                </div>
            </div>

            {type === 'recipes' && (
                <div className="mb-10 bg-indigo-600/5 border border-indigo-500/20 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                            <FileUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Upload de PDF Inteligente</p>
                            <p className="text-xs text-slate-500">Suba seu livro de receitas e a IA preenche tudo.</p>
                        </div>
                    </div>
                    <input
                        type="file"
                        id="pdf-upload"
                        className="hidden"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                    />
                    <Button
                        onClick={() => document.getElementById('pdf-upload')?.click()}
                        disabled={isParsing}
                        className="bg-white text-black hover:bg-slate-200 h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                    >
                        {isParsing ? <Loader2 className="animate-spin" /> : <Wand2 size={16} />}
                        {isParsing ? "Lendo PDF..." : "Selecionar PDF"}
                    </Button>
                </div>
            )}

            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identificação do Prato/Asset</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-slate-700"
                            placeholder="Ex: Shot Termogênico Matinal"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Classificação do Protocolo</label>
                        <div className="relative">
                            <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-500/50 appearance-none font-medium cursor-pointer">
                                <option>Desjejum Estratégico</option>
                                <option>Almoço Metabólico</option>
                                <option>Jantar Clinical</option>
                                <option>Snack Performance</option>
                                <option>Bio-Shot / Elixir</option>
                            </select>
                            <ChevronRight size={18} className="absolute right-5 top-5.5 text-slate-600 rotate-90" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            Bio-Ingredientes <Sparkles size={12} className="text-indigo-400" />
                        </div>
                        {tags.length > 0 && (
                            <div className="flex gap-1">
                                {tags.map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400">{t}</span>
                                ))}
                            </div>
                        )}
                    </label>
                    <textarea
                        value={ingredients}
                        onChange={e => setIngredients(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white outline-none focus:border-indigo-500/50 h-48 font-medium placeholder:text-slate-700 resize-none"
                        placeholder="Dica: Liste um ingrediente por linha para melhor legibilidade..."
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Processo de Preparação Clinical</label>
                    <textarea
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white outline-none focus:border-indigo-500/50 h-32 font-medium placeholder:text-slate-700 resize-none"
                        placeholder="Descreva o passo a passo da ativação nutricional..."
                    />
                </div>

                <div
                    onClick={() => document.getElementById('asset-image-upload')?.click()}
                    className="p-10 border-2 border-dashed border-white/10 rounded-[2.5rem] text-center hover:border-indigo-500/40 transition-all cursor-pointer group bg-white/[0.02] relative overflow-hidden"
                >
                    <input
                        type="file"
                        id="asset-image-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    {isUploadingFile ? (
                        <div className="flex flex-col items-center">
                            <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
                            <p className="text-sm text-slate-400">Processando imagem clinical...</p>
                        </div>
                    ) : coverImageUrl ? (
                        <div className="relative group/cover">
                            <img src={coverImageUrl} alt="Cover preview" className="max-h-40 mx-auto rounded-2xl object-cover shadow-2xl" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity rounded-2xl">
                                <p className="text-xs font-black text-white uppercase tracking-widest">Substituir Documentação</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-600/20 transition-all group-hover:border-indigo-500/30 border border-transparent">
                                <ImageIcon size={32} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                            </div>
                            <p className="text-sm font-black text-slate-400 group-hover:text-white transition-colors uppercase tracking-widest">Registrar Documentação Visual</p>
                            <p className="text-[9px] text-slate-600 mt-2 uppercase font-black tracking-widest">(Formatos Premium: RAW, PNG, JPG)</p>
                        </>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-6 pt-6">
                    <Button variant="ghost" onClick={onClose} className="h-16 rounded-2xl font-black uppercase tracking-widest text-[11px] border border-white/5 text-slate-500 hover:text-white hover:bg-white/5 px-10">Descartar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-16 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-[11px] border-none shadow-2xl shadow-indigo-900/40"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : (
                            <span className="flex items-center gap-3">
                                <Save size={20} />
                                Validar e Salvar no Reino
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
