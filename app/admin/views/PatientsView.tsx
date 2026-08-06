"use client"

import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase-browser"
import {
    Search, Bell, Zap, TrendingUp, AlertTriangle, MessageCircle,
    Activity, Star, Crown, Trophy, Flame, CheckCircle, Mail,
    Phone, Clock, Target, ChevronRight, Loader2, Sparkles,
    Heart, Plus, X, RefreshCw, Send, Shield, Users, FileText,
    ToggleLeft, ToggleRight, Gift, Coins, Download, KeyRound, Copy, Pencil, Upload, CalendarPlus,
    Stethoscope, ClipboardList, Eye, EyeOff, Lock, Paperclip, Trash2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Patient {
    id: string; name: string; email: string; phone: string; plan: string
    avatar: string; status: 'risk' | 'active' | 'star'
    riskLevel: 'low' | 'medium' | 'high'; riskScore: number
    adherenceRate: number; lastLogin: string; startDate: string
    aiSummary: string; aiSuggestion: string | null
    xp: number; coins: number; level: number; streak: number; longestStreak: number
    weight: { current: number; goal: number; start: number }
    primaryGoal: string; onboardingCompleted: boolean
    hasActiveProtocol: boolean; hasCheckin: boolean
    checkinScore: number | null; daysSinceActivity: number
}

const PLAN_LABELS: Record<string, string> = {
    community: 'Community', tech_diet: 'Tech Diet', vip: 'VIP', manual: 'Manual'
}

const RISK_META: Record<string, { color: string; bg: string; label: string }> = {
    high:   { color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/25',    label: 'Alto risco' },
    medium: { color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',  label: 'Médio risco' },
    low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', label: 'Saudável' },
}

const RECORD_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    encaminhamento:   { label: 'Encaminhamento',  icon: <Send size={11}/>,          color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/25' },
    evolucao_clinica: { label: 'Evolução Clínica', icon: <Stethoscope size={11}/>,   color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25' },
    exame:            { label: 'Exame',           icon: <ClipboardList size={11}/>, color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/25' },
    nota:              { label: 'Nota',            icon: <FileText size={11}/>,      color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25' },
    observacao:        { label: 'Observação',      icon: <Eye size={11}/>,           color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25' },
}

interface PatientRecord {
    id: string
    type: keyof typeof RECORD_TYPE_META
    title: string
    body: string | null
    attachment_path: string | null
    attachment_url: string | null
    tag_ids: string[]
    created_at: string
}

interface RecordTag { id: string; name: string; color: string; icon: string | null }

// ─── Register Modal ────────────────────────────────────────────────────────────
interface SuccessData { userId: string; email: string; name: string; password: string; emailSent: boolean }

function RegisterModal({ onClose, onSuccess, onRegistered }: {
    onClose: () => void
    onSuccess: () => void
    onRegistered?: () => void
}) {
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: 'ChangeMe123!', plan: 'tech_diet' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successData, setSuccessData] = useState<SuccessData | null>(null)
    const [resending, setResending] = useState(false)
    const [resendDone, setResendDone] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleSubmit = async () => {
        if (!form.name || !form.email) { setError('Nome e e-mail são obrigatórios'); return }
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/admin/create-patient', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
            onRegistered?.()
            setSuccessData({ userId: data.user_id, email: form.email, name: form.name, password: form.password, emailSent: data.email_sent || false })
        } catch (err: any) {
            setError(err.message)
        } finally { setSaving(false) }
    }

    const handleResend = async () => {
        if (!successData) return
        setResending(true)
        try {
            await fetch(`/api/admin/patients/${successData.userId}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send-credentials' })
            })
            setResendDone(true)
            setTimeout(() => setResendDone(false), 3000)
        } finally { setResending(false) }
    }

    const handleCopy = async () => {
        if (!successData) return
        const loginUrl = typeof window !== 'undefined' ? window.location.origin + '/login' : '/login'
        const firstName = successData.name.split(' ')[0]
        const text = `Olá ${firstName}! Seu acesso foi liberado 🎉\n\n📧 E-mail: ${successData.email}\n🔑 Senha provisória: ${successData.password}\n🔗 Link: ${loginUrl}\n\nRecomendamos trocar a senha no primeiro acesso.`
        try { await navigator.clipboard.writeText(text) } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ── Success screen ─────────────────────────────────────────────────────────
    if (successData) {
        const loginUrl = typeof window !== 'undefined' ? window.location.origin + '/login' : '/login'
        const firstName = successData.name.split(' ')[0]
        const credentialText = `Olá ${firstName}! Seu acesso foi liberado 🎉\n\n📧 E-mail: ${successData.email}\n🔑 Senha provisória: ${successData.password}\n🔗 Link: ${loginUrl}\n\nRecomendamos trocar a senha no primeiro acesso.`

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">

                    <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle size={24} className="text-emerald-400"/>
                        </div>
                        <h2 className="text-lg font-bold text-white">Rainha cadastrada!</h2>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                            {successData.emailSent
                                ? `E-mail com dados de acesso enviado para ${successData.email}`
                                : `E-mail automático não configurado. Use o texto abaixo para enviar manualmente.`}
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Texto para enviar manualmente</label>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{credentialText}</pre>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleCopy}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:border-white/20 transition-all">
                            {copied ? <CheckCircle size={13} className="text-emerald-400"/> : <Copy size={13}/>}
                            {copied ? 'Copiado!' : 'Copiar texto'}
                        </button>
                        <button onClick={handleResend} disabled={resending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:bg-indigo-600/30 transition-all disabled:opacity-50">
                            {resending ? <Loader2 size={13} className="animate-spin"/> : <Mail size={13}/>}
                            {resendDone ? 'Enviado!' : 'Reenviar e-mail'}
                        </button>
                    </div>

                    <button onClick={onSuccess}
                        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all">
                        Concluir
                    </button>
                </motion.div>
            </motion.div>
        )
    }

    // ── Registration form ──────────────────────────────────────────────────────
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Cadastrar Nova Rainha</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl"><X size={16} className="text-slate-400"/></button>
                </div>

                {[
                    { label: 'Nome completo *', key: 'name', type: 'text', placeholder: 'Ana Souza' },
                    { label: 'E-mail de acesso *', key: 'email', type: 'email', placeholder: 'ana@email.com' },
                    { label: 'WhatsApp', key: 'phone', type: 'tel', placeholder: '(11) 99999-9999' },
                    { label: 'Senha provisória', key: 'password', type: 'text', placeholder: '' },
                ].map(f => (
                    <div key={f.key}>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">{f.label}</label>
                        <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                    </div>
                ))}

                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Plano</label>
                    <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none">
                        {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>}

                <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                        Cadastrar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Protocol Assign Modal ────────────────────────────────────────────────────
function AssignProtocolModal({ patientId, patientName, currentProtocol, onClose, onSuccess }: {
    patientId: string; patientName: string; currentProtocol: string | null
    onClose: () => void; onSuccess: () => void
}) {
    const [protocols, setProtocols] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [assigning, setAssigning] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch('/api/admin/protocols-list')
            .then(r => r.ok ? r.json() : { protocols: [] })
            .then(d => { setProtocols(d.protocols || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const handleAssign = async (protocolId: string | null) => {
        setAssigning(protocolId || 'remove')
        setError('')
        try {
            const res = await fetch(`/api/admin/patients/${patientId}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: protocolId ? 'assign-protocol' : 'remove-protocol', protocol_id: protocolId })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Erro ao atribuir protocolo. Tente novamente.')
                return
            }
            onSuccess()
        } catch {
            setError('Erro de conexão. Tente novamente.')
        } finally { setAssigning(null) }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-white">Atribuir Protocolo</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl"><X size={15} className="text-slate-400"/></button>
                </div>

                {error && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 mb-3">{error}</p>
                )}

                {loading ? (
                    <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-600"/></div>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {currentProtocol && (
                            <button onClick={() => handleAssign(null)} disabled={!!assigning}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all">
                                {assigning === 'remove' ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>}
                                Remover protocolo atual
                            </button>
                        )}
                        {protocols.map((p: any) => (
                            <button key={p.id} onClick={() => handleAssign(p.id)} disabled={!!assigning}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                                    ${p.id === currentProtocol ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-white/5 border-white/10 hover:border-indigo-500/30'}`}>
                                <span className="text-lg">{p.emoji || '📋'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{p.title}</p>
                                    <p className="text-[10px] text-slate-500">{p.duration_days} dias</p>
                                </div>
                                {assigning === p.id && <Loader2 size={13} className="animate-spin text-indigo-400 flex-shrink-0"/>}
                                {p.id === currentProtocol && !assigning && <CheckCircle size={13} className="text-indigo-400 flex-shrink-0"/>}
                            </button>
                        ))}
                        {protocols.length === 0 && (
                            <p className="text-center text-xs text-slate-600 py-4">Nenhum protocolo ativo. Crie um em Bio-Protocolos.</p>
                        )}
                    </div>
                )}
            </motion.div>
        </motion.div>
    )
}

// ─── Goals Assign Modal ───────────────────────────────────────────────────────
// Diferente de protocolo, a paciente pode ter várias metas ativas ao mesmo
// tempo — sem "atual" único, então o modal mostra as metas já atribuídas
// (com opção de remover cada uma) e a biblioteca de metas disponíveis pra
// atribuir mais.
interface GoalAssignment {
    id: string; goal_id: string | null; title: string; emoji: string
    goal_type: string; target_value: number | null; unit: string | null; status: string
}

function AssignGoalModal({ patientId, patientName, onClose, onSuccess }: {
    patientId: string; patientName: string
    onClose: () => void; onSuccess: () => void
}) {
    const [goals, setGoals] = useState<any[]>([])
    const [assignments, setAssignments] = useState<GoalAssignment[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([
            fetch('/api/admin/goals-list').then(r => r.ok ? r.json() : { goals: [] }),
            fetch(`/api/admin/patients/${patientId}/goals`).then(r => r.ok ? r.json() : { assignments: [] }),
        ])
            .then(([g, a]) => { setGoals(g.goals || []); setAssignments(a.assignments || []) })
            .finally(() => setLoading(false))
    }, [patientId])

    useEffect(() => { load() }, [load])

    const activeAssignments = assignments.filter(a => a.status === 'active')
    const activeGoalIds = new Set(activeAssignments.map(a => a.goal_id))

    const handleAssign = async (goalId: string) => {
        setBusy(goalId)
        setError('')
        try {
            const res = await fetch(`/api/admin/patients/${patientId}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'assign-goal', goal_id: goalId })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Erro ao atribuir meta. Tente novamente.')
                return
            }
            load()
            onSuccess()
        } catch {
            setError('Erro de conexão. Tente novamente.')
        } finally { setBusy(null) }
    }

    const handleUnassign = async (assignmentId: string) => {
        setBusy(assignmentId)
        setError('')
        try {
            const res = await fetch(`/api/admin/patients/${patientId}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unassign-goal', assignment_id: assignmentId })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Erro ao remover meta. Tente novamente.')
                return
            }
            load()
            onSuccess()
        } catch {
            setError('Erro de conexão. Tente novamente.')
        } finally { setBusy(null) }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-white">Metas da paciente</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl"><X size={15} className="text-slate-400"/></button>
                </div>

                {error && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 mb-3">{error}</p>
                )}

                {loading ? (
                    <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-600"/></div>
                ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {activeAssignments.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ativas</p>
                                {activeAssignments.map(a => (
                                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-lg">{a.emoji || '🎯'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{a.title}</p>
                                            {a.target_value != null && (
                                                <p className="text-[10px] text-slate-500">Meta: {a.target_value}{a.unit ? ` ${a.unit}` : ''}</p>
                                            )}
                                        </div>
                                        <button onClick={() => handleUnassign(a.id)} disabled={!!busy}
                                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex-shrink-0">
                                            {busy === a.id ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Biblioteca de metas</p>
                            {goals.filter(g => !activeGoalIds.has(g.id)).map(g => (
                                <button key={g.id} onClick={() => handleAssign(g.id)} disabled={!!busy}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-white/5 border-white/10 hover:border-indigo-500/30 transition-all text-left">
                                    <span className="text-lg">{g.emoji || '🎯'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{g.title}</p>
                                        {g.target_value != null && (
                                            <p className="text-[10px] text-slate-500">Meta: {g.target_value}{g.unit ? ` ${g.unit}` : ''}</p>
                                        )}
                                    </div>
                                    {busy === g.id && <Loader2 size={13} className="animate-spin text-indigo-400 flex-shrink-0"/>}
                                </button>
                            ))}
                            {goals.filter(g => !activeGoalIds.has(g.id)).length === 0 && (
                                <p className="text-center text-xs text-slate-600 py-4">
                                    {goals.length === 0 ? 'Nenhuma meta na biblioteca. Crie uma na Biblioteca Clínica.' : 'Todas as metas da biblioteca já estão atribuídas.'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    )
}

// ─── Send Message Modal ───────────────────────────────────────────────────────
function SendMessageModal({ patientId, patientName, onClose, onSuccess }: {
    patientId: string; patientName: string; onClose: () => void; onSuccess: () => void
}) {
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)

    const send = async () => {
        if (!title || !body) return
        setSending(true)
        await fetch(`/api/admin/patients/${patientId}/action`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-message', title, body })
        })
        setSending(false)
        onSuccess()
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Mensagem para {patientName.split(' ')[0]}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl"><X size={15} className="text-slate-400"/></button>
                </div>
                <input value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    placeholder="Título da notificação"/>
                <textarea value={body} onChange={e => setBody(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-24"
                    placeholder="Mensagem que ela receberá no inbox..."/>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold">Cancelar</button>
                    <button onClick={send} disabled={sending || !title || !body}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                        {sending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>} Enviar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Edit Patient Modal ───────────────────────────────────────────────────────
function EditPatientModal({ patient, onClose, onSuccess }: {
    patient: Patient
    onClose: () => void
    onSuccess: () => void
}) {
    const [form, setForm] = useState({
        name: patient.name,
        phone: patient.phone,
        current_plan: patient.plan,
        current_weight: patient.weight.current > 0 ? String(patient.weight.current) : '',
        primary_goal: patient.primaryGoal,
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Nome é obrigatório'); return }
        setSaving(true); setError('')
        try {
            const res = await fetch(`/api/admin/patients/${patient.id}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update-profile', ...form })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally { setSaving(false) }
    }

    const fields: { label: string; key: keyof typeof form; type: string; placeholder: string }[] = [
        { label: 'Nome completo', key: 'name', type: 'text', placeholder: 'Nome da paciente' },
        { label: 'WhatsApp', key: 'phone', type: 'tel', placeholder: '(11) 99999-9999' },
        { label: 'Peso atual (kg)', key: 'current_weight', type: 'number', placeholder: 'ex: 68.5' },
        { label: 'Objetivo principal', key: 'primary_goal', type: 'text', placeholder: 'ex: Perda de peso' },
    ]

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Editar Rainha</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{patient.email}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl">
                        <X size={16} className="text-slate-400"/>
                    </button>
                </div>

                {fields.map(f => (
                    <div key={f.key}>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">{f.label}</label>
                        <input
                            type={f.type} value={form[f.key]} placeholder={f.placeholder}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                    </div>
                ))}

                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Plano</label>
                    <select
                        value={form.current_plan}
                        onChange={e => setForm(f => ({ ...f, current_plan: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                        {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                {error && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                        Salvar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Prontuário (Fase 5) ────────────────────────────────────────────────────────
// Área privada: nunca há nenhuma rota/consulta equivalente no app da paciente.
const TAG_COLOR_CLASS: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25',
    emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
    amber: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
    rose: 'text-rose-400 bg-rose-500/15 border-rose-500/25',
    sky: 'text-sky-400 bg-sky-500/15 border-sky-500/25',
    violet: 'text-violet-400 bg-violet-500/15 border-violet-500/25',
}
const TAG_COLORS = Object.keys(TAG_COLOR_CLASS)

function NewRecordForm({ patientId, tags, onCreated, onTagCreated, onCancel }: {
    patientId: string
    tags: RecordTag[]
    onCreated: (r: PatientRecord) => void
    onTagCreated: (t: RecordTag) => void
    onCancel: () => void
}) {
    const [type, setType] = useState<keyof typeof RECORD_TYPE_META>('nota')
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [newTagName, setNewTagName] = useState('')
    const [creatingTag, setCreatingTag] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const toggleTag = (id: string) => {
        setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
    }

    const createTag = async () => {
        const name = newTagName.trim()
        if (!name || creatingTag) return
        setCreatingTag(true)
        try {
            const color = TAG_COLORS[tags.length % TAG_COLORS.length]
            const res = await fetch('/api/admin/record-tags', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color }),
            })
            const data = await res.json()
            if (res.ok && data.tag) {
                onTagCreated(data.tag)
                setSelectedTags(prev => [...prev, data.tag.id])
                setNewTagName('')
            }
        } finally { setCreatingTag(false) }
    }

    const handleSave = async () => {
        if (!title.trim() || saving) return
        setSaving(true)
        setError(null)
        try {
            const fd = new FormData()
            fd.append('type', type)
            fd.append('title', title.trim())
            fd.append('body', body)
            fd.append('tag_ids', JSON.stringify(selectedTags))
            if (file) fd.append('file', file)

            const res = await fetch(`/api/admin/patients/${patientId}/records`, { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Erro ao salvar registro'); return }
            onCreated(data.record)
        } finally { setSaving(false) }
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
                {(Object.keys(RECORD_TYPE_META) as (keyof typeof RECORD_TYPE_META)[]).map(t => (
                    <button key={t} onClick={() => setType(t)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all
                            ${type === t ? RECORD_TYPE_META[t].bg + ' ' + RECORD_TYPE_META[t].color : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                        {RECORD_TYPE_META[t].icon} {RECORD_TYPE_META[t].label}
                    </button>
                ))}
            </div>

            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do registro"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />

            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Detalhes clínicos..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-500/50" />

            <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                        <button key={tag.id} onClick={() => toggleTag(tag.id)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all
                                ${selectedTags.includes(tag.id) ? TAG_COLOR_CLASS[tag.color] || TAG_COLOR_CLASS.indigo : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                            {tag.name}
                        </button>
                    ))}
                    <div className="flex items-center gap-1">
                        <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createTag() } }}
                            placeholder="Nova tag..."
                            className="w-24 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-[11px] text-white placeholder:text-slate-600 focus:outline-none" />
                        <button onClick={createTag} disabled={creatingTag || !newTagName.trim()}
                            className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-400">
                            {creatingTag ? <Loader2 size={11} className="animate-spin"/> : <Plus size={11}/>}
                        </button>
                    </div>
                </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer w-fit">
                <Paperclip size={13}/>
                {file ? file.name : 'Anexar arquivo (opcional)'}
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>

            {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}

            <div className="flex items-center gap-2 pt-1">
                <button onClick={onCancel} className="px-4 py-2 rounded-xl text-slate-400 text-xs font-bold hover:bg-white/5 transition-all">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !title.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all">
                    {saving ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle size={13}/>}
                    Salvar registro
                </button>
            </div>
        </div>
    )
}

function RecordCard({ patientId, record, tags, onDeleted }: {
    patientId: string
    record: PatientRecord
    tags: RecordTag[]
    onDeleted: (id: string) => void
}) {
    const [deleting, setDeleting] = useState(false)
    const meta = RECORD_TYPE_META[record.type] || RECORD_TYPE_META.nota
    const recordTags = tags.filter(t => record.tag_ids?.includes(t.id))

    const handleDelete = async () => {
        if (!confirm('Excluir este registro do prontuário?')) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/patients/${patientId}/records/${record.id}`, { method: 'DELETE' })
            if (res.ok) onDeleted(record.id)
        } finally { setDeleting(false) }
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                        {meta.icon} {meta.label}
                    </span>
                    {recordTags.map(t => (
                        <span key={t.id} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${TAG_COLOR_CLASS[t.color] || TAG_COLOR_CLASS.indigo}`}>
                            {t.name}
                        </span>
                    ))}
                </div>
                <button onClick={handleDelete} disabled={deleting}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all flex-shrink-0">
                    {deleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                </button>
            </div>
            <p className="text-sm font-bold text-white">{record.title}</p>
            {record.body && <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{record.body}</p>}
            <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-slate-600">
                    {new Date(record.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {record.attachment_url && (
                    <a href={record.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">
                        <Paperclip size={11}/> Ver anexo
                    </a>
                )}
            </div>
        </div>
    )
}

function PatientRecordsPanel({ patientId }: { patientId: string }) {
    const [records, setRecords] = useState<PatientRecord[]>([])
    const [tags, setTags] = useState<RecordTag[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [recordsRes, tagsRes] = await Promise.all([
                fetch(`/api/admin/patients/${patientId}/records`),
                fetch('/api/admin/record-tags'),
            ])
            if (recordsRes.ok) setRecords((await recordsRes.json()).records || [])
            if (tagsRes.ok) setTags((await tagsRes.json()).tags || [])
        } finally { setLoading(false) }
    }, [patientId])

    useEffect(() => { load() }, [load])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Lock size={11}/> Área privada — a paciente nunca vê nenhum registro daqui.
                </p>
                {!showForm && (
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all">
                        <Plus size={12}/> Novo registro
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <NewRecordForm
                            patientId={patientId}
                            tags={tags}
                            onTagCreated={t => setTags(prev => [...prev, t])}
                            onCreated={r => { setRecords(prev => [r, ...prev]); setShowForm(false) }}
                            onCancel={() => setShowForm(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-600"/></div>
            ) : records.length === 0 ? (
                <div className="text-center py-10">
                    <ClipboardList size={28} className="text-slate-700 mx-auto mb-2"/>
                    <p className="text-sm text-slate-500">Nenhum registro no prontuário ainda.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {records.map(r => (
                        <RecordCard key={r.id} patientId={patientId} record={r} tags={tags} onDeleted={id => setRecords(prev => prev.filter(x => x.id !== id))} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Comunidade Tab ────────────────────────────────────────────────────────────
const NIVEL_META = [
    { id: 1, label: 'Básico',   emoji: '🌱', color: 'bg-slate-600 border-slate-500', badge: 'bg-slate-500/20 border-slate-500/30 text-slate-400' },
    { id: 2, label: 'Plus',     emoji: '💜', color: 'bg-violet-600 border-violet-500', badge: 'bg-violet-500/20 border-violet-500/30 text-violet-400' },
    { id: 3, label: 'VIP',      emoji: '👑', color: 'bg-amber-600 border-amber-500',  badge: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
    { id: 4, label: 'Consulta', emoji: '🩺', color: 'bg-emerald-600 border-emerald-500', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' },
]

function ComunidadeTab({ patientId, nivelAtual, nivelSelecionado, setNivelSelecionado, validadeNivel, setValidadeNivel, salvandoNivel, setSalvandoNivel, setNivelAtual, nivelToast, setNivelToast, comentariosDaPaciente, setComentariosDaPaciente, loadingComentarios, setLoadingComentarios }: {
    patientId: string
    nivelAtual: { nivel: number; validade: string | null } | null
    nivelSelecionado: number
    setNivelSelecionado: (n: number) => void
    validadeNivel: string
    setValidadeNivel: (v: string) => void
    salvandoNivel: boolean
    setSalvandoNivel: (b: boolean) => void
    setNivelAtual: (n: { nivel: number; validade: string | null } | null) => void
    nivelToast: { type: 'success' | 'error'; msg: string } | null
    setNivelToast: (t: { type: 'success' | 'error'; msg: string } | null) => void
    comentariosDaPaciente: any[]
    setComentariosDaPaciente: (c: any[]) => void
    loadingComentarios: boolean
    setLoadingComentarios: (b: boolean) => void
}) {
    useEffect(() => {
        // Buscar nível atual
        fetch(`/api/admin/patients/${patientId}/nivel`)
            .then(r => r.json())
            .then(d => {
                setNivelAtual({ nivel: d.nivel ?? 1, validade: d.validade ?? null })
                setNivelSelecionado(d.nivel ?? 1)
                if (d.validade) setValidadeNivel(d.validade)
            })
            .catch(() => setNivelAtual({ nivel: 1, validade: null }))

        // Buscar comentários da paciente
        setLoadingComentarios(true)
        fetch(`/api/admin/comunidade/comentarios`)
            .then(r => r.json())
            .then(d => {
                const meus = (d.comentarios || []).filter((c: any) => c.user_id === patientId)
                setComentariosDaPaciente(meus)
            })
            .catch(() => {})
            .finally(() => setLoadingComentarios(false))
    }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

    const salvarNivel = async () => {
        setSalvandoNivel(true)
        try {
            const res = await fetch(`/api/admin/patients/${patientId}/nivel`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nivel: nivelSelecionado, validade: validadeNivel || null }),
            })
            const d = await res.json()
            if (res.ok) {
                setNivelAtual({ nivel: nivelSelecionado, validade: validadeNivel || null })
                setNivelToast({ type: 'success', msg: 'Nível atualizado com sucesso!' })
            } else {
                setNivelToast({ type: 'error', msg: d.error || 'Erro ao salvar nível' })
            }
        } catch {
            setNivelToast({ type: 'error', msg: 'Erro de conexão' })
        } finally {
            setSalvandoNivel(false)
            setTimeout(() => setNivelToast(null), 3500)
        }
    }

    const toggleOcultarComentario = async (comentarioId: string, ocultoAtual: boolean) => {
        await fetch(`/api/admin/comunidade/comentarios/${comentarioId}`, { method: 'PATCH' })
        setComentariosDaPaciente(
            comentariosDaPaciente.map((c: any) => c.id === comentarioId ? { ...c, oculto: !ocultoAtual } : c)
        )
    }

    const nivelInfo = NIVEL_META.find(n => n.id === (nivelAtual?.nivel ?? 1)) || NIVEL_META[0]

    return (
        <div className="space-y-5">
            {/* Toast */}
            <AnimatePresence>
                {nivelToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border
                            ${nivelToast.type === 'success'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'}`}
                    >
                        {nivelToast.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                        {nivelToast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Nível atual */}
            {nivelAtual && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${nivelInfo.badge}`}>
                    <span className="text-xl">{nivelInfo.emoji}</span>
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider">{nivelInfo.label}</p>
                        <p className="text-[10px] opacity-70 mt-0.5">
                            {nivelAtual.validade
                                ? `Válido até ${new Date(nivelAtual.validade + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                : 'Sem data de expiração'}
                        </p>
                    </div>
                </div>
            )}

            {/* Painel de definição de nível */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Lock size={10}/> Nível de Acesso à Comunidade
                </p>

                <div className="grid grid-cols-2 gap-2">
                    {NIVEL_META.map(n => (
                        <button
                            key={n.id}
                            onClick={() => setNivelSelecionado(n.id)}
                            className={`py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2
                                ${nivelSelecionado === n.id
                                    ? `${n.color} text-white`
                                    : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                        >
                            <span>{n.emoji}</span> {n.label}
                        </button>
                    ))}
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Válido até (opcional)
                    </label>
                    <input
                        type="date"
                        value={validadeNivel}
                        onChange={e => setValidadeNivel(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">Deixe em branco para acesso sem expiração</p>
                </div>

                <button
                    onClick={salvarNivel}
                    disabled={salvandoNivel}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
                >
                    {salvandoNivel ? <Loader2 size={14} className="animate-spin"/> : <Shield size={14}/>}
                    Salvar nível de acesso
                </button>
            </div>

            {/* Comentários da paciente */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MessageCircle size={10}/> Comentários no feed
                </p>
                {loadingComentarios ? (
                    <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-500"/></div>
                ) : comentariosDaPaciente.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-2">Nenhum comentário desta paciente.</p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {comentariosDaPaciente.map((c: any) => (
                            <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all
                                ${c.oculto ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300 leading-relaxed">{c.corpo}</p>
                                    <p className="text-[10px] text-slate-600 mt-1">
                                        {new Date(c.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {c.oculto && <span className="ml-2 text-slate-700 font-bold">(oculto)</span>}
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleOcultarComentario(c.id, c.oculto)}
                                    title={c.oculto ? 'Exibir comentário' : 'Ocultar comentário'}
                                    className={`flex-shrink-0 p-1.5 rounded-lg transition-all
                                        ${c.oculto
                                            ? 'bg-white/5 text-slate-500 hover:text-emerald-400'
                                            : 'bg-white/5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'}`}
                                >
                                    {c.oculto ? <Eye size={12}/> : <EyeOff size={12}/>}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Patient detail panel ─────────────────────────────────────────────────────
const COMMON_RESTRICTIONS = ['Lactose', 'Glúten', 'Ovo', 'Frutos do mar', 'Amendoim', 'Soja', 'Nozes', 'Carne vermelha', 'Carne de porco', 'Vegetariana', 'Vegana']

function PatientDetail({ patient, onAction, onRefresh }: {
    patient: Patient
    onAction: (type: string) => void
    onRefresh: () => void
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showProtocolModal, setShowProtocolModal] = useState(false)
    const [showGoalsModal, setShowGoalsModal] = useState(false)
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'health' | 'insights' | 'records' | 'comunidade'>('overview')

    // Comunidade (nível de acesso)
    const [nivelAtual, setNivelAtual] = useState<{ nivel: number; validade: string | null } | null>(null)
    const [nivelSelecionado, setNivelSelecionado] = useState(1)
    const [validadeNivel, setValidadeNivel] = useState('')
    const [salvandoNivel, setSalvandoNivel] = useState(false)
    const [nivelToast, setNivelToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [comentariosDaPaciente, setComentariosDaPaciente] = useState<any[]>([])
    const [loadingComentarios, setLoadingComentarios] = useState(false)
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [restrictions, setRestrictions] = useState<string[]>([])
    const [customRestriction, setCustomRestriction] = useState('')
    const [savingRestrictions, setSavingRestrictions] = useState(false)
    const [measurements, setMeasurements] = useState<any[]>([])
    const [loadingMeasurements, setLoadingMeasurements] = useState(false)
    const [patientAppointments, setPatientAppointments] = useState<any[]>([])
    const [loadingAppointments, setLoadingAppointments] = useState(false)
    const [patientQuestionnaireResponses, setPatientQuestionnaireResponses] = useState<any[]>([])
    const [loadingQRs, setLoadingQRs] = useState(false)
    const [checkinHistory, setCheckinHistory] = useState<any[]>([])
    const [loadingCheckins, setLoadingCheckins] = useState(false)

    // Fase da jornada (method_phases) state
    const [faseAtual, setFaseAtual] = useState<{ inicio: string; method_phases: { id: string; name: string } | null } | null | undefined>(undefined)
    const [fasesDisponiveis, setFasesDisponiveis] = useState<{ id: string; name: string; methodName: string }[]>([])
    const [faseSelecionada, setFaseSelecionada] = useState<string>('')
    const [salvandoFase, setSalvandoFase] = useState(false)
    const [enviandoNotif, setEnviandoNotif] = useState(false)
    const [faseToast, setFaseToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    useEffect(() => {
        fetch(`/api/admin/patients/${patient.id}/fase`)
            .then(r => r.json())
            .then(d => {
                setFaseAtual(d.fase ?? null)
                if (d.fase?.method_phases?.id) setFaseSelecionada(d.fase.method_phases.id)
            })
            .catch(() => setFaseAtual(null))

        fetch('/api/admin/methods')
            .then(r => r.json())
            .then(d => {
                const opcoes = (d.methods || []).flatMap((m: any) =>
                    (m.method_phases || []).map((p: any) => ({ id: p.id, name: p.name, methodName: m.name }))
                )
                setFasesDisponiveis(opcoes)
                setFaseSelecionada(prev => prev || opcoes[0]?.id || '')
            })
            .catch(() => {})
    }, [patient.id])

    const salvarFase = async () => {
        if (!faseSelecionada) return
        setSalvandoFase(true)
        try {
            const res = await fetch(`/api/admin/patients/${patient.id}/fase`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method_phase_id: faseSelecionada })
            })
            const d = await res.json()
            if (res.ok) {
                setFaseAtual(d.fase)
                setFaseToast({ type: 'success', msg: 'Fase atualizada!' })
            } else {
                setFaseToast({ type: 'error', msg: d.error || 'Erro ao salvar fase' })
            }
        } catch { setFaseToast({ type: 'error', msg: 'Erro de conexão' }) }
        finally {
            setSalvandoFase(false)
            setTimeout(() => setFaseToast(null), 3500)
        }
    }

    const testarNotificacao = async (tipo: string) => {
        setEnviandoNotif(true)
        try {
            const res = await fetch('/api/admin/notificacoes/testar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paciente_id: patient.id, tipo })
            })
            const d = await res.json()
            setFaseToast({ type: res.ok ? 'success' : 'error', msg: res.ok ? 'Push enviado!' : (d.error || 'Erro ao enviar') })
        } catch { setFaseToast({ type: 'error', msg: 'Erro de conexão' }) }
        finally {
            setEnviandoNotif(false)
            setTimeout(() => setFaseToast(null), 3500)
        }
    }

    // AI Insights state
    const [insight, setInsight] = useState<{
        behavioral_analysis: string
        strengths: string[]
        risks: string[]
        action_suggestions: string[]
        motivational_message: string
        engagement_score: number
    } | null>(null)
    const [insightLoading, setInsightLoading] = useState(false)
    const [insightError, setInsightError] = useState<string | null>(null)

    useEffect(() => {
        if (activeTab !== 'health') return
        setLoadingMeasurements(true)
        fetch(`/api/admin/measurements?patient_id=${patient.id}`)
            .then(r => r.json())
            .then(d => setMeasurements(d.measurements || []))
            .catch(() => {})
            .finally(() => setLoadingMeasurements(false))
    }, [activeTab, patient.id])

    useEffect(() => {
        if (activeTab !== 'history') return
        setLoadingAppointments(true)
        fetch(`/api/admin/appointments?patient_id=${patient.id}`)
            .then(r => r.json())
            .then(d => setPatientAppointments(d.appointments || []))
            .catch(() => {})
            .finally(() => setLoadingAppointments(false))

        setLoadingCheckins(true)
        ;(async () => {
            try {
                const { data } = await supabase.from('weekly_checkin_responses')
                    .select('id, created_at, week_start, diet_score, mood, bowel, had_binge, main_difficulty, ai_risk_level')
                    .eq('user_id', patient.id)
                    .order('week_start', { ascending: false })
                    .limit(8)
                setCheckinHistory(data || [])
            } catch {}
            finally { setLoadingCheckins(false) }
        })()

        setLoadingQRs(true)
        ;(async () => {
            try {
                const { data } = await supabase.from('questionnaire_responses')
                    .select('id, created_at, completed_at, questionnaire:questionnaires(name)')
                    .eq('patient_id', patient.id)
                    .order('created_at', { ascending: false })
                    .limit(10)
                setPatientQuestionnaireResponses(data || [])
            } catch {}
            finally { setLoadingQRs(false) }
        })()
    }, [activeTab, patient.id])

    const generateInsight = async () => {
        setInsightLoading(true)
        setInsightError(null)
        try {
            const res = await fetch(`/api/admin/patients/${patient.id}/insight`, { method: 'POST' })
            const data = await res.json()
            if (res.ok) setInsight(data.insight)
            else setInsightError(data.error || 'Erro ao gerar insight')
        } catch {
            setInsightError('Erro de conexão')
        } finally {
            setInsightLoading(false)
        }
    }

    // AI Chat state (chat com contexto da paciente, só para esta sessão — não persiste)
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [chatError, setChatError] = useState<string | null>(null)

    const sendChatMessage = async () => {
        const message = chatInput.trim()
        if (!message || chatLoading) return
        const history = chatMessages
        setChatMessages([...history, { role: 'user', content: message }])
        setChatInput('')
        setChatLoading(true)
        setChatError(null)
        try {
            const res = await fetch(`/api/admin/patients/${patient.id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history }),
            })
            const data = await res.json()
            if (res.ok) setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
            else setChatError(data.error || 'Erro ao consultar IA')
        } catch {
            setChatError('Erro de conexão')
        } finally {
            setChatLoading(false)
        }
    }

    const rm = RISK_META[patient.riskLevel]

    const quickAction = async (action: string, label: string) => {
        setActionLoading(action)
        try {
            await fetch(`/api/admin/patients/${patient.id}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })
            onAction(label + ' enviado!')
        } finally { setActionLoading(null) }
    }

    const sendCredentials = async () => {
        setActionLoading('send-credentials')
        try {
            const res = await fetch(`/api/admin/patients/${patient.id}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send-credentials' })
            })
            const data = await res.json()
            onAction(data.email_sent ? 'Dados de acesso enviados por e-mail!' : 'Acesso enviado para o app e WhatsApp')
        } finally { setActionLoading(null) }
    }

    const copyAccess = async () => {
        const loginUrl = typeof window !== 'undefined' ? window.location.origin + '/login' : '/login'
        const firstName = patient.name.split(' ')[0]
        const text = `Olá ${firstName}! Seu acesso:\n\n📧 E-mail: ${patient.email}\n🔗 Link: ${loginUrl}\n\nNa tela de login, clique em "Esqueci minha senha" para criar sua senha.`
        try { await navigator.clipboard.writeText(text) } catch {}
        onAction('Texto de acesso copiado!')
    }

    const saveRestrictions = async () => {
        setSavingRestrictions(true)
        try {
            await fetch(`/api/admin/patients/${patient.id}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update-restrictions', restrictions })
            })
            onAction('Restrições salvas!')
            onRefresh()
        } finally { setSavingRestrictions(false) }
    }

    const toggleRestriction = (r: string) => {
        setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
    }

    const addCustom = () => {
        const clean = customRestriction.trim()
        if (!clean || restrictions.includes(clean)) return
        setRestrictions(prev => [...prev, clean])
        setCustomRestriction('')
    }

    // Composite health score 0-100
    const healthScore = Math.max(0, Math.min(100, Math.round(
        patient.adherenceRate * 0.35 +
        (patient.checkinScore !== null ? patient.checkinScore * 10 * 0.25 : 0) +
        (patient.streak > 0 ? Math.min(patient.streak * 1.5, 25) : 0) +
        (patient.onboardingCompleted ? 15 : 0)
    )))

    const scoreColor = healthScore >= 70 ? 'text-emerald-400' : healthScore >= 40 ? 'text-amber-400' : 'text-rose-400'
    const scoreBarColor = healthScore >= 70 ? 'bg-emerald-500' : healthScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'

    // Risk causes
    const riskCauses: string[] = []
    if (!patient.onboardingCompleted) riskCauses.push('onboarding pendente')
    if (!patient.hasActiveProtocol) riskCauses.push('sem protocolo')
    if (!patient.hasCheckin) riskCauses.push('sem check-in')
    if (patient.adherenceRate === 0) riskCauses.push('adesão zero')
    if (patient.daysSinceActivity > 7) riskCauses.push(patient.daysSinceActivity >= 999 ? 'nunca fez check-in' : `inativa há ${patient.daysSinceActivity}d`)

    // Activity timeline events
    const timelineEvents: { label: string; sub: string; done: boolean; urgent?: boolean }[] = [
        { label: 'Entrou no clube', sub: patient.startDate, done: true },
        { label: 'Onboarding', sub: patient.onboardingCompleted ? 'Concluído' : 'Pendente', done: patient.onboardingCompleted, urgent: !patient.onboardingCompleted },
        { label: 'Protocolo', sub: patient.hasActiveProtocol ? 'Atribuído' : 'Não atribuído', done: patient.hasActiveProtocol, urgent: !patient.hasActiveProtocol },
        { label: 'Check-in semanal', sub: patient.hasCheckin ? `Score ${patient.checkinScore}/10` : 'Sem check-in', done: patient.hasCheckin, urgent: !patient.hasCheckin },
        { label: 'Última atividade', sub: patient.lastLogin === 'Nunca' ? 'Sem atividade registrada' : patient.lastLogin, done: patient.lastLogin !== 'Nunca' },
    ]

    // XP to next level threshold
    const xpNextLevel = Math.pow(patient.level, 2) * 500
    const xpPrevLevel = patient.level > 1 ? Math.pow(patient.level - 1, 2) * 500 : 0
    const xpProgress = xpNextLevel > xpPrevLevel ? Math.min(100, Math.round(((patient.xp - xpPrevLevel) / (xpNextLevel - xpPrevLevel)) * 100)) : 100

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-4 border-b border-white/5 bg-slate-900/50 flex-shrink-0 space-y-4">

                {/* Top row: avatar + identity + health score */}
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0
                        ${patient.riskLevel === 'high' ? 'bg-gradient-to-br from-rose-600 to-rose-800'
                        : patient.status === 'star' ? 'bg-gradient-to-br from-amber-500 to-yellow-600'
                        : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
                        {patient.avatar}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-white leading-tight">{patient.name}</h2>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${rm.bg} ${rm.color}`}>
                                {rm.label}
                            </span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-500">
                                {PLAN_LABELS[patient.plan] || patient.plan}
                            </span>
                            <button onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg transition-all">
                                <Pencil size={9}/> Editar
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            desde {patient.startDate}
                            {patient.primaryGoal && <span className="text-slate-600"> · {patient.primaryGoal}</span>}
                        </p>
                    </div>

                    {/* Health score */}
                    <div className="flex-shrink-0 text-right">
                        <p className={`text-2xl font-black ${scoreColor}`}>{healthScore}</p>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider">saúde</p>
                    </div>
                </div>

                {/* Health score bar */}
                <div className="space-y-1">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${scoreBarColor}`} style={{ width: `${healthScore}%` }}/>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {patient.streak > 0 && (
                                <span className="flex items-center gap-1 text-[11px] text-orange-400">
                                    <Flame size={11}/> {patient.streak}d
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-indigo-400">
                                <Zap size={11}/> {patient.xp.toLocaleString('pt-BR')} XP
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-amber-400">
                                🪙 {patient.coins}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-600">Nível {patient.level} · {xpProgress}% para Nível {patient.level + 1}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit overflow-x-auto">
                    {[['overview', 'Visão Geral'], ['history', 'Histórico'], ['health', 'Saúde'], ['insights', '✨ IA'], ['records', '🔒 Prontuário'], ['comunidade', '👥 Comunidade']].map(([id, label]) => (
                        <button key={id} onClick={() => setActiveTab(id as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                                ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Content ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                {activeTab === 'overview' && (
                    <>
                        {/* Alert banner — only if there are causes */}
                        {riskCauses.length > 0 && (
                            <div className={`rounded-2xl p-4 border space-y-3
                                ${patient.riskLevel === 'high' ? 'bg-rose-500/10 border-rose-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} className={patient.riskLevel === 'high' ? 'text-rose-400' : 'text-amber-400'}/>
                                    <p className="text-xs font-bold text-white">Por que está em risco?</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {riskCauses.map(cause => (
                                        <span key={cause} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                                            ${patient.riskLevel === 'high'
                                                ? 'bg-rose-500/15 border-rose-500/20 text-rose-300'
                                                : 'bg-amber-500/15 border-amber-500/20 text-amber-300'}`}>
                                            {cause}
                                        </span>
                                    ))}
                                </div>
                                {patient.aiSuggestion && (
                                    <p className="text-[11px] text-slate-300 leading-relaxed">{patient.aiSuggestion}</p>
                                )}
                            </div>
                        )}

                        {/* AI summary (only when has checkin, otherwise not redundant) */}
                        {patient.hasCheckin && (
                            <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-indigo-600/30 rounded-xl flex-shrink-0">
                                        <Sparkles size={14} className="text-indigo-400"/>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Análise IA — check-in desta semana</p>
                                        <p className="text-sm text-white leading-relaxed">"{patient.aiSummary}"</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Primary action row */}
                        <div className="flex gap-2">
                            {patient.riskLevel === 'high' ? (
                                <button onClick={() => quickAction('send-rescue', 'Mensagem de resgate')}
                                    disabled={actionLoading === 'send-rescue'}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                                    {actionLoading === 'send-rescue' ? <Loader2 size={13} className="animate-spin"/> : <Heart size={13}/>}
                                    Resgatar
                                </button>
                            ) : patient.status === 'star' ? (
                                <button onClick={() => quickAction('send-congrats', 'Parabéns')}
                                    disabled={actionLoading === 'send-congrats'}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                                    {actionLoading === 'send-congrats' ? <Loader2 size={13} className="animate-spin"/> : <Trophy size={13}/>}
                                    Parabenizar
                                </button>
                            ) : (
                                <button onClick={() => setShowMessageModal(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                                    <Send size={13}/> Mensagem
                                </button>
                            )}
                            <button onClick={() => setShowMessageModal(true)}
                                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all flex items-center gap-2">
                                <Bell size={13}/> Inbox
                            </button>
                            <button onClick={() => setShowScheduleModal(true)}
                                className="px-4 py-2.5 bg-teal-600/20 hover:bg-teal-600/40 border border-teal-500/30 text-teal-400 text-sm font-bold rounded-2xl transition-all flex items-center gap-2">
                                <CalendarPlus size={13}/>
                            </button>
                            {patient.phone && (
                                <a href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                                    className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 text-sm font-bold rounded-2xl transition-all flex items-center gap-2">
                                    <MessageCircle size={13}/>
                                </a>
                            )}
                        </div>

                        {/* Metrics grid with context */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Adherence */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Adesão 7d</span>
                                    <Activity size={12} className="text-slate-600"/>
                                </div>
                                <p className={`text-2xl font-bold ${patient.adherenceRate < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {patient.adherenceRate}%
                                </p>
                                <p className="text-[10px] mt-1 text-slate-600">
                                    {patient.adherenceRate === 0 ? 'sem histórico registrado'
                                        : patient.adherenceRate < 50 ? 'abaixo do ideal (>70%)'
                                        : 'dentro da meta'}
                                </p>
                            </div>

                            {/* Check-in */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Check-in</span>
                                    <CheckCircle size={12} className="text-slate-600"/>
                                </div>
                                <p className={`text-2xl font-bold ${patient.checkinScore !== null ? (patient.checkinScore >= 7 ? 'text-emerald-400' : patient.checkinScore >= 5 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-600'}`}>
                                    {patient.checkinScore !== null ? `${patient.checkinScore}/10` : '—'}
                                </p>
                                <p className="text-[10px] mt-1 text-slate-600">
                                    {patient.hasCheckin ? 'check-in desta semana' : 'nenhum check-in enviado'}
                                </p>
                            </div>

                            {/* Streak */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Streak</span>
                                    <Flame size={12} className="text-slate-600"/>
                                </div>
                                <p className={`text-2xl font-bold ${patient.streak > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {patient.streak}d
                                </p>
                                <p className="text-[10px] mt-1 text-slate-600">
                                    {patient.longestStreak > 0 ? `recorde: ${patient.longestStreak}d` : 'sem atividade contínua'}
                                </p>
                            </div>

                            {/* Last activity */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Últ. atividade</span>
                                    <Clock size={12} className="text-slate-600"/>
                                </div>
                                <p className={`text-lg font-bold leading-tight ${patient.lastLogin === 'Nunca' ? 'text-slate-600' : 'text-white'}`}>
                                    {patient.lastLogin}
                                </p>
                                <p className="text-[10px] mt-1 text-slate-600">
                                    {patient.onboardingCompleted ? 'onboarding concluído' : 'onboarding pendente'}
                                </p>
                            </div>
                        </div>

                        {/* Protocol — with inline action */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><FileText size={13}/> Protocolo</p>
                                {patient.hasActiveProtocol && (
                                    <button onClick={() => setShowProtocolModal(true)}
                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                                        Alterar <ChevronRight size={11}/>
                                    </button>
                                )}
                            </div>
                            {patient.hasActiveProtocol ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0"/>
                                    <span className="text-sm text-white font-bold">Protocolo ativo</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-amber-400 flex-shrink-0"/>
                                        <span className="text-sm text-amber-300">Nenhum protocolo atribuído</span>
                                    </div>
                                    <button onClick={() => setShowProtocolModal(true)}
                                        className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl transition-all">
                                        Atribuir agora
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Metas — múltiplas metas ativas ao mesmo tempo, sem "atual" único */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Target size={13}/> Metas</p>
                                <button onClick={() => setShowGoalsModal(true)}
                                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                                    Gerenciar <ChevronRight size={11}/>
                                </button>
                            </div>
                        </div>

                        {/* Fase da jornada (Método) */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fase da Jornada</p>
                            {faseToast && (
                                <div className={`text-xs px-3 py-2 rounded-xl font-medium ${faseToast.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                    {faseToast.msg}
                                </div>
                            )}
                            {faseAtual === undefined ? (
                                <div className="text-xs text-slate-500">Carregando...</div>
                            ) : faseAtual?.method_phases ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400">
                                        Fase atual
                                    </span>
                                    <span className="text-sm text-white font-medium">{faseAtual.method_phases.name}</span>
                                    <span className="text-xs text-slate-500">desde {new Date(faseAtual.inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Nenhuma fase atribuída</p>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                <select value={faseSelecionada} onChange={e => setFaseSelecionada(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                                    {fasesDisponiveis.length === 0 && <option value="">Nenhuma fase cadastrada</option>}
                                    {fasesDisponiveis.map(f => (
                                        <option key={f.id} value={f.id}>{f.methodName} — {f.name}</option>
                                    ))}
                                </select>
                                <button onClick={salvarFase} disabled={salvandoFase || !faseSelecionada}
                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                                    {salvandoFase ? <Loader2 size={12} className="animate-spin"/> : 'Salvar'}
                                </button>
                            </div>
                            {faseAtual && (
                                <div className="pt-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Testar notificação</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(['lembrete_refeicao', 'hidratacao', 'checkin', 'motivacao'] as const).map(tipo => (
                                            <button key={tipo} onClick={() => testarNotificacao(tipo)} disabled={enviandoNotif}
                                                className="text-[10px] font-bold px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-lg transition-all disabled:opacity-50">
                                                {tipo === 'lembrete_refeicao' ? 'Refeição' : tipo === 'hidratacao' ? 'Hidratação' : tipo === 'checkin' ? 'Check-in' : 'Motivação'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Acesso + Contato */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Contato & Acesso</p>
                            {patient.email && (
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Mail size={13} className="text-slate-500 flex-shrink-0"/> {patient.email}
                                </div>
                            )}
                            {patient.phone && (
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Phone size={13} className="text-slate-500 flex-shrink-0"/> {patient.phone}
                                </div>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button onClick={sendCredentials} disabled={actionLoading === 'send-credentials'}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                                    {actionLoading === 'send-credentials' ? <Loader2 size={11} className="animate-spin"/> : <KeyRound size={11}/>}
                                    Enviar acesso
                                </button>
                                <button onClick={copyAccess}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded-xl text-xs font-bold transition-all">
                                    <Copy size={11}/> Copiar
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <>
                        {/* Activity timeline */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">Linha do tempo</p>
                            <div className="space-y-0">
                                {timelineEvents.map((ev, i) => (
                                    <div key={ev.label} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ev.done ? 'bg-emerald-500/20 border border-emerald-500/40' : ev.urgent ? 'bg-rose-500/20 border border-rose-500/40' : 'bg-white/5 border border-white/10'}`}>
                                                {ev.done
                                                    ? <CheckCircle size={10} className="text-emerald-400"/>
                                                    : <AlertTriangle size={10} className={ev.urgent ? 'text-rose-400' : 'text-slate-600'}/>}
                                            </div>
                                            {i < timelineEvents.length - 1 && (
                                                <div className={`w-px flex-1 mt-1 mb-1 ${ev.done ? 'bg-emerald-500/20' : 'bg-white/5'}`} style={{ minHeight: '16px' }}/>
                                            )}
                                        </div>
                                        <div className="pb-3">
                                            <p className={`text-xs font-bold ${ev.done ? 'text-white' : ev.urgent ? 'text-rose-300' : 'text-slate-600'}`}>
                                                {ev.label}
                                            </p>
                                            <p className="text-[10px] text-slate-600">{ev.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Weight progress */}
                        {patient.weight.start > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5"><TrendingUp size={13}/> Progresso de peso</p>
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-600 uppercase">Início</p>
                                        <p className="text-xl font-bold text-white">{patient.weight.start}kg</p>
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                                style={{ width: patient.weight.start > patient.weight.current ? `${Math.min(100, Math.round(((patient.weight.start - patient.weight.current) / patient.weight.start) * 300))}%` : '5%' }}/>
                                        </div>
                                        {patient.weight.start > patient.weight.current && (
                                            <p className="text-[10px] text-emerald-400 font-bold text-center mt-1">
                                                -{(patient.weight.start - patient.weight.current).toFixed(1)}kg
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-600 uppercase">Atual</p>
                                        <p className="text-xl font-bold text-emerald-400">{patient.weight.current}kg</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Weekly check-in history */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Histórico de Check-ins</p>
                            {loadingCheckins ? (
                                <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-500"/></div>
                            ) : checkinHistory.length === 0 ? (
                                <p className="text-xs text-slate-600">Nenhum check-in enviado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {checkinHistory.map((c: any) => {
                                        const riskColor: Record<string, string> = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-rose-400' }
                                        const moodEmoji: Record<string, string> = { 'Ótimo': '🌟', 'Bom': '😊', 'Regular': '😐', 'Ruim': '😟' }
                                        return (
                                            <div key={c.id} className="flex items-start justify-between py-2 border-b border-white/5 last:border-0 gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-400">
                                                            Semana de {new Date(c.week_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                                        </p>
                                                        {c.mood && <span className="text-xs">{moodEmoji[c.mood] || c.mood}</span>}
                                                    </div>
                                                    {c.main_difficulty && (
                                                        <p className="text-[10px] text-slate-600 truncate mt-0.5">"{c.main_difficulty}"</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {c.diet_score != null && (
                                                        <span className={`text-xs font-black ${c.diet_score >= 7 ? 'text-emerald-400' : c.diet_score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                            {c.diet_score}/10
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-bold uppercase ${riskColor[c.ai_risk_level] || 'text-slate-500'}`}>
                                                        {c.ai_risk_level || 'low'}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Stats summary */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Objetivo', value: patient.primaryGoal || 'Não informado', color: 'text-white' },
                                { label: 'Maior streak', value: `${patient.longestStreak} dias`, color: 'text-orange-400' },
                                { label: 'Nível atual', value: `Nível ${patient.level}`, color: 'text-indigo-400' },
                                { label: 'NutriCoins', value: `${patient.coins}`, color: 'text-amber-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">{s.label}</p>
                                    <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Appointments history */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Consultas</p>
                            {loadingAppointments ? (
                                <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-500"/></div>
                            ) : patientAppointments.length === 0 ? (
                                <p className="text-xs text-slate-600">Nenhuma consulta registrada.</p>
                            ) : (
                                <div className="space-y-2">
                                    {patientAppointments.slice(0, 5).map((appt: any) => {
                                        const d = new Date(appt.scheduled_at)
                                        const statusColor: Record<string, string> = {
                                            scheduled: 'text-blue-400', confirmed: 'text-emerald-400',
                                            completed: 'text-slate-400', cancelled: 'text-rose-400', no_show: 'text-amber-400'
                                        }
                                        const statusLabel: Record<string, string> = {
                                            scheduled: 'Agendada', confirmed: 'Confirmada',
                                            completed: 'Realizada', cancelled: 'Cancelada', no_show: 'Ausente'
                                        }
                                        return (
                                            <div key={appt.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                                <div>
                                                    <p className="text-xs text-white font-bold">
                                                        {d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">{appt.duration_minutes}min · {appt.is_virtual ? 'Online' : 'Presencial'}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold ${statusColor[appt.status] || 'text-slate-500'}`}>
                                                    {statusLabel[appt.status] || appt.status}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {patientAppointments.length > 5 && (
                                        <p className="text-[10px] text-slate-600 text-center">+{patientAppointments.length - 5} mais</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Questionnaire responses */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Questionários Respondidos</p>
                            {loadingQRs ? (
                                <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-500"/></div>
                            ) : patientQuestionnaireResponses.length === 0 ? (
                                <p className="text-xs text-slate-600">Nenhum questionário respondido.</p>
                            ) : (
                                <div className="space-y-2">
                                    {patientQuestionnaireResponses.map((r: any) => (
                                        <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                            <div>
                                                <p className="text-xs text-white font-bold">{(r.questionnaire as any)?.name || 'Questionário'}</p>
                                                <p className="text-[10px] text-slate-500">
                                                    {new Date(r.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-400">✓ Respondido</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'insights' && (
                    <div className="space-y-4">
                        {/* Generate button */}
                        {!insight && (
                            <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-5 text-center space-y-4">
                                <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto">
                                    <Sparkles size={22} className="text-indigo-400"/>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Insight Profundo por IA</p>
                                    <p className="text-xs text-slate-500 mt-1">Análise comportamental completa com pontos fortes, riscos e sugestões de ação personalizadas para {patient.name.split(' ')[0]}.</p>
                                </div>
                                {insightError && (
                                    <p className="text-xs text-rose-400 font-bold">{insightError}</p>
                                )}
                                <button
                                    onClick={generateInsight}
                                    disabled={insightLoading}
                                    className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                                    {insightLoading ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
                                    {insightLoading ? 'Analisando...' : 'Gerar Insight Agora'}
                                </button>
                            </div>
                        )}

                        {insight && (
                            <>
                                {/* Engagement score */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Score de Engajamento IA</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Avaliação holística 0–100</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-3xl font-black ${insight.engagement_score >= 70 ? 'text-emerald-400' : insight.engagement_score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {insight.engagement_score}
                                        </p>
                                        <p className="text-[10px] text-slate-600">/100</p>
                                    </div>
                                </div>

                                {/* Behavioral analysis */}
                                <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-4 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                        <Sparkles size={10}/> Análise Comportamental
                                    </p>
                                    <p className="text-sm text-slate-200 leading-relaxed">{insight.behavioral_analysis}</p>
                                </div>

                                {/* Strengths */}
                                {insight.strengths.length > 0 && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle size={10}/> Pontos Fortes
                                        </p>
                                        <ul className="space-y-1.5">
                                            {insight.strengths.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span> {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Risks */}
                                {insight.risks.length > 0 && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                            <AlertTriangle size={10}/> Pontos de Atenção
                                        </p>
                                        <ul className="space-y-1.5">
                                            {insight.risks.map((r, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                    <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span> {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Action suggestions */}
                                {insight.action_suggestions.length > 0 && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                            <Target size={10}/> Sugestões de Ação
                                        </p>
                                        <ul className="space-y-2">
                                            {insight.action_suggestions.map((a, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                    <span className="text-indigo-400 font-bold flex-shrink-0">{i + 1}.</span> {a}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Motivational message */}
                                {insight.motivational_message && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mensagem Motivacional</p>
                                        <p className="text-sm text-slate-300 italic">"{insight.motivational_message}"</p>
                                        <button
                                            onClick={async () => {
                                                try { await navigator.clipboard.writeText(insight.motivational_message) } catch {}
                                                onAction('Mensagem copiada!')
                                            }}
                                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all">
                                            <Copy size={12}/> Copiar para enviar
                                        </button>
                                    </div>
                                )}

                                {/* Regenerate */}
                                <button
                                    onClick={() => { setInsight(null); setInsightError(null) }}
                                    className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 text-xs font-bold rounded-2xl transition-all">
                                    Gerar novo insight
                                </button>
                            </>
                        )}

                        {/* Chat IA — conversa livre com contexto completo da paciente */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <MessageCircle size={10}/> Chat IA sobre {patient.name.split(' ')[0]}
                            </p>
                            <p className="text-xs text-slate-500 -mt-2">
                                Pergunte livremente à IA sobre esta paciente — ela já tem todo o contexto acima.
                            </p>

                            {chatMessages.length > 0 && (
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                    {chatMessages.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                                m.role === 'user'
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white/10 text-slate-200'
                                            }`}>
                                                {m.content}
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white/10 rounded-2xl px-3 py-2">
                                                <Loader2 size={13} className="animate-spin text-slate-400"/>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {chatError && <p className="text-xs text-rose-400 font-bold">{chatError}</p>}

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                                    placeholder="Ex: ela teve alguma recaída essa semana?"
                                    disabled={chatLoading}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 disabled:opacity-50"
                                />
                                <button
                                    onClick={sendChatMessage}
                                    disabled={chatLoading || !chatInput.trim()}
                                    className="flex items-center justify-center w-9 h-9 flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl transition-all">
                                    {chatLoading ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'records' && (
                    <PatientRecordsPanel patientId={patient.id} />
                )}

                {activeTab === 'comunidade' && (
                    <ComunidadeTab
                        patientId={patient.id}
                        nivelAtual={nivelAtual}
                        nivelSelecionado={nivelSelecionado}
                        setNivelSelecionado={setNivelSelecionado}
                        validadeNivel={validadeNivel}
                        setValidadeNivel={setValidadeNivel}
                        salvandoNivel={salvandoNivel}
                        setSalvandoNivel={setSalvandoNivel}
                        setNivelAtual={setNivelAtual}
                        nivelToast={nivelToast}
                        setNivelToast={setNivelToast}
                        comentariosDaPaciente={comentariosDaPaciente}
                        setComentariosDaPaciente={setComentariosDaPaciente}
                        loadingComentarios={loadingComentarios}
                        setLoadingComentarios={setLoadingComentarios}
                    />
                )}

                {activeTab === 'health' && (
                    <div className="space-y-4">
                        {/* Body measurements */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Medidas Corporais</p>
                            {loadingMeasurements ? (
                                <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-500"/></div>
                            ) : measurements.length === 0 ? (
                                <p className="text-xs text-slate-600">Nenhuma medida registrada ainda.</p>
                            ) : (() => {
                                const latest = measurements[0]
                                const previous = measurements[1]
                                const MFIELDS = [
                                    { key: 'weight_kg', label: 'Peso', unit: 'kg' },
                                    { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
                                    { key: 'abdomen_cm', label: 'Abdômen', unit: 'cm' },
                                    { key: 'hip_cm', label: 'Quadril', unit: 'cm' },
                                    { key: 'chest_cm', label: 'Busto', unit: 'cm' },
                                    { key: 'arm_cm', label: 'Braço', unit: 'cm' },
                                    { key: 'thigh_cm', label: 'Coxa', unit: 'cm' },
                                ] as const
                                return (
                                    <>
                                        <p className="text-[10px] text-slate-500">
                                            Última medição: {new Date(latest.measured_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            {measurements.length > 1 && ` · ${measurements.length} registros`}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {MFIELDS.filter(f => latest[f.key] != null).map(f => {
                                                const curr = latest[f.key] as number
                                                const prev = previous ? previous[f.key] as number | null : null
                                                const diff = curr != null && prev != null ? curr - prev : null
                                                return (
                                                    <div key={f.key} className="bg-white/[0.03] border border-white/8 rounded-xl p-2.5">
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{f.label}</p>
                                                        <p className="text-white font-black text-base">{curr}<span className="text-slate-500 text-xs font-normal ml-0.5">{f.unit}</span></p>
                                                        {diff != null && diff !== 0 && (
                                                            <p className={`text-[10px] font-bold ${diff < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {latest.notes && <p className="text-xs text-slate-500 italic">"{latest.notes}"</p>}
                                    </>
                                )
                            })()}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Restrições Alimentares</p>
                            <p className="text-xs text-slate-400">Selecione as restrições para personalizar o cardápio e o chat com IA</p>
                            <div className="flex flex-wrap gap-2">
                                {COMMON_RESTRICTIONS.map(r => (
                                    <button key={r} onClick={() => toggleRestriction(r)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${restrictions.includes(r) ? 'bg-rose-500/15 border-rose-500/25 text-rose-400' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}>
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input value={customRestriction} onChange={e => setCustomRestriction(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCustom()}
                                    placeholder="Outra restrição..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                                <button onClick={addCustom} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all text-sm">+</button>
                            </div>
                            {restrictions.filter(r => !COMMON_RESTRICTIONS.includes(r)).map(r => (
                                <span key={r} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-rose-500/15 border border-rose-500/25 text-rose-400">
                                    {r} <button onClick={() => toggleRestriction(r)} className="hover:text-white">×</button>
                                </span>
                            ))}
                            <button onClick={saveRestrictions} disabled={savingRestrictions}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                                {savingRestrictions ? <Loader2 size={14} className="animate-spin"/> : null}
                                Salvar restrições
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showEditModal && (
                    <EditPatientModal
                        patient={patient}
                        onClose={() => setShowEditModal(false)}
                        onSuccess={() => { setShowEditModal(false); onRefresh(); onAction('Dados salvos!') }}
                    />
                )}
                {showProtocolModal && (
                    <AssignProtocolModal
                        patientId={patient.id}
                        patientName={patient.name}
                        currentProtocol={null}
                        onClose={() => setShowProtocolModal(false)}
                        onSuccess={() => { setShowProtocolModal(false); onRefresh(); onAction('Protocolo atribuído!') }}
                    />
                )}
                {showGoalsModal && (
                    <AssignGoalModal
                        patientId={patient.id}
                        patientName={patient.name}
                        onClose={() => setShowGoalsModal(false)}
                        onSuccess={() => onAction('Metas atualizadas!')}
                    />
                )}
                {showMessageModal && (
                    <SendMessageModal
                        patientId={patient.id}
                        patientName={patient.name}
                        onClose={() => setShowMessageModal(false)}
                        onSuccess={() => { setShowMessageModal(false); onAction('Mensagem enviada!') }}
                    />
                )}
                {showScheduleModal && (
                    <QuickScheduleModal
                        patientId={patient.id}
                        patientName={patient.name}
                        onClose={() => setShowScheduleModal(false)}
                        onSuccess={() => { setShowScheduleModal(false); onAction('Consulta agendada!') }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Quick Schedule Modal ─────────────────────────────────────────────────────
function QuickScheduleModal({ patientId, patientName, onClose, onSuccess }: {
    patientId: string; patientName: string; onClose: () => void; onSuccess: () => void
}) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const defaultDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`
    const [form, setForm] = useState({
        date: defaultDate,
        time: '10:00',
        duration: '60',
        type: 'consultation',
        is_virtual: true,
        meeting_link: '',
        notes: '',
    })

    const handleSave = async () => {
        setSaving(true); setError(null)
        try {
            const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString()
            const res = await fetch('/api/admin/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: patientId,
                    scheduled_at,
                    duration_minutes: parseInt(form.duration),
                    appointment_type: form.type,
                    is_virtual: form.is_virtual,
                    meeting_link: form.meeting_link || undefined,
                    notes: form.notes || undefined,
                    status: 'scheduled',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao agendar')
            onSuccess()
        } catch (e: any) {
            setError(e.message)
        } finally { setSaving(false) }
    }

    const firstName = patientName.split(' ')[0]

    return (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm"
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <CalendarPlus size={15} className="text-teal-400"/> Agendar Consulta
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">com {firstName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-500"><X size={15}/></button>
                </div>

                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Data</label>
                            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hora</label>
                            <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo</label>
                            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                                <option value="consultation">Consulta</option>
                                <option value="followup">Retorno</option>
                                <option value="initial_assessment">Avaliação</option>
                                <option value="group_session">Grupo</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Duração</label>
                            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="90">90 min</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-sm text-slate-300">Online (videochamada)</span>
                        <button onClick={() => setForm(p => ({ ...p, is_virtual: !p.is_virtual }))}
                            className={`relative w-10 h-5 rounded-full transition-colors ${form.is_virtual ? 'bg-teal-600' : 'bg-white/10'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_virtual ? 'left-5' : 'left-0.5'}`}/>
                        </button>
                    </div>

                    {form.is_virtual && (
                        <input value={form.meeting_link} onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))}
                            placeholder="Link da videochamada (opcional)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"/>
                    )}

                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        rows={2} placeholder="Observações (opcional)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/50"/>

                    {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}

                    <div className="flex gap-2 pt-1">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">Cancelar</button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <CalendarPlus size={14}/>}
                            Agendar
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Import CSV Modal ─────────────────────────────────────────────────────────
interface ImportRow { name: string; email: string; phone?: string; plan?: string; primary_goal?: string }
interface ImportResult { email: string; name: string; status: 'success' | 'error'; error?: string; temp_password?: string }

function ImportCSVModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload')
    const [rows, setRows] = useState<ImportRow[]>([])
    const [results, setResults] = useState<ImportResult[]>([])
    const [parseError, setParseError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)

    const parseCSV = (text: string) => {
        setParseError(null)
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) { setParseError('CSV deve ter pelo menos 1 linha de cabeçalho e 1 de dados'); return }

        const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
        const nameIdx = header.findIndex(h => ['nome', 'name'].includes(h))
        const emailIdx = header.findIndex(h => h === 'email')
        const phoneIdx = header.findIndex(h => ['telefone', 'phone', 'celular'].includes(h))
        const planIdx = header.findIndex(h => ['plano', 'plan'].includes(h))
        const goalIdx = header.findIndex(h => ['objetivo', 'primary_goal', 'goal'].includes(h))

        if (nameIdx === -1 || emailIdx === -1) {
            setParseError('Colunas obrigatórias não encontradas. O CSV deve ter "nome" e "email".')
            return
        }

        const parsed: ImportRow[] = []
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
            if (!cols[emailIdx] && !cols[nameIdx]) continue
            parsed.push({
                name: cols[nameIdx] || '',
                email: cols[emailIdx] || '',
                phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
                plan: planIdx >= 0 ? cols[planIdx] : undefined,
                primary_goal: goalIdx >= 0 ? cols[goalIdx] : undefined,
            })
        }

        if (parsed.length === 0) { setParseError('Nenhuma linha válida encontrada'); return }
        if (parsed.length > 200) { setParseError('Máximo 200 linhas por importação'); return }
        setRows(parsed)
        setStep('preview')
    }

    const handleFile = (file: File) => {
        const reader = new FileReader()
        reader.onload = e => parseCSV(e.target?.result as string)
        reader.readAsText(file, 'UTF-8')
    }

    const handleImport = async () => {
        setStep('importing')
        setProgress(0)
        try {
            const res = await fetch('/api/admin/patients/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            })
            const data = await res.json()
            setResults(data.results || [])
            setProgress(100)
            setStep('results')
            onDone()
        } catch {
            setParseError('Erro de conexão ao importar')
            setStep('preview')
        }
    }

    const downloadTemplate = () => {
        const csv = 'nome,email,telefone,plano,objetivo\nMaria Silva,maria@email.com,11999998888,community,Emagrecer\nAna Costa,ana@email.com,,,Ganhar saúde'
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'modelo-importacao.csv'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Upload size={16} className="text-indigo-400"/> Importar Membros (CSV)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {step === 'upload' && 'Faça upload de um arquivo CSV'}
                            {step === 'preview' && `${rows.length} linha(s) detectada(s)`}
                            {step === 'importing' && 'Importando...'}
                            {step === 'results' && `${successCount} criadas · ${errorCount} com erro`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all">
                        <X size={16}/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {step === 'upload' && (
                        <>
                            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl p-10 cursor-pointer transition-all group">
                                <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600/30 transition-all">
                                    <Upload size={22} className="text-indigo-400"/>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white">Clique para escolher o arquivo</p>
                                    <p className="text-xs text-slate-500 mt-1">Apenas arquivos .csv</p>
                                </div>
                                <input type="file" accept=".csv" className="hidden"
                                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
                            </label>

                            {parseError && (
                                <p className="text-xs text-rose-400 font-bold text-center">{parseError}</p>
                            )}

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Colunas esperadas</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {[['nome', 'obrigatório'], ['email', 'obrigatório'], ['telefone', 'opcional'], ['plano', 'opcional'], ['objetivo', 'opcional']].map(([col, hint]) => (
                                        <span key={col} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${hint === 'obrigatório' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                            {col} <span className="opacity-60">({hint})</span>
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-600">Planos válidos: community, tech_diet, vip</p>
                            </div>

                            <button onClick={downloadTemplate}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 text-slate-400 text-xs font-bold rounded-2xl transition-all">
                                <Download size={13}/> Baixar modelo CSV
                            </button>
                        </>
                    )}

                    {step === 'preview' && (
                        <>
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-3 gap-0 text-[10px] font-black uppercase tracking-wider text-slate-500 px-4 py-2 border-b border-white/5">
                                    <span>Nome</span><span>Email</span><span>Plano</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {rows.map((r, i) => (
                                        <div key={i} className="grid grid-cols-3 gap-0 px-4 py-2 border-b border-white/[0.03] text-xs">
                                            <span className="text-white truncate pr-2">{r.name || <span className="text-rose-400">—</span>}</span>
                                            <span className="text-slate-400 truncate pr-2">{r.email || <span className="text-rose-400">—</span>}</span>
                                            <span className="text-slate-500 truncate">{r.plan || 'community'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 text-center">
                                Uma senha temporária será gerada para cada membro.
                            </p>
                            {parseError && (
                                <p className="text-xs text-rose-400 font-bold text-center">{parseError}</p>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => { setRows([]); setStep('upload') }}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl">
                                    Voltar
                                </button>
                                <button onClick={handleImport}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                                    Importar {rows.length} membro(s)
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 size={32} className="animate-spin text-indigo-400"/>
                            <p className="text-sm font-bold text-white">Criando {rows.length} conta(s)...</p>
                            <p className="text-xs text-slate-500">Isso pode levar alguns segundos</p>
                        </div>
                    )}

                    {step === 'results' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-400">{successCount}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Criadas</p>
                                </div>
                                <div className={`${errorCount > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/10'} border rounded-2xl p-4 text-center`}>
                                    <p className={`text-2xl font-black ${errorCount > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{errorCount}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Com erro</p>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {results.map((r, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${r.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-rose-500/5 border-rose-500/15'}`}>
                                        <span className={`text-sm flex-shrink-0 mt-0.5 ${r.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {r.status === 'success' ? '✓' : '✗'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{r.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{r.email}</p>
                                            {r.status === 'success' && r.temp_password && (
                                                <p className="text-[10px] text-indigo-400 font-bold mt-0.5">Senha temp: {r.temp_password}</p>
                                            )}
                                            {r.status === 'error' && (
                                                <p className="text-[10px] text-rose-400 mt-0.5">{r.error}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button onClick={onClose}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                                Concluir
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function PatientsView({ setView }: { setView: (v: any) => void }) {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'risk' | 'star' | 'active'>('all')
    const [showRegister, setShowRegister] = useState(false)
    const [showImport, setShowImport] = useState(false)
    const [toast, setToast] = useState<string | null>(null)
    const [remindingCheckin, setRemindingCheckin] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/patients')
            if (res.ok) {
                const data = await res.json()
                const list = data.patients || []
                setPatients(list)
                if (list.length > 0 && !selectedId) setSelectedId(list[0].id)
            }
        } finally { setLoading(false) }
    }, [selectedId])

    useEffect(() => { refresh() }, [])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3500)
    }

    const sendCheckinReminders = async () => {
        setRemindingCheckin(true)
        try {
            const res = await fetch('/api/admin/patients/remind-checkin', { method: 'POST' })
            const data = await res.json()
            showToast(data.message || `Lembretes enviados!`)
        } catch {
            showToast('Erro ao enviar lembretes')
        } finally { setRemindingCheckin(false) }
    }

    const exportCSV = () => {
        if (!patients.length) {
            showToast('Nenhuma rainha para exportar');
            return;
        }
        
        const headers = ['Nome', 'Email', 'Telefone', 'Plano', 'Status', 'Risco', 'Adesão', 'XP', 'Streak', 'Progresso_Peso'];
        const csvContent = [
            headers.join(','),
            ...patients.map(p => [
                `"${p.name}"`,
                `"${p.email}"`,
                `"${p.phone || ''}"`,
                `"${PLAN_LABELS[p.plan] || p.plan}"`,
                `"${p.status}"`,
                `"${p.riskLevel}"`,
                `"${p.adherenceRate}%"`,
                `${p.xp}`,
                `${p.streak}`,
                p.weight.start > 0 ? `"${(p.weight.start - p.weight.current).toFixed(1)}kg perdidos"` : '"-"'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `vitaclub-pacientes-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV exportado com sucesso!');
    }

    const filtered = patients.filter(p => {
        const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
        const mf = filter === 'all' || p.status === filter
        return ms && mf
    }).sort((a, b) => {
        const order: Record<string, number> = { risk: 0, star: 1, active: 2 }
        return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })

    const activePatient = patients.find(p => p.id === selectedId)
    const riskCount = patients.filter(p => p.status === 'risk').length
    const starCount = patients.filter(p => p.status === 'star').length

    return (
        <div className="flex h-[calc(100vh-88px)] -m-8 overflow-hidden">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-2xl">
                        ✓ {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── LEFT: patient list ─────────────────────────────────────────── */}
            <div className="w-72 flex flex-col flex-shrink-0 border-r border-white/5 bg-slate-950/60">
                <div className="p-4 border-b border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <Crown size={16} className="text-indigo-400"/>
                            Rainhas
                            <span className="text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-md font-bold">{patients.length}</span>
                        </h2>
                        <div className="flex gap-1">
                            <button onClick={sendCheckinReminders} disabled={remindingCheckin}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-amber-400 transition-colors disabled:opacity-40" title="Lembrar check-in pendente">
                                {remindingCheckin ? <Loader2 size={13} className="animate-spin"/> : <Bell size={13}/>}
                            </button>
                            <button onClick={exportCSV} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-slate-400 transition-colors" title="Exportar CSV">
                                <Download size={13}/>
                            </button>
                            <button onClick={() => setShowImport(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-slate-400 transition-colors" title="Importar CSV">
                                <Upload size={13}/>
                            </button>
                            <button onClick={refresh} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-slate-400 transition-colors" title="Atualizar">
                                <RefreshCw size={13}/>
                            </button>
                            <button onClick={() => setShowRegister(true)}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors" title="Nova Rainha">
                                <Plus size={13}/>
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"/>
                    </div>

                    {/* filters */}
                    <div className="flex gap-1 overflow-x-auto pb-0.5">
                        {[['all','Todas'],['risk',`⚠️ ${riskCount}`],['star',`⭐ ${starCount}`]] .map(([v,l]) => (
                            <button key={v} onClick={() => setFilter(v as any)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border
                                    ${filter === v
                                        ? v === 'risk' ? 'bg-rose-600/20 border-rose-500/30 text-rose-400'
                                            : v === 'star' ? 'bg-amber-600/20 border-amber-500/30 text-amber-400'
                                            : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                                        : 'bg-white/5 border-white/10 text-slate-600 hover:text-slate-400'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && patients.length === 0 ? (
                        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-700"/></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-slate-700 text-xs">Nenhuma rainha encontrada</div>
                    ) : filtered.map(p => (
                        <button key={p.id} onClick={() => setSelectedId(p.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] transition-all text-left
                                ${selectedId === p.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/[0.03]'}`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0
                                ${p.riskLevel === 'high' ? 'bg-gradient-to-br from-rose-600 to-rose-800'
                                : p.status === 'star' ? 'bg-gradient-to-br from-amber-500 to-yellow-600'
                                : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
                                {p.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-600 truncate">{PLAN_LABELS[p.plan] || p.plan}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {p.riskLevel === 'high' && <AlertTriangle size={11} className="text-rose-500"/>}
                                {p.status === 'star' && <Star size={11} className="text-amber-400 fill-amber-400"/>}
                                {p.streak > 0 && <span className="text-[9px] text-orange-400 flex items-center gap-0.5"><Flame size={9}/>{p.streak}</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── RIGHT: patient detail ──────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
                {activePatient ? (
                    <PatientDetail
                        patient={activePatient}
                        onAction={showToast}
                        onRefresh={refresh}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-700">
                        <div className="text-center">
                            <Users size={40} className="mx-auto mb-3 opacity-30"/>
                            <p className="text-sm">Selecione uma rainha</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Register modal */}
            <AnimatePresence>
                {showRegister && (
                    <RegisterModal
                        onClose={() => setShowRegister(false)}
                        onRegistered={() => refresh()}
                        onSuccess={() => { setShowRegister(false); showToast('Rainha cadastrada com sucesso!') }}
                    />
                )}
                {showImport && (
                    <ImportCSVModal
                        onClose={() => setShowImport(false)}
                        onDone={() => { refresh(); showToast('Importação concluída!') }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
