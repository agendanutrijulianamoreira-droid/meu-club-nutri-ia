"use client"

import { useState } from "react"
import { Plus, Sparkles, FileText, Clock, MoreVertical, Edit, Trash2, Copy, Loader2, X, Save, Calendar, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useProtocols } from "@/lib/hooks/useDatabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProtocolCalendar } from "@/components/admin/ProtocolCalendar"
import { supabase } from "@/lib/supabase"

export function ProtocolsView({ setView }: { setView: (v: any) => void }) {
    const router = useRouter()
    const { protocols, loading, createProtocol, updateProtocol, deleteProtocol, refresh } = useProtocols()
    const [showCreate, setShowCreate] = useState(false)
    const [editingProtocol, setEditingProtocol] = useState<any>(null)
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === protocols.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(protocols.map(p => p.id))
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Deseja realmente excluir ${selectedIds.length} protocolos?`)) return

        setIsBulkDeleting(true)
        try {
            const { error } = await supabase
                .from('protocols')
                .delete()
                .in('id', selectedIds)

            if (error) throw error
            setSelectedIds([])
            refresh()
        } catch (err: any) {
            alert("Erro ao excluir em lote: " + err.message)
        } finally {
            setIsBulkDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-queen-pink" size={48} />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Protocolos 📋</h1>
                        <p className="text-gray-400 mt-1">Dietas estruturadas que suas Rainhas seguem.</p>
                    </div>
                    {viewMode === 'list' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSelectAll}
                            className="text-xs font-bold text-gray-500 hover:text-white mt-8"
                        >
                            {selectedIds.length === protocols.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </Button>
                    )}
                </div>
                <div className="flex gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-queen-pink text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <List size={16} />
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'calendar' ? 'bg-queen-pink text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Calendar size={16} />
                            Calendário
                        </button>
                    </div>
                    <Link href="/admin/protocols/new">
                        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 border-0">
                            <Sparkles size={18} className="mr-2" />
                            Protocol Builder ✨
                        </Button>
                    </Link>
                    <Button
                        onClick={() => {
                            setEditingProtocol(null)
                            setShowCreate(true)
                        }}
                        variant="secondary"
                        className="border-white/10"
                    >
                        <Plus size={18} className="mr-2" />
                        Criação Rápida
                    </Button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {showCreate ? (
                    <CreateProtocolForm
                        onClose={() => {
                            setShowCreate(false)
                            setEditingProtocol(null)
                        }}
                        onSave={createProtocol}
                        onUpdate={updateProtocol}
                        editingData={editingProtocol}
                    />
                ) : viewMode === 'calendar' ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <ProtocolCalendar />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {protocols.map((protocol) => (
                            <ProtocolCard
                                key={protocol.id}
                                protocol={protocol}
                                isSelected={selectedIds.includes(protocol.id)}
                                onSelect={() => toggleSelect(protocol.id)}
                                onDelete={deleteProtocol}
                                onEdit={(p) => {
                                    router.push(`/admin/protocols/new?edit=${p.id}`)
                                }}
                                onDuplicate={async (p) => {
                                    await createProtocol({
                                        title: `${p.title} (Cópia)`,
                                        description: p.description,
                                        duration_days: p.duration_days,
                                        content_json: p.content_json,
                                        is_active: false,
                                        is_template: false,
                                        tenant_id: null
                                    })
                                }}
                            />
                        ))}

                        {/* Empty Add Card */}
                        <button
                            onClick={() => {
                                setEditingProtocol(null)
                                setShowCreate(true)
                            }}
                            className="glass-panel p-6 rounded-2xl border border-dashed border-white/20 hover:border-queen-pink/50 transition-all flex flex-col items-center justify-center gap-4 min-h-[200px] group"
                        >
                            <div className="h-16 w-16 rounded-full bg-queen-pink/10 flex items-center justify-center group-hover:bg-queen-pink/20 transition-colors">
                                <Plus size={32} className="text-queen-pink" />
                            </div>
                            <p className="text-gray-400 group-hover:text-white transition-colors">Novo Protocolo</p>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-4 rounded-3xl border border-white/10 shadow-2xl flex items-center gap-8 bg-[#1a1744]/80 backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-queen-pink text-white flex items-center justify-center font-bold">
                                {selectedIds.length}
                            </div>
                            <span className="font-bold text-gray-200">Selecionados</span>
                        </div>

                        <div className="h-8 w-px bg-white/10" />

                        <div className="flex gap-4">
                            <Button
                                onClick={() => setSelectedIds([])}
                                variant="ghost"
                                className="text-gray-400 hover:text-white"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 rounded-xl"
                            >
                                {isBulkDeleting ? <Loader2 size={18} className="animate-spin mr-2" /> : <Trash2 size={18} className="mr-2" />}
                                Excluir em Lote
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function ProtocolCard({ protocol, isSelected, onSelect, onDelete, onEdit, onDuplicate }: {
    protocol: any,
    isSelected: boolean,
    onSelect: () => void,
    onDelete: (id: string) => Promise<any>,
    onEdit: (protocol: any) => void,
    onDuplicate: (protocol: any) => Promise<any>
}) {
    const [showMenu, setShowMenu] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [duplicating, setDuplicating] = useState(false)

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Tem certeza que deseja excluir este protocolo?')) return
        setDeleting(true)
        await onDelete(protocol.id)
        setDeleting(false)
    }

    const handleDuplicate = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setDuplicating(true)
        setShowMenu(false)
        await onDuplicate(protocol)
        setDuplicating(false)
    }

    return (
        <div
            onClick={onSelect}
            className={`glass-panel p-6 rounded-2xl border transition-all group relative cursor-pointer ${isSelected ? 'border-queen-pink bg-queen-pink/5 ring-1 ring-queen-pink' : 'border-white/5 hover:border-queen-pink/30'
                }`}
        >
            {/* Checkbox Overlay */}
            <div className={`absolute top-4 left-4 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-queen-pink border-queen-pink' : 'border-white/20 bg-black/20 group-hover:border-queen-pink/50'
                }`}>
                {isSelected && <div className="h-3 w-3 bg-white rounded-sm" />}
            </div>

            {/* Status Badge */}
            <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-bold
                ${protocol.is_active ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
            >
                {protocol.is_active ? 'ATIVO' : 'RASCUNHO'}
            </div>

            {/* Emoji */}
            <div className="text-4xl mb-4 mt-6">📋</div>

            {/* Title */}
            <h3 className="font-bold text-lg mb-2">{protocol.title}</h3>

            {/* Description */}
            {protocol.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{protocol.description}</p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {protocol.duration_days} dias
                </span>
                <span className="flex items-center gap-1">
                    <FileText size={14} />
                    {protocol.content_json?.length || 0} dias
                </span>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    onClick={() => onEdit(protocol)}
                >
                    <Edit size={16} className="mr-1" /> Editar
                </Button>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        disabled={deleting || duplicating}
                    >
                        {(deleting || duplicating) ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-2 bg-[#1a1744] border border-white/10 rounded-xl p-2 min-w-[150px] z-10">
                            <button
                                onClick={handleDuplicate}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-lg"
                            >
                                <Copy size={14} /> Duplicar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                            >
                                <Trash2 size={14} /> Excluir
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function CreateProtocolForm({ onClose, onSave, onUpdate, editingData }: {
    onClose: () => void,
    onSave: (data: any) => Promise<any>,
    onUpdate?: (id: string, data: any) => Promise<any>,
    editingData?: any
}) {
    const isEditing = !!editingData
    const [step, setStep] = useState(isEditing ? 2 : 1)
    const [formData, setFormData] = useState({
        title: editingData?.title || "",
        duration: editingData?.duration_days?.toString() || "7",
        description: editingData?.description || "",
        days: editingData?.content_json || []
    })
    const [selectedDay, setSelectedDay] = useState<number | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const generateWithAI = () => {
        setIsGenerating(true)
        setTimeout(() => {
            const daysCount = parseInt(formData.duration)
            const newDays = Array.from({ length: daysCount }).map((_, i) => ({
                day: i + 1,
                title: `Dia ${i + 1}: Meta Sugerida`,
                tasks: [
                    { title: "Beber 2L de água", type: "water", points: 10 },
                    { title: "Café da manhã proteico", type: "meal", points: 20 },
                    { title: "Foto do prato", type: "photo", points: 30 },
                ]
            }))
            setFormData(prev => ({ ...prev, days: newDays }))
            setStep(2)
            setIsGenerating(false)
        }, 2000)
    }

    const saveProtocol = async () => {
        setIsSaving(true)

        const protocolData = {
            title: formData.title,
            description: formData.description,
            duration_days: parseInt(formData.duration),
            content_json: formData.days,
            is_active: false,
            is_template: false,
            tenant_id: null
        }

        let result
        if (isEditing && onUpdate) {
            result = await onUpdate(editingData.id, protocolData)
        } else {
            result = await onSave(protocolData)
        }

        setIsSaving(false)

        if (result.error) {
            alert('Erro ao salvar: ' + result.error)
        } else {
            onClose()
        }
    }

    const updateDayTask = (dayIndex: number, taskIndex: number, field: string, value: any) => {
        const newDays = [...formData.days]
        newDays[dayIndex].tasks[taskIndex][field] = value
        setFormData({ ...formData, days: newDays })
    }

    const addTask = (dayIndex: number) => {
        const newDays = [...formData.days]
        newDays[dayIndex].tasks.push({ title: "", type: "custom", points: 10 })
        setFormData({ ...formData, days: newDays })
    }

    const removeTask = (dayIndex: number, taskIndex: number) => {
        const newDays = [...formData.days]
        newDays[dayIndex].tasks.splice(taskIndex, 1)
        setFormData({ ...formData, days: newDays })
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel p-8 rounded-2xl border border-white/10"
        >
            {/* Progress */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">
                    {isEditing ? "Editar Protocolo" : step === 1 ? "1. Definir Protocolo" : "2. Estrutura por Dia"}
                </h2>
                <Button variant="ghost" onClick={onClose} className="text-gray-400">
                    <X size={20} />
                </Button>
            </div>

            {step === 1 && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">Nome do Protocolo</label>
                        <input
                            type="text"
                            placeholder="Ex: Protocolo Detox Primavera"
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white text-lg focus:outline-none focus:border-queen-pink"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">Duração</label>
                        <div className="grid grid-cols-3 gap-4">
                            {['7', '14', '21'].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setFormData({ ...formData, duration: d })}
                                    className={`p-6 rounded-xl border transition-all text-center
                                        ${formData.duration === d
                                            ? 'bg-queen-pink text-white border-queen-pink'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                >
                                    <span className="text-3xl font-bold block">{d}</span>
                                    <span className="text-sm">DIAS</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-400 mb-2 block">Descrição (opcional)</label>
                        <textarea
                            placeholder="O que suas Rainhas vão conquistar com esse protocolo?"
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white h-24 resize-none focus:outline-none focus:border-queen-pink"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <Button
                        onClick={generateWithAI}
                        disabled={!formData.title || isGenerating}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-500 border-0 font-bold text-lg"
                    >
                        {isGenerating ? (
                            <><Sparkles className="animate-spin mr-2" /> Gerando Estrutura...</>
                        ) : (
                            <><Sparkles className="mr-2" /> Gerar com IA</>
                        )}
                    </Button>
                </div>
            )}

            {step === 2 && (
                <div className="grid grid-cols-12 gap-6 h-[500px]">
                    {/* Days List */}
                    <div className="col-span-4 bg-white/5 rounded-xl p-4 overflow-y-auto space-y-2">
                        {formData.days.map((day: any, idx: number) => (
                            <button
                                key={day.day}
                                onClick={() => setSelectedDay(idx)}
                                className={`w-full p-4 rounded-xl transition-colors text-left border
                                    ${selectedDay === idx
                                        ? 'bg-queen-pink/20 border-queen-pink'
                                        : 'bg-white/5 hover:bg-queen-pink/10 border-transparent hover:border-queen-pink/30'}`}
                            >
                                <span className="text-queen-pink text-xs font-bold">DIA {day.day}</span>
                                <h4 className="font-bold text-sm mt-1">{day.title}</h4>
                                <p className="text-xs text-gray-400 mt-1">{day.tasks.length} tarefas</p>
                            </button>
                        ))}
                    </div>

                    {/* Editor */}
                    <div className="col-span-8 bg-black/20 rounded-xl p-6 border border-white/5 overflow-y-auto">
                        {selectedDay !== null ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-400 mb-2 block">Título do Dia</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={formData.days[selectedDay].title}
                                        onChange={e => {
                                            const newDays = [...formData.days]
                                            newDays[selectedDay].title = e.target.value
                                            setFormData({ ...formData, days: newDays })
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-bold text-gray-400">Tarefas</label>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => addTask(selectedDay)}
                                            className="text-queen-pink"
                                        >
                                            <Plus size={14} className="mr-1" /> Adicionar
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.days[selectedDay].tasks.map((task: any, taskIdx: number) => (
                                            <div key={taskIdx} className="flex gap-2 items-start bg-white/5 p-3 rounded-lg">
                                                <input
                                                    type="text"
                                                    placeholder="Título da tarefa"
                                                    className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none"
                                                    value={task.title}
                                                    onChange={e => updateDayTask(selectedDay, taskIdx, 'title', e.target.value)}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Pts"
                                                    className="w-16 bg-black/20 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none"
                                                    value={task.points}
                                                    onChange={e => updateDayTask(selectedDay, taskIdx, 'points', parseInt(e.target.value))}
                                                />
                                                <button
                                                    onClick={() => removeTask(selectedDay, taskIdx)}
                                                    className="text-red-400 hover:bg-red-500/10 p-1 rounded"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-20">
                                👈 Clique em um dia para editar suas tarefas
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between">
                {step === 2 && !isEditing && (
                    <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-400">
                        Voltar
                    </Button>
                )}
                <div className="ml-auto flex gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400" disabled={isSaving}>
                        Cancelar
                    </Button>
                    {step === 2 && (
                        <Button
                            onClick={saveProtocol}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-500"
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin mr-2" /> Salvando...</>
                            ) : (
                                <><Save size={16} className="mr-2" /> {isEditing ? 'Atualizar' : 'Salvar'} Protocolo</>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
