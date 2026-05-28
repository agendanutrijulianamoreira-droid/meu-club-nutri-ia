"use client"

import { useState, useCallback, useEffect } from "react"
import {
    Plus, Sparkles, FileText, Clock, MoreVertical, Edit, Trash2, Copy, Loader2,
    X, Save, Heart, Target, Utensils, Trophy, Check, AlertCircle, ChevronRight,
    Zap, Calendar, Scale, Dumbbell, Apple, Leaf, Star
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useProtocols, useGoals } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase"

type Tab = 'protocols' | 'goals' | 'meals' | 'challenges'

const GOAL_TYPES = [
    { id: 'weight', label: 'Peso', icon: Scale, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { id: 'habit', label: 'Hábito', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'nutrition', label: 'Nutrição', icon: Apple, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'exercise', label: 'Exercício', icon: Dumbbell, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'wellness', label: 'Bem-estar', icon: Leaf, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'custom', label: 'Personalizada', icon: Target, color: 'text-slate-400', bg: 'bg-slate-500/10' },
] as const

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }: { toast: { type: 'success' | 'error'; msg: string } }) {
    return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium
                ${toast.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'
                    : 'bg-rose-500/15 border border-rose-500/25 text-rose-400'}`}>
            {toast.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
        </motion.div>
    )
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function ProtocolsView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
    const [activeTab, setActiveTab] = useState<Tab>('protocols')
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const showToast = useCallback((type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }, [])

    // Protocols
    const { protocols, loading: loadingProtocols, createProtocol, updateProtocol, deleteProtocol, duplicateProtocol, toggleFavorite } = useProtocols()
    const [showCreateProtocol, setShowCreateProtocol] = useState(false)
    const [editingProtocol, setEditingProtocol] = useState<any>(null)
    const [templateProtocol, setTemplateProtocol] = useState<any>(null)
    const [filterFavorites, setFilterFavorites] = useState(false)

    // Goals
    const { goals, loading: loadingGoals, createGoal, deleteGoal, toggleGoalFavorite } = useGoals(tenantId)
    const [showCreateGoal, setShowCreateGoal] = useState(false)

    const filteredProtocols = filterFavorites ? protocols.filter(p => p.is_favorite) : protocols

    const closeProtocolForm = () => {
        setShowCreateProtocol(false)
        setEditingProtocol(null)
        setTemplateProtocol(null)
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light">Biblioteca de <span className="font-bold">Conteúdo</span></h1>
                    <p className="text-slate-400 mt-1 text-sm">Protocolos, metas, cardápios e desafios para suas pacientes.</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'protocols' && !showCreateProtocol && (
                        <button
                            onClick={() => { setTemplateProtocol(null); setEditingProtocol(null); setShowCreateProtocol(true) }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                            <Plus size={16} /> Novo Protocolo
                        </button>
                    )}
                    {activeTab === 'goals' && !showCreateGoal && (
                        <button
                            onClick={() => setShowCreateGoal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                            <Plus size={16} /> Nova Meta
                        </button>
                    )}
                </div>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && <Toast toast={toast} />}
            </AnimatePresence>

            {/* Tabs */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex gap-1 w-fit">
                {([
                    { id: 'protocols', label: 'Protocolos', icon: FileText },
                    { id: 'goals', label: 'Metas', icon: Target },
                    { id: 'meals', label: 'Cardápios', icon: Utensils },
                    { id: 'challenges', label: 'Desafios', icon: Trophy },
                ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                            ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {/* ─── Protocolos ─── */}
                {activeTab === 'protocols' && (
                    <motion.div key="protocols" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {showCreateProtocol ? (
                            <CreateProtocolForm
                                tenantId={tenantId}
                                onClose={closeProtocolForm}
                                editingData={editingProtocol}
                                templateData={templateProtocol}
                                onSave={async (data) => {
                                    const result = await createProtocol({ ...data, tenant_id: tenantId })
                                    if (result.error) showToast('error', 'Erro ao salvar: ' + result.error)
                                    else { showToast('success', 'Protocolo criado!'); closeProtocolForm() }
                                }}
                                onUpdate={async (id, data) => {
                                    const result = await updateProtocol(id, data)
                                    if (result.error) showToast('error', 'Erro ao atualizar')
                                    else { showToast('success', 'Protocolo atualizado!'); closeProtocolForm() }
                                }}
                            />
                        ) : (
                            <div className="space-y-4">
                                {/* Filter bar */}
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setFilterFavorites(!filterFavorites)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                                            ${filterFavorites
                                                ? 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                                        <Heart size={12} className={filterFavorites ? 'fill-rose-400' : ''} />
                                        Favoritos
                                    </button>
                                    <span className="text-slate-600 text-xs">
                                        {filteredProtocols.length} protocolo{filteredProtocols.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {loadingProtocols ? (
                                    <div className="flex items-center justify-center h-40">
                                        <Loader2 className="animate-spin text-indigo-400" size={32} />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredProtocols.map(protocol => (
                                            <ProtocolCard
                                                key={protocol.id}
                                                protocol={protocol}
                                                onDelete={async (id) => {
                                                    await deleteProtocol(id)
                                                    showToast('success', 'Protocolo excluído')
                                                }}
                                                onEdit={(p) => { setEditingProtocol(p); setShowCreateProtocol(true) }}
                                                onDuplicate={async (p) => {
                                                    await (duplicateProtocol as any)(p.id)
                                                    showToast('success', 'Duplicado!')
                                                }}
                                                onToggleFavorite={toggleFavorite}
                                                onUseAsTemplate={(p) => {
                                                    setTemplateProtocol(p)
                                                    setEditingProtocol(null)
                                                    setShowCreateProtocol(true)
                                                }}
                                            />
                                        ))}

                                        <button onClick={() => setShowCreateProtocol(true)}
                                            className="bg-white/[0.02] border border-dashed border-white/10 hover:border-indigo-500/30 transition-all rounded-3xl p-5 flex flex-col items-center justify-center gap-3 min-h-[200px] group">
                                            <div className="h-14 w-14 rounded-full bg-indigo-600/10 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                                                <Plus size={28} className="text-indigo-400" />
                                            </div>
                                            <p className="text-slate-500 group-hover:text-white transition-colors text-sm">Novo Protocolo</p>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ─── Metas ─── */}
                {activeTab === 'goals' && (
                    <motion.div key="goals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {showCreateGoal ? (
                            <CreateGoalForm
                                tenantId={tenantId}
                                onClose={() => setShowCreateGoal(false)}
                                onSave={async (data) => {
                                    const result = await createGoal(data)
                                    if (result.error) showToast('error', 'Erro ao salvar meta')
                                    else { showToast('success', 'Meta criada!'); setShowCreateGoal(false) }
                                }}
                            />
                        ) : (
                            <div className="space-y-4">
                                {loadingGoals ? (
                                    <div className="flex items-center justify-center h-40">
                                        <Loader2 className="animate-spin text-indigo-400" size={32} />
                                    </div>
                                ) : goals.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-60 gap-4">
                                        <div className="text-5xl">🎯</div>
                                        <p className="text-slate-400 text-sm">Nenhuma meta criada ainda</p>
                                        <p className="text-slate-600 text-xs text-center max-w-xs">
                                            Crie metas para guiar suas pacientes: perda de peso, hábitos, hidratação, exercícios.
                                        </p>
                                        <button onClick={() => setShowCreateGoal(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                                            <Plus size={16} /> Criar Primeira Meta
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {goals.map(goal => (
                                            <GoalCard
                                                key={goal.id}
                                                goal={goal}
                                                onDelete={async (id) => {
                                                    await deleteGoal(id)
                                                    showToast('success', 'Meta excluída')
                                                }}
                                                onToggleFavorite={toggleGoalFavorite}
                                            />
                                        ))}
                                        <button onClick={() => setShowCreateGoal(true)}
                                            className="bg-white/[0.02] border border-dashed border-white/10 hover:border-indigo-500/30 transition-all rounded-3xl p-5 flex flex-col items-center justify-center gap-3 min-h-[180px] group">
                                            <div className="h-14 w-14 rounded-full bg-indigo-600/10 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                                                <Plus size={28} className="text-indigo-400" />
                                            </div>
                                            <p className="text-slate-500 group-hover:text-white transition-colors text-sm">Nova Meta</p>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ─── Cardápios ─── */}
                {activeTab === 'meals' && (
                    <motion.div key="meals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <MealsTab setView={setView} />
                    </motion.div>
                )}

                {/* ─── Desafios ─── */}
                {activeTab === 'challenges' && (
                    <motion.div key="challenges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ChallengesTab setView={setView} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Protocol Card ────────────────────────────────────────────────────────────
function ProtocolCard({ protocol, onDelete, onEdit, onDuplicate, onToggleFavorite, onUseAsTemplate }: {
    protocol: any
    onDelete: (id: string) => Promise<any>
    onEdit: (p: any) => void
    onDuplicate: (p: any) => Promise<any>
    onToggleFavorite: (id: string) => Promise<any>
    onUseAsTemplate: (p: any) => void
}) {
    const [showMenu, setShowMenu] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [duplicating, setDuplicating] = useState(false)
    const [favoriting, setFavoriting] = useState(false)

    const days = protocol.content?.length || protocol.content_json?.length || 0

    return (
        <div className={`bg-white/5 border rounded-3xl p-5 group relative flex flex-col gap-4 transition-all hover:border-indigo-500/20
            ${protocol.is_favorite ? 'border-rose-500/20' : 'border-white/10'}`}>

            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl flex-shrink-0">
                        {protocol.emoji || '📋'}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm leading-snug truncate">{protocol.title}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> {protocol.duration_days}d
                            {days > 0 && <> · <FileText size={10} /> {days} dias</>}
                        </p>
                    </div>
                </div>
                <button
                    onClick={async () => { setFavoriting(true); await onToggleFavorite(protocol.id); setFavoriting(false) }}
                    disabled={favoriting}
                    className="flex-shrink-0 p-1.5 rounded-xl hover:bg-white/10 transition-all">
                    {favoriting
                        ? <Loader2 size={14} className="animate-spin text-slate-500" />
                        : <Heart size={14} className={protocol.is_favorite ? 'fill-rose-400 text-rose-400' : 'text-slate-600 hover:text-rose-400'} />
                    }
                </button>
            </div>

            {/* Description */}
            {protocol.description && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{protocol.description}</p>
            )}

            {/* Status badge */}
            <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border
                    ${protocol.is_active
                        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                        : 'bg-slate-700/30 border-slate-600/20 text-slate-500'}`}>
                    {protocol.is_active ? 'Ativo' : 'Rascunho'}
                </span>
                {protocol.category && protocol.category !== 'custom' && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                        {protocol.category}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                    onClick={() => onEdit(protocol)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                    <Edit size={12} /> Editar
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        disabled={deleting || duplicating}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                        {(deleting || duplicating) ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
                    </button>
                    {showMenu && (
                        <div onClick={() => setShowMenu(false)}
                            className="absolute right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-2xl p-2 min-w-[170px] z-20 shadow-xl">
                            <button
                                onClick={() => onUseAsTemplate(protocol)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 rounded-xl">
                                <Copy size={12} /> Usar como base
                            </button>
                            <button
                                onClick={async () => { setDuplicating(true); await onDuplicate(protocol); setDuplicating(false) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 rounded-xl">
                                <Copy size={12} /> Duplicar
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                            <button
                                onClick={async () => {
                                    if (!confirm('Excluir este protocolo?')) return
                                    setDeleting(true)
                                    await onDelete(protocol.id)
                                    setDeleting(false)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl">
                                <Trash2 size={12} /> Excluir
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Create Protocol Form ─────────────────────────────────────────────────────
function CreateProtocolForm({ tenantId, onClose, onSave, onUpdate, editingData, templateData }: {
    tenantId: string
    onClose: () => void
    onSave: (data: any) => Promise<void>
    onUpdate?: (id: string, data: any) => Promise<void>
    editingData?: any
    templateData?: any
}) {
    const isEditing = !!editingData
    const baseData = editingData || templateData
    const [step, setStep] = useState(baseData ? 2 : 1)
    const [formData, setFormData] = useState({
        title: baseData?.title ? (templateData ? `Cópia de ${baseData.title}` : baseData.title) : '',
        duration: baseData?.duration_days?.toString() || '7',
        description: baseData?.description || '',
        category: baseData?.category || 'custom',
        days: baseData?.content || baseData?.content_json || [] as any[],
    })
    const [selectedDay, setSelectedDay] = useState<number | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [aiError, setAiError] = useState('')

    const generateWithAI = async () => {
        if (!formData.title) return
        setIsGenerating(true)
        setAiError('')
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'generate-protocol',
                    context: `Crie um protocolo de ${formData.duration} dias focado em: ${formData.title}. ${formData.description}`,
                    prompt: `Gere a estrutura de tarefas diárias para o protocolo "${formData.title}" de ${formData.duration} dias.`
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setFormData(prev => ({
                ...prev,
                title: data.title || prev.title,
                description: data.description || prev.description,
                days: data.days || [],
            }))
            setStep(2)
            if ((data.days || []).length > 0) setSelectedDay(0)
        } catch (err: any) {
            setAiError(err.message || 'Erro ao gerar. Tente novamente.')
        } finally {
            setIsGenerating(false)
        }
    }

    const goToStepTwoManually = () => {
        const dur = parseInt(formData.duration)
        const days = Array.from({ length: dur }, (_, i) => ({
            day: i + 1,
            title: `Dia ${i + 1}`,
            items: [] as any[],
        }))
        setFormData(prev => ({ ...prev, days }))
        setStep(2)
        setSelectedDay(0)
    }

    const saveProtocol = async () => {
        if (!formData.title) return
        setIsSaving(true)
        const protocolData = {
            title: formData.title,
            description: formData.description,
            duration_days: parseInt(formData.duration),
            content: formData.days,
            category: formData.category,
            is_active: false,
            is_favorite: false,
            tenant_id: tenantId,
        }
        if (isEditing && onUpdate) {
            await onUpdate(editingData.id, protocolData)
        } else {
            await onSave(protocolData)
        }
        setIsSaving(false)
    }

    const updateDayItem = (dayIndex: number, taskIndex: number, field: string, value: any) => {
        const newDays = [...formData.days]
        newDays[dayIndex] = { ...newDays[dayIndex] }
        newDays[dayIndex].items = [...(newDays[dayIndex].items || [])]
        newDays[dayIndex].items[taskIndex] = { ...newDays[dayIndex].items[taskIndex], [field]: value }
        setFormData({ ...formData, days: newDays })
    }

    const addBlock = (dayIndex: number) => {
        const newDays = [...formData.days]
        newDays[dayIndex] = { ...newDays[dayIndex], items: [...(newDays[dayIndex].items || []), { title: '', item_type: 'habit', points: 10 }] }
        setFormData({ ...formData, days: newDays })
    }

    const removeBlock = (dayIndex: number, taskIndex: number) => {
        const newDays = [...formData.days]
        const items = [...(newDays[dayIndex].items || [])]
        items.splice(taskIndex, 1)
        newDays[dayIndex] = { ...newDays[dayIndex], items }
        setFormData({ ...formData, days: newDays })
    }

    const CATEGORIES = [
        { id: 'custom', label: 'Personalizado' },
        { id: 'detox', label: 'Detox' },
        { id: 'lowcarb', label: 'Low Carb' },
        { id: 'maintenance', label: 'Manutenção' },
        { id: 'challenge', label: 'Desafio' },
        { id: 'seasonal', label: 'Sazonal' },
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold">
                        {isEditing ? 'Editar Protocolo' : templateData ? 'Novo Protocolo (baseado em template)' : step === 1 ? '1. Definir Protocolo' : '2. Estrutura por Dia'}
                    </h2>
                    {templateData && <p className="text-xs text-indigo-400 mt-0.5">Base: {templateData.title}</p>}
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400">
                    <X size={18} />
                </button>
            </div>

            {/* Step 1 */}
            {step === 1 && (
                <div className="max-w-2xl mx-auto space-y-5">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Nome do Protocolo</label>
                        <input
                            type="text"
                            placeholder="Ex: Protocolo Detox Primavera"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-base focus:outline-none focus:border-indigo-500/50"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Duração</label>
                        <div className="grid grid-cols-4 gap-3">
                            {['7', '14', '21', '30'].map(d => (
                                <button key={d} onClick={() => setFormData({ ...formData, duration: d })}
                                    className={`p-4 rounded-2xl border transition-all text-center
                                        ${formData.duration === d
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                    <span className="text-2xl font-bold block">{d}</span>
                                    <span className="text-xs">dias</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Categoria</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(c => (
                                <button key={c.id} onClick={() => setFormData({ ...formData, category: c.id })}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                                        ${formData.category === c.id
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Descrição (opcional)</label>
                        <textarea
                            placeholder="O que suas pacientes vão conquistar com esse protocolo?"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white h-20 resize-none focus:outline-none focus:border-indigo-500/50 text-sm"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {aiError && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                            <AlertCircle size={15} /> {aiError}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={generateWithAI}
                            disabled={!formData.title || isGenerating}
                            className="flex-1 flex items-center justify-center gap-2 h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all">
                            {isGenerating
                                ? <><Loader2 className="animate-spin" size={16} /> Gerando...</>
                                : <><Sparkles size={16} /> Gerar com IA</>}
                        </button>
                        <button
                            onClick={goToStepTwoManually}
                            disabled={!formData.title}
                            className="flex items-center gap-2 px-4 h-12 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-400 hover:text-white border border-white/10 rounded-2xl transition-all text-sm">
                            Criar manualmente
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
                <div className="grid grid-cols-12 gap-4" style={{ minHeight: 480 }}>
                    {/* Days list */}
                    <div className="col-span-4 bg-white/[0.03] rounded-2xl p-3 overflow-y-auto space-y-1.5" style={{ maxHeight: 480 }}>
                        {formData.days.map((day: any, idx: number) => (
                            <button key={day.day} onClick={() => setSelectedDay(idx)}
                                className={`w-full p-3 rounded-xl transition-all text-left border
                                    ${selectedDay === idx
                                        ? 'bg-indigo-600/20 border-indigo-500/40'
                                        : 'bg-white/5 hover:bg-white/10 border-transparent'}`}>
                                <span className="text-indigo-400 text-[10px] font-black uppercase">DIA {day.day}</span>
                                <p className="font-semibold text-xs mt-0.5 text-white truncate">{day.title}</p>
                                <p className="text-[10px] text-slate-500">{(day.items || []).length} tarefa{(day.items || []).length !== 1 ? 's' : ''}</p>
                            </button>
                        ))}
                        {formData.days.length === 0 && (
                            <p className="text-slate-600 text-xs text-center py-10">Nenhum dia gerado</p>
                        )}
                    </div>

                    {/* Editor */}
                    <div className="col-span-8 bg-white/[0.02] rounded-2xl p-5 border border-white/5 overflow-y-auto" style={{ maxHeight: 480 }}>
                        {selectedDay !== null && formData.days[selectedDay] ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Título do Dia</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                                        value={formData.days[selectedDay].title}
                                        onChange={e => {
                                            const newDays = [...formData.days]
                                            newDays[selectedDay] = { ...newDays[selectedDay], title: e.target.value }
                                            setFormData({ ...formData, days: newDays })
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tarefas / Refeições</label>
                                        <button onClick={() => addBlock(selectedDay)}
                                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                            <Plus size={12} /> Adicionar
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {(formData.days[selectedDay].items || []).map((task: any, taskIdx: number) => (
                                            <div key={taskIdx} className="flex gap-2 items-center bg-white/5 border border-white/5 p-3 rounded-xl">
                                                <select
                                                    value={task.item_type || 'habit'}
                                                    onChange={e => updateDayItem(selectedDay, taskIdx, 'item_type', e.target.value)}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-400 focus:outline-none w-24">
                                                    <option value="meal">🍽 Refeição</option>
                                                    <option value="shot">💉 Shot</option>
                                                    <option value="water">💧 Água</option>
                                                    <option value="exercise">🏃 Exercício</option>
                                                    <option value="habit">⭐ Hábito</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Descrição da tarefa"
                                                    className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder:text-slate-600"
                                                    value={task.title || ''}
                                                    onChange={e => updateDayItem(selectedDay, taskIdx, 'title', e.target.value)}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="XP"
                                                    className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none text-center"
                                                    value={task.points || 10}
                                                    onChange={e => updateDayItem(selectedDay, taskIdx, 'points', parseInt(e.target.value) || 0)}
                                                />
                                                <button onClick={() => removeBlock(selectedDay, taskIdx)}
                                                    className="text-slate-600 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {(formData.days[selectedDay].items || []).length === 0 && (
                                            <p className="text-slate-600 text-xs text-center py-8">Nenhuma tarefa. Clique em Adicionar.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-600 text-sm text-center py-20">
                                👈 Selecione um dia para editar
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-white/10 flex justify-between items-center">
                <div>
                    {step === 2 && !isEditing && !templateData && (
                        <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-white transition-colors">
                            ← Voltar
                        </button>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                        Cancelar
                    </button>
                    {step === 2 && (
                        <button
                            onClick={saveProtocol}
                            disabled={isSaving || !formData.title}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                            {isSaving
                                ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                                : <><Save size={14} /> {isEditing ? 'Atualizar' : 'Salvar'} Protocolo</>}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, onDelete, onToggleFavorite }: {
    goal: any
    onDelete: (id: string) => Promise<any>
    onToggleFavorite: (id: string) => Promise<any>
}) {
    const [deleting, setDeleting] = useState(false)
    const [favoriting, setFavoriting] = useState(false)
    const meta = GOAL_TYPES.find(g => g.id === goal.goal_type) || GOAL_TYPES[5]
    const Icon = meta.icon

    const deadline = goal.deadline ? new Date(goal.deadline) : null
    const isOverdue = deadline && deadline < new Date()

    return (
        <div className={`bg-white/5 border rounded-3xl p-5 flex flex-col gap-3 transition-all hover:border-indigo-500/20
            ${goal.is_favorite ? 'border-rose-500/20' : 'border-white/10'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                        {goal.emoji !== '🎯' ? (
                            <span className="text-xl">{goal.emoji}</span>
                        ) : (
                            <Icon size={20} className={meta.color} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm leading-snug">{goal.title}</h3>
                        <p className={`text-[10px] mt-0.5 ${meta.color}`}>{meta.label}</p>
                    </div>
                </div>
                <button
                    onClick={async () => { setFavoriting(true); await onToggleFavorite(goal.id); setFavoriting(false) }}
                    disabled={favoriting}
                    className="flex-shrink-0 p-1.5 rounded-xl hover:bg-white/10 transition-all">
                    {favoriting
                        ? <Loader2 size={14} className="animate-spin text-slate-500" />
                        : <Heart size={14} className={goal.is_favorite ? 'fill-rose-400 text-rose-400' : 'text-slate-600 hover:text-rose-400'} />
                    }
                </button>
            </div>

            {goal.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{goal.description}</p>
            )}

            {(goal.target_value || goal.metric || goal.deadline) && (
                <div className="flex items-center gap-3 flex-wrap">
                    {goal.target_value && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Target size={10} /> Meta: <strong className="text-white">{goal.target_value}{goal.unit ? ` ${goal.unit}` : ''}</strong>
                        </span>
                    )}
                    {deadline && (
                        <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>
                            <Calendar size={10} /> {deadline.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border
                    ${goal.is_active ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-slate-700/30 border-slate-600/20 text-slate-500'}`}>
                    {goal.is_active ? 'Ativa' : 'Inativa'}
                </span>
                <button
                    onClick={async () => {
                        if (!confirm('Excluir esta meta?')) return
                        setDeleting(true)
                        await onDelete(goal.id)
                        setDeleting(false)
                    }}
                    disabled={deleting}
                    className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all">
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
            </div>
        </div>
    )
}

// ─── Create Goal Form ─────────────────────────────────────────────────────────
function CreateGoalForm({ tenantId, onClose, onSave }: {
    tenantId: string
    onClose: () => void
    onSave: (data: any) => Promise<void>
}) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        emoji: '🎯',
        goal_type: 'habit' as const,
        metric: '',
        target_value: '',
        unit: '',
        deadline: '',
    })
    const [isSaving, setIsSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [aiError, setAiError] = useState('')

    const generateSuggestion = async () => {
        if (!form.title) return
        setIsGenerating(true)
        setAiError('')
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'marketing-suggestion',
                    context: `Crie uma sugestão de meta de saúde: ${form.title}`,
                    prompt: `Sugira uma descrição motivacional curta para a meta: "${form.title}"`
                })
            })
            const data = await res.json()
            if (data.message) setForm(prev => ({ ...prev, description: data.message }))
        } catch (err: any) {
            setAiError('Erro ao gerar sugestão')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSave = async () => {
        if (!form.title) return
        setIsSaving(true)
        await onSave({
            title: form.title,
            description: form.description || null,
            emoji: form.emoji,
            goal_type: form.goal_type,
            metric: form.metric || null,
            target_value: form.target_value ? parseFloat(form.target_value) : null,
            unit: form.unit || null,
            deadline: form.deadline || null,
            is_active: true,
            is_favorite: false,
            tenant_id: tenantId,
            content_json: {},
        })
        setIsSaving(false)
    }

    const EMOJIS = ['🎯', '⚡', '💪', '🥗', '💧', '🏃', '🧘', '✨', '🌟', '🌿', '🏆', '❤️', '🔥', '🍎', '😴']

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Nova Meta</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400"><X size={18} /></button>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Tipo de Meta</label>
                    <div className="grid grid-cols-3 gap-2">
                        {GOAL_TYPES.map(gt => {
                            const Icon = gt.icon
                            return (
                                <button key={gt.id} onClick={() => setForm({ ...form, goal_type: gt.id as any })}
                                    className={`flex items-center gap-2 p-3 rounded-2xl border transition-all text-sm
                                        ${form.goal_type === gt.id
                                            ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                                    <Icon size={16} className={form.goal_type === gt.id ? 'text-indigo-400' : gt.color} />
                                    {gt.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Emoji</label>
                    <div className="flex flex-wrap gap-2">
                        {EMOJIS.map(e => (
                            <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                                className={`w-9 h-9 rounded-xl text-lg transition-all border
                                    ${form.emoji === e ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                {e}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Título da Meta</label>
                    <input
                        type="text"
                        placeholder="Ex: Beber 2L de água por dia"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Descrição</label>
                        <button onClick={generateSuggestion} disabled={!form.title || isGenerating}
                            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors">
                            {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            Sugerir com IA
                        </button>
                    </div>
                    <textarea
                        placeholder="Descrição ou instrução para a paciente..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm h-16 resize-none focus:outline-none focus:border-indigo-500/50"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                    />
                    {aiError && <p className="text-rose-400 text-xs mt-1">{aiError}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Valor alvo</label>
                        <input type="number" placeholder="Ex: 5"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            value={form.target_value}
                            onChange={e => setForm({ ...form, target_value: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Unidade</label>
                        <input type="text" placeholder="kg, L, min..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            value={form.unit}
                            onChange={e => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Prazo</label>
                        <input type="date"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            value={form.deadline}
                            onChange={e => setForm({ ...form, deadline: e.target.value })} />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={isSaving || !form.title}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {isSaving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Save size={14} /> Criar Meta</>}
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Meals Tab ────────────────────────────────────────────────────────────────
function MealsTab({ setView }: { setView: (v: any) => void }) {
    return (
        <div className="space-y-4">
            <p className="text-slate-500 text-sm">Crie cardápios estruturados para suas pacientes.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Quantitative */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
                        🔬
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Cardápio Quantitativo</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Com macros calculados (proteína, carboidrato, gordura, kcal).
                            A IA seleciona alimentos da tabela TACO e calcula as porções.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['Macros precisos', 'Tabela TACO', 'PDF exportável'].map(t => (
                            <span key={t} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{t}</span>
                        ))}
                    </div>
                    <button onClick={() => setView('meal-plans')}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-2xl transition-all mt-auto">
                        <Zap size={14} /> Criar Cardápio Quantitativo <ChevronRight size={14} />
                    </button>
                </div>

                {/* Qualitative */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
                        📝
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Cardápio Qualitativo</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Orientações de refeições por descrição sem quantidades exatas.
                            Ideal para reeducação alimentar e protocolos de hábitos.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['Orientação alimentar', 'Protocolo de hábitos', 'Fácil de seguir'].map(t => (
                            <span key={t} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">{t}</span>
                        ))}
                    </div>
                    <button onClick={() => setView('protocols')}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-2xl transition-all mt-auto"
                        title="Crie um protocolo com tipo 'Personalizado' descrevendo refeições por dia">
                        <FileText size={14} /> Criar via Protocolo <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-slate-500 text-xs">
                    💡 <strong className="text-slate-400">Dica:</strong> Para cardápios qualitativos, crie um Protocolo com a IA usando o contexto
                    <em> "cardápio por refeição: café da manhã, almoço, lanche e jantar"</em>. A IA irá gerar descrições alimentares para cada refeição do dia.
                </p>
            </div>
        </div>
    )
}

// ─── Challenges Tab ───────────────────────────────────────────────────────────
function ChallengesTab({ setView }: { setView: (v: any) => void }) {
    const [challenges, setChallenges] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.from('challenges').select('id, title, emoji, is_active, duration_days, start_date, end_date')
            .order('created_at', { ascending: false }).limit(6)
            .then(({ data }) => { setChallenges(data || []); setLoading(false) })
    }, [])

    const active = challenges.filter(c => c.is_active)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-sm">{active.length} desafio{active.length !== 1 ? 's' : ''} ativo{active.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setView('challenges')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                    <Plus size={14} /> Gerenciar Desafios
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                </div>
            ) : challenges.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 gap-4">
                    <div className="text-5xl">🏆</div>
                    <p className="text-slate-400 text-sm">Nenhum desafio criado ainda</p>
                    <button onClick={() => setView('challenges')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                        <Plus size={14} /> Criar Primeiro Desafio
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {challenges.map(c => {
                        const start = c.start_date ? new Date(c.start_date) : null
                        const end = c.end_date ? new Date(c.end_date) : null
                        const today = new Date()
                        let status = 'inactive'
                        if (c.is_active) {
                            if (start && today < start) status = 'upcoming'
                            else if (end && today > end) status = 'finished'
                            else status = 'active'
                        }
                        const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
                            active:   { label: 'Ativo',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25' },
                            upcoming: { label: 'Em breve',  color: 'text-indigo-400',  bg: 'bg-indigo-500/15 border-indigo-500/25' },
                            finished: { label: 'Encerrado', color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25' },
                            inactive: { label: 'Inativo',   color: 'text-slate-500',   bg: 'bg-slate-700/20 border-slate-600/20' },
                        }
                        const sm = statusMeta[status]
                        return (
                            <div key={c.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
                                    {c.emoji || '🏆'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-white text-sm truncate">{c.title}</h4>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <Clock size={10} /> {c.duration_days}d
                                    </p>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${sm.bg} ${sm.color}`}>
                                    {sm.label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}

            <button onClick={() => setView('challenges')}
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                Ver todos os desafios <ChevronRight size={14} />
            </button>
        </div>
    )
}
