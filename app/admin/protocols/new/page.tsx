"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    ArrowLeft, Save, Sparkles, Plus, X, Trash2,
    Upload, Clock, Utensils, Coffee, Dumbbell, FileText, Droplet, Wand2, Loader2, Calendar
} from "lucide-react"
import { useProtocolBuilder, useAIWriter } from "@/lib/hooks/useProtocolBuilder"
import { generateProtocolWithAI } from "@/lib/ai-generator"
import { motion, AnimatePresence } from "framer-motion"

const BLOCK_TYPES = [
    { type: 'meal', label: 'Refeição', icon: Utensils, color: 'from-green-500 to-emerald-600' },
    { type: 'shot', label: 'Shot', icon: Coffee, color: 'from-orange-500 to-red-600' },
    { type: 'workout', label: 'Treino', icon: Dumbbell, color: 'from-blue-500 to-cyan-600' },
    { type: 'content', label: 'Conteúdo', icon: FileText, color: 'from-purple-500 to-pink-600' },
    { type: 'water', label: 'Hidratação', icon: Droplet, color: 'from-cyan-400 to-blue-500' },
]

const CATEGORIES = [
    { value: 'detox', label: '🌿 Detox', description: 'Desintoxicação e renovação' },
    { value: 'lowcarb', label: '💪 Low Carb', description: 'Redução de carboidratos' },
    { value: 'maintenance', label: '⚖️ Manutenção', description: 'Equilíbrio e sustentação' },
    { value: 'challenge', label: '🏆 Desafio', description: 'Meta específica' },
    { value: 'custom', label: '✨ Personalizado', description: 'Seu método único' },
]

export default function ProtocolBuilderPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editId = searchParams?.get('edit')

    const { saveProtocol, saving, protocol, loading } = useProtocolBuilder(editId || undefined)
    const { generateDescription, generating } = useAIWriter()

    // Form state
    const [formData, setFormData] = useState({
        title: protocol?.title || "",
        description: protocol?.description || "",
        duration: protocol?.duration_days || 7,
        category: protocol?.category || "custom",
        coverImage: protocol?.cover_image_url || "",
        startDate: protocol?.start_date || "",
        startTime: protocol?.start_time || "06:00",
        autoActivate: protocol?.auto_activate ?? true,
    })

    const [days, setDays] = useState<any[]>(
        Array.from({ length: 7 }).map((_, i) => ({
            day_number: i + 1,
            title: `Dia ${i + 1}`,
            subtitle: "",
            items: []
        }))
    )

    const [selectedDay, setSelectedDay] = useState(0)
    const [showMagicModal, setShowMagicModal] = useState(false)
    const [magicPrompt, setMagicPrompt] = useState("")
    const [magicDuration, setMagicDuration] = useState(7)
    const [generatingProtocol, setGeneratingProtocol] = useState(false)

    // Sync protocol data quando carregar do banco (para edição)
    useEffect(() => {
        if (protocol) {
            setFormData({
                title: protocol.title || "",
                description: protocol.description || "",
                duration: protocol.duration_days || 7,
                category: protocol.category || "custom",
                coverImage: protocol.cover_image_url || "",
                startDate: protocol.start_date || "",
                startTime: protocol.start_time || "06:00",
                autoActivate: protocol.auto_activate ?? true,
            })

            if (protocol.days && protocol.days.length > 0) {
                setDays(protocol.days)
            }
        }
    }, [protocol])

    // Magic AI Generator Function
    const handleMagicGenerate = async () => {
        if (!magicPrompt.trim()) {
            alert('Digite o objetivo do protocolo!')
            return
        }

        setGeneratingProtocol(true)

        const result = await generateProtocolWithAI(magicPrompt, magicDuration)

        setGeneratingProtocol(false)

        if (result.success && result.protocol) {
            // Auto-fill entire form!
            const p = result.protocol

            setFormData({
                title: p.title,
                description: p.description,
                duration: magicDuration,
                category: p.category || 'custom',
                coverImage: '',
                startDate: '',
                startTime: '06:00',
                autoActivate: true,
            })

            setDays(p.days)
            setSelectedDay(0)
            setShowMagicModal(false)
            setMagicPrompt("")

            alert('✨ Protocolo gerado! Revise e edite antes de salvar.')
        } else {
            alert('Erro ao gerar protocolo: ' + result.error)
        }
    }

    // Atualizar dias quando duração mudar
    const handleDurationChange = (newDuration: number) => {
        setFormData({ ...formData, duration: newDuration })
        const currentDays = days.length

        if (newDuration > currentDays) {
            // Adicionar dias
            const newDays = [...days]
            for (let i = currentDays; i < newDuration; i++) {
                newDays.push({
                    day_number: i + 1,
                    title: `Dia ${i + 1}`,
                    subtitle: "",
                    items: []
                })
            }
            setDays(newDays)
        } else if (newDuration < currentDays) {
            // Remover dias
            setDays(days.slice(0, newDuration))
            if (selectedDay >= newDuration) {
                setSelectedDay(newDuration - 1)
            }
        }
    }

    // AI Writer
    const handleAIGenerate = async () => {
        if (!formData.title) {
            alert('Digite um título primeiro!')
            return
        }
        const description = await generateDescription(formData.title, formData.category)
        setFormData({ ...formData, description })
    }

    // Adicionar bloco
    const addBlock = (type: string) => {
        const newDays = [...days]
        newDays[selectedDay].items.push({
            time: type === 'meal' ? '12:00' : null,
            type,
            title: "",
            description: "",
            ingredients: type === 'meal' ? [] : null,
            recipe: type === 'shot' ? "" : null,
            video_url: type === 'workout' ? "" : null,
            is_mandatory: true,
            points: 10,
            order_index: newDays[selectedDay].items.length
        })
        setDays(newDays)
    }

    // Remover bloco
    const removeBlock = (itemIndex: number) => {
        const newDays = [...days]
        newDays[selectedDay].items.splice(itemIndex, 1)
        setDays(newDays)
    }

    // Atualizar bloco
    const updateBlock = (itemIndex: number, field: string, value: any) => {
        const newDays = [...days]
        newDays[selectedDay].items[itemIndex][field] = value
        setDays(newDays)
    }

    // Salvar
    const handleSave = async () => {
        if (!formData.title) {
            alert('Título é obrigatório!')
            return
        }

        const result = await saveProtocol({
            title: formData.title,
            description: formData.description,
            duration_days: formData.duration,
            cover_image_url: formData.coverImage,
            category: formData.category,
            start_date: formData.startDate || null,
            start_time: formData.startTime || null,
            auto_activate: formData.autoActivate,
            days
        })

        if (result.success) {
            router.push('/admin?view=protocols')
        } else {
            alert('Erro ao salvar: ' + result.error)
        }
    }

    // Loading state para edição
    if (editId && loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] text-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin text-queen-pink mx-auto mb-4" size={48} />
                    <p className="text-gray-400">Carregando protocolo...</p>
                </div>
            </div>
        )
    }

    // Helper to open magic modal with pre-filled prompt
    const openMagicModal = () => {
        if (!magicPrompt && formData.title) {
            // Pegar a ideia central (título + descrição básica)
            setMagicPrompt(`${formData.title}${formData.description ? `: ${formData.description}` : ''}`)
        }
        setShowMagicModal(true)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1744] to-[#0f0c29] text-white pb-10">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/admin?view=protocols')}
                            className="text-gray-400"
                        >
                            <ArrowLeft size={20} className="mr-2" />
                            Voltar
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">
                                {editId ? '✏️ Editar Protocolo' : 'Protocol Builder ✨'}
                            </h1>
                            <p className="text-sm text-gray-400">
                                {editId ? 'Atualize seu protocolo' : 'Construa seu método passo a passo'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={openMagicModal}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 border-0"
                        >
                            <Wand2 size={18} className="mr-2" />
                            ✨ Gerar com IA
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !formData.title}
                            className="bg-gradient-to-r from-queen-pink to-purple-600 border-0"
                        >
                            <Save size={18} className="mr-2" />
                            {saving ? 'Salvando...' : 'Salvar Protocolo'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Magic AI Generator Modal */}
            <AnimatePresence>
                {showMagicModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="glass-panel max-w-2xl w-full p-8 rounded-2xl border border-white/20"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <Wand2 className="text-purple-400" />
                                        Magic Protocol Generator ✨
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Descreva o objetivo e deixe a IA criar todo o protocolo
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowMagicModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        Qual o objetivo deste protocolo?
                                    </label>
                                    <textarea
                                        placeholder="Ex: Protocolo detox pós-festas de 3 dias, focado em desinflamação intestinal, sem glúten e sem lactose, com shots matinais"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white h-32 resize-none focus:outline-none focus:border-purple-500"
                                        value={magicPrompt}
                                        onChange={e => setMagicPrompt(e.target.value)}
                                        disabled={generatingProtocol}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        Duração
                                    </label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[3, 7, 14, 21].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setMagicDuration(d)}
                                                disabled={generatingProtocol}
                                                className={`p-4 rounded-xl border transition-all
                                                    ${magicDuration === d
                                                        ? 'bg-purple-600 text-white border-purple-500'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                            >
                                                <div className="text-2xl font-bold">{d}</div>
                                                <div className="text-xs">dias</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                    <p className="text-sm text-purple-200">
                                        💡 <strong>Dica:</strong> Seja específico! Mencione alimentos, tipos de refeição, objetivos (emagrecer, desinflamar, energizar), restrições alimentares, etc.
                                    </p>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowMagicModal(false)}
                                        disabled={generatingProtocol}
                                        className="text-gray-400"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleMagicGenerate}
                                        disabled={!magicPrompt.trim() || generatingProtocol}
                                        className="bg-gradient-to-r from-purple-600 to-pink-600 border-0"
                                    >
                                        {generatingProtocol ? (
                                            <>
                                                <Loader2 size={18} className="mr-2 animate-spin" />
                                                Gerando Protocolo...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} className="mr-2" />
                                                Gerar Protocolo Completo
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-12 gap-6">
                    {/* LEFT SIDE: Settings */}
                    <div className="col-span-4 space-y-6">
                        {/* Cover Image */}
                        <div className="glass-panel p-6 rounded-2xl border border-white/10">
                            <label className="text-sm font-bold text-gray-300 mb-3 block">Capa do Protocolo</label>
                            <div className="aspect-video bg-white/5 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center hover:border-queen-pink/50 transition-all cursor-pointer group">
                                {formData.coverImage ? (
                                    <img src={formData.coverImage} alt="Cover" className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                    <div className="text-center">
                                        <Upload size={32} className="mx-auto mb-2 text-gray-400 group-hover:text-queen-pink transition-colors" />
                                        <p className="text-sm text-gray-400">Clique para enviar</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                            <div>
                                <label className="text-sm font-bold text-gray-300 mb-2 block">Título do Protocolo *</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Protocolo Detox Primavera"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-300">Descrição</label>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleAIGenerate}
                                        disabled={generating || !formData.title}
                                        className="text-purple-400 hover:text-purple-300"
                                    >
                                        <Sparkles size={14} className={generating ? "animate-spin mr-1" : "mr-1"} />
                                        IA
                                    </Button>
                                </div>
                                <textarea
                                    placeholder="O que suas Rainhas vão conquistar?"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white h-32 resize-none focus:outline-none focus:border-queen-pink"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-300 mb-2 block">Categoria</label>
                                <div className="space-y-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.value}
                                            onClick={() => setFormData({ ...formData, category: cat.value })}
                                            className={`w-full p-3 rounded-xl border transition-all text-left
                                                ${formData.category === cat.value
                                                    ? 'bg-queen-pink/20 border-queen-pink'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        >
                                            <div className="font-medium text-sm">{cat.label}</div>
                                            <div className="text-xs text-gray-400">{cat.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-300 mb-2 block">Duração</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[7, 14, 21].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => handleDurationChange(d)}
                                            className={`p-3 rounded-xl border transition-all
                                                ${formData.duration === d
                                                    ? 'bg-queen-pink text-white border-queen-pink'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        >
                                            <div className="text-xl font-bold">{d}</div>
                                            <div className="text-xs">dias</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scheduling Section */}
                    <div className="col-span-4">
                        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={20} className="text-queen-pink" />
                                <h3 className="font-bold text-lg">Agendamento</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        📅 Data de Liberação
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Quando este protocolo será liberado
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        ⏰ Horário de Liberação
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="auto-activate"
                                        checked={formData.autoActivate}
                                        onChange={e => setFormData({ ...formData, autoActivate: e.target.checked })}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="auto-activate" className="text-sm text-blue-200 cursor-pointer">
                                        ⚡ Ativar automaticamente na data
                                    </label>
                                </div>

                                {formData.startDate && (
                                    <div className="bg-queen-pink/10 border border-queen-pink/30 rounded-xl p-4">
                                        <p className="text-sm text-white/90">
                                            📅 <strong>Período Ativo:</strong><br />
                                            <span className="text-green-400">De:</span> {new Date(formData.startDate + 'T00:00').toLocaleDateString('pt-BR')} às {formData.startTime}<br />
                                            <span className="text-red-400">Até:</span> {new Date(new Date(formData.startDate).getTime() + (formData.duration * 24 * 60 * 60 * 1000)).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Content Builder */}
                    <div className="col-span-8">
                        <div className="glass-panel p-6 rounded-2xl border border-white/10">
                            <h3 className="font-bold text-lg mb-4">Estrutura do Protocolo</h3>

                            {/* Days Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10">
                                {days.map((day, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDay(idx)}
                                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all
                                            ${selectedDay === idx
                                                ? 'bg-queen-pink text-white'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        Dia {day.day_number}
                                        {day.items.length > 0 && (
                                            <span className="ml-2 text-xs opacity-70">({day.items.length})</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Day Editor */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">Título do Dia</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={days[selectedDay].title}
                                        onChange={e => {
                                            const newDays = [...days]
                                            newDays[selectedDay].title = e.target.value
                                            setDays(newDays)
                                        }}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-bold text-gray-300">Blocos do Dia</label>
                                        <div className="flex gap-2">
                                            {BLOCK_TYPES.map(block => (
                                                <button
                                                    key={block.type}
                                                    onClick={() => addBlock(block.type)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                                                    title={block.label}
                                                >
                                                    <block.icon size={18} className="text-gray-400 group-hover:text-white" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Blocks List */}
                                    <div className="space-y-3">
                                        <AnimatePresence>
                                            {days[selectedDay].items.map((item: any, itemIdx: number) => {
                                                const blockType = BLOCK_TYPES.find(b => b.type === item.type)
                                                const Icon = blockType?.icon || FileText

                                                return (
                                                    <motion.div
                                                        key={itemIdx}
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="bg-white/5 rounded-xl p-4 border border-white/10"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`p-2 rounded-lg bg-gradient-to-br ${blockType?.color} flex-shrink-0`}>
                                                                <Icon size={20} className="text-white" />
                                                            </div>

                                                            <div className="flex-1 space-y-3">
                                                                <div className="flex gap-2">
                                                                    {item.type === 'meal' && (
                                                                        <input
                                                                            type="time"
                                                                            className="w-32 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                                                                            value={item.time || ''}
                                                                            onChange={e => updateBlock(itemIdx, 'time', e.target.value)}
                                                                        />
                                                                    )}
                                                                    <input
                                                                        type="text"
                                                                        placeholder={`Título do ${blockType?.label}`}
                                                                        className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none"
                                                                        value={item.title}
                                                                        onChange={e => updateBlock(itemIdx, 'title', e.target.value)}
                                                                    />
                                                                </div>

                                                                <textarea
                                                                    placeholder="Descrição ou instruções..."
                                                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm resize-none focus:outline-none"
                                                                    rows={2}
                                                                    value={item.description || ''}
                                                                    onChange={e => updateBlock(itemIdx, 'description', e.target.value)}
                                                                />

                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Pontos"
                                                                        className="w-20 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none"
                                                                        value={item.points}
                                                                        onChange={e => updateBlock(itemIdx, 'points', parseInt(e.target.value))}
                                                                    />
                                                                    <span className="text-xs text-gray-400">XP</span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => removeBlock(itemIdx)}
                                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>

                                        {days[selectedDay].items.length === 0 && (
                                            <div className="text-center py-12 text-gray-400">
                                                <FileText size={48} className="mx-auto mb-3 opacity-30" />
                                                <p>Nenhum bloco adicionado ainda.</p>
                                                <p className="text-sm mt-1">Use os ícones acima para começar!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
