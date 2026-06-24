"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Plus, Edit3, Trash2, Loader2, Save, GripVertical,
    Activity, Droplets, Apple, Brain, Users, MoreHorizontal,
    CheckCircle, AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

type HabitCategory = 'saude' | 'alimentacao' | 'movimento' | 'mente' | 'social' | 'outro'
type IconColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky'

interface Habit {
    id: string
    name: string
    emoji: string
    description: string | null
    category: HabitCategory
    icon_color: IconColor
    sort_order: number
    is_active: boolean
}

interface HabitsViewProps {
    setView: (v: any) => void
    tenantId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HABITS = 20

const CATEGORIES: { value: HabitCategory; label: string; icon: any }[] = [
    { value: 'saude',       label: 'Saúde',       icon: Activity },
    { value: 'alimentacao', label: 'Alimentação',  icon: Apple },
    { value: 'movimento',   label: 'Movimento',    icon: CheckCircle },
    { value: 'mente',       label: 'Mente',        icon: Brain },
    { value: 'social',      label: 'Social',       icon: Users },
    { value: 'outro',       label: 'Outro',        icon: MoreHorizontal },
]

const COLORS: { value: IconColor; class: string; label: string }[] = [
    { value: 'indigo',  class: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',  label: 'Índigo' },
    { value: 'emerald', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Verde' },
    { value: 'amber',   class: 'bg-amber-500/20 text-amber-400 border-amber-500/30',     label: 'Âmbar' },
    { value: 'rose',    class: 'bg-rose-500/20 text-rose-400 border-rose-500/30',        label: 'Rosa' },
    { value: 'violet',  class: 'bg-violet-500/20 text-violet-400 border-violet-500/30',  label: 'Violeta' },
    { value: 'sky',     class: 'bg-sky-500/20 text-sky-400 border-sky-500/30',           label: 'Azul' },
]

const SUGGESTED_EMOJIS = ['✅','💧','🥗','🏃','🧘','📖','😴','🥑','💊','🌿','🏋️','🚶','🍎','💪','☀️','🧴','🫁','🫀','🧠','🌸']

const DEFAULT_FORM = {
    name: '',
    emoji: '✅',
    description: '',
    category: 'saude' as HabitCategory,
    icon_color: 'indigo' as IconColor,
}

// ─── Habit Form Modal ─────────────────────────────────────────────────────────

function HabitFormModal({
    habit,
    onSave,
    onClose,
    saving,
}: {
    habit: Partial<Habit> | null
    onSave: (data: typeof DEFAULT_FORM) => void
    onClose: () => void
    saving: boolean
}) {
    const [form, setForm] = useState<typeof DEFAULT_FORM>(
        habit
            ? { name: habit.name ?? '', emoji: habit.emoji ?? '✅', description: habit.description ?? '', category: habit.category ?? 'saude', icon_color: habit.icon_color ?? 'indigo' }
            : { ...DEFAULT_FORM }
    )

    const colorMeta = COLORS.find(c => c.value === form.icon_color)!

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-[#11111f] border border-white/10 rounded-3xl p-6 shadow-2xl z-10"
            >
                <h2 className="text-lg font-bold text-white mb-5">
                    {habit?.id ? 'Editar Hábito' : 'Novo Hábito'}
                </h2>

                <div className="space-y-4">
                    {/* Emoji picker */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Emoji</p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_EMOJIS.map(e => (
                                <button
                                    key={e}
                                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all
                                        ${form.emoji === e ? 'bg-indigo-600/30 ring-1 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}
                                >
                                    {e}
                                </button>
                            ))}
                            <input
                                type="text"
                                maxLength={2}
                                value={!SUGGESTED_EMOJIS.includes(form.emoji) ? form.emoji : ''}
                                onChange={e => setForm(f => ({ ...f, emoji: e.target.value || '✅' }))}
                                placeholder="outro"
                                className="w-16 h-9 rounded-xl bg-white/5 border border-white/10 text-center text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Nome do hábito *</p>
                        <input
                            type="text"
                            maxLength={60}
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Beber 2L de água"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Descrição (opcional)</p>
                        <textarea
                            maxLength={200}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Explique como concluir este hábito..."
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Categoria</p>
                        <div className="grid grid-cols-3 gap-2">
                            {CATEGORIES.map(cat => {
                                const Icon = cat.icon
                                return (
                                    <button
                                        key={cat.value}
                                        onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all
                                            ${form.category === cat.value
                                                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                                                : 'bg-white/5 text-slate-400 border border-white/5 hover:border-white/15'
                                            }`}
                                    >
                                        <Icon size={12} />
                                        {cat.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Color */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Cor do ícone</p>
                        <div className="flex gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setForm(f => ({ ...f, icon_color: c.value }))}
                                    title={c.label}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${c.class}
                                        ${form.icon_color === c.value ? 'scale-110 ring-2 ring-white/30' : 'opacity-60 hover:opacity-100'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className={`mt-5 flex items-center gap-3 p-3 rounded-2xl border ${colorMeta.class}`}>
                    <span className="text-2xl">{form.emoji}</span>
                    <div>
                        <p className="text-sm font-bold text-white">{form.name || 'Nome do hábito'}</p>
                        {form.description && <p className="text-xs text-slate-400 mt-0.5">{form.description}</p>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={!form.name.trim() || saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Salvar
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── Habit Row ────────────────────────────────────────────────────────────────

function HabitRow({ habit, onEdit, onDelete, onToggle }: {
    habit: Habit
    onEdit: (h: Habit) => void
    onDelete: (id: string) => void
    onToggle: (id: string, active: boolean) => void
}) {
    const [deleting, setDeleting] = useState(false)
    const colorMeta = COLORS.find(c => c.value === habit.icon_color) ?? COLORS[0]

    const handleDelete = async () => {
        if (!confirm(`Remover o hábito "${habit.name}"?`)) return
        setDeleting(true)
        await onDelete(habit.id)
        setDeleting(false)
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`flex items-center gap-4 p-4 bg-white/[0.03] border rounded-2xl group transition-all
                ${habit.is_active ? 'border-white/8 hover:border-white/15' : 'border-white/5 opacity-50'}`}
        >
            <GripVertical size={14} className="text-slate-700 flex-shrink-0 cursor-grab" />

            {/* Emoji badge */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border flex-shrink-0 ${colorMeta.class}`}>
                {habit.emoji}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{habit.name}</p>
                {habit.description && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{habit.description}</p>
                )}
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 mt-1 block">
                    {CATEGORIES.find(c => c.value === habit.category)?.label ?? habit.category}
                </span>
            </div>

            {/* Toggle active */}
            <button
                onClick={() => onToggle(habit.id, !habit.is_active)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0
                    ${habit.is_active ? 'bg-emerald-600' : 'bg-white/10'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all
                    ${habit.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(habit)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <Edit3 size={13} />
                </button>
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
            </div>
        </motion.div>
    )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function HabitsView({ setView, tenantId = '' }: HabitsViewProps) {
    const [habits, setHabits] = useState<Habit[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [orientation, setOrientation] = useState('')
    const [savingOrientation, setSavingOrientation] = useState(false)
    const [editingHabit, setEditingHabit] = useState<Habit | null | 'new'>('new' as any)
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }

    const loadHabits = useCallback(async () => {
        setLoading(true)
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('id, habits_orientation')
            .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
            .single()

        if (!tenantData) { setLoading(false); return }

        setOrientation(tenantData.habits_orientation ?? '')

        const { data } = await supabase
            .from('habits')
            .select('*')
            .eq('tenant_id', tenantData.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })

        setHabits(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { loadHabits() }, [loadHabits])

    const handleSave = async (form: typeof DEFAULT_FORM) => {
        setSaving(true)
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
            .single()

        if (!tenant) { setSaving(false); return }

        if (editingHabit && typeof editingHabit === 'object' && 'id' in editingHabit) {
            const { error } = await supabase
                .from('habits')
                .update({ ...form, updated_at: new Date().toISOString() })
                .eq('id', editingHabit.id)
            if (error) showToast('error', 'Erro ao atualizar hábito.')
            else showToast('success', 'Hábito atualizado!')
        } else {
            const { error } = await supabase
                .from('habits')
                .insert({ ...form, tenant_id: tenant.id, sort_order: habits.length })
            if (error) showToast('error', 'Erro ao criar hábito.')
            else showToast('success', 'Hábito criado!')
        }

        setSaving(false)
        setShowModal(false)
        setEditingHabit(null)
        loadHabits()
    }

    const handleDelete = async (id: string) => {
        await supabase.from('habits').delete().eq('id', id)
        setHabits(prev => prev.filter(h => h.id !== id))
        showToast('success', 'Hábito removido.')
    }

    const handleToggle = async (id: string, active: boolean) => {
        await supabase.from('habits').update({ is_active: active }).eq('id', id)
        setHabits(prev => prev.map(h => h.id === id ? { ...h, is_active: active } : h))
    }

    const handleSaveOrientation = async () => {
        setSavingOrientation(true)
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
            .single()
        if (tenant) {
            await supabase.from('tenants').update({ habits_orientation: orientation }).eq('id', tenant.id)
            showToast('success', 'Orientações salvas!')
        }
        setSavingOrientation(false)
    }

    const openNew = () => {
        if (activeHabits >= MAX_HABITS) {
            showToast('error', `Limite de ${MAX_HABITS} hábitos atingido.`)
            return
        }
        setEditingHabit(null)
        setShowModal(true)
    }

    const openEdit = (h: Habit) => {
        setEditingHabit(h)
        setShowModal(true)
    }

    const activeHabits = habits.filter(h => h.is_active).length

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">
                        Hábitos <span className="font-bold">Diários</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Defina até {MAX_HABITS} hábitos que suas pacientes rastrearão todo dia.
                    </p>
                </div>
                <button
                    onClick={openNew}
                    disabled={activeHabits >= MAX_HABITS}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
                >
                    <Plus size={15} />
                    Novo Hábito
                </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border
                            ${toast.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}
                    >
                        {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Hábitos ativos', value: activeHabits, max: MAX_HABITS, color: 'text-indigo-400' },
                    { label: 'Total criados',   value: habits.length,              color: 'text-slate-300' },
                    { label: 'Vagas restantes', value: MAX_HABITS - activeHabits,  color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Habits list */}
            <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">
                    Lista de Hábitos ({habits.length}/{MAX_HABITS})
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-600">
                        <Loader2 size={20} className="animate-spin" />
                    </div>
                ) : habits.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-4xl mb-3">🌱</p>
                        <p className="text-slate-400 font-medium">Nenhum hábito criado ainda</p>
                        <p className="text-slate-600 text-sm mt-1">Crie hábitos que suas pacientes vão rastrear diariamente.</p>
                        <button
                            onClick={openNew}
                            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all mx-auto"
                        >
                            <Plus size={15} />
                            Criar primeiro hábito
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence>
                            {habits.map(h => (
                                <HabitRow
                                    key={h.id}
                                    habit={h}
                                    onEdit={openEdit}
                                    onDelete={handleDelete}
                                    onToggle={handleToggle}
                                />
                            ))}
                        </AnimatePresence>

                        {activeHabits < MAX_HABITS && (
                            <button
                                onClick={openNew}
                                className="w-full py-3 border border-dashed border-white/10 rounded-2xl text-slate-600 hover:text-slate-400 hover:border-white/20 text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} />
                                Adicionar hábito
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Orientações */}
            <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Orientações</p>
                        <p className="text-xs text-slate-600 mt-0.5">Texto exibido às pacientes para contextualizar os hábitos.</p>
                    </div>
                    <button
                        onClick={handleSaveOrientation}
                        disabled={savingOrientation}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                    >
                        {savingOrientation ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Salvar
                    </button>
                </div>
                <textarea
                    value={orientation}
                    onChange={e => setOrientation(e.target.value)}
                    placeholder="Ex: Complete cada hábito uma vez por dia. Hábitos com foto valem mais pontos no ranking dos desafios..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <HabitFormModal
                        habit={editingHabit && typeof editingHabit === 'object' && 'id' in editingHabit ? editingHabit : null}
                        onSave={handleSave}
                        onClose={() => { setShowModal(false); setEditingHabit(null) }}
                        saving={saving}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
