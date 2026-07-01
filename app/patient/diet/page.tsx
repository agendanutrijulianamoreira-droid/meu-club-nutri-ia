"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Clock, ChevronDown, ChevronUp, CheckCircle, Circle, Loader2,
    Sparkles, Utensils, ChefHat, Droplets, Dumbbell, FileText,
    Zap, RefreshCw, BookOpen, Flame, Drumstick, Wheat, ShoppingCart, Crown,
} from "lucide-react"
import { getNomeFaseReino } from "@/lib/config/promptsPlanoAlimentar"
import { useAssignments } from "@/lib/hooks/useDatabase"
import { ProtocolMealView } from "./ProtocolMealView"
import { supabase } from "@/lib/supabase-browser"
import { MealPlanBasic } from "@/components/patient/MealPlanBasic"
import { MealPlanPremium } from "@/components/patient/MealPlanPremium"
import { PlanUpgradePrompt } from "@/components/patient/PlanUpgradePrompt"

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

// ─── Lista de Compras ─────────────────────────────────────────────────────────
function ListaCompras({ mealPlan, dia }: { mealPlan: any; dia: number }) {
    const [aberta, setAberta] = useState(false)

    const diaData = mealPlan?.days?.find((d: any) => d.day_number === dia)
    if (!diaData) return null

    const todosItens: { nome: string; qtd: number }[] = []
    const mapaItens: Record<string, number> = {}

    for (const meal of diaData.meals || []) {
        for (const item of meal.items || []) {
            const nome = item.food_name
            if (!nome) continue
            mapaItens[nome] = (mapaItens[nome] || 0) + (item.quantity_g || 0)
        }
    }

    for (const [nome, qtd] of Object.entries(mapaItens)) {
        todosItens.push({ nome, qtd: Math.round(qtd) })
    }

    if (todosItens.length === 0) return null

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <button onClick={() => setAberta(a => !a)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all">
                <div className="flex items-center gap-2">
                    <ShoppingCart size={15} className="text-emerald-400" />
                    <span className="text-sm font-bold text-white">Lista de compras — Dia {dia}</span>
                </div>
                {aberta ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {aberta && (
                <div className="px-4 pb-4 space-y-1.5 border-t border-white/5 pt-3">
                    {todosItens.sort((a, b) => a.nome.localeCompare(b.nome)).map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-sm text-slate-300">{item.nome}</span>
                            <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-lg">{item.qtd}g</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PatientDietPage() {
    const [userId, setUserId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"cardapio" | "protocol" | "ia">("cardapio")
    const [expandedDay, setExpandedDay] = useState(1)

    // Meal plan (atribuído pela nutricionista)
    const [mealPlan, setMealPlan] = useState<any | null>(null)
    const [mealPlanLoading, setMealPlanLoading] = useState(false)
    const [mealPlanDay, setMealPlanDay] = useState(1)
    const [mealPlanLoaded, setMealPlanLoaded] = useState(false)
    const [mealPlanTier, setMealPlanTier] = useState<'basic' | 'premium'>('basic')
    const [isMealPlanPremium, setIsMealPlanPremium] = useState(false)

    // IA Plan state
    const [focus, setFocus] = useState("")
    const [durationDays, setDurationDays] = useState(7)
    const [generating, setGenerating] = useState(false)
    const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
    const [generatedPlanRaw, setGeneratedPlanRaw] = useState<any | null>(null)
    const [generatedPlanTier, setGeneratedPlanTier] = useState<'basic' | 'premium'>('basic')
    const [expandedAIDay, setExpandedAIDay] = useState(1)
    const [genError, setGenError] = useState<string | null>(null)

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setUserId(user.id)
        }
        loadUser()
    }, [])

    // Load meal plan from nutritionist
    useEffect(() => {
        if (!userId || mealPlanLoaded) return
        setMealPlanLoading(true)
        fetch('/api/patient/meal-plan')
            .then(r => r.json())
            .then(d => {
                setMealPlan(d.plan || null)
                setMealPlanTier(d.tier === 'premium' ? 'premium' : 'basic')
                setIsMealPlanPremium(d.is_premium || false)
                setMealPlanLoaded(true)
            })
            .catch(() => setMealPlanLoaded(true))
            .finally(() => setMealPlanLoading(false))
    }, [userId, mealPlanLoaded])

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
        setGeneratedPlanRaw(null)

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
            const response = await res.json()
            const tier: 'basic' | 'premium' = response.tier === 'premium' ? 'premium' : 'basic'
            setGeneratedPlanTier(tier)
            setGeneratedPlanRaw(response.data)

            // For legacy rendering (old format with tasks[]), keep backward compat
            if (response.data?.days?.[0]?.tasks) {
                setGeneratedPlan(response.data as GeneratedPlan)
            } else {
                // New format (basic/premium) — stored in generatedPlanRaw
                setGeneratedPlan(null)
            }
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
            <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-2xl border border-white/10">
                <button
                    onClick={() => setActiveTab("cardapio")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "cardapio"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-white"
                    }`}
                >
                    <Utensils size={13} />
                    Cardápio
                </button>
                <button
                    onClick={() => setActiveTab("protocol")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "protocol"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-white"
                    }`}
                >
                    <BookOpen size={13} />
                    Protocolo
                </button>
                <button
                    onClick={() => setActiveTab("ia")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "ia"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-white"
                    }`}
                >
                    <Sparkles size={13} />
                    Plano Interativo
                </button>
            </div>

            <AnimatePresence mode="wait">
                {/* ── CARDÁPIO TAB ─────────────────────────────────────────── */}
                {activeTab === "cardapio" && (
                    <motion.div
                        key="cardapio"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        {mealPlanLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-indigo-400" size={32} />
                                <p className="text-slate-400 text-sm">Carregando seu cardápio...</p>
                            </div>
                        ) : !mealPlan ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
                                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                    <Utensils size={28} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-white font-semibold mb-1">Nenhum cardápio atribuído</p>
                                    <p className="text-slate-500 text-sm">Sua nutricionista ainda não enviou um cardápio para você.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header do plano */}
                                <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/10 rounded-2xl border border-indigo-500/20 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wide mb-1">Cardápio da sua nutricionista</p>
                                            <h2 className="text-white font-bold text-lg leading-tight">{mealPlan.title}</h2>
                                            {mealPlan.description && (
                                                <p className="text-slate-400 text-sm mt-1">{mealPlan.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {mealPlanTier === 'premium' && (
                                                <span className="shrink-0 flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full font-bold">
                                                    VIP
                                                </span>
                                            )}
                                            {mealPlan.fase_aplicada && (
                                                <span className="shrink-0 flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-1 rounded-full font-bold">
                                                    <Crown size={10} />F{mealPlan.fase_aplicada} {getNomeFaseReino(mealPlan.fase_aplicada)}
                                                </span>
                                            )}
                                            {mealPlan.is_ai_generated && (
                                                <span className="shrink-0 flex items-center gap-1 text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-full">
                                                    <Sparkles size={10} />Interativo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-3 text-xs text-slate-400">
                                        {mealPlan.plan_mode !== 'basic' && mealPlan.target_kcal > 0 && (
                                            <span className="flex items-center gap-1"><Flame size={11} className="text-orange-400" />{mealPlan.target_kcal} kcal/dia</span>
                                        )}
                                        {mealPlan.plan_mode !== 'basic' && mealPlan.target_protein_g > 0 && (
                                            <span className="flex items-center gap-1"><Drumstick size={11} className="text-rose-400" />{mealPlan.target_protein_g}g proteína</span>
                                        )}
                                        {mealPlan.plan_mode === 'basic' && (
                                            <span className="flex items-center gap-1">📋 Cardápio qualitativo</span>
                                        )}
                                        <span>{mealPlan.duration_days || mealPlan.days?.length} dias</span>
                                    </div>
                                </div>

                                {/* Renderização adaptada ao tier e formato dos dados */}
                                {(() => {
                                    // Detect new AI format (basic: description field, premium: items array in meals)
                                    const firstDay = mealPlan.days?.[0]
                                    const firstMeal = firstDay?.meals?.[0]
                                    const isNewBasicFormat = firstMeal && 'description' in firstMeal && !('items' in firstMeal) && !('meal_type' in firstMeal)
                                    const isNewPremiumFormat = firstMeal && ('items' in firstMeal) && Array.isArray(firstMeal.items) && firstMeal.items?.[0] && 'food' in firstMeal.items[0]

                                    if (isNewBasicFormat) {
                                        return <MealPlanBasic plan={mealPlan} currentDay={1} />
                                    }
                                    if (isNewPremiumFormat) {
                                        return <MealPlanPremium plan={mealPlan} currentDay={1} />
                                    }

                                    // Legacy DB format (meal_plan_items with day_number, meal_type, etc.)
                                    return (
                                        <>
                                            {/* Lock premium: plano calculado mas paciente no plano básico */}
                                            {mealPlan.plan_mode === 'premium' && !isMealPlanPremium && (
                                                <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                                    <span className="text-xl shrink-0">🔒</span>
                                                    <div>
                                                        <p className="text-sm font-bold text-white mb-0.5">Cardápio Premium</p>
                                                        <p className="text-xs text-slate-400">Sua nutricionista enviou um cardápio calculado com calorias e macros. Faça upgrade para ver todos os detalhes.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Seletor de dias */}
                                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                {mealPlan.days.map((d: any) => {
                                                    const isActive = mealPlanDay === d.day_number
                                                    const showKcal = mealPlan.plan_mode !== 'basic' && isMealPlanPremium
                                                    const kcalPct = showKcal && mealPlan.target_kcal > 0
                                                        ? Math.round((d.day_total_kcal / mealPlan.target_kcal) * 100) : 0
                                                    return (
                                                        <button
                                                            key={d.day_number}
                                                            onClick={() => setMealPlanDay(d.day_number)}
                                                            className={`shrink-0 px-3 py-2 rounded-xl text-center transition-all border ${isActive ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                                                        >
                                                            <div className="text-xs font-bold">Dia {d.day_number}</div>
                                                            {showKcal ? (
                                                                <div className={`text-xs mt-0.5 ${kcalPct >= 90 && kcalPct <= 110 ? 'text-emerald-400' : kcalPct > 110 ? 'text-rose-400' : 'text-amber-400'}`}>
                                                                    {d.day_total_kcal} kcal
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs mt-0.5 text-slate-500">{d.meals?.length || 0} ref</div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Refeições do dia ativo */}
                                            {mealPlan.days
                                                .filter((d: any) => d.day_number === mealPlanDay)
                                                .map((day: any) => (
                                                    <div key={day.day_number} className="space-y-3">
                                                        {/* Totais do dia — só premium calculado */}
                                                        {mealPlan.plan_mode !== 'basic' && isMealPlanPremium && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {[
                                                                { label: 'Calorias', value: `${day.day_total_kcal} kcal`, icon: Flame, color: 'text-orange-400' },
                                                                { label: 'Proteínas', value: `${day.day_total_protein}g`, icon: Drumstick, color: 'text-rose-400' },
                                                                { label: 'Refeições', value: `${day.meals.length}x`, icon: Utensils, color: 'text-indigo-400' },
                                                            ].map(m => (
                                                                <div key={m.label} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                                                                    <m.icon size={14} className={`${m.color} mx-auto mb-1`} />
                                                                    <p className="text-white text-sm font-bold">{m.value}</p>
                                                                    <p className="text-slate-500 text-xs">{m.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        )}

                                            {/* Cards de refeição */}
                                            {day.meals.map((meal: any, mi: number) => (
                                                <motion.div
                                                    key={mi}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: mi * 0.04 }}
                                                    className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
                                                >
                                                    {/* Header da refeição */}
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">{meal.emoji}</span>
                                                            <div>
                                                                <p className="text-white text-sm font-semibold">{meal.meal_label}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {meal.time && (
                                                                <span className="text-xs text-slate-400 bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <Clock size={10} />{meal.time}
                                                                </span>
                                                            )}
                                                            {mealPlan.plan_mode !== 'basic' && isMealPlanPremium && (
                                                            <span className="text-xs text-slate-500">
                                                                {Math.round(meal.items.reduce((s: number, i: any) => s + (i.calc_kcal || 0), 0))} kcal
                                                            </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Itens da refeição */}
                                                    <div className="divide-y divide-white/5">
                                                        {meal.items.map((item: any, ii: number) => (
                                                            <div key={ii} className="px-4 py-3">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-white text-sm font-medium">{item.food_name}</p>
                                                                        {/* Modo básico: descrição qualitativa */}
                                                                        {(mealPlan.plan_mode === 'basic' || !isMealPlanPremium) ? (
                                                                            item.qualitative_description ? (
                                                                                <p className="text-slate-400 text-xs mt-0.5">{item.qualitative_description}</p>
                                                                            ) : item.quantity_g ? (
                                                                                <p className="text-slate-500 text-xs mt-0.5">{item.quantity_g}g</p>
                                                                            ) : null
                                                                        ) : (
                                                                        /* Modo premium: macros completos */
                                                                        <p className="text-slate-500 text-xs mt-0.5">
                                                                            {item.quantity_g}g
                                                                            {item.serving_qty && item.serving_label
                                                                                ? ` (${item.serving_qty} ${item.serving_label})`
                                                                                : ''}
                                                                            {' · '}
                                                                            {Math.round(item.calc_kcal)} kcal
                                                                            {' · P:'}{Math.round(item.calc_protein_g)}g
                                                                            {' · C:'}{Math.round(item.calc_carbs_g)}g
                                                                            {' · G:'}{Math.round(item.calc_fat_g)}g
                                                                        </p>
                                                                        )}
                                                                        {item.preparation_notes && (
                                                                            <p className="text-indigo-400/70 text-xs mt-1 italic">{item.preparation_notes}</p>
                                                                        )}
                                                                    </div>
                                                                    {mealPlan.plan_mode !== 'basic' && isMealPlanPremium && (
                                                                    <span className="shrink-0 text-xs text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
                                                                        {Math.round(item.calc_kcal)} kcal
                                                                    </span>
                                                                    )}
                                                                </div>
                                                                {item.substitution_note && isMealPlanPremium && (
                                                                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                                                                        <span>↔</span>{item.substitution_note}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ))}
                                        {/* Lista de compras do dia */}
                                        <ListaCompras mealPlan={mealPlan} dia={mealPlanDay} />
                                        </>
                                    )
                                })()}
                            </>
                        )}
                    </motion.div>
                )}

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
                                    Sua nutricionista ainda não atribuiu um plano.
                                </p>
                                <button
                                    onClick={() => setActiveTab("ia")}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-400"
                                >
                                    <Sparkles size={15} />
                                    Gerar Plano Interativo
                                </button>
                            </div>
                        ) : (
                            <ProtocolMealView
                                protocol={(activeProtocol.protocol as any)}
                                days={protocolDays || []}
                                currentDay={
                                    (() => {
                                        const assignedAt = activeProtocol.assigned_at
                                            ? new Date(activeProtocol.assigned_at)
                                            : new Date()
                                        const diffDays = Math.floor(
                                            (Date.now() - assignedAt.getTime()) / (1000 * 60 * 60 * 24)
                                        )
                                        const totalDays = (protocolDays || []).length
                                        return totalDays > 0 ? Math.min(diffDays + 1, totalDays) : 1
                                    })()
                                }
                                progress={activeProtocol.progress_percentage || 0}
                                onGoIA={() => setActiveTab("ia")}
                            />
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
                        {!generatedPlan && !generatedPlanRaw ? (
                            <div className="space-y-5">
                                {/* Header */}
                                <div className="text-center py-4">
                                    <div className="h-14 w-14 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                                        <ChefHat size={28} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-1">Plano Alimentar Interativo</h2>
                                    <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                        Diga o que você quer e a gente monta um cardápio personalizado para você.
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
                                            Gerar Meu Plano
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
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Seu Plano Personalizado</span>
                                            </div>
                                            <h2 className="text-xl font-bold text-white">
                                                {generatedPlan ? generatedPlan.title : generatedPlanRaw?.title}
                                            </h2>
                                            {generatedPlan?.description && (
                                                <p className="text-slate-400 text-sm mt-1">{generatedPlan.description}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => { setGeneratedPlan(null); setGeneratedPlanRaw(null) }}
                                            className="ml-3 h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all flex-shrink-0"
                                        >
                                            <RefreshCw size={14} className="text-slate-400" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-slate-400 font-bold">
                                            {(generatedPlan?.days ?? generatedPlanRaw?.days)?.length} dias
                                        </span>
                                        <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-slate-400 font-bold">
                                            Foco: {focus}
                                        </span>
                                        {generatedPlanTier === 'premium' && (
                                            <span className="text-xs bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-lg px-3 py-1.5 font-bold">
                                                VIP • Macros calculados
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Tier-aware rendering for new format */}
                                {generatedPlanRaw && generatedPlanTier === 'basic' && (
                                    <MealPlanBasic plan={generatedPlanRaw} currentDay={1} />
                                )}
                                {generatedPlanRaw && generatedPlanTier === 'premium' && (
                                    <MealPlanPremium plan={generatedPlanRaw} currentDay={1} />
                                )}

                                {/* Legacy format (tasks array) */}
                                {generatedPlan && (
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
                                )}

                                {/* Regenerate */}
                                <button
                                    onClick={() => { setGeneratedPlan(null); setGeneratedPlanRaw(null) }}
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
