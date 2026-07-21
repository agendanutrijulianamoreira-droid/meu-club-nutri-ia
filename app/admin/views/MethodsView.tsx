"use client"

import { useState } from "react"
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Pencil } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useMethods, Method, MethodPhase } from "@/lib/hooks/useMethods"

interface MethodsViewProps {
    setView: (v: any) => void
    tenantId?: string
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
        </button>
    )
}

function PhaseRow({ phase, methodId, onSave, onDelete }: {
    phase: MethodPhase
    methodId: string
    onSave: (id: string, methodId: string, updates: Partial<Pick<MethodPhase, 'name' | 'description' | 'sort_order'>>) => Promise<any>
    onDelete: (id: string, methodId: string) => Promise<any>
}) {
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(phase.name)
    const [description, setDescription] = useState(phase.description ?? '')
    const [saving, setSaving] = useState(false)

    const save = async () => {
        if (!name.trim()) return
        setSaving(true)
        await onSave(phase.id, methodId, { name: name.trim(), description: description.trim() || null })
        setSaving(false)
        setEditing(false)
    }

    if (editing) {
        return (
            <div className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="flex-1 space-y-2">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da fase"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <button onClick={save} disabled={saving || !name.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : 'Salvar'}
                </button>
                <button onClick={() => setEditing(false)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold rounded-xl transition-all">
                    Cancelar
                </button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3 bg-white/[0.02] border border-white/8 rounded-2xl p-3 group">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400 flex-shrink-0">
                Fase {phase.sort_order + 1}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{phase.name}</p>
                {phase.description && <p className="text-xs text-slate-500 truncate">{phase.description}</p>}
            </div>
            <button onClick={() => setEditing(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                <Pencil size={12} />
            </button>
            <button onClick={() => { if (confirm(`Remover a fase "${phase.name}"?`)) onDelete(phase.id, methodId) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={12} />
            </button>
        </div>
    )
}

function MethodCard({ method, tenantId, createPhase, updatePhase, deletePhase, updateMethod, deleteMethod }: {
    method: Method
    tenantId: string
    createPhase: ReturnType<typeof useMethods>['createPhase']
    updatePhase: ReturnType<typeof useMethods>['updatePhase']
    deletePhase: ReturnType<typeof useMethods>['deletePhase']
    updateMethod: ReturnType<typeof useMethods>['updateMethod']
    deleteMethod: ReturnType<typeof useMethods>['deleteMethod']
}) {
    const [expanded, setExpanded] = useState(true)
    const [addingPhase, setAddingPhase] = useState(false)
    const [newPhaseName, setNewPhaseName] = useState('')
    const [savingPhase, setSavingPhase] = useState(false)

    const addPhase = async () => {
        if (!newPhaseName.trim()) return
        setSavingPhase(true)
        await createPhase({
            method_id: method.id,
            tenant_id: tenantId,
            name: newPhaseName.trim(),
            sort_order: method.method_phases.length,
        })
        setNewPhaseName('')
        setAddingPhase(false)
        setSavingPhase(false)
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 transition-all hover:border-indigo-500/30">
            <div className="flex items-center justify-between">
                <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    {expanded ? <ChevronUp size={16} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-white font-bold truncate">{method.name}</p>
                        {method.description && <p className="text-xs text-slate-500 truncate">{method.description}</p>}
                    </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500">{method.method_phases.length} fase{method.method_phases.length === 1 ? '' : 's'}</span>
                    <Toggle on={method.is_active} onToggle={() => updateMethod(method.id, { is_active: !method.is_active })} />
                    <button onClick={() => { if (confirm(`Remover o método "${method.name}" e todas as suas fases?`)) deleteMethod(method.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-all">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                        {method.method_phases.map(phase => (
                            <PhaseRow key={phase.id} phase={phase} methodId={method.id} onSave={updatePhase} onDelete={deletePhase} />
                        ))}

                        {addingPhase ? (
                            <div className="flex items-center gap-2">
                                <input value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
                                    placeholder="Nome da nova fase (ex: Corrigindo a Rota)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                                <button onClick={addPhase} disabled={savingPhase || !newPhaseName.trim()}
                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                                    {savingPhase ? <Loader2 size={12} className="animate-spin" /> : 'Adicionar'}
                                </button>
                                <button onClick={() => setAddingPhase(false)}
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold rounded-xl transition-all">
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setAddingPhase(true)}
                                className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 px-1 pt-1 transition-all">
                                <Plus size={13} /> Nova fase
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function MethodsView({ tenantId = '' }: MethodsViewProps) {
    const { methods, loading, error, createMethod, updateMethod, deleteMethod, createPhase, updatePhase, deletePhase } = useMethods()
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [creatingMethod, setCreatingMethod] = useState(false)
    const [newMethodName, setNewMethodName] = useState('')
    const [savingMethod, setSavingMethod] = useState(false)

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }

    const handleCreateMethod = async () => {
        if (!newMethodName.trim() || !tenantId) return
        setSavingMethod(true)
        const { error } = await createMethod({ name: newMethodName.trim(), tenant_id: tenantId })
        setSavingMethod(false)
        if (error) {
            showToast('error', error)
        } else {
            showToast('success', 'Método criado!')
            setNewMethodName('')
            setCreatingMethod(false)
        }
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">
                        Método <span className="font-bold">Clínico</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Fase = etapa da jornada da paciente. Protocolos, dietas e metas vivem dentro de cada fase.
                    </p>
                </div>
                <button onClick={() => setCreatingMethod(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                    <Plus size={15} />
                    Novo Método
                </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border
                            ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {creatingMethod && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-2">
                    <input value={newMethodName} onChange={e => setNewMethodName(e.target.value)}
                        placeholder="Nome do método (ex: Método Corpo de Rainha)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    <button onClick={handleCreateMethod} disabled={savingMethod || !newMethodName.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {savingMethod ? <Loader2 size={12} className="animate-spin" /> : 'Criar'}
                    </button>
                    <button onClick={() => setCreatingMethod(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold rounded-xl transition-all">
                        Cancelar
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
            )}

            {error && (
                <p className="text-sm text-rose-400">{error}</p>
            )}

            {!loading && methods.length === 0 && (
                <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-10 text-center">
                    <p className="text-white font-bold mb-1">Nenhum método cadastrado</p>
                    <p className="text-slate-500 text-sm mb-4">Crie o método clínico da sua clínica e organize suas fases da jornada.</p>
                    <button onClick={() => setCreatingMethod(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                        <Plus size={15} /> Criar Método
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {methods.map(method => (
                    <MethodCard
                        key={method.id}
                        method={method}
                        tenantId={tenantId}
                        createPhase={createPhase}
                        updatePhase={updatePhase}
                        deletePhase={deletePhase}
                        updateMethod={updateMethod}
                        deleteMethod={deleteMethod}
                    />
                ))}
            </div>
        </div>
    )
}
