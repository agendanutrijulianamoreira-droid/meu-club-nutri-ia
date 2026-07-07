"use client"

import React, { useState, useEffect } from 'react'
import {
    ClipboardList, Plus, Trash2, ChevronDown, ChevronUp,
    Loader2, Edit2, Check, X, Eye, Users, ToggleLeft, ToggleRight,
    GripVertical, Type, AlignLeft, List, ToggleRight as ToggleIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase-browser'

interface QuestionnairesViewProps {
    setView: (v: any) => void
    tenantId?: string
}

interface Question {
    id?: string
    question_text: string
    question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'yesno' | 'scale'
    question_order: number
    options?: string[]
    is_required: boolean
}

interface Questionnaire {
    id: string
    name: string
    description: string | null
    is_active: boolean
    estimated_minutes: number
    total_respondents: number
    response_rate_pct: number
    created_at: string
    questions?: Question[]
}

interface Response {
    id: string
    created_at: string
    answers: Record<string, string | string[]>
    patient: { name: string; email: string }
}

const QUESTION_TYPES: { value: Question['question_type']; label: string; icon: typeof Type }[] = [
    { value: 'text', label: 'Resposta curta', icon: Type },
    { value: 'textarea', label: 'Resposta longa', icon: AlignLeft },
    { value: 'select', label: 'Escolha única', icon: List },
    { value: 'multiselect', label: 'Múltipla escolha', icon: List },
    { value: 'yesno', label: 'Sim / Não', icon: ToggleIcon },
    { value: 'scale', label: 'Escala 1-10', icon: Type },
]

export function QuestionnairesView({ setView, tenantId }: QuestionnairesViewProps) {
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Questionnaire | null>(null)
    const [mode, setMode] = useState<'list' | 'edit' | 'responses'>('list')
    const [responses, setResponses] = useState<Response[]>([])
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    const [saving, setSaving] = useState(false)

    // Edit state
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [editMinutes, setEditMinutes] = useState(5)
    const [questions, setQuestions] = useState<Question[]>([])

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => { loadQuestionnaires() }, [])

    const loadQuestionnaires = async () => {
        setLoading(true)
        if (!tenantId) { setLoading(false); return }
        const { data } = await supabase
            .from('questionnaires')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
        setQuestionnaires((data as Questionnaire[]) || [])
        setLoading(false)
    }

    const openNew = () => {
        setSelected(null)
        setEditName('')
        setEditDesc('')
        setEditMinutes(5)
        setQuestions([{ question_text: '', question_type: 'text', question_order: 0, is_required: true }])
        setMode('edit')
    }

    const openEdit = async (q: Questionnaire) => {
        setSelected(q)
        setEditName(q.name)
        setEditDesc(q.description || '')
        setEditMinutes(q.estimated_minutes || 5)
        const { data } = await supabase
            .from('questionnaire_questions')
            .select('*')
            .eq('questionnaire_id', q.id)
            .order('question_order')
        setQuestions((data as Question[]) || [])
        setMode('edit')
    }

    const openResponses = async (q: Questionnaire) => {
        setSelected(q)
        const { data } = await supabase
            .from('questionnaire_responses')
            .select(`id, created_at, answers, patient:profiles!patient_id(name, email)`)
            .eq('questionnaire_id', q.id)
            .order('created_at', { ascending: false })
        setResponses((data as any) || [])
        setMode('responses')
    }

    const saveQuestionnaire = async () => {
        if (!editName.trim()) { showToast('Nome obrigatório', 'error'); return }
        if (questions.some(q => !q.question_text.trim())) { showToast('Preencha todas as perguntas', 'error'); return }
        setSaving(true)
        try {
            let qId = selected?.id
            if (!qId) {
                const { data, error } = await supabase.from('questionnaires').insert({
                    tenant_id: tenantId,
                    name: editName,
                    description: editDesc || null,
                    estimated_minutes: editMinutes,
                    is_active: true,
                }).select('id').single()
                if (error) throw error
                qId = data.id
            } else {
                await supabase.from('questionnaires').update({
                    name: editName, description: editDesc || null, estimated_minutes: editMinutes,
                }).eq('id', qId)
            }

            // Upsert questions
            await supabase.from('questionnaire_questions').delete().eq('questionnaire_id', qId)
            await supabase.from('questionnaire_questions').insert(
                questions.map((q, i) => ({
                    questionnaire_id: qId,
                    tenant_id: tenantId,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    question_order: i,
                    options: q.options || null,
                    is_required: q.is_required,
                }))
            )

            showToast('Questionário salvo!')
            setMode('list')
            loadQuestionnaires()
        } catch (e: any) {
            showToast(e.message || 'Erro ao salvar', 'error')
        } finally { setSaving(false) }
    }

    const toggleActive = async (q: Questionnaire) => {
        await supabase.from('questionnaires').update({ is_active: !q.is_active }).eq('id', q.id)
        setQuestionnaires(prev => prev.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x))
    }

    const deleteQuestionnaire = async (id: string) => {
        if (!confirm('Excluir questionário? As respostas também serão apagadas.')) return
        await supabase.from('questionnaires').delete().eq('id', id)
        setQuestionnaires(prev => prev.filter(q => q.id !== id))
        showToast('Excluído')
    }

    const addQuestion = () => {
        setQuestions(prev => [...prev, {
            question_text: '', question_type: 'text',
            question_order: prev.length, is_required: true,
        }])
    }

    const updateQuestion = (i: number, patch: Partial<Question>) => {
        setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q))
    }

    const removeQuestion = (i: number) => {
        setQuestions(prev => prev.filter((_, idx) => idx !== i))
    }

    const copyLink = (id: string) => {
        const url = `${window.location.origin}/patient/questionnaire/${id}`
        navigator.clipboard.writeText(url)
        showToast('Link copiado!')
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5 pb-10">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Questionários <span className="font-bold">& Formulários</span></h1>
                    <p className="text-slate-400 text-sm mt-1">Crie formulários para coletar informações das pacientes</p>
                </div>
                {mode === 'list' && (
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                        <Plus size={15} /> Novo questionário
                    </button>
                )}
                {mode !== 'list' && (
                    <button onClick={() => setMode('list')}
                        className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                        <X size={15} /> Fechar
                    </button>
                )}
            </div>

            {/* List */}
            {mode === 'list' && (
                loading ? (
                    <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
                ) : questionnaires.length === 0 ? (
                    <div className="text-center py-16">
                        <ClipboardList size={48} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500">Nenhum questionário criado ainda.</p>
                        <button onClick={openNew} className="mt-3 text-indigo-400 text-sm hover:underline">Criar o primeiro</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questionnaires.map(q => (
                            <motion.div key={q.id} layout
                                className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 group hover:border-indigo-500/20 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h3 className="text-white font-bold">{q.name}</h3>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                q.is_active
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                    : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                                            }`}>{q.is_active ? 'Ativo' : 'Inativo'}</span>
                                        </div>
                                        {q.description && <p className="text-slate-500 text-sm mb-2">{q.description}</p>}
                                        <div className="flex items-center gap-3 text-xs text-slate-600">
                                            <span>{q.estimated_minutes} min estimados</span>
                                            <span>·</span>
                                            <span>{q.total_respondents || 0} respostas</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button onClick={() => toggleActive(q)} title={q.is_active ? 'Desativar' : 'Ativar'}
                                            className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-white transition-colors">
                                            {q.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                                        </button>
                                        <button onClick={() => openResponses(q)} title="Ver respostas"
                                            className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-indigo-400 transition-colors">
                                            <Users size={15} />
                                        </button>
                                        <button onClick={() => copyLink(q.id)} title="Copiar link"
                                            className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-emerald-400 transition-colors">
                                            <Check size={15} />
                                        </button>
                                        <button onClick={() => openEdit(q)} title="Editar"
                                            className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-white transition-colors">
                                            <Edit2 size={15} />
                                        </button>
                                        <button onClick={() => deleteQuestionnaire(q.id)} title="Excluir"
                                            className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-rose-400 transition-colors">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )
            )}

            {/* Edit / Create */}
            {mode === 'edit' && (
                <div className="space-y-5">
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            {selected ? 'Editar questionário' : 'Novo questionário'}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500 mb-1 block">Nome do questionário *</label>
                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                    placeholder="Ex: Formulário de Anamnese, Avaliação Pré-Consulta..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-500 mb-1 block">Descrição (opcional)</label>
                                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                                    placeholder="Instruções para a paciente..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Tempo estimado (min)</label>
                                <input type="number" min={1} max={60} value={editMinutes} onChange={e => setEditMinutes(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                            </div>
                        </div>
                    </div>

                    {/* Questions */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Perguntas</p>
                        <AnimatePresence>
                            {questions.map((q, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                                    className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="text-slate-600 text-sm font-black w-6 mt-3 flex-shrink-0">{i + 1}</span>
                                        <div className="flex-1 space-y-3">
                                            <input value={q.question_text}
                                                onChange={e => updateQuestion(i, { question_text: e.target.value })}
                                                placeholder="Texto da pergunta..."
                                                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                                            <div className="flex flex-wrap gap-2">
                                                {QUESTION_TYPES.map(t => (
                                                    <button key={t.value} onClick={() => updateQuestion(i, { question_type: t.value })}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                            q.question_type === t.value
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                        }`}>
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {(q.question_type === 'select' || q.question_type === 'multiselect') && (
                                                <div>
                                                    <label className="text-xs text-slate-500 mb-1 block">Opções (uma por linha)</label>
                                                    <textarea
                                                        value={(q.options || []).join('\n')}
                                                        onChange={e => updateQuestion(i, { options: e.target.value.split('\n').filter(Boolean) })}
                                                        rows={3} placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                                                        className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 resize-none" />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id={`req-${i}`} checked={q.is_required}
                                                    onChange={e => updateQuestion(i, { is_required: e.target.checked })}
                                                    className="w-4 h-4 rounded" />
                                                <label htmlFor={`req-${i}`} className="text-xs text-slate-400">Obrigatória</label>
                                            </div>
                                        </div>
                                        <button onClick={() => removeQuestion(i)} disabled={questions.length === 1}
                                            className="p-1.5 rounded-lg hover:bg-white/8 text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-30 flex-shrink-0 mt-2">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <button onClick={addQuestion}
                            className="w-full py-3 border border-dashed border-white/15 rounded-2xl text-slate-500 hover:text-white hover:border-indigo-500/40 text-sm flex items-center justify-center gap-2 transition-all">
                            <Plus size={14} /> Adicionar pergunta
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setMode('list')} className="px-5 py-2.5 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                            Cancelar
                        </button>
                        <button onClick={saveQuestionnaire} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Salvar questionário
                        </button>
                    </div>
                </div>
            )}

            {/* Responses */}
            {mode === 'responses' && selected && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-white font-bold">{selected.name}</h2>
                        <span className="text-slate-500 text-sm">· {responses.length} resposta{responses.length !== 1 ? 's' : ''}</span>
                    </div>

                    {responses.length === 0 ? (
                        <div className="text-center py-12">
                            <Users size={40} className="mx-auto text-slate-700 mb-3" />
                            <p className="text-slate-500 text-sm">Nenhuma resposta ainda.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {responses.map(r => (
                                <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-white font-bold text-sm">{(r.patient as any)?.name || 'Paciente'}</p>
                                        <p className="text-slate-600 text-xs">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(r.answers).map(([key, val]) => (
                                            <div key={key} className="grid grid-cols-2 gap-2 text-xs">
                                                <span className="text-slate-500">{key}</span>
                                                <span className="text-slate-300">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
