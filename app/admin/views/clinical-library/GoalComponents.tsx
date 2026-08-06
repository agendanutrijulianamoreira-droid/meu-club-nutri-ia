"use client"

// Extraído de ProtocolsView.tsx (Sub-fase 2 — Metas passam a ser um Ativo
// Clínico independente, gerenciado pela Biblioteca Clínica em vez de dentro
// do Protocolos). Componentes reaproveitados como estavam, sem reescrever
// a interface (ADR-0001 — Metas viram Biblioteca Clínica → Protocolos).

import { useState } from "react"
import { motion } from "framer-motion"
import { Scale, Star, Apple, Dumbbell, Leaf, Target, Heart, Calendar, X, Loader2, Sparkles, Save, Trash2 } from "lucide-react"

export const GOAL_TYPES = [
    { id: 'weight', label: 'Peso', icon: Scale, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { id: 'habit', label: 'Hábito', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'nutrition', label: 'Nutrição', icon: Apple, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'exercise', label: 'Exercício', icon: Dumbbell, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'wellness', label: 'Bem-estar', icon: Leaf, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'custom', label: 'Personalizada', icon: Target, color: 'text-slate-400', bg: 'bg-slate-500/10' },
] as const

export function GoalCard({ goal, onDelete, onToggleFavorite }: {
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

export function CreateGoalForm({ tenantId, onClose, onSave }: {
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
                    task: 'generate-goal',
                    context: form.title,
                    prompt: `Sugira uma meta de saúde a partir do título: "${form.title}"`
                })
            })
            const data = await res.json()
            if (!res.ok) { setAiError(data.error || 'Erro ao gerar sugestão'); return }
            setForm(prev => ({
                ...prev,
                title: data.title || prev.title,
                description: data.description || prev.description,
                emoji: data.emoji || prev.emoji,
                goal_type: (data.goal_type as any) || prev.goal_type,
                metric: data.metric || prev.metric,
                target_value: data.target_value != null ? String(data.target_value) : prev.target_value,
                unit: data.unit || prev.unit,
            }))
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
