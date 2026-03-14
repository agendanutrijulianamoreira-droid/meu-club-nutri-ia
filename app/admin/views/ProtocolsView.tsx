"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Plus, Sparkles, FileText, Clock, Edit3, Trash2, Copy,
    Loader2, X, Save, Search, ToggleLeft, ToggleRight,
    Users, ChevronRight, Bot, Zap, CheckCircle, AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useProtocols } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase"

const EMOJIS = ['📋','🥗','💪','🌿','🔥','💧','🎯','⭐','🏆','💎','🌱','🧘','🍎','🥦','✨']
const DURATIONS = ['7', '14', '21', '30', '45', '60']

interface ProtocolStats { [id: string]: { assignments: number; active: number } }

// ─── Protocol Card ─────────────────────────────────────────────────────────────
function ProtocolCard({ protocol, stats, onEdit, onDelete, onDuplicate, onToggleActive }: {
    protocol: any; stats?: { assignments: number; active: number }
    onEdit: (p: any) => void; onDelete: (id: string) => void
    onDuplicate: (p: any) => Promise<any>; onToggleActive: (id: string, active: boolean) => void
    key?: any
}) {
    const [deleting, setDeleting] = useState(false)
    const [duplicating, setDuplicating] = useState(false)
    const [toggling, setToggling] = useState(false)
    const emoji = protocol.emoji || '📋'
    const dayCount = protocol.content_json?.length || 0

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`bg-white/5 border rounded-3xl p-5 flex flex-col gap-4 group transition-all
                ${protocol.is_active ? 'border-white/10 hover:border-indigo-500/30' : 'border-white/5 opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl flex-shrink-0">{emoji}</div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{protocol.title}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock size={10}/> {protocol.duration_days}d
                            {dayCount > 0 && <> · <FileText size={10}/> {dayCount} dias</>}
                        </p>
                    </div>
                </div>
                <button onClick={async () => { setToggling(true); await onToggleActive(protocol.id, !protocol.is_active); setToggling(false) }}
                    disabled={toggling} className="flex-shrink-0 hover:scale-110 transition-all">
                    {toggling ? <Loader2 size={18} className="animate-spin text-slate-500"/>
                        : protocol.is_active ? <ToggleRight size={20} className="text-emerald-400"/>
                        : <ToggleLeft size={20} className="text-slate-600"/>}
                </button>
            </div>

            {protocol.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{protocol.description}</p>}

            <div className="flex items-center gap-3">
                {stats && <>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Users size={11} className="text-indigo-400"/> {stats.assignments} pacientes
                    </span>
                    {stats.active > 0 && <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                        <CheckCircle size={11}/> {stats.active} ativas
                    </span>}
                </>}
                <span className={`ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full
                    ${protocol.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-500'}`}>
                    {protocol.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <button onClick={() => onEdit(protocol)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-400 text-xs font-bold transition-all">
                    <Edit3 size={12}/> Editar
                </button>
                <button onClick={async () => { setDuplicating(true); await onDuplicate(protocol); setDuplicating(false) }}
                    disabled={duplicating}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    {duplicating ? <Loader2 size={13} className="animate-spin"/> : <Copy size={13}/>}
                </button>
                <button onClick={async () => { if (!confirm('Excluir este protocolo?')) return; setDeleting(true); await onDelete(protocol.id); setDeleting(false) }}
                    disabled={deleting}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all">
                    {deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                </button>
            </div>
        </motion.div>
    )
}

// ─── Protocol Form ─────────────────────────────────────────────────────────────
function ProtocolForm({ editingData, tenantId, onSave, onUpdate, onClose }: {
    editingData?: any; tenantId: string
    onSave: (d: any) => Promise<any>; onUpdate?: (id: string, d: any) => Promise<any>; onClose: () => void
}) {
    const isEditing = !!editingData?.id
    const [step, setStep] = useState(1)
    const [form, setForm] = useState({
        title: editingData?.title || '',
        description: editingData?.description || '',
        duration: DURATIONS.includes(String(editingData?.duration_days)) ? String(editingData?.duration_days) : editingData?.duration_days ? 'custom' : '21',
        customDuration: DURATIONS.includes(String(editingData?.duration_days)) ? '' : String(editingData?.duration_days || ''),
        emoji: editingData?.emoji || '📋',
        days: editingData?.content_json || [] as any[],
    })
    const [selectedDay, setSelectedDay] = useState<number | null>(null)
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [aiError, setAiError] = useState('')

    const duration = form.duration === 'custom' ? parseInt(form.customDuration) || 7 : parseInt(form.duration)

    const generateWithAI = async () => {
        if (!form.title) return
        setGenerating(true); setAiError('')
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'generate-protocol',
                    context: `Crie um protocolo de ${duration} dias: ${form.title}. ${form.description ? form.description : ''}`,
                    prompt: `Gere estrutura diária para "${form.title}" com ${duration} dias.`
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setForm(f => ({ ...f, title: data.title || f.title, description: data.description || f.description, days: data.days || [] }))
            setStep(2); setSelectedDay(0)
        } catch (err: any) {
            setAiError(err.message || 'Erro ao gerar')
        } finally { setGenerating(false) }
    }

    const handleSave = async () => {
        if (!form.title) return
        setSaving(true)
        const payload = {
            title: form.title, description: form.description || null, duration_days: duration,
            content_json: form.days, emoji: form.emoji, is_active: editingData?.is_active ?? false,
            is_template: false, tenant_id: tenantId || null,
        }
        const result = isEditing && onUpdate ? await onUpdate(editingData.id, payload) : await onSave(payload)
        setSaving(false)
        if (result?.error) { alert('Erro: ' + result.error); return }
        onClose()
    }

    const updateDayTask = (dIdx: number, tIdx: number, field: string, value: any) => {
        const newDays = form.days.map((d: any, i: number) => i !== dIdx ? d : {
            ...d, tasks: d.tasks.map((t: any, j: number) => j !== tIdx ? t : { ...t, [field]: value })
        })
        setForm(f => ({ ...f, days: newDays }))
    }

    const addTask = (dIdx: number) => setForm(f => ({
        ...f, days: f.days.map((d: any, i: number) => i !== dIdx ? d : { ...d, tasks: [...d.tasks, { title: '', type: 'custom', points: 10 }] })
    }))

    const removeTask = (dIdx: number, tIdx: number) => setForm(f => ({
        ...f, days: f.days.map((d: any, i: number) => i !== dIdx ? d : { ...d, tasks: d.tasks.filter((_: any, j: number) => j !== tIdx) })
    }))

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-lg font-bold text-white">{isEditing ? 'Editar Protocolo' : 'Novo Protocolo'}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        {[1,2].map(s => (
                            <button key={s} onClick={() => { if (s === 2 && !form.days.length) return; setStep(s) }}
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition-all
                                    ${step === s ? 'bg-indigo-600 text-white' : form.days.length || s === 1 ? 'text-slate-500 hover:text-slate-300' : 'text-slate-800 cursor-not-allowed'}`}>
                                {s === 1 ? '1. Definir' : '2. Estrutura'}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} className="text-slate-400"/></button>
            </div>

            {step === 1 && (
                <div className="space-y-5 max-w-2xl">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Ícone</p>
                            <div className="flex flex-wrap gap-1 w-44">
                                {EMOJIS.map(e => (
                                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                                        className={`w-9 h-9 rounded-xl text-lg transition-all ${form.emoji === e ? 'bg-indigo-600 scale-110' : 'bg-white/5 hover:bg-white/10'}`}>{e}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Nome *</label>
                                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    placeholder="Ex: Protocolo Detox Primavera"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Descrição</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-20"
                                    placeholder="O que suas rainhas vão conquistar?"/>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Duração</label>
                        <div className="flex flex-wrap gap-2">
                            {DURATIONS.map(d => (
                                <button key={d} onClick={() => setForm(f => ({ ...f, duration: d }))}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all
                                        ${form.duration === d ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>
                                    {d} dias
                                </button>
                            ))}
                            <button onClick={() => setForm(f => ({ ...f, duration: 'custom' }))}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all
                                    ${form.duration === 'custom' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>
                                Personalizado
                            </button>
                        </div>
                        {form.duration === 'custom' && (
                            <input type="number" min="1" max="365" value={form.customDuration}
                                onChange={e => setForm(f => ({ ...f, customDuration: e.target.value }))}
                                className="mt-2 w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Dias"/>
                        )}
                    </div>

                    {aiError && (
                        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                            <AlertCircle size={13}/> {aiError}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={generateWithAI} disabled={!form.title || generating}
                            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            {generating ? <Loader2 size={15} className="animate-spin"/> : <Bot size={15}/>}
                            {generating ? 'Gerando...' : 'Gerar estrutura com IA'}
                        </button>
                        {form.days.length > 0 && (
                            <button onClick={() => { setStep(2); setSelectedDay(0) }}
                                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-sm font-bold hover:bg-white/10 transition-all">
                                Ver estrutura <ChevronRight size={14}/>
                            </button>
                        )}
                    </div>
                    {!form.days.length && (
                        <button onClick={() => {
                            const d = Array.from({ length: duration }, (_, i) => ({ day: i + 1, title: `Dia ${i + 1}`, tasks: [{ title: '', type: 'custom', points: 10 }] }))
                            setForm(f => ({ ...f, days: d })); setStep(2); setSelectedDay(0)
                        }} disabled={!form.title}
                            className="w-full py-3 rounded-2xl border border-white/10 text-slate-400 text-sm font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                            <Zap size={14}/> Criar manualmente
                        </button>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="grid grid-cols-3 gap-4" style={{ height: 460 }}>
                    <div className="col-span-1 overflow-y-auto space-y-1 pr-1">
                        {form.days.map((day: any, idx: number) => (
                            <button key={idx} onClick={() => setSelectedDay(idx)}
                                className={`w-full px-3 py-2.5 rounded-xl text-left transition-all
                                    ${selectedDay === idx ? 'bg-indigo-600/20 border border-indigo-500/30 text-white' : 'bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:border-white/10'}`}>
                                <p className="text-[9px] font-black uppercase text-indigo-400">Dia {day.day}</p>
                                <p className="text-xs font-bold mt-0.5 truncate">{day.title || `Dia ${day.day}`}</p>
                                <p className="text-[9px] text-slate-600">{day.tasks?.length || 0} tarefas</p>
                            </button>
                        ))}
                    </div>
                    <div className="col-span-2 bg-white/[0.03] border border-white/5 rounded-2xl p-4 overflow-y-auto">
                        {selectedDay !== null && form.days[selectedDay] ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Título do Dia</label>
                                    <input value={form.days[selectedDay].title}
                                        onChange={e => {
                                            const newDays = form.days.map((d: any, i: number) => i !== selectedDay ? d : { ...d, title: e.target.value })
                                            setForm(f => ({ ...f, days: newDays }))
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tarefas</label>
                                        <button onClick={() => addTask(selectedDay)}
                                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                            <Plus size={11}/> Adicionar
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {form.days[selectedDay].tasks?.map((task: any, tIdx: number) => (
                                            <div key={tIdx} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                                                <input value={task.title} onChange={e => updateDayTask(selectedDay, tIdx, 'title', e.target.value)}
                                                    className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-slate-700"
                                                    placeholder="Título da tarefa"/>
                                                <input type="number" value={task.points} min="0"
                                                    onChange={e => updateDayTask(selectedDay, tIdx, 'points', parseInt(e.target.value) || 0)}
                                                    className="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-400 text-right focus:outline-none"/>
                                                <span className="text-[9px] text-slate-700">XP</span>
                                                <button onClick={() => removeTask(selectedDay, tIdx)} className="text-slate-700 hover:text-rose-400 transition-colors"><X size={13}/></button>
                                            </div>
                                        ))}
                                        {(!form.days[selectedDay].tasks || !form.days[selectedDay].tasks.length) && (
                                            <p className="text-xs text-slate-700 text-center py-3">Clique em Adicionar para criar tarefas</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-700 text-sm">← Selecione um dia</div>
                        )}
                    </div>
                </div>
            )}

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                {step === 2 && !isEditing && (
                    <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-300 text-sm font-bold">← Voltar</button>
                )}
                <div className="ml-auto flex gap-3">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-400 text-sm font-bold hover:bg-white/5 transition-all">Cancelar</button>
                    {(step === 2 || isEditing) && (
                        <button onClick={handleSave} disabled={saving || !form.title}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2 transition-all">
                            {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                            {isEditing ? 'Atualizar' : 'Salvar'} protocolo
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function ProtocolsView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
    const { protocols, loading, createProtocol, updateProtocol, deleteProtocol } = useProtocols()
    const [showForm, setShowForm] = useState(false)
    const [editingProtocol, setEditingProtocol] = useState<any>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [stats, setStats] = useState<ProtocolStats>({})

    useEffect(() => {
        const raw = sessionStorage.getItem('protocol_prefill')
        if (raw) {
            try { setEditingProtocol(JSON.parse(raw)); setShowForm(true); sessionStorage.removeItem('protocol_prefill') }
            catch { sessionStorage.removeItem('protocol_prefill') }
        }
    }, [])

    const loadStats = useCallback(async () => {
        if (!protocols.length) return
        const { data } = await supabase.from('protocol_assignments').select('protocol_id, status').in('protocol_id', protocols.map(p => p.id))
        const s: ProtocolStats = {}
        for (const r of data || []) {
            if (!s[r.protocol_id]) s[r.protocol_id] = { assignments: 0, active: 0 }
            s[r.protocol_id].assignments++
            if (r.status === 'active') s[r.protocol_id].active++
        }
        setStats(s)
    }, [protocols])

    useEffect(() => { loadStats() }, [loadStats])

    const filtered = protocols.filter(p => {
        const ms = p.title.toLowerCase().includes(search.toLowerCase())
        const mf = filter === 'all' || (filter === 'active' ? p.is_active : !p.is_active)
        return ms && mf
    })

    const totalActive = protocols.filter(p => p.is_active).length
    const totalAssign = Object.values(stats).reduce((a: number, s) => a + (s as { assignments: number; active: number }).assignments, 0)

    return (
        <div className="space-y-5 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Bio<span className="font-bold">-Protocolos</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Dietas estruturadas que suas rainhas seguem.</p>
                </div>
                <button onClick={() => { setEditingProtocol(null); setShowForm(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl transition-all">
                    <Plus size={15}/> Novo Protocolo
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {[['Total', protocols.length, 'text-white'],['Ativos', totalActive, 'text-emerald-400'],['Atribuições', totalAssign, 'text-indigo-400']].map(([l,v,c]) => (
                    <div key={l as string} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{l as string}</p>
                        <p className={`text-2xl font-bold mt-0.5 ${c as string}`}>{v as number}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
                </div>
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                    {([['all','Todos'],['active','Ativos'],['inactive','Inativos']] as const).map(([v,l]) => (
                        <button key={v} onClick={() => setFilter(v)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                ${filter === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <ProtocolForm
                        editingData={editingProtocol} tenantId={tenantId}
                        onSave={createProtocol} onUpdate={updateProtocol}
                        onClose={() => { setShowForm(false); setEditingProtocol(null) }}
                    />
                )}
            </AnimatePresence>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={28}/></div>
            ) : filtered.length === 0 && !showForm ? (
                <div className="text-center py-16">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-white font-bold mb-1">{search ? 'Nenhum resultado' : 'Nenhum protocolo ainda'}</p>
                    <p className="text-slate-500 text-sm mb-4">{search ? 'Tente outro termo' : 'Crie seu primeiro protocolo'}</p>
                    {!search && <button onClick={() => { setEditingProtocol(null); setShowForm(true) }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl">
                        <Plus size={14}/> Criar agora
                    </button>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(p => (
                        <ProtocolCard key={p.id} protocol={p} stats={stats[p.id]}
                            onEdit={protocol => { setEditingProtocol(protocol); setShowForm(true) }}
                            onDelete={deleteProtocol}
                            onDuplicate={async (p) => createProtocol({ title: `${p.title} (Cópia)`, description: p.description, duration_days: p.duration_days, content_json: p.content_json, is_active: false, is_template: false, tenant_id: tenantId || null } as any)}
                            onToggleActive={(id, active) => updateProtocol(id, { is_active: active })}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
