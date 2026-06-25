"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
    Trophy,
    Calendar,
    Camera,
    Zap,
    MessageCircle,
    Plus,
    Trash2,
    GripVertical,
    Save,
    Rocket,
    ArrowLeft,
    Droplets,
    Moon,
    Dumbbell,
    Apple,
    Clock,
    Star,
    Sparkles,
    Copy,
    Eye,
    Loader2,
    ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Mission {
    id: string
    type: 'photo' | 'check' | 'water' | 'exercise' | 'sleep' | 'meal' | 'community'
    title: string
    description?: string
    points: number
    isBonus?: boolean
}

interface DayConfig {
    id: string
    dayNumber: number
    title: string
    missions: Mission[]
}

// Banco de Missões Predefinidas
const MISSION_TEMPLATES: Mission[] = [
    { id: 'tpl-photo', type: 'photo', title: 'Foto da Refeição', description: 'Compartilhe seu prato', points: 50 },
    { id: 'tpl-water', type: 'water', title: 'Meta de Hidratação', description: 'Beber 2-3L de água', points: 30 },
    { id: 'tpl-exercise', type: 'exercise', title: 'Movimento do Dia', description: 'Caminhada ou treino', points: 40 },
    { id: 'tpl-sleep', type: 'sleep', title: 'Sono de Qualidade', description: 'Dormir antes das 23h', points: 30 },
    { id: 'tpl-meal', type: 'meal', title: 'Refeição Completa', description: 'Proteína + Vegetais', points: 35 },
    { id: 'tpl-community', type: 'community', title: 'Interação no Grupo', description: 'Comentar ou curtir', points: 15 },
    { id: 'tpl-check', type: 'check', title: 'Hábito Personalizado', description: 'Definir pelo usuário', points: 25 },
]

// Temas de Dias Sugeridos pela IA
const DAY_THEMES = [
    "A Largada 🚀",
    "Foco Total 🎯",
    "Limpeza Profunda 🧹",
    "Dia do Movimento 🏃",
    "Detox Mental 🧘",
    "Celebração de Progresso 🎉",
    "Dia Bônus ⭐",
    "Superação 💪",
]

function ChallengeBuilderContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const challengeId = searchParams.get('id')

    const [activeTab, setActiveTab] = useState<'setup' | 'missions' | 'feed'>('missions')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(!!challengeId)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ type, msg }); setTimeout(() => setToast(null), 3500)
    }

    // Challenge Info
    const [challengeInfo, setChallengeInfo] = useState({
        title: "Desafio 21 Dias Detox",
        emoji: "🏆",
        description: "Transformação completa em 21 dias de missões diárias.",
        durationDays: 21,
        startDate: new Date().toISOString().split('T')[0],
        isActive: false
    })

    // Days Configuration
    const [days, setDays] = useState<DayConfig[]>([
        {
            id: '1',
            dayNumber: 1,
            title: "A Largada 🚀",
            missions: [
                { id: 'm1-1', type: 'photo', title: 'Foto do Café da Manhã', description: 'Primeira refeição registrada!', points: 50 },
                { id: 'm1-2', type: 'water', title: 'Beber 3L de Água', description: 'Meta de hidratação', points: 30 }
            ]
        },
        {
            id: '2',
            dayNumber: 2,
            title: "Limpeza 🧹",
            missions: [
                { id: 'm2-1', type: 'check', title: 'Sem Açúcar Adicionado', description: 'O dia todo!', points: 40 }
            ]
        },
        {
            id: '3',
            dayNumber: 3,
            title: "Movimento 🏃",
            missions: []
        },
    ])

    // Feed Posts
    const [feedPosts, setFeedPosts] = useState([
        { id: 'f1', dayNumber: 1, time: '08:00', message: "Bom dia, Rainhas! 👑 Hoje é o DIA 1 da nossa jornada. Quem está pronta para a primeira missão?" },
        { id: 'f2', dayNumber: 1, time: '12:00', message: "Metade do dia! Já bateram a meta de água? 💧 Lembrem-se: hidratação é a base da transformação!" },
    ])

    useEffect(() => {
        if (challengeId) {
            loadChallenge(challengeId)
        }
    }, [challengeId])

    const loadChallenge = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('challenges')
                .select('*')
                .eq('id', id)
                .single()

            if (data) {
                setChallengeInfo({
                    title: data.title,
                    emoji: data.emoji || "🏆",
                    description: data.description || "",
                    durationDays: data.duration_days,
                    startDate: data.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    isActive: data.is_active
                })

                // Load missions from rewards_json if exists
                if (data.rewards_json?.days) {
                    setDays(data.rewards_json.days)
                }
            }
        } catch (error) {
            console.error('Erro ao carregar desafio:', error)
        } finally {
            setLoading(false)
        }
    }

    const getMissionIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            photo: <Camera size={16} />,
            water: <Droplets size={16} />,
            exercise: <Dumbbell size={16} />,
            sleep: <Moon size={16} />,
            meal: <Apple size={16} />,
            community: <MessageCircle size={16} />,
            check: <Zap size={16} />
        }
        return icons[type] || <Zap size={16} />
    }

    const getMissionColor = (type: string) => {
        const colors: Record<string, string> = {
            photo: 'bg-purple-900/50 text-purple-400',
            water: 'bg-blue-900/50 text-blue-400',
            exercise: 'bg-orange-900/50 text-orange-400',
            sleep: 'bg-indigo-900/50 text-indigo-400',
            meal: 'bg-green-900/50 text-green-400',
            community: 'bg-pink-900/50 text-pink-400',
            check: 'bg-yellow-900/50 text-yellow-400'
        }
        return colors[type] || 'bg-gray-900/50 text-gray-400'
    }

    const addMissionToDay = (dayId: string, template: Mission) => {
        setDays(prev => prev.map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    missions: [...day.missions, {
                        ...template,
                        id: `${dayId}-${Date.now()}`
                    }]
                }
            }
            return day
        }))
    }

    const removeMissionFromDay = (dayId: string, missionId: string) => {
        setDays(prev => prev.map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    missions: day.missions.filter(m => m.id !== missionId)
                }
            }
            return day
        }))
    }

    const updateDayTitle = (dayId: string, title: string) => {
        setDays(prev => prev.map(day =>
            day.id === dayId ? { ...day, title } : day
        ))
    }

    const addNewDay = () => {
        const newDayNumber = days.length + 1
        setDays(prev => [...prev, {
            id: `day-${Date.now()}`,
            dayNumber: newDayNumber,
            title: DAY_THEMES[newDayNumber % DAY_THEMES.length] || `Dia ${newDayNumber}`,
            missions: []
        }])
    }

    const removeDay = (dayId: string) => {
        setDays(prev => {
            const filtered = prev.filter(d => d.id !== dayId)
            // Renumber days
            return filtered.map((day, index) => ({
                ...day,
                dayNumber: index + 1
            }))
        })
    }

    const duplicateDay = (dayId: string) => {
        const dayToCopy = days.find(d => d.id === dayId)
        if (!dayToCopy) return

        const newDayNumber = days.length + 1
        setDays(prev => [...prev, {
            ...dayToCopy,
            id: `day-${Date.now()}`,
            dayNumber: newDayNumber,
            title: `${dayToCopy.title} (Cópia)`,
            missions: dayToCopy.missions.map(m => ({
                ...m,
                id: `m-${Date.now()}-${Math.random()}`
            }))
        }])
    }

    const generateDaysWithAI = async () => {
        setSaving(true)
        await new Promise(r => setTimeout(r, 2000))

        // Simulated AI generation
        const aiDays: DayConfig[] = []
        for (let i = 1; i <= challengeInfo.durationDays; i++) {
            const theme = DAY_THEMES[(i - 1) % DAY_THEMES.length]
            const missions: Mission[] = []

            // Add 2-3 missions per day
            if (i === 1) {
                missions.push({ id: `ai-${i}-1`, type: 'photo', title: 'Foto de Compromisso', description: 'Seu primeiro registro!', points: 50 })
            }
            missions.push({ id: `ai-${i}-2`, type: 'water', title: 'Meta de Água', description: '2-3L hoje', points: 30 })

            if (i % 3 === 0) {
                missions.push({ id: `ai-${i}-3`, type: 'exercise', title: 'Dia do Movimento', description: 'Caminhada ou treino', points: 40, isBonus: true })
            }

            aiDays.push({
                id: `day-ai-${i}`,
                dayNumber: i,
                title: theme,
                missions
            })
        }

        setDays(aiDays)
        setSaving(false)
    }

    const saveChallenge = async () => {
        setSaving(true)
        try {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .limit(1)
                .single()

            const startDate = new Date(challengeInfo.startDate)
            const endDate = new Date(startDate.getTime() + (challengeInfo.durationDays * 24 * 60 * 60 * 1000))

            const challengeData = {
                title: challengeInfo.title,
                description: challengeInfo.description,
                emoji: challengeInfo.emoji,
                duration_days: challengeInfo.durationDays,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                is_active: challengeInfo.isActive,
                tenant_id: tenant?.id,
                rewards_json: {
                    days: days,
                    feedPosts: feedPosts
                }
            }

            if (challengeId) {
                await supabase.from('challenges').update(challengeData).eq('id', challengeId)
            } else {
                await supabase.from('challenges').insert(challengeData)
            }

            router.push('/admin?view=challenges')
        } catch (error) {
            console.error('Erro ao salvar:', error)
            showToast('Erro ao salvar desafio')
        } finally {
            setSaving(false)
        }
    }

    const totalMissions = days.reduce((acc, day) => acc + day.missions.length, 0)
    const totalXP = days.reduce((acc, day) =>
        acc + day.missions.reduce((m, mission) => m + mission.points, 0), 0
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-400" size={48} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl text-sm font-bold shadow-xl border ${toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'}`}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Header */}
            <header className="border-b border-gray-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link href="/admin?view=challenges">
                                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-full">
                                    <ArrowLeft size={20} />
                                </Button>
                            </Link>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                        {challengeId ? 'Editando' : 'Novo'} Desafio
                                    </span>
                                    <span className="text-gray-500 text-xs">{challengeInfo.durationDays} Dias</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{challengeInfo.emoji}</span>
                                    <input
                                        value={challengeInfo.title}
                                        onChange={(e) => setChallengeInfo({ ...challengeInfo, title: e.target.value })}
                                        className="text-2xl font-bold bg-transparent outline-none focus:text-purple-400 transition"
                                        placeholder="Nome do Desafio"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Stats */}
                            <div className="hidden md:flex items-center gap-6 text-sm mr-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-purple-400">{days.length}</p>
                                    <p className="text-xs text-gray-500">Dias</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-green-400">{totalMissions}</p>
                                    <p className="text-xs text-gray-500">Missões</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-yellow-400">{totalXP}</p>
                                    <p className="text-xs text-gray-500">XP Total</p>
                                </div>
                            </div>

                            <Button variant="ghost" className="text-gray-400">
                                <Eye size={18} className="mr-2" />
                                Preview
                            </Button>
                            <Button
                                onClick={saveChallenge}
                                disabled={saving}
                                className="bg-green-600 hover:bg-green-500 font-bold"
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                ) : (
                                    <Save size={18} className="mr-2" />
                                )}
                                {saving ? 'Salvando...' : 'Salvar Desafio'}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-gray-800 bg-slate-950">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-8 text-sm font-bold text-gray-400">
                        <button
                            onClick={() => setActiveTab('setup')}
                            className={`py-4 border-b-2 transition ${activeTab === 'setup' ? 'text-white border-purple-500' : 'border-transparent hover:text-gray-300'
                                }`}
                        >
                            1. Configurações
                        </button>
                        <button
                            onClick={() => setActiveTab('missions')}
                            className={`py-4 border-b-2 transition ${activeTab === 'missions' ? 'text-white border-purple-500' : 'border-transparent hover:text-gray-300'
                                }`}
                        >
                            2. Missões Diárias
                        </button>
                        <button
                            onClick={() => setActiveTab('feed')}
                            className={`py-4 border-b-2 transition ${activeTab === 'feed' ? 'text-white border-purple-500' : 'border-transparent hover:text-gray-300'
                                }`}
                        >
                            3. Piloto Automático
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">

                {/* TAB: Setup */}
                {activeTab === 'setup' && (
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Trophy className="text-purple-400" size={20} />
                                Informações do Desafio
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Descrição</label>
                                    <textarea
                                        value={challengeInfo.description}
                                        onChange={(e) => setChallengeInfo({ ...challengeInfo, description: e.target.value })}
                                        rows={3}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 resize-none"
                                        placeholder="Descreva o objetivo do desafio..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Duração (dias)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={90}
                                        value={challengeInfo.durationDays}
                                        onChange={(e) => setChallengeInfo({ ...challengeInfo, durationDays: parseInt(e.target.value) || 21 })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-center font-bold focus:outline-none focus:border-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Data de Início</label>
                                    <input
                                        type="date"
                                        value={challengeInfo.startDate}
                                        onChange={(e) => setChallengeInfo({ ...challengeInfo, startDate: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div
                                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${challengeInfo.isActive ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'
                                    }`}
                                onClick={() => setChallengeInfo({ ...challengeInfo, isActive: !challengeInfo.isActive })}
                            >
                                <div>
                                    <p className="font-bold">Ativar para as Rainhas</p>
                                    <p className="text-xs text-gray-500">O desafio ficará disponível no app</p>
                                </div>
                                <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${challengeInfo.isActive ? 'bg-green-500' : 'bg-gray-600'
                                    }`}>
                                    <motion.div
                                        className="bg-white w-4 h-4 rounded-full shadow-md"
                                        animate={{ x: challengeInfo.isActive ? 24 : 0 }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* AI Generate Days */}
                        <Button
                            onClick={generateDaysWithAI}
                            disabled={saving}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-6 font-bold"
                        >
                            {saving ? (
                                <Loader2 size={20} className="animate-spin mr-2" />
                            ) : (
                                <Sparkles size={20} className="mr-2" />
                            )}
                            {saving ? 'Gerando...' : `Gerar ${challengeInfo.durationDays} Dias com IA`}
                        </Button>
                    </div>
                )}

                {/* TAB: Missions */}
                {activeTab === 'missions' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                        {/* Sidebar: Mission Templates */}
                        <div className="lg:col-span-1">
                            <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 sticky top-32">
                                <h3 className="font-bold text-gray-300 mb-4 flex items-center gap-2">
                                    <Zap size={18} className="text-purple-400" />
                                    Banco de Missões
                                </h3>
                                <p className="text-xs text-gray-500 mb-4">Clique para adicionar ao dia selecionado.</p>

                                <div className="space-y-2">
                                    {MISSION_TEMPLATES.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => {
                                                if (days.length > 0) {
                                                    addMissionToDay(days[0].id, template)
                                                }
                                            }}
                                            className="w-full bg-white/5 p-3 rounded-xl border border-white/10 hover:border-purple-500/50 transition flex items-center gap-3 text-left group"
                                        >
                                            <div className={`p-2 rounded-lg ${getMissionColor(template.type)}`}>
                                                {getMissionIcon(template.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{template.title}</p>
                                                <p className="text-xs text-yellow-400 font-bold">+{template.points}xp</p>
                                            </div>
                                            <Plus size={16} className="text-gray-600 group-hover:text-purple-400 transition" />
                                        </button>
                                    ))}
                                </div>

                                {/* AI Tip */}
                                <div className="mt-6 pt-6 border-t border-white/5">
                                    <h4 className="font-bold text-gray-300 mb-2 flex items-center gap-2">
                                        <Sparkles size={14} className="text-yellow-400" />
                                        Dica da IA
                                    </h4>
                                    <p className="text-xs text-gray-400 italic">
                                        "Nos dias 3 e 4, a motivação cai. Adicione uma Missão Bônus com pontuação dobrada para reengajar."
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Main: Timeline */}
                        <div className="lg:col-span-3 space-y-4">
                            {days.map((day, dayIndex) => (
                                <motion.div
                                    key={day.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: dayIndex * 0.05 }}
                                    className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden"
                                >
                                    {/* Day Header */}
                                    <div className="bg-white/[0.02] p-4 flex justify-between items-center border-b border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-purple-600 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white">
                                                {day.dayNumber}
                                            </div>
                                            <input
                                                value={day.title}
                                                onChange={(e) => updateDayTitle(day.id, e.target.value)}
                                                className="bg-transparent text-lg font-bold outline-none placeholder-gray-600 focus:text-purple-400 transition"
                                                placeholder="Tema do dia..."
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => duplicateDay(day.id)}
                                                className="text-gray-500 hover:text-purple-400"
                                            >
                                                <Copy size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeDay(day.id)}
                                                className="text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Day Missions */}
                                    <div className="p-4 space-y-2 min-h-[100px]">
                                        {day.missions.length === 0 ? (
                                            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center text-gray-600">
                                                <Plus size={24} className="mx-auto mb-2 opacity-50" />
                                                <p>Adicione missões do banco ao lado</p>
                                            </div>
                                        ) : (
                                            day.missions.map((mission) => (
                                                <div
                                                    key={mission.id}
                                                    className="flex items-center gap-4 bg-white/[0.02] p-3 rounded-xl border border-white/5 group"
                                                >
                                                    <GripVertical size={16} className="text-gray-600 cursor-move" />
                                                    <div className={`p-2 rounded-lg ${getMissionColor(mission.type)}`}>
                                                        {getMissionIcon(mission.type)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            value={mission.title}
                                                            onChange={(e) => {
                                                                setDays(prev => prev.map(d => ({
                                                                    ...d,
                                                                    missions: d.missions.map(m =>
                                                                        m.id === mission.id ? { ...m, title: e.target.value } : m
                                                                    )
                                                                })))
                                                            }}
                                                            className="bg-transparent font-medium text-sm outline-none w-full"
                                                        />
                                                        <p className="text-xs text-gray-500">{mission.description}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            value={mission.points}
                                                            onChange={(e) => {
                                                                setDays(prev => prev.map(d => ({
                                                                    ...d,
                                                                    missions: d.missions.map(m =>
                                                                        m.id === mission.id ? { ...m, points: parseInt(e.target.value) || 0 } : m
                                                                    )
                                                                })))
                                                            }}
                                                            className="w-16 bg-yellow-500/10 text-yellow-400 font-bold text-sm text-center py-1 px-2 rounded-lg border border-yellow-500/30 outline-none"
                                                        />
                                                        <span className="text-yellow-400 text-xs font-bold">xp</span>
                                                        <button
                                                            onClick={() => removeMissionFromDay(day.id, mission.id)}
                                                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}

                                        {/* Quick Add */}
                                        <div className="flex gap-2 pt-2">
                                            {MISSION_TEMPLATES.slice(0, 4).map((template) => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => addMissionToDay(day.id, template)}
                                                    className={`p-2 rounded-lg ${getMissionColor(template.type)} opacity-50 hover:opacity-100 transition`}
                                                    title={template.title}
                                                >
                                                    {getMissionIcon(template.type)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Add New Day */}
                            <button
                                onClick={addNewDay}
                                className="w-full py-6 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 font-bold hover:border-purple-500 hover:text-purple-400 transition flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                Adicionar Dia {days.length + 1}
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: Feed */}
                {activeTab === 'feed' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center py-12 bg-white/[0.03] rounded-2xl border border-white/5">
                            <Rocket size={64} className="mx-auto text-purple-500 mb-6" />
                            <h3 className="text-2xl font-bold mb-3">Piloto Automático de Conteúdo</h3>
                            <p className="text-gray-400 max-w-md mx-auto mb-8">
                                Configure as mensagens que o "Robô do Desafio" vai postar na comunidade todos os dias para motivar as Rainhas.
                            </p>

                            <Button
                                disabled={saving}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6 font-bold text-lg"
                            >
                                <Sparkles size={20} className="mr-2" />
                                Gerar Posts com IA
                            </Button>

                            <div className="mt-8 grid gap-4 text-left max-w-lg mx-auto">
                                {feedPosts.map((post) => (
                                    <div key={post.id} className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded font-bold">
                                                Dia {post.dayNumber}
                                            </span>
                                            <span className="text-gray-500 text-xs">{post.time}</span>
                                        </div>
                                        <p className="text-sm text-gray-300">{post.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ChallengeBuilderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-400" size={48} />
            </div>
        }>
            <ChallengeBuilderContent />
        </Suspense>
    )
}
