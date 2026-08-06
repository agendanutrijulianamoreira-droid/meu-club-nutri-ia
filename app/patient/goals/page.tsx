"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Target, Loader2, CheckCircle2, Trophy, Calendar } from "lucide-react"
import Link from "next/link"

interface GoalAssignment {
    id: string
    goal_id: string | null
    title: string
    description: string | null
    emoji: string
    goal_type: string
    metric: string | null
    target_value: number | null
    unit: string | null
    deadline: string | null
    current_value: number
    status: 'active' | 'completed' | 'abandoned'
    completed_at: string | null
}

function GoalCard({ goal, onUpdated }: { goal: GoalAssignment; onUpdated: (updated: Partial<GoalAssignment>) => void }) {
    const [value, setValue] = useState(String(goal.current_value ?? 0))
    const [saving, setSaving] = useState(false)

    const hasTarget = goal.target_value != null
    const progress = hasTarget ? Math.min(100, ((goal.current_value ?? 0) / (goal.target_value as number)) * 100) : 0

    const submit = async (newValue: number) => {
        setSaving(true)
        try {
            const res = await fetch('/api/patient/goals/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: goal.id, current_value: newValue }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            onUpdated({
                current_value: newValue,
                status: data.completed ? 'completed' : 'active',
                completed_at: data.completed ? new Date().toISOString() : null,
            })
        } catch { } finally { setSaving(false) }
    }

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0 text-xl">
                    {goal.emoji || '🎯'}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-white font-bold text-sm leading-snug">{goal.title}</h3>
                    {goal.description && <p className="text-slate-500 text-xs mt-0.5">{goal.description}</p>}
                </div>
            </div>

            {goal.deadline && (
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar size={11} /> até {new Date(goal.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </p>
            )}

            {hasTarget ? (
                <div className="space-y-2">
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500">/ {goal.target_value}{goal.unit ? ` ${goal.unit}` : ''}</span>
                        <button
                            onClick={() => submit(parseFloat(value) || 0)}
                            disabled={saving}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => submit(1)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Marcar como concluída
                </button>
            )}
        </div>
    )
}

export default function PatientGoalsPage() {
    const [assignments, setAssignments] = useState<GoalAssignment[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => { load() }, [])

    const load = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/patient/goals')
            const data = await res.json()
            setAssignments(data.assignments || [])
        } catch { } finally { setLoading(false) }
    }

    const updateAssignment = (id: string, updated: Partial<GoalAssignment>) => {
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
        if (updated.status === 'completed') {
            setToast('Meta concluída! +50 XP 🎉')
            setTimeout(() => setToast(null), 3500)
        }
    }

    const active = assignments.filter(a => a.status === 'active')
    const completed = assignments.filter(a => a.status === 'completed')

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b]">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-emerald-500/90 text-white text-sm font-bold rounded-xl">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-10">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
                    <Link href="/patient/profile"
                        className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-base font-bold text-white">Minhas Metas</h1>
                        <p className="text-[11px] text-slate-500">{active.length} ativa{active.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 pb-28 space-y-5">
                {loading && (
                    <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
                )}

                {!loading && assignments.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                            <Target size={28} className="text-indigo-400" />
                        </div>
                        <h2 className="text-white font-black text-lg mb-1">Nenhuma meta atribuída</h2>
                        <p className="text-slate-500 text-sm">Sua nutricionista ainda não atribuiu nenhuma meta pra você.</p>
                    </motion.div>
                )}

                {!loading && active.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ativas</p>
                        {active.map(g => (
                            <GoalCard key={g.id} goal={g} onUpdated={u => updateAssignment(g.id, u)} />
                        ))}
                    </div>
                )}

                {!loading && completed.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Concluídas</p>
                        {completed.map(g => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <Trophy size={16} className="text-amber-400 flex-shrink-0" />
                                <span className="text-sm text-slate-300 flex-1 truncate">{g.title}</span>
                                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
