"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Search, Bell, Zap, TrendingUp, AlertTriangle, MessageCircle,
    Activity, Star, Crown, Trophy, Flame, CheckCircle, Mail,
    Phone, Clock, Target, ChevronRight, Loader2, Sparkles,
    Heart, Plus, X, RefreshCw, Send, Shield, Users, FileText,
    ToggleLeft, ToggleRight, Gift, Coins, Download, KeyRound, Copy, Pencil
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

    useEffect(() => {
        fetch('/api/admin/protocols-list')
            .then(r => r.ok ? r.json() : { protocols: [] })
            .then(d => { setProtocols(d.protocols || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const handleAssign = async (protocolId: string | null) => {
        setAssigning(protocolId || 'remove')
        try {
            await fetch(`/api/admin/patients/${patientId}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: protocolId ? 'assign-protocol' : 'remove-protocol', protocol_id: protocolId })
            })
            onSuccess()
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

// ─── Patient detail panel ─────────────────────────────────────────────────────
const COMMON_RESTRICTIONS = ['Lactose', 'Glúten', 'Ovo', 'Frutos do mar', 'Amendoim', 'Soja', 'Nozes', 'Carne vermelha', 'Carne de porco', 'Vegetariana', 'Vegana']

function PatientDetail({ patient, onAction, onRefresh }: {
    patient: Patient
    onAction: (type: string) => void
    onRefresh: () => void
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showProtocolModal, setShowProtocolModal] = useState(false)
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'health'>('overview')
    const [restrictions, setRestrictions] = useState<string[]>([])
    const [customRestriction, setCustomRestriction] = useState('')
    const [savingRestrictions, setSavingRestrictions] = useState(false)

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
    if (patient.daysSinceActivity > 7) riskCauses.push(`inativa há ${patient.daysSinceActivity}d`)

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
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                    {[['overview', 'Visão Geral'], ['history', 'Histórico'], ['health', 'Saúde']].map(([id, label]) => (
                        <button key={id} onClick={() => setActiveTab(id as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                                ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Content ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

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
                    </>
                )}

                {activeTab === 'health' && (
                    <div className="space-y-4">
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
                {showMessageModal && (
                    <SendMessageModal
                        patientId={patient.id}
                        patientName={patient.name}
                        onClose={() => setShowMessageModal(false)}
                        onSuccess={() => { setShowMessageModal(false); onAction('Mensagem enviada!') }}
                    />
                )}
            </AnimatePresence>
        </div>
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
    const [toast, setToast] = useState<string | null>(null)

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
                            <button onClick={exportCSV} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-slate-400 transition-colors" title="Exportar CSV">
                                <Download size={13}/>
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
                <div className="flex-1 overflow-y-auto">
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
            </AnimatePresence>
        </div>
    )
}
