"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Clock, ChevronDown, ChevronUp, CheckCircle, Circle, Loader2,
    Sparkles, Utensils, ChefHat, Droplets, Dumbbell, FileText,
    Zap, RefreshCw, BookOpen,
} from "lucide-react"
import { useAssignments } from "@/lib/hooks/useDatabase"
import { supabase } from "@/lib/supabase-browser"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Task {
    time: string | null
    type: "meal" | "shot" | "water" | "workout" | "content"
    description: string
    ingredients?: string[]
    points: number
}

interface PlanDay {
    day: number
    title: string
    tasks: Task[]
}

interface GeneratedPlan {
    title: string
    description: string
    days: PlanDay[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
    shot:    { label: "SHOT",     color: "text-orange-400", bg: "bg-orange-500/20", Icon: Zap },
    meal:    { label: "REFEIÇÃO", color: "text-green-400",  bg: "bg-green-500/20",  Icon: Utensils },
    water:   { label: "ÁGUA",     color: "text-blue-400",   bg: "bg-blue-500/20",   Icon: Droplets },
    workout: { label: "TREINO",   color: "text-pink-400",   bg: "bg-pink-500/20",   Icon: Dumbbell },
    content: { label: "DICA",     color: "text-purple-400", bg: "bg-purple-500/20", Icon: FileText },
}

const FOCUS_PRESETS = [
    "Desinchar em 7 dias",
    "Emagrecer com saciedade",
    "Ganhar energia e disposição",
    "Equilibrar o intestino",
    "Reduzir inflamação",
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PatientDietPage() {
    const [userId, setUserId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"protocol" | "ia">("protocol")
    const [expandedDay, setExpandedDay] = useState(1)

    // IA Plan state
    const [focus, setFocus] = useState("")
    const [durationDays, setDurationDays] = useState(7)
    const [generating, setGenerating] = useState(false)
    const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
    const [expandedAIDay, setExpandedAIDay] = useState(1)
    const [genError, setGenError] = useState<string | null>(null)

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setUserId(user.id)
        }
        loadUser()
    }, [])

    const { assignments, loading } = useAssignments(userId || undefined)
    const activeProtocol = assignments?.[0]

    const protocolDays = (activeProtocol?.protocol as any)?.days
        ?.sort((a: any, b: any) => a.day_number - b.day_number)
        .map((d: any) => ({
            day: d.day_number,
            title: d.title || `Dia ${d.day_number}`,
            items: d.items?.sort((a: any, b: any) => a.time?.localeCompare(b.time)).map((i: any) => ({
                time: i.time,
                type: i.item_type,
                title: i.title,
                description: i.description,
                completed: false,
            })) || [],
        })) || []

    // ─── Generate meal plan ──────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!focus.trim()) return
        setGenerating(true)
        setGenError(null)
        setGeneratedPlan(null)

        try {
            const res = await fetch("/api/ai/meal-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ focus: focus.trim(), duration_days: durationDays }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Erro ao gerar plano")
            }
            const { data } = await res.json()
            setGeneratedPlan(data)
            setExpandedAIDay(1)
        } catch (err: any) {
            setGenError(err.message || "Tente novamente")
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <p className="text-slate-400 text-sm">Carregando...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen px-4 pt-6 pb-28">
            {/* Tab switcher */}
            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-2xl border border-white/10">
                <button
                    onClick={() => setActiveTab("protocol")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === "protocol"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-white"
                    }`}
                >
                    <BookOpen size={15} />
                    Meu Protocolo
                </button>
                <button
                    onClick={() => setActiveTab("ia")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === "ia"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-white"
                    }`}
                >
                    <Sparkles size={15} />
                    Plano IA
                </button>
            </div>

            <AnimatePresence mode="wait">
                {/* ── PROTOCOL TAB ─────────────────────────────────────────── */}
                {activeTab === "protocol" && (
                    <motion.div
                        key="protocol"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {!activeProtocol ? (
                            <div className="flex flex-col items-center justify-center text-center py-20">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <Circle className="text-slate-600" size={40} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Nenhum Protocolo Ativo</h2>
                                <p className="text-slate-400 text-sm max-w-sm mb-4">
                                    Sua nutricionista ainda não atribuiu um plano. Enquanto isso, experimente o Plano IA!
                                </p>
                                <button
                                    onClick={() => setActiveTab("ia")}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-400"
                                >
                                    <Sparkles size={15} />
                                    Gerar Plano com IA
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Protocol header */}
                                <div className="mb-5">
                                    <div className="inline-block bg-indigo-600/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Protocolo Ativo</span>
                                    </div>
                                    <h1 className="text-2xl font-bold text-white mb-1">
                                        {(activeProtocol.protocol as any)?.title || "Meu Protocolo"}
                                    </h1>
                                    <p className="text-slate-400 text-sm">
                                        {(activeProtocol.protocol as any)?.description || "Seu plano nutricional personalizado"}
                                    </p>
                                    <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progresso Geral</span>
                                            <span className="text-sm font-bold text-white">{activeProtocol.progress_percentage || 0}%</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                                style={{ width: `${activeProtocol.progress_percentage || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Protocol days */}
                                <div className="space-y-3">
                                    {protocolDays.map((day: any) => {
                                        const isExpanded = expandedDay === day.day
                                        return (
                                            <div key={day.day} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                                <button
                                                    onClick={() => setExpandedDay(isExpanded ? 0 : day.day)}
                                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center">
                                                            <span className="text-sm font-bold text-indigo-400">{day.day}</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <h3 className="font-bold text-white text-sm">{day.title}</h3>
                                                            <p className="text-xs text-slate-500">{day.items.length} itens</p>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="text-slate-400" size={20} /> : <ChevronDown className="text-slate-400" size={20} />}
                                                </button>
                                                {isExpanded && (
                                                    <div className="p-4 space-y-3 border-t border-white/5">
                                                        {day.items.map((item: any, idx: number) => {
                                                            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.meal
                                                            return (
                                                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                                                                        <cfg.Icon size={14} className={cfg.color} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            {item.time && <span className="text-[10px] text-slate-500 font-bold">{item.time}</span>}
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                                                        </div>
                                                                        <p className="text-sm font-bold text-white">{item.title}</p>
                                                                        {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {/* ── IA PLAN TAB ───────────────────────────────────────────── */}
                {activeTab === "ia" && (
                    <motion.div
                        key="ia"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {!generatedPlan ? (
                            <div className="space-y-5">
                                {/* Header */}
                                <div className="text-center py-4">
                                    <div className="h-14 w-14 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                                        <ChefHat size={28} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-1">Plano Alimentar com IA</h2>
                                    <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                        Diga o que você quer e a IA monta um cardápio personalizado para você.
                                    </p>
                                </div>

                                {/* Focus input */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Qual é o seu foco?</p>
                                    <input
                                        type="text"
                                        value={focus}
                                        onChange={(e) => setFocus(e.target.value)}
                                        placeholder="Ex: desinchar, emagrecer, ganhar energia..."
                                        className="w-full h-13 bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>

                                {/* Presets */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ou escolha uma sugestão</p>
                                    <div className="flex flex-wrap gap-2">
                                        {FOCUS_PRESETS.map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => setFocus(preset)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                                    focus === preset
                                                        ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400"
                                                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                }`}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Duration */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Duração</p>
                                    <div className="flex gap-2">
                                        {[3, 7, 14].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setDurationDays(d)}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                                    durationDays === d
                                                        ? "bg-indigo-600 border-indigo-500 text-white"
                                                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                }`}
                                            >
                                                {d} dias
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {genError && (
                                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                        {genError}
                                    </p>
                                )}

                                {/* Generate button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={!focus.trim() || generating}
                                    className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-all text-white font-bold flex items-center justify-center gap-2"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Gerando cardápio...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            Gerar Meu Plano IA
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* ── Generated Plan View ──────────────────────── */
                            <div>
                                {/* Plan header */}
                                <div className="mb-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="inline-flex items-center gap-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-2">
                                                <Sparkles size={10} className="text-indigo-400" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Plano Gerado pela IA</span>
                                            </div>
                                            <h2 className="text-xl font-bold text-white">{generatedPlan.title}</h2>
                                            <p className="text-slate-400 text-sm mt-1">{generatedPlan.description}</p>
                                        </div>
                                        <button
                                            onClick={() => setGeneratedPlan(null)}
                                            className="ml-3 h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all flex-shrink-0"
                                        >
                                            <RefreshCw size={14} className="text-slate-400" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-slate-400 font-bold">
                                            {generatedPlan.days.length} dias
                                        </span>
                                        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-slate-400 font-bold">
                                            Foco: {focus}
                                        </span>
                                    </div>
                                </div>

                                {/* Days */}
                                <div className="space-y-3">
                                    {generatedPlan.days.map((day) => {
                                        const isExpanded = expandedAIDay === day.day
                                        const totalXP = day.tasks.reduce((acc, t) => acc + (t.points || 0), 0)
                                        return (
                                            <div key={day.day} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                                <button
                                                    onClick={() => setExpandedAIDay(isExpanded ? 0 : day.day)}
                                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center">
                                                            <span className="text-sm font-bold text-indigo-400">{day.day}</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <h3 className="font-bold text-white text-sm">{day.title}</h3>
                                                            <p className="text-xs text-slate-500">{day.tasks.length} itens · +{totalXP} XP</p>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="text-slate-400" size={18} /> : <ChevronDown className="text-slate-400" size={18} />}
                                                </button>

                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="p-4 space-y-3 border-t border-white/5"
                                                    >
                                                        {day.tasks.map((task, idx) => {
                                                            const cfg = TYPE_CONFIG[task.type] || TYPE_CONFIG.meal
                                                            return (
                                                                <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                                                                            <cfg.Icon size={14} className={cfg.color} />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                {task.time && <span className="text-[10px] text-slate-500 font-bold">{task.time}</span>}
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                                                                <span className="text-[9px] text-slate-600 ml-auto">+{task.points} XP</span>
                                                                            </div>
                                                                            <p className="text-sm font-bold text-white">{task.description}</p>
                                                                            {task.ingredients && task.ingredients.length > 0 && (
                                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                                    {task.ingredients.map((ing, i) => (
                                                                                        <span key={i} className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-slate-400">
                                                                                            {ing}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </motion.div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Regenerate */}
                                <button
                                    onClick={() => setGeneratedPlan(null)}
                                    className="w-full mt-4 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 font-bold text-sm flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={15} />
                                    Gerar outro plano
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
