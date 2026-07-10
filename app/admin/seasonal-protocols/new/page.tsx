"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft, Save, Sparkles, Plus, X, Trash2, Loader2, Wand2, Image as ImageIcon,
    Upload, Target, DollarSign, Users2, ChevronRight, Check, AlertCircle, Copy, ExternalLink,
} from "lucide-react"
import { useStorage } from "@/lib/hooks/useStorage"

const MEAL_TYPE_OPTIONS = [
    { value: 'shot', label: '🧪 Shot Matinal' },
    { value: 'cafe_manha', label: '☀️ Café da Manhã' },
    { value: 'lanche_manha', label: '🍋 Lanche da Manhã' },
    { value: 'colacao', label: '🍎 Colação' },
    { value: 'almoco', label: '🍽️ Almoço' },
    { value: 'lanche_tarde', label: '🥤 Lanche da Tarde' },
    { value: 'jantar', label: '🌙 Jantar' },
    { value: 'ceia', label: '🍵 Ceia' },
    { value: 'cha_noturno', label: '🍵 Chá Noturno' },
    { value: 'water', label: '💧 Hidratação' },
    { value: 'workout', label: '💪 Treino' },
    { value: 'content', label: '💡 Dica' },
]

const VISUAL_MEAL_TYPES = new Set(['shot', 'cafe_manha', 'lanche_manha', 'colacao', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'cha_noturno'])

type ItemForm = {
    meal_type: string
    title: string
    description: string
    ingredients: string[]
    recipe: string
    image_url: string | null
    points: number
    points_camera: number
    points_gallery: number
    generatingPhoto?: boolean
}

type DayForm = { day_number: number; title: string; subtitle: string; items: ItemForm[] }

function emptyDay(n: number): DayForm {
    return { day_number: n, title: `Dia ${n}`, subtitle: '', items: [] }
}

function newItem(): ItemForm {
    return { meal_type: 'almoco', title: '', description: '', ingredients: [], recipe: '', image_url: null, points: 10, points_camera: 10, points_gallery: 10 }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }: { toast: { type: 'success' | 'error'; msg: string } }) {
    return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-xl border
                ${toast.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                    : 'bg-rose-500/15 border-rose-500/25 text-rose-400'}`}>
            {toast.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
        </motion.div>
    )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle} type="button"
            className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
        </button>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">{children}</p>
}

function SeasonalProtocolBuilderContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editId = searchParams?.get('edit')
    const { uploadImage, uploading } = useStorage()

    const [loading, setLoading] = useState(!!editId)
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'info' | 'cardapio' | 'venda'>('info')
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [coverImage, setCoverImage] = useState('')
    const [goals, setGoals] = useState<string[]>([])
    const [goalInput, setGoalInput] = useState('')
    const [days, setDays] = useState<DayForm[]>(Array.from({ length: 7 }, (_, i) => emptyDay(i + 1)))
    const [selectedDay, setSelectedDay] = useState(0)

    const [upsellTitle, setUpsellTitle] = useState('')
    const [upsellMessage, setUpsellMessage] = useState('')
    const [upsellCtaLabel, setUpsellCtaLabel] = useState('')
    const [upsellCtaUrl, setUpsellCtaUrl] = useState('')

    const [isStandalone, setIsStandalone] = useState(false)
    const [standaloneSlug, setStandaloneSlug] = useState('')
    const [standalonePrice, setStandalonePrice] = useState('')
    const [salesHeadline, setSalesHeadline] = useState('')
    const [salesDescription, setSalesDescription] = useState('')
    const [savedSlug, setSavedSlug] = useState('')
    const [leads, setLeads] = useState<any[]>([])

    const [showMagic, setShowMagic] = useState(false)
    const [magicPrompt, setMagicPrompt] = useState('')
    const [magicDuration, setMagicDuration] = useState(7)
    const [generating, setGenerating] = useState(false)

    // ── Load para edição ──
    useEffect(() => {
        if (!editId) return
        setLoading(true)
        fetch(`/api/admin/seasonal-protocols/${editId}`)
            .then(r => r.json())
            .then(data => {
                const p = data.protocol
                if (!p) return
                setTitle(p.title || '')
                setDescription(p.description || '')
                setCoverImage(p.cover_image_url || '')
                setGoals(p.goals || [])
                setUpsellTitle(p.upsell_title || '')
                setUpsellMessage(p.upsell_message || '')
                setUpsellCtaLabel(p.upsell_cta_label || '')
                setUpsellCtaUrl(p.upsell_cta_url || '')
                setIsStandalone(p.is_standalone || false)
                setStandaloneSlug(p.standalone_slug || '')
                setSavedSlug(p.standalone_slug || '')
                setStandalonePrice(p.standalone_price_cents ? (p.standalone_price_cents / 100).toFixed(2) : '')
                setSalesHeadline(p.sales_headline || '')
                setSalesDescription(p.sales_description || '')
                setLeads(data.leads || [])

                const loadedDays: DayForm[] = (p.days || []).map((d: any) => ({
                    day_number: d.day_number,
                    title: d.title || `Dia ${d.day_number}`,
                    subtitle: d.subtitle || '',
                    items: (d.protocol_items || []).map((i: any) => ({
                        meal_type: i.type,
                        title: i.title,
                        description: i.description || '',
                        ingredients: i.ingredients || [],
                        recipe: i.recipe || '',
                        image_url: i.image_url,
                        points: i.points || 10,
                        points_camera: i.points_camera || i.points || 10,
                        points_gallery: i.points_gallery || i.points || 10,
                    })),
                }))
                if (loadedDays.length > 0) setDays(loadedDays)
            })
            .finally(() => setLoading(false))
    }, [editId])

    // ── Duração ──
    const handleDurationChange = (n: number) => {
        setDays(prev => {
            if (n > prev.length) {
                const extra = Array.from({ length: n - prev.length }, (_, i) => emptyDay(prev.length + i + 1))
                return [...prev, ...extra]
            }
            return prev.slice(0, n)
        })
        if (selectedDay >= n) setSelectedDay(n - 1)
    }

    // ── Geração via IA ──
    const generatePhotoFor = async (dayIdx: number, itemIdx: number, itemTitle: string, itemDescription: string) => {
        setDays(prev => {
            const copy = [...prev]
            copy[dayIdx] = { ...copy[dayIdx], items: copy[dayIdx].items.map((it, i) => i === itemIdx ? { ...it, generatingPhoto: true } : it) }
            return copy
        })
        try {
            const res = await fetch('/api/ai/generate-meal-photo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: itemTitle, description: itemDescription }),
            })
            const data = await res.json()
            setDays(prev => {
                const copy = [...prev]
                copy[dayIdx] = {
                    ...copy[dayIdx],
                    items: copy[dayIdx].items.map((it, i) => i === itemIdx
                        ? { ...it, generatingPhoto: false, image_url: data.url || it.image_url }
                        : it),
                }
                return copy
            })
        } catch {
            setDays(prev => {
                const copy = [...prev]
                copy[dayIdx] = { ...copy[dayIdx], items: copy[dayIdx].items.map((it, i) => i === itemIdx ? { ...it, generatingPhoto: false } : it) }
                return copy
            })
        }
    }

    const generatePhotosInBatches = async (generatedDays: DayForm[]) => {
        const jobs: { dayIdx: number; itemIdx: number; title: string; description: string }[] = []
        generatedDays.forEach((day, dayIdx) => {
            day.items.forEach((item, itemIdx) => {
                if (VISUAL_MEAL_TYPES.has(item.meal_type)) {
                    jobs.push({ dayIdx, itemIdx, title: item.title, description: item.description })
                }
            })
        })
        const BATCH = 3
        for (let i = 0; i < jobs.length; i += BATCH) {
            const batch = jobs.slice(i, i + BATCH)
            await Promise.all(batch.map(j => generatePhotoFor(j.dayIdx, j.itemIdx, j.title, j.description)))
        }
    }

    const handleMagicGenerate = async () => {
        if (!magicPrompt.trim()) { showToast('error', 'Descreva o objetivo do protocolo'); return }
        setGenerating(true)
        try {
            const res = await fetch('/api/ai/generate-seasonal-protocol', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: magicPrompt, durationDays: magicDuration }),
            })
            const result = await res.json()
            if (!res.ok || !result.success) { showToast('error', result.error || 'Erro ao gerar protocolo'); return }

            const data = result.data
            setTitle(data.title || '')
            setDescription(data.description || '')
            setGoals(data.goals || [])

            const generatedDays: DayForm[] = (data.days || []).map((d: any) => ({
                day_number: d.day_number,
                title: d.title || `Dia ${d.day_number}`,
                subtitle: '',
                items: (d.items || []).map((it: any) => ({
                    meal_type: it.meal_type || 'meal',
                    title: it.title || '',
                    description: it.description || '',
                    ingredients: it.ingredients || [],
                    recipe: it.recipe || '',
                    image_url: null,
                    points: it.points || 10,
                    points_camera: it.points_camera || it.points || 10,
                    points_gallery: it.points_gallery || it.points || 10,
                })),
            }))
            setDays(generatedDays.length > 0 ? generatedDays : days)
            setSelectedDay(0)
            setShowMagic(false)
            setMagicPrompt('')
            showToast('success', 'Protocolo gerado! Gerando fotos das refeições em segundo plano...')

            generatePhotosInBatches(generatedDays)
        } catch (err: any) {
            showToast('error', err.message || 'Erro ao gerar protocolo')
        } finally {
            setGenerating(false)
        }
    }

    // ── Handlers de dia/item ──
    const updateDay = (field: keyof DayForm, value: any) => {
        setDays(prev => { const c = [...prev]; c[selectedDay] = { ...c[selectedDay], [field]: value }; return c })
    }
    const addItem = () => {
        setDays(prev => { const c = [...prev]; c[selectedDay] = { ...c[selectedDay], items: [...c[selectedDay].items, newItem()] }; return c })
    }
    const removeItem = (idx: number) => {
        setDays(prev => { const c = [...prev]; c[selectedDay] = { ...c[selectedDay], items: c[selectedDay].items.filter((_, i) => i !== idx) }; return c })
    }
    const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
        setDays(prev => {
            const c = [...prev]
            c[selectedDay] = { ...c[selectedDay], items: c[selectedDay].items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }
            return c
        })
    }

    const handleUploadCover = async (file: File) => {
        const { url, error } = await uploadImage(file, 'seasonal-protocols')
        if (error) { showToast('error', error); return }
        if (url) setCoverImage(url)
    }

    const handleUploadItemPhoto = async (idx: number, file: File) => {
        const { url, error } = await uploadImage(file, 'seasonal-protocols')
        if (error) { showToast('error', error); return }
        if (url) updateItem(idx, 'image_url', url)
    }

    // ── Salvar ──
    const handleSave = async () => {
        if (!title.trim()) { showToast('error', 'Título é obrigatório'); setTab('info'); return }
        setSaving(true)
        try {
            const payload = {
                title, description, cover_image_url: coverImage, goals,
                duration_days: days.length,
                days: days.map(d => ({
                    day_number: d.day_number, title: d.title, subtitle: d.subtitle,
                    items: d.items.map(it => ({
                        meal_type: it.meal_type, title: it.title, description: it.description,
                        ingredients: it.ingredients, recipe: it.recipe, image_url: it.image_url, points: it.points,
                        points_camera: it.points_camera, points_gallery: it.points_gallery,
                    })),
                })),
                upsell_title: upsellTitle, upsell_message: upsellMessage,
                upsell_cta_label: upsellCtaLabel, upsell_cta_url: upsellCtaUrl,
                is_standalone: isStandalone,
                standalone_slug: standaloneSlug,
                standalone_price_cents: standalonePrice ? Math.round(parseFloat(standalonePrice.replace(',', '.')) * 100) : null,
                sales_headline: salesHeadline, sales_description: salesDescription,
            }

            const res = editId
                ? await fetch(`/api/admin/seasonal-protocols/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                : await fetch('/api/admin/seasonal-protocols', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

            const result = await res.json()
            if (!res.ok) { showToast('error', result.error || 'Erro ao salvar'); return }

            if (result.standalone_slug) setSavedSlug(result.standalone_slug)
            showToast('success', 'Protocolo salvo!')
            if (!editId && result.id) router.replace(`/admin/seasonal-protocols/new?edit=${result.id}`)
        } catch (err: any) {
            showToast('error', err.message || 'Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-400" size={40} />
            </div>
        )
    }

    const currentDay = days[selectedDay]

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-16">
            <AnimatePresence>{toast && <Toast toast={toast} />}</AnimatePresence>

            {/* Header */}
            <div className="border-b border-white/10 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/admin?view=protocols')} className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
                            <ArrowLeft size={18} /> Voltar
                        </button>
                        <div>
                            <h1 className="text-lg font-bold">{editId ? 'Editar Protocolo Sazonal' : 'Novo Protocolo Sazonal'}</h1>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowMagic(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold rounded-2xl transition-all">
                            <Wand2 size={16} /> Gerar com IA
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Salvando...' : 'Salvar Protocolo'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Magic modal */}
            <AnimatePresence>
                {showMagic && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 max-w-xl w-full p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 className="text-indigo-400" size={18} /> Gerar Protocolo com IA</h2>
                                <button onClick={() => setShowMagic(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
                            </div>
                            <SectionLabel>Objetivo do protocolo</SectionLabel>
                            <textarea
                                placeholder="Ex: Protocolo detox de verão, 7 dias, foco em desinchar e reduzir inflamação, com shots matinais e cardápio leve"
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white h-28 resize-none focus:outline-none focus:border-indigo-500 mb-4"
                                value={magicPrompt} onChange={e => setMagicPrompt(e.target.value)} disabled={generating}
                            />
                            <SectionLabel>Duração</SectionLabel>
                            <div className="grid grid-cols-4 gap-2 mb-5">
                                {[3, 5, 7, 14].map(d => (
                                    <button key={d} disabled={generating} onClick={() => setMagicDuration(d)}
                                        className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${magicDuration === d ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                        {d} dias
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowMagic(false)} disabled={generating} className="px-4 py-2 text-slate-400 text-sm">Cancelar</button>
                                <button onClick={handleMagicGenerate} disabled={generating || !magicPrompt.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl">
                                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {generating ? 'Gerando...' : 'Gerar Protocolo Completo'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex gap-1 w-fit mb-6">
                    {([
                        { id: 'info', label: 'Informações & Metas' },
                        { id: 'cardapio', label: 'Cardápio por Dia' },
                        { id: 'venda', label: 'Próximo Passo & Venda' },
                    ] as const).map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── INFO TAB ── */}
                {tab === 'info' && (
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-8 space-y-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                                <div>
                                    <SectionLabel>Título do Protocolo *</SectionLabel>
                                    <input type="text" placeholder="Ex: Protocolo Detox Verão"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                                        value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div>
                                    <SectionLabel>Descrição</SectionLabel>
                                    <textarea placeholder="O que suas pacientes vão conquistar com este protocolo?"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white h-24 resize-none focus:outline-none focus:border-indigo-500"
                                        value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <div>
                                    <SectionLabel>Duração</SectionLabel>
                                    <div className="grid grid-cols-6 gap-2">
                                        {[3, 5, 7, 10, 14, 21].map(d => (
                                            <button key={d} onClick={() => handleDurationChange(d)}
                                                className={`py-2 rounded-xl border text-sm font-bold transition-all ${days.length === d ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                                {d}d
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Target size={14} className="text-emerald-400" />
                                    <SectionLabel>Metas do Protocolo</SectionLabel>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input type="text" placeholder="Ex: Desinchar e reduzir retenção de líquidos"
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={goalInput} onChange={e => setGoalInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && goalInput.trim()) { setGoals([...goals, goalInput.trim()]); setGoalInput('') } }} />
                                    <button onClick={() => { if (goalInput.trim()) { setGoals([...goals, goalInput.trim()]); setGoalInput('') } }}
                                        className="px-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-2">
                                    {goals.map((g, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                            <span className="text-sm text-slate-300">{g}</span>
                                            <button onClick={() => setGoals(goals.filter((_, gi) => gi !== i))} className="text-slate-500 hover:text-rose-400"><X size={14} /></button>
                                        </div>
                                    ))}
                                    {goals.length === 0 && <p className="text-xs text-slate-600">Nenhuma meta adicionada ainda.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="col-span-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                <SectionLabel>Capa do Protocolo</SectionLabel>
                                <label className="aspect-video bg-white/5 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center hover:border-indigo-500/50 transition-all cursor-pointer group overflow-hidden">
                                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                        onChange={e => e.target.files?.[0] && handleUploadCover(e.target.files[0])} />
                                    {coverImage ? (
                                        <img src={coverImage} alt="Capa" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center">
                                            {uploading ? <Loader2 className="animate-spin mx-auto mb-2 text-indigo-400" size={28} /> : <Upload size={28} className="mx-auto mb-2 text-slate-500 group-hover:text-indigo-400" />}
                                            <p className="text-xs text-slate-500">Clique para enviar</p>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CARDÁPIO TAB ── */}
                {tab === 'cardapio' && currentDay && (
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-3">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 space-y-1 max-h-[70vh] overflow-y-auto">
                                {days.map((d, idx) => (
                                    <button key={idx} onClick={() => setSelectedDay(idx)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${selectedDay === idx ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                                        <p className="text-xs font-black uppercase tracking-wider opacity-70">Dia {d.day_number}</p>
                                        <p className="text-sm font-bold truncate">{d.title}</p>
                                        <p className="text-xs opacity-60">{d.items.length} itens</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-9 space-y-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                <SectionLabel>Título do Dia</SectionLabel>
                                <input type="text" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                                    value={currentDay.title} onChange={e => updateDay('title', e.target.value)} />
                            </div>

                            <div className="flex items-center justify-between">
                                <SectionLabel>Refeições / Opções do Dia</SectionLabel>
                                <button onClick={addItem} className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300">
                                    <Plus size={14} /> Adicionar
                                </button>
                            </div>

                            <div className="space-y-3">
                                {currentDay.items.map((item, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <select value={item.meal_type} onChange={e => updateItem(idx, 'meal_type', e.target.value)}
                                                className="bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none">
                                                {MEAL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                            <input type="text" placeholder="Nome da opção (ex: Suco verde detox)"
                                                className="flex-1 bg-transparent border-b border-white/10 text-white placeholder-slate-600 focus:outline-none py-2"
                                                value={item.title} onChange={e => updateItem(idx, 'title', e.target.value)} />
                                            <button onClick={() => removeItem(idx)} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={16} /></button>
                                        </div>

                                        <div className="flex items-center gap-4 pl-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pontos por comprovação:</span>
                                            <label className="flex items-center gap-1.5 text-xs text-slate-400">
                                                Sem foto
                                                <input type="number" min="0" value={item.points}
                                                    onChange={e => updateItem(idx, 'points', parseInt(e.target.value) || 0)}
                                                    className="w-14 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:outline-none" />
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-sky-400">
                                                Galeria
                                                <input type="number" min="0" value={item.points_gallery}
                                                    onChange={e => updateItem(idx, 'points_gallery', parseInt(e.target.value) || 0)}
                                                    className="w-14 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:outline-none" />
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-violet-400">
                                                Câmera
                                                <input type="number" min="0" value={item.points_camera}
                                                    onChange={e => updateItem(idx, 'points_camera', parseInt(e.target.value) || 0)}
                                                    className="w-14 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:outline-none" />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-3">
                                                <textarea placeholder="Descrição qualitativa (sem gramas)..."
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white resize-none focus:outline-none"
                                                    rows={2} value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                                <IngredientsInput
                                                    ingredients={item.ingredients}
                                                    onChange={list => updateItem(idx, 'ingredients', list)}
                                                />
                                                <textarea placeholder="Modo de preparo (opcional — salva como receita no banco)"
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white resize-none focus:outline-none"
                                                    rows={2} value={item.recipe} onChange={e => updateItem(idx, 'recipe', e.target.value)} />
                                            </div>

                                            <div>
                                                <div className="aspect-video bg-black/20 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden relative">
                                                    {item.generatingPhoto ? (
                                                        <Loader2 className="animate-spin text-indigo-400" size={24} />
                                                    ) : item.image_url ? (
                                                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon size={24} className="text-slate-600" />
                                                    )}
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => generatePhotoFor(selectedDay, idx, item.title, item.description)}
                                                        disabled={item.generatingPhoto || !item.title.trim()}
                                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 disabled:opacity-40 text-indigo-400 text-xs font-bold">
                                                        <Wand2 size={12} /> Gerar foto
                                                    </button>
                                                    <label className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer">
                                                        <input type="file" accept="image/*" className="hidden"
                                                            onChange={e => e.target.files?.[0] && handleUploadItemPhoto(idx, e.target.files[0])} />
                                                        <Upload size={12} /> Enviar
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {currentDay.items.length === 0 && (
                                    <div className="text-center py-10 text-slate-500 text-sm">Nenhuma refeição adicionada para este dia ainda.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── VENDA TAB ── */}
                {tab === 'venda' && (
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-6 space-y-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                                <SectionLabel>Próximo Passo (exibido no último dia)</SectionLabel>
                                <input type="text" placeholder="Título (ex: Continue sua jornada)"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    value={upsellTitle} onChange={e => setUpsellTitle(e.target.value)} />
                                <textarea placeholder="Mensagem motivacional para o próximo passo"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white h-20 resize-none focus:outline-none focus:border-indigo-500"
                                    value={upsellMessage} onChange={e => setUpsellMessage(e.target.value)} />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Texto do botão (ex: Agendar consulta)"
                                        className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={upsellCtaLabel} onChange={e => setUpsellCtaLabel(e.target.value)} />
                                    <input type="text" placeholder="Link (WhatsApp, checkout, etc)"
                                        className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={upsellCtaUrl} onChange={e => setUpsellCtaUrl(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-6 space-y-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-amber-400" />
                                        <SectionLabel>Venda Avulsa (não-assinantes)</SectionLabel>
                                    </div>
                                    <Toggle on={isStandalone} onToggle={() => setIsStandalone(!isStandalone)} />
                                </div>

                                {isStandalone && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <SectionLabel>Preço (R$)</SectionLabel>
                                                <input type="text" placeholder="27,90"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    value={standalonePrice} onChange={e => setStandalonePrice(e.target.value)} />
                                            </div>
                                            <div>
                                                <SectionLabel>URL personalizada</SectionLabel>
                                                <input type="text" placeholder="detox-verao"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                    value={standaloneSlug} onChange={e => setStandaloneSlug(e.target.value)} />
                                            </div>
                                        </div>
                                        <input type="text" placeholder="Headline de vendas (ex: Desinche em 7 dias)"
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            value={salesHeadline} onChange={e => setSalesHeadline(e.target.value)} />
                                        <textarea placeholder="Descrição de vendas (o que a pessoa vai receber)"
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-sm text-white h-20 resize-none focus:outline-none focus:border-indigo-500"
                                            value={salesDescription} onChange={e => setSalesDescription(e.target.value)} />
                                        {savedSlug && (
                                            <a href={`/oferta/${savedSlug}`} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300">
                                                <ExternalLink size={12} /> Ver página de vendas
                                            </a>
                                        )}
                                    </>
                                )}
                            </div>

                            {editId && (
                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users2 size={14} className="text-emerald-400" />
                                        <SectionLabel>Interessadas ({leads.length})</SectionLabel>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {leads.map(lead => (
                                            <div key={lead.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                                <div>
                                                    <p className="text-sm text-white font-medium">{lead.name}</p>
                                                    <p className="text-xs text-slate-500">{lead.whatsapp || lead.email}</p>
                                                </div>
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{lead.status}</span>
                                            </div>
                                        ))}
                                        {leads.length === 0 && <p className="text-xs text-slate-600">Nenhuma interessada ainda.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function IngredientsInput({ ingredients, onChange }: { ingredients: string[]; onChange: (list: string[]) => void }) {
    const [input, setInput] = useState('')
    const add = () => {
        if (!input.trim()) return
        onChange([...ingredients, input.trim()])
        setInput('')
    }
    return (
        <div>
            <div className="flex gap-2 mb-1.5">
                <input type="text" placeholder="Ingrediente + Enter"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
                <button onClick={add} className="px-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg"><Plus size={12} /></button>
            </div>
            {ingredients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {ingredients.map((ing, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-slate-400">
                            {ing}
                            <button onClick={() => onChange(ingredients.filter((_, ii) => ii !== i))} className="hover:text-rose-400"><X size={10} /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function SeasonalProtocolBuilderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-400" size={40} /></div>}>
            <SeasonalProtocolBuilderContent />
        </Suspense>
    )
}
