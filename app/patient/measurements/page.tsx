"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Plus, Scale, Ruler, Loader2, Check, TrendingDown, TrendingUp, Minus, X } from "lucide-react"
import Link from "next/link"

interface Measurement {
    id: string
    measured_at: string
    weight_kg: number | null
    waist_cm: number | null
    hip_cm: number | null
    arm_cm: number | null
    thigh_cm: number | null
    abdomen_cm: number | null
    chest_cm: number | null
    notes: string | null
}

const FIELDS: { key: keyof Measurement; label: string; unit: string; icon: string }[] = [
    { key: 'weight_kg', label: 'Peso', unit: 'kg', icon: '⚖️' },
    { key: 'waist_cm', label: 'Cintura', unit: 'cm', icon: '📏' },
    { key: 'abdomen_cm', label: 'Abdômen', unit: 'cm', icon: '📏' },
    { key: 'hip_cm', label: 'Quadril', unit: 'cm', icon: '📏' },
    { key: 'chest_cm', label: 'Busto', unit: 'cm', icon: '📏' },
    { key: 'arm_cm', label: 'Braço', unit: 'cm', icon: '💪' },
    { key: 'thigh_cm', label: 'Coxa', unit: 'cm', icon: '🦵' },
]

function delta(current: number | null, previous: number | null, lower_is_better = true) {
    if (current == null || previous == null) return null
    const diff = current - previous
    if (diff === 0) return { diff: 0, positive: true }
    const positive = lower_is_better ? diff < 0 : diff > 0
    return { diff, positive }
}

export default function MeasurementsPage() {
    const [measurements, setMeasurements] = useState<Measurement[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<string | null>(null)
    const [form, setForm] = useState({
        weight_kg: '',
        waist_cm: '',
        abdomen_cm: '',
        hip_cm: '',
        chest_cm: '',
        arm_cm: '',
        thigh_cm: '',
        notes: '',
        measured_at: new Date().toISOString().split('T')[0],
    })

    useEffect(() => { loadMeasurements() }, [])

    const loadMeasurements = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/patient/measurements')
            const data = await res.json()
            setMeasurements(data.measurements || [])
        } catch { } finally { setLoading(false) }
    }

    const showMsg = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const handleSave = async () => {
        const hasAny = Object.entries(form)
            .filter(([k]) => k !== 'notes' && k !== 'measured_at')
            .some(([, v]) => v !== '')

        if (!hasAny) { showMsg('Preencha ao menos uma medida'); return }
        setSaving(true)
        try {
            const body: any = { measured_at: form.measured_at, notes: form.notes || undefined }
            FIELDS.forEach(f => {
                const val = form[f.key as keyof typeof form] as string
                if (val) body[f.key] = parseFloat(val)
            })

            const res = await fetch('/api/patient/measurements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error('Erro ao salvar')
            showMsg('Medidas salvas!')
            setShowForm(false)
            setForm({ weight_kg: '', waist_cm: '', abdomen_cm: '', hip_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '', notes: '', measured_at: new Date().toISOString().split('T')[0] })
            loadMeasurements()
        } catch { showMsg('Erro ao salvar') } finally { setSaving(false) }
    }

    const latest = measurements[0]
    const previous = measurements[1]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b]">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-emerald-500/90 text-white text-sm font-bold rounded-xl">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Link href="/patient/profile"
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <ChevronLeft size={18} className="text-white" />
                    </Link>
                    <div className="flex-1">
                        <p className="text-white text-sm font-black">Minhas Medidas</p>
                        <p className="text-slate-500 text-[10px]">Acompanhe sua evolução corporal</p>
                    </div>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
                        <Plus size={14} /> Registrar
                    </button>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 pb-28 space-y-5">

                {/* Form overlay */}
                <AnimatePresence>
                    {showForm && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowForm(false)}
                                className="fixed inset-0 bg-black/60 z-40" />
                            <motion.div
                                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-h-[90vh] overflow-y-auto">
                                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-white font-bold">Registrar medidas</h2>
                                    <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                                        <X size={18} className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Data da medição</label>
                                        <input type="date" value={form.measured_at}
                                            onChange={e => setForm(p => ({ ...p, measured_at: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {FIELDS.map(f => (
                                            <div key={f.key}>
                                                <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                                                    {f.icon} {f.label} ({f.unit})
                                                </label>
                                                <input
                                                    type="number"
                                                    step={f.unit === 'kg' ? '0.1' : '0.5'}
                                                    min={0}
                                                    value={form[f.key as keyof typeof form] as string}
                                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                                    placeholder={f.unit === 'kg' ? '0.0' : '0.0'}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Observações (opcional)</label>
                                        <textarea value={form.notes}
                                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                            rows={2} placeholder="Como você está se sentindo..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none" />
                                    </div>

                                    <button onClick={handleSave} disabled={saving}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all text-sm">
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        Salvar medidas
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
                )}

                {/* Empty state */}
                {!loading && measurements.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                            <Ruler size={28} className="text-indigo-400" />
                        </div>
                        <h2 className="text-white font-black text-lg mb-1">Nenhuma medida registrada</h2>
                        <p className="text-slate-500 text-sm mb-5">Registre suas medidas para acompanhar a evolução</p>
                        <button onClick={() => setShowForm(true)}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-sm transition-all">
                            Primeira medição
                        </button>
                    </motion.div>
                )}

                {/* Latest snapshot */}
                {!loading && latest && (
                    <>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Última medição</p>
                            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5">
                                <p className="text-slate-500 text-xs mb-4">
                                    {new Date(latest.measured_at + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {FIELDS.filter(f => latest[f.key] != null).map(f => {
                                        const curr = latest[f.key] as number
                                        const prev = previous ? previous[f.key] as number : null
                                        const d = delta(curr, prev, f.key !== 'weight_kg' ? undefined : true)
                                        return (
                                            <div key={f.key} className="bg-white/[0.03] border border-white/8 rounded-2xl p-3">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                                                    {f.icon} {f.label}
                                                </p>
                                                <p className="text-white font-black text-xl">
                                                    {curr}<span className="text-slate-500 text-sm font-normal ml-0.5">{f.unit}</span>
                                                </p>
                                                {d && d.diff !== 0 && (
                                                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${d.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {d.positive
                                                            ? <TrendingDown size={12} />
                                                            : <TrendingUp size={12} />
                                                        }
                                                        {d.diff > 0 ? '+' : ''}{d.diff.toFixed(1)} {f.unit}
                                                    </div>
                                                )}
                                                {d && d.diff === 0 && (
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-600">
                                                        <Minus size={12} /> Sem variação
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {latest.notes && (
                                    <p className="text-slate-500 text-xs mt-3 italic">"{latest.notes}"</p>
                                )}
                            </div>
                        </div>

                        {/* Weight chart */}
                        {(() => {
                            const weightPoints = [...measurements].reverse().filter(m => m.weight_kg != null)
                            if (weightPoints.length < 2) return null
                            const W = 320, H = 80, PAD = 8
                            const vals = weightPoints.map(m => m.weight_kg as number)
                            const minV = Math.min(...vals) - 0.5
                            const maxV = Math.max(...vals) + 0.5
                            const toX = (i: number) => PAD + (i / (weightPoints.length - 1)) * (W - PAD * 2)
                            const toY = (v: number) => PAD + (1 - (v - minV) / (maxV - minV)) * (H - PAD * 2)
                            const points = weightPoints.map((m, i) => `${toX(i)},${toY(m.weight_kg as number)}`).join(' ')
                            const first = vals[0], last = vals[vals.length - 1]
                            const down = last <= first
                            return (
                                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Evolução do Peso</p>
                                        <span className={`text-xs font-bold ${down ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {down ? '▼' : '▲'} {Math.abs(last - first).toFixed(1)} kg
                                        </span>
                                    </div>
                                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
                                        {/* Grid line */}
                                        <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                                        {/* Gradient fill under line */}
                                        <defs>
                                            <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={down ? '#10b981' : '#f43f5e'} stopOpacity="0.3"/>
                                                <stop offset="100%" stopColor={down ? '#10b981' : '#f43f5e'} stopOpacity="0"/>
                                            </linearGradient>
                                        </defs>
                                        <polygon
                                            points={`${PAD},${H-PAD} ${points} ${W-PAD},${H-PAD}`}
                                            fill="url(#wgrad)"
                                        />
                                        <polyline points={points} fill="none" stroke={down ? '#10b981' : '#f43f5e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        {/* Dots */}
                                        {weightPoints.map((m, i) => (
                                            <circle key={i} cx={toX(i)} cy={toY(m.weight_kg as number)} r="3"
                                                fill={down ? '#10b981' : '#f43f5e'} stroke="#020617" strokeWidth="1.5"/>
                                        ))}
                                        {/* Labels: first and last */}
                                        <text x={PAD} y={H+4} fill="rgba(100,116,139,0.8)" fontSize="8" textAnchor="middle">
                                            {new Date(weightPoints[0].measured_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </text>
                                        <text x={W-PAD} y={H+4} fill="rgba(100,116,139,0.8)" fontSize="8" textAnchor="middle">
                                            {new Date(weightPoints[weightPoints.length-1].measured_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </text>
                                    </svg>
                                    <div className="flex justify-between mt-4 text-xs">
                                        <span className="text-slate-500">Início: <span className="text-white font-bold">{first} kg</span></span>
                                        <span className="text-slate-500">Atual: <span className={`font-bold ${down ? 'text-emerald-400' : 'text-rose-400'}`}>{last} kg</span></span>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* History */}
                        {measurements.length > 1 && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Histórico</p>
                                <div className="space-y-2">
                                    {measurements.slice(1).map((m, i) => (
                                        <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                            className="bg-white/[0.02] border border-white/8 rounded-2xl p-4">
                                            <p className="text-slate-500 text-xs mb-3">
                                                {new Date(m.measured_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                            <div className="flex flex-wrap gap-3">
                                                {FIELDS.filter(f => m[f.key] != null).map(f => (
                                                    <span key={f.key} className="text-xs text-slate-400">
                                                        <span className="text-slate-600">{f.label}: </span>
                                                        <span className="font-bold text-white">{m[f.key] as number} {f.unit}</span>
                                                    </span>
                                                ))}
                                            </div>
                                            {m.notes && <p className="text-slate-600 text-xs mt-2 italic">"{m.notes}"</p>}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
