"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Plus, Trophy, Clock, Users, Flame, Target, Sparkles,
    Edit3, Trash2, Loader2, X, Save, Search, Bot,
    ToggleLeft, ToggleRight, CheckCircle, Calendar, Zap
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useChallenges } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase"

const EMOJIS = ["🏆","🔥","💪","🥗","💧","🏃","🧘","✨","🌟","🎯","🚀","👑","⚡","🎉","🌿"]
const DURATIONS = [7, 14, 21, 30]

interface ParticipantStats { [id: string]: { total: number; finished: number } }

// ─── Status helpers ───────────────────────────────────────────────────────────
function getChallengeStatus(challenge: any) {
    const today = new Date()
    const start = challenge.start_date ? new Date(challenge.start_date) : null
    const end = challenge.end_date ? new Date(challenge.end_date) : null
    if (!challenge.is_active) return 'inactive'
    if (start && today < start) return 'upcoming'
    if (end && today > end) return 'finished'
    return 'active'
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    active:   { label: 'Ativo',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25' },
    upcoming: { label: 'Em breve',  color: 'text-indigo-400',  bg: 'bg-indigo-500/15 border-indigo-500/25' },
    finished: { label: 'Encerrado', color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25' },
    inactive: { label: 'Inativo',   color: 'text-slate-500',   bg: 'bg-slate-700/20 border-slate-600/20' },
}

// ─── Challenge Card ───────────────────────────────────────────────────────────
function ChallengeCard({ challenge, participants, onEdit, onDelete, onToggle }: {
    challenge: any
    participants?: { total: number; finished: number }
    onEdit: (c: any) => void
    onDelete: (id: string) => void
    onToggle: (id: string, active: boolean) => void
    key?: any
}) {
    const [deleting, setDeleting] = useState(false)
    const [toggling, setToggling] = useState(false)

    const status = getChallengeStatus(challenge)
    const sm = STATUS_META[status]

    const start = challenge.start_date ? new Date(challenge.start_date) : null
    const end = challenge.end_date ? new Date(challenge.end_date) : null
    const today = new Date()

    let progress = 0
    if (status === 'active' && start && end) {
        const total = end.getTime() - start.getTime()
        const elapsed = today.getTime() - start.getTime()
        progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
    }

    const completionRate = participants && participants.total > 0
        ? Math.round((participants.finished / participants.total) * 100)
        : null

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`bg-white/5 border rounded-3xl p-5 flex flex-col gap-4 group transition-all
                ${status === 'active' ? 'border-white/10 hover:border-indigo-500/30' : 'border-white/5 opacity-75'}`}>

            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                        {challenge.emoji || '🏆'}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm leading-snug truncate">{challenge.title}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> {challenge.duration_days}d
                            {start && <> · <Calendar size={10} /> {start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</>}
                        </p>
                    </div>
                </div>
                <button onClick={async () => { setToggling(true); await onToggle(challenge.id, !challenge.is_active); setToggling(false) }}
                    disabled={toggling} className="flex-shrink-0 hover:scale-110 transition-all">
                    {toggling ? <Loader2 size={18} className="animate-spin text-slate-500" />
                        : challenge.is_active ? <ToggleRight size={20} className="text-emerald-400" />
                        : <ToggleLeft size={20} className="text-slate-600" />}
                </button>
            </div>

            {/* Description */}
            {challenge.description && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{challenge.description}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${sm.bg} ${sm.color}`}>
                    {sm.label}
                </span>
                {participants && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Users size={11} className="text-indigo-400" />
                        {participants.total} participantes
                    </span>
                )}
                {completionRate !== null && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                        <CheckCircle size={11} />
                        {completionRate}% conclusão
                    </span>
                )}
                {challenge.prize_pool_coins > 0 && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 ml-auto">
                        🪙 {challenge.prize_pool_coins.toLocaleString('pt-BR')}
                    </span>
                )}
            </div>

            {/* Progress bar for active */}
            {status === 'active' && (
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Progresso temporal</span>
                        <span className="text-indigo-400 font-bold">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <button onClick={() => onEdit(challenge)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-400 text-xs font-bold transition-all">
                    <Edit3 size={12} /> Editar
                </button>
                <button onClick={async () => {
                    if (!confirm('Excluir este desafio?')) return
                    setDeleting(true); await onDelete(challenge.id); setDeleting(false)
                }} disabled={deleting}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all">
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
            </div>
        </motion.div>
    )
}

// ─── Challenge Form ───────────────────────────────────────────────────────────
function ChallengeForm({ editingData, tenantId, onSave, onUpdate, onClose }: {
    editingData?: any; tenantId: string
    onSave: (d: any) => Promise<any>; onUpdate?: (id: string, d: any) => Promise<any>; onClose: () => void
}) {
    const isEditing = !!editingData?.id
    const today = new Date().toISOString().split('T')[0]
    const [form, setForm] = useState({
        title: editingData?.title || '',
        description: editingData?.description || '',
        emoji: editingData?.emoji || '🏆',
        duration_days: editingData?.duration_days || 14,
        start_date: editingData?.start_date?.split('T')[0] || today,
        end_date: editingData?.end_date?.split('T')[0] || '',
        is_active: editingData?.is_active ?? true,
        prize_pool_coins: editingData?.prize_pool_coins || 0,
        entry_fee_coins: editingData?.entry_fee_coins || 0,
        max_participants: editingData?.max_participants || '',
        rewards_json: editingData?.rewards_json || null,
    })
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [aiError, setAiError] = useState('')

    // Auto-calc end_date from start_date + duration
    const calcEndDate = () => {
        if (!form.start_date) return
        const d = new Date(form.start_date)
        d.setDate(d.getDate() + Number(form.duration_days))
        setForm(f => ({ ...f, end_date: d.toISOString().split('T')[0] }))
    }

    const generateWithAI = async () => {
        setGenerating(true); setAiError('')
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'generate-challenge',
                    context: form.title ? `Melhore este desafio: "${form.title}"` : 'Sugira um desafio de saúde e nutrição criativo para um clube de mulheres',
                    prompt: 'Gere um desafio gamificado com título, descrição e duração sugerida.'
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setForm(f => ({
                ...f,
                title: data.title || f.title,
                description: data.description || f.description,
                emoji: data.emoji || f.emoji,
                duration_days: data.duration_days || f.duration_days,
            }))
        } catch (err: any) {
            setAiError(err.message)
        } finally { setGenerating(false) }
    }

    const handleSave = async () => {
        if (!form.title) return
        setSaving(true)
        const endDate = form.end_date || (() => {
            const d = new Date(form.start_date)
            d.setDate(d.getDate() + Number(form.duration_days))
            return d.toISOString().split('T')[0]
        })()

        const payload: any = {
            title: form.title,
            description: form.description || null,
            emoji: form.emoji,
            duration_days: Number(form.duration_days),
            start_date: form.start_date,
            end_date: endDate,
            is_active: form.is_active,
            prize_pool_coins: Number(form.prize_pool_coins) || 0,
            entry_fee_coins: Number(form.entry_fee_coins) || 0,
            max_participants: form.max_participants ? Number(form.max_participants) : null,
            rewards_json: form.rewards_json,
            tenant_id: tenantId,
        }

        const result = isEditing && onUpdate
            ? await onUpdate(editingData.id, payload)
            : await onSave(payload)
        setSaving(false)
        if (result?.error) { alert('Erro: ' + result.error); return }
        onClose()
    }

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6">

            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">{isEditing ? 'Editar Desafio' : 'Novo Desafio'}</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
                    <X size={18} className="text-slate-400" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left col */}
                <div className="space-y-4">
                    {/* AI */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Bot size={13} className="text-amber-400" />
                            <span className="text-xs font-bold text-amber-400">Gerar com IA</span>
                        </div>
                        <button onClick={generateWithAI} disabled={generating}
                            className="w-full py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all">
                            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            {generating ? 'Gerando...' : form.title ? 'Melhorar com IA' : 'Sugerir desafio'}
                        </button>
                        {aiError && <p className="text-[10px] text-rose-400 mt-1.5">{aiError}</p>}
                    </div>

                    {/* Emoji + Title */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Ícone</label>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                                    className={`w-9 h-9 rounded-xl text-lg transition-all ${form.emoji === e ? 'bg-amber-600 scale-110' : 'bg-white/5 hover:bg-white/10'}`}>
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Título *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50"
                            placeholder="Ex: Desafio 21 Dias Sem Açúcar" />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Descrição</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none h-24"
                            placeholder="Objetivo e regras do desafio..." />
                    </div>
                </div>

                {/* Right col */}
                <div className="space-y-4">
                    {/* Duration quick picks */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Duração</label>
                        <div className="flex gap-2 flex-wrap mb-2">
                            {DURATIONS.map(d => (
                                <button key={d} onClick={() => setForm(f => ({ ...f, duration_days: d }))}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all
                                        ${form.duration_days === d ? 'bg-amber-600 border-amber-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>
                                    {d} dias
                                </button>
                            ))}
                            <input type="number" min="1" max="365" value={form.duration_days}
                                onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 7 }))}
                                className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-amber-500/50"
                                placeholder="dias" />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Início</label>
                            <input type="date" value={form.start_date}
                                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Término</label>
                                <button onClick={calcEndDate} className="text-[9px] text-amber-500 hover:text-amber-400 font-bold">
                                    Auto-calcular
                                </button>
                            </div>
                            <input type="date" value={form.end_date}
                                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                        </div>
                    </div>

                    {/* Gamification */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Gamificação</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-600 mb-1 block">Pool de prêmio 🪙</label>
                                <input type="number" min="0" value={form.prize_pool_coins}
                                    onChange={e => setForm(f => ({ ...f, prize_pool_coins: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                    placeholder="NutriCoins" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-600 mb-1 block">Máx. participantes</label>
                                <input type="number" min="0" value={form.max_participants}
                                    onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                    placeholder="Ilimitado" />
                            </div>
                        </div>
                    </div>

                    {/* Active toggle */}
                    <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all
                            ${form.is_active ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}>
                        <div className="text-left">
                            <p className="text-sm font-bold text-white">Ativar desafio</p>
                            <p className="text-[10px] text-slate-500">Ficará visível para as rainhas</p>
                        </div>
                        {form.is_active
                            ? <ToggleRight size={22} className="text-emerald-400 flex-shrink-0" />
                            : <ToggleLeft size={22} className="text-slate-600 flex-shrink-0" />}
                    </button>
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-400 text-sm font-bold hover:bg-white/5 transition-all">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.title}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2 transition-all">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {isEditing ? 'Atualizar' : 'Criar'} desafio
                </button>
            </div>
        </motion.div>
    )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function ChallengesView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
    const { challenges, loading, createChallenge, updateChallenge, deleteChallenge } = useChallenges()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<any>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'finished'>('all')
    const [participantStats, setParticipantStats] = useState<ParticipantStats>({})

    const loadParticipants = useCallback(async () => {
        if (!challenges.length) return
        const ids = challenges.map(c => c.id)
        const { data } = await supabase
            .from('challenge_participants')
            .select('challenge_id, rank')
            .in('challenge_id', ids)

        const s: ParticipantStats = {}
        for (const r of data || []) {
            if (!s[r.challenge_id]) s[r.challenge_id] = { total: 0, finished: 0 }
            s[r.challenge_id].total++
            if (r.rank && r.rank > 0) s[r.challenge_id].finished++
        }
        setParticipantStats(s)
    }, [challenges])

    useEffect(() => { loadParticipants() }, [loadParticipants])

    const handleToggle = async (id: string, active: boolean) => {
        await updateChallenge(id, { is_active: active })
    }

    const filtered = challenges.filter(c => {
        const ms = c.title.toLowerCase().includes(search.toLowerCase())
        const status = getChallengeStatus(c)
        const mf = filter === 'all' || status === filter
        return ms && mf
    })

    const activeCount = challenges.filter(c => getChallengeStatus(c) === 'active').length
    const statValues = Object.values(participantStats) as { total: number; finished: number }[]
    const totalParticipants = statValues.reduce((a, s) => a + s.total, 0)
    const avgCompletion = (() => {
        const withData = statValues.filter(s => s.total > 0)
        if (!withData.length) return null
        const avg = withData.reduce((a, s) => a + (s.finished / s.total), 0) / withData.length
        return Math.round(avg * 100)
    })()

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Jornadas & <span className="font-bold">Desafios</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Competições gamificadas que motivam suas rainhas.</p>
                </div>
                <button onClick={() => { setEditing(null); setShowForm(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-2xl transition-all">
                    <Plus size={15} /> Novo Desafio
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Desafios ativos', value: activeCount, color: 'text-emerald-400', icon: <Flame size={14} className="text-emerald-400" /> },
                    { label: 'Participantes', value: totalParticipants, color: 'text-indigo-400', icon: <Users size={14} className="text-indigo-400" /> },
                    { label: 'Taxa de conclusão', value: avgCompletion !== null ? `${avgCompletion}%` : '—', color: 'text-amber-400', icon: <Trophy size={14} className="text-amber-400" /> },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1">{s.icon}</div>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar desafio..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                </div>
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                    {([['all','Todos'],['active','Ativos'],['upcoming','Em breve'],['finished','Encerrados']] as const).map(([v,l]) => (
                        <button key={v} onClick={() => setFilter(v)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                ${filter === v ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
            </div>

            {/* Form */}
            <AnimatePresence>
                {showForm && (
                    <ChallengeForm
                        editingData={editing} tenantId={tenantId}
                        onSave={createChallenge} onUpdate={updateChallenge}
                        onClose={() => { setShowForm(false); setEditing(null) }}
                    />
                )}
            </AnimatePresence>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={28} /></div>
            ) : filtered.length === 0 && !showForm ? (
                <div className="text-center py-16">
                    <div className="text-4xl mb-3">🏆</div>
                    <p className="text-white font-bold mb-1">{search ? 'Nenhum resultado' : 'Nenhum desafio ainda'}</p>
                    <p className="text-slate-500 text-sm mb-4">{search ? 'Tente outro termo' : 'Crie o primeiro desafio do clube'}</p>
                    {!search && <button onClick={() => { setEditing(null); setShowForm(true) }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl transition-all">
                        <Plus size={14} /> Criar agora
                    </button>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(c => (
                        <ChallengeCard key={c.id} challenge={c}
                            participants={participantStats[c.id]}
                            onEdit={ch => { setEditing(ch); setShowForm(true) }}
                            onDelete={deleteChallenge}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
