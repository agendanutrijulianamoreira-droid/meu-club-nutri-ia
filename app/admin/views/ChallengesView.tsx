"use client"

import { useState } from "react"
import { Plus, Trophy, Clock, Users, Flame, Target, Sparkles, Edit, Trash2, ChevronRight, Loader2, X, CheckCircle, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useChallenges } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export function ChallengesView({ setView }: { setView: (v: any) => void }) {
    const { challenges, loading, createChallenge, updateChallenge, deleteChallenge, refresh } = useChallenges()
    const [showCreate, setShowCreate] = useState(false)
    const [editingChallenge, setEditingChallenge] = useState<any>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === challenges.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(challenges.map(c => c.id))
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Deseja realmente excluir ${selectedIds.length} desafios?`)) return

        setIsBulkDeleting(true)
        try {
            const { error } = await supabase
                .from('challenges')
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

    const activeCount = challenges.filter(c => c.is_active).length
    const totalParticipants = 0

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Desafios 🏆</h1>
                        <p className="text-gray-400 mt-1">Competições gamificadas que motivam suas Rainhas.</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="text-xs font-bold text-gray-500 hover:text-white mt-8"
                    >
                        {selectedIds.length === challenges.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </Button>
                </div>
                <Link href="/admin/desafios/builder">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 border-0">
                        <Rocket size={18} className="mr-2" />
                        Construir Desafio
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Flame size={24} className="text-green-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{activeCount}</p>
                        <p className="text-sm text-gray-400">Desafios Ativos</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Target size={24} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{totalParticipants}</p>
                        <p className="text-sm text-gray-400">Participantes Ativos</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Trophy size={24} className="text-yellow-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">--</p>
                        <p className="text-sm text-gray-400">Taxa de Conclusão</p>
                    </div>
                </div>
            </div>

            {/* Challenges Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((challenge) => (
                    <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        isSelected={selectedIds.includes(challenge.id)}
                        onSelect={() => toggleSelect(challenge.id)}
                        onEdit={(c) => setEditingChallenge(c)}
                        onDelete={deleteChallenge}
                    />
                ))}

                {/* Add New */}
                <button
                    onClick={() => setShowCreate(true)}
                    className="glass-panel p-6 rounded-2xl border border-dashed border-white/20 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-4 min-h-[250px] group"
                >
                    <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                        <Plus size={32} className="text-purple-500" />
                    </div>
                    <p className="text-gray-400 group-hover:text-white transition-colors">Criar Desafio</p>
                </button>
            </div>

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
                            <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
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

            {/* Create/Edit Challenge Modal */}
            <AnimatePresence>
                {(showCreate || editingChallenge) && (
                    <ChallengeModal
                        challenge={editingChallenge}
                        onClose={() => {
                            setShowCreate(false)
                            setEditingChallenge(null)
                        }}
                        onSave={async (data) => {
                            if (editingChallenge) {
                                const result = await updateChallenge(editingChallenge.id, data)
                                if (!result.error) {
                                    setEditingChallenge(null)
                                } else {
                                    alert("Erro ao atualizar: " + result.error)
                                }
                            } else {
                                const result = await createChallenge(data)
                                if (!result.error) {
                                    setShowCreate(false)
                                } else {
                                    alert("Erro ao criar: " + result.error)
                                }
                            }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ==========================================
// CHALLENGE MODAL (CREATE/EDIT)
// ==========================================

function ChallengeModal({
    challenge,
    onClose,
    onSave
}: {
    challenge?: any
    onClose: () => void
    onSave: (data: any) => Promise<void>
}) {
    const isEditing = !!challenge
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [formData, setFormData] = useState({
        title: challenge?.title || "",
        description: challenge?.description || "",
        emoji: challenge?.emoji || "🏆",
        duration_days: challenge?.duration_days || 7,
        start_date: challenge?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        end_date: challenge?.end_date?.split('T')[0] || "",
        is_active: challenge?.is_active ?? true,
        rewards_json: challenge?.rewards_json || null
    })

    const EMOJI_OPTIONS = ["🏆", "🔥", "💪", "🥗", "💧", "🏃", "🧘", "✨", "🌟", "🎯", "🚀", "👑"]

    const handleSubmit = async () => {
        if (!formData.title) {
            alert("Digite um título para o desafio")
            return
        }

        setSaving(true)

        try {
            // Get tenant_id
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .limit(1)
                .single()

            if (!tenant) {
                alert("Erro: Nenhum tenant configurado")
                setSaving(false)
                return
            }

            // Calculate end_date if not set
            const startDate = new Date(formData.start_date)
            const endDate = formData.end_date
                ? formData.end_date
                : new Date(startDate.getTime() + (formData.duration_days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]

            await onSave({
                ...formData,
                end_date: endDate,
                tenant_id: tenant.id
            })
        } catch (error: any) {
            alert("Erro ao criar desafio: " + error.message)
        } finally {
            setSaving(false)
        }
    }


    const generateWithAI = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'generate-challenge',
                    context: `Sugira um desafio para o app "Meu Club Nutri".`,
                    prompt: `Gere um novo desafio gamificado criativo.`
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setFormData(prev => ({
                ...prev,
                title: data.title || prev.title,
                description: data.description || prev.description,
                emoji: data.emoji || prev.emoji,
                duration_days: data.duration_days || prev.duration_days
            }));
        } catch (err: any) {
            alert("Erro na IA: " + err.message);
        } finally {
            setGenerating(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-panel p-8 rounded-3xl border border-white/10 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Trophy className="text-purple-400" />
                            {isEditing ? 'Editar Desafio' : 'Criar Novo Desafio'}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">{isEditing ? 'Modifique os detalhes do desafio.' : 'Crie uma competição gamificada para suas Rainhas.'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
                        <X size={24} />
                    </button>
                </div>

                {/* AI Generate Button */}
                <Button
                    onClick={generateWithAI}
                    disabled={generating}
                    variant="ghost"
                    className="w-full border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                    {generating ? (
                        <Loader2 size={18} className="animate-spin mr-2" />
                    ) : (
                        <Sparkles size={18} className="mr-2" />
                    )}
                    {generating ? "Gerando com IA..." : "Gerar Sugestão com IA"}
                </Button>

                {/* Form */}
                <div className="space-y-5">
                    {/* Emoji Selector */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Emoji do Desafio</label>
                        <div className="flex flex-wrap gap-2">
                            {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => setFormData({ ...formData, emoji })}
                                    className={`text-3xl p-2 rounded-xl transition-all ${formData.emoji === emoji
                                        ? 'bg-purple-500/30 ring-2 ring-purple-500'
                                        : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Título do Desafio *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Desafio 21 Dias Sem Açúcar"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-lg font-bold focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Descrição</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descreva o objetivo e regras do desafio..."
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 resize-none"
                        />
                    </div>

                    {/* Duration & Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Duração (dias)</label>
                            <input
                                type="number"
                                min={1}
                                value={formData.duration_days}
                                onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 7 })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-center font-bold focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Início</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Término</label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                placeholder="Auto"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${formData.is_active ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'
                            }`}
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    >
                        <div>
                            <p className="font-bold">Ativar Imediatamente</p>
                            <p className="text-xs text-gray-500">O desafio ficará visível para as Rainhas</p>
                        </div>
                        <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-gray-600'
                            }`}>
                            <motion.div
                                className="bg-white w-4 h-4 rounded-full shadow-md"
                                animate={{ x: formData.is_active ? 24 : 0 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 border-t border-white/5">
                    <Button variant="ghost" onClick={onClose} className="flex-1 text-gray-400">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving || !formData.title}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 font-bold"
                    >
                        {saving ? (
                            <Loader2 size={18} className="animate-spin mr-2" />
                        ) : (
                            <CheckCircle size={18} className="mr-2" />
                        )}
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Desafio"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    )
}


function ChallengeCard({ challenge, isSelected, onSelect, onEdit, onDelete }: {
    challenge: any,
    isSelected: boolean,
    onSelect: () => void,
    onEdit: (challenge: any) => void,
    onDelete: (id: string) => Promise<any>
}) {
    const today = new Date()
    const startDate = challenge.start_date ? new Date(challenge.start_date) : null
    const endDate = challenge.end_date ? new Date(challenge.end_date) : null

    let currentStatus = 'upcoming'
    if (!challenge.is_active) currentStatus = 'completed'
    else if (startDate && today >= startDate) {
        if (endDate && today > endDate) currentStatus = 'completed'
        else currentStatus = 'active'
    }

    const statusColors = {
        active: { bg: "bg-green-500/20", text: "text-green-400", label: "ATIVO" },
        upcoming: { bg: "bg-blue-500/20", text: "text-blue-400", label: "EM BREVE" },
        completed: { bg: "bg-gray-500/20", text: "text-gray-400", label: "FINALIZADO" },
    }
    const status = statusColors[currentStatus as keyof typeof statusColors]

    let progress = 0
    if (startDate && endDate && today > startDate) {
        const total = endDate.getTime() - startDate.getTime()
        const current = today.getTime() - startDate.getTime()
        progress = Math.min(100, Math.max(0, Math.round((current / total) * 100)))
    }

    return (
        <div
            onClick={onSelect}
            className={`glass-panel p-6 rounded-2xl border transition-all relative overflow-hidden group/card cursor-pointer ${isSelected ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500' : 'border-white/5 hover:border-purple-500/30'
                }`}
        >
            {/* Checkbox Overlay */}
            <div className={`absolute top-4 left-4 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-white/20 bg-black/20 group-hover/card:border-purple-500/50'
                }`}>
                {isSelected && <div className="h-3 w-3 bg-white rounded-sm" />}
            </div>

            {/* Actions Menu (Hover) */}
            <div className="absolute top-4 right-24 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <Link
                    href={`/admin/desafios/builder?id=${challenge.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                    <Edit size={16} />
                </Link>
                <button
                    onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm('Excluir este desafio?')) {
                            await onDelete(challenge.id)
                        }
                    }}
                    className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Status */}
            <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                {status.label}
            </div>

            {/* Emoji */}
            <div className="text-5xl mb-4 mt-6">{challenge.emoji || '🏆'}</div>

            {/* Title */}
            <h3 className="font-bold text-xl mb-2">{challenge.title}</h3>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {challenge.duration_days} dias
                </span>
                <span className="flex items-center gap-1 text-queen-pink">
                    <Users size={14} />
                    0 participando
                </span>
            </div>

            {/* Progress Bar */}
            {currentStatus === 'active' && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Progresso Temporal</span>
                        <span className="text-purple-400">{progress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Start Date */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                    {currentStatus === 'upcoming' ? '🗓️ Inicia em: ' : '🏁 Iniciado em: '}
                    {startDate ? startDate.toLocaleDateString('pt-BR') : '--'}
                </span>
                <ChevronRight size={16} className="text-gray-600 group-hover/card:text-queen-pink transition-colors" />
            </div>
        </div>
    )
}
