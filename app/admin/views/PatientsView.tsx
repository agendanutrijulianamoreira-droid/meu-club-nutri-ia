"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Search, Bell, Zap, TrendingUp, AlertTriangle, MessageCircle,
    Activity, Star, Crown, Trophy, Flame, CheckCircle, Mail,
    Phone, Clock, Target, ChevronRight, Loader2, Sparkles,
    Heart, Plus, X, RefreshCw, Send, Shield, Users, FileText,
    ToggleLeft, ToggleRight, Gift, Coins
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
function RegisterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: 'ChangeMe123!', plan: 'tech_diet' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!form.name || !form.email) { setError('Nome e email são obrigatórios'); return }
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/admin/create-patient', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally { setSaving(false) }
    }

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

// ─── Patient detail panel ─────────────────────────────────────────────────────
function PatientDetail({ patient, onAction, onRefresh }: {
    patient: Patient
    onAction: (type: string) => void
    onRefresh: () => void
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showProtocolModal, setShowProtocolModal] = useState(false)
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

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

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-slate-900/50 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0
                            ${patient.riskLevel === 'high' ? 'bg-gradient-to-br from-rose-600 to-rose-800'
                            : patient.status === 'star' ? 'bg-gradient-to-br from-amber-500 to-yellow-600'
                            : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
                            {patient.avatar}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-bold text-white">{patient.name}</h2>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${rm.bg} ${rm.color}`}>
                                    {rm.label}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {PLAN_LABELS[patient.plan] || patient.plan} · desde {patient.startDate}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                                {patient.streak > 0 && (
                                    <span className="flex items-center gap-1 text-xs text-orange-400">
                                        <Flame size={12}/> {patient.streak}d streak
                                    </span>
                                )}
                                <span className="flex items-center gap-1 text-xs text-indigo-400">
                                    <Zap size={12}/> {patient.xp.toLocaleString('pt-BR')} XP
                                </span>
                                <span className="flex items-center gap-1 text-xs text-amber-400">
                                    🪙 {patient.coins.toLocaleString('pt-BR')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        {patient.phone && (
                            <a href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all">
                                <MessageCircle size={12}/> WhatsApp
                            </a>
                        )}
                        <button onClick={() => setShowMessageModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold transition-all">
                            <Bell size={12}/> Inbox
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-4 bg-white/5 rounded-xl p-1 w-fit">
                    {[['overview', 'Visão Geral'], ['history', 'Histórico']] .map(([id, label]) => (
                        <button key={id} onClick={() => setActiveTab(id as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                                ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {activeTab === 'overview' && (
                    <>
                        {/* AI summary */}
                        <div className={`rounded-2xl p-4 border
                            ${patient.riskLevel === 'high' ? 'bg-rose-500/10 border-rose-500/25'
                            : patient.status === 'star' ? 'bg-amber-500/10 border-amber-500/25'
                            : 'bg-indigo-500/10 border-indigo-500/25'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-xl flex-shrink-0
                                    ${patient.riskLevel === 'high' ? 'bg-rose-600/30' : patient.status === 'star' ? 'bg-amber-600/30' : 'bg-indigo-600/30'}`}>
                                    <Sparkles size={16} className={patient.riskLevel === 'high' ? 'text-rose-400' : patient.status === 'star' ? 'text-amber-400' : 'text-indigo-400'}/>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-400 mb-1">
                                        {patient.hasCheckin ? 'Análise IA — check-in desta semana' : 'Score de engajamento'}
                                    </p>
                                    <p className="text-sm text-white leading-relaxed">"{patient.aiSummary}"</p>
                                    {patient.aiSuggestion && (
                                        <div className="mt-2 bg-white/5 rounded-xl px-3 py-2">
                                            <p className="text-[10px] font-bold text-indigo-400 uppercase mb-0.5">Sugestão</p>
                                            <p className="text-xs text-slate-300">{patient.aiSuggestion}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons based on status */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {patient.riskLevel === 'high' && (
                                    <button onClick={() => quickAction('send-rescue', 'Mensagem de resgate')}
                                        disabled={actionLoading === 'send-rescue'}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                                        {actionLoading === 'send-rescue' ? <Loader2 size={11} className="animate-spin"/> : <Heart size={11}/>}
                                        Enviar resgate
                                    </button>
                                )}
                                {patient.status === 'star' && (
                                    <button onClick={() => quickAction('send-congrats', 'Parabéns')}
                                        disabled={actionLoading === 'send-congrats'}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                                        {actionLoading === 'send-congrats' ? <Loader2 size={11} className="animate-spin"/> : <Trophy size={11}/>}
                                        Enviar parabéns
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Adesão 7d', value: `${patient.adherenceRate}%`, sub: 'últimos 7 dias', color: patient.adherenceRate < 50 ? 'text-rose-400' : 'text-emerald-400', icon: <Activity size={14}/> },
                                { label: 'Check-in', value: patient.checkinScore !== null ? `${patient.checkinScore}/10` : '—', sub: patient.hasCheckin ? 'esta semana' : 'sem check-in', color: patient.checkinScore !== null ? (patient.checkinScore >= 7 ? 'text-emerald-400' : patient.checkinScore >= 5 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-600', icon: <CheckCircle size={14}/> },
                                { label: 'Streak', value: `${patient.streak}d`, sub: `recorde ${patient.longestStreak}d`, color: patient.streak > 0 ? 'text-orange-400' : 'text-slate-600', icon: <Flame size={14}/> },
                                { label: 'Última atividade', value: patient.lastLogin, sub: patient.onboardingCompleted ? 'onboarding ✓' : 'onboarding pendente', color: 'text-white', icon: <Clock size={14}/> },
                            ].map(m => (
                                <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{m.label}</span>
                                        <span className="text-slate-600">{m.icon}</span>
                                    </div>
                                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                                    <p className="text-[10px] text-slate-600 mt-1">{m.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Protocol assignment */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><FileText size={13}/> Protocolo</p>
                                <button onClick={() => setShowProtocolModal(true)}
                                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                                    Alterar <ChevronRight size={11}/>
                                </button>
                            </div>
                            {patient.hasActiveProtocol ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0"/>
                                    <span className="text-sm text-white font-bold">Protocolo ativo atribuído</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-400 flex-shrink-0"/>
                                    <span className="text-sm text-amber-300">Nenhum protocolo atribuído</span>
                                    <button onClick={() => setShowProtocolModal(true)}
                                        className="ml-auto text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg hover:bg-indigo-500/20 transition-all">
                                        Atribuir
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Contact */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Contato</p>
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
                            {patient.primaryGoal && (
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <Target size={13} className="text-indigo-400 flex-shrink-0"/> {patient.primaryGoal}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <>
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
                                                -{(patient.weight.start - patient.weight.current).toFixed(1)}kg 🎉
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
                                { label: 'Protocolo', value: patient.hasActiveProtocol ? 'Ativo' : 'Não atribuído', color: patient.hasActiveProtocol ? 'text-emerald-400' : 'text-slate-500' },
                                { label: 'Objetivo', value: patient.primaryGoal || 'Não informado', color: 'text-white' },
                                { label: 'Maior streak', value: `${patient.longestStreak} dias`, color: 'text-orange-400' },
                                { label: 'Nível atual', value: `Nível ${patient.level}`, color: 'text-indigo-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">{s.label}</p>
                                    <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
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
                            <button onClick={refresh} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-slate-400 transition-colors">
                                <RefreshCw size={13}/>
                            </button>
                            <button onClick={() => setShowRegister(true)}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
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
                        onSuccess={() => { setShowRegister(false); refresh(); showToast('Rainha cadastrada com sucesso!') }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
