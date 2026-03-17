"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowRight,
    ArrowLeft,
    Activity,
    Zap,
    CheckCircle,
    Scale,
    Target,
    Loader2,
    Heart,
    Utensils,
    Dumbbell,
    Moon,
    Droplets,
    Sparkles,
    AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "./actions"

const TOTAL_STEPS = 4

const GOALS = [
    { id: 'emagrecimento', label: 'Emagrecer de forma saudável', emoji: '⚖️' },
    { id: 'desinchar', label: 'Desinchar e reduzir retenção', emoji: '💧' },
    { id: 'energia', label: 'Mais energia e disposição', emoji: '⚡' },
    { id: 'saude_geral', label: 'Melhorar saúde em geral', emoji: '❤️' },
    { id: 'massa_muscular', label: 'Ganhar massa muscular', emoji: '💪' },
    { id: 'reeducacao', label: 'Reeducação alimentar', emoji: '🥗' },
]

const PAIN_POINTS = [
    { id: 'efeito_sanfona', label: 'Efeito sanfona constante', icon: Activity },
    { id: 'falta_energia', label: 'Falta de energia e cansaço', icon: Zap },
    { id: 'rotina_corrida', label: 'Rotina corrida dificulta a dieta', icon: Target },
    { id: 'compulsao', label: 'Compulsão alimentar', icon: AlertTriangle },
    { id: 'ansiedade', label: 'Ansiedade e estresse', icon: Heart },
    { id: 'sono_ruim', label: 'Sono ruim ou insônia', icon: Moon },
]

const DIETARY_OPTIONS = [
    { id: 'nenhuma', label: 'Nenhuma restrição' },
    { id: 'lactose', label: 'Intolerância à lactose' },
    { id: 'gluten', label: 'Intolerância ao glúten' },
    { id: 'vegetariana', label: 'Vegetariana' },
    { id: 'vegana', label: 'Vegana' },
    { id: 'low_carb', label: 'Preferência low carb' },
    { id: 'diabetes', label: 'Diabética (controle de açúcar)' },
    { id: 'hipertensao', label: 'Hipertensa (controle de sódio)' },
]

const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: 'Sedentária', desc: 'Pouca ou nenhuma atividade física', icon: Moon },
    { id: 'light', label: 'Leve', desc: '1-2x por semana (caminhada, yoga)', icon: Droplets },
    { id: 'moderate', label: 'Moderada', desc: '3-4x por semana (musculação, corrida)', icon: Activity },
    { id: 'intense', label: 'Intensa', desc: '5+ vezes por semana', icon: Dumbbell },
]

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [weight, setWeight] = useState("")
    const [height, setHeight] = useState("")
    const [mainGoal, setMainGoal] = useState("")
    const [selectedPains, setSelectedPains] = useState<string[]>([])
    const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
    const [activityLevel, setActivityLevel] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const togglePain = (id: string) => {
        setSelectedPains(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        )
    }

    const toggleRestriction = (id: string) => {
        if (id === 'nenhuma') {
            setDietaryRestrictions(['nenhuma'])
            return
        }
        setDietaryRestrictions(prev => {
            const without = prev.filter(r => r !== 'nenhuma')
            return without.includes(id) ? without.filter(r => r !== id) : [...without, id]
        })
    }

    const canAdvance = () => {
        switch (step) {
            case 1: return weight && height
            case 2: return mainGoal && selectedPains.length > 0
            case 3: return dietaryRestrictions.length > 0
            case 4: return activityLevel
            default: return false
        }
    }

    const handleSubmit = async () => {
        setError(null)
        setIsSubmitting(true)

        const formData = new FormData()
        formData.append("weight", weight)
        formData.append("height", height)
        formData.append("mainGoal", mainGoal)
        formData.append("painPoints", JSON.stringify(selectedPains))
        formData.append("dietaryRestrictions", JSON.stringify(
            dietaryRestrictions.includes('nenhuma') ? [] : dietaryRestrictions
        ))
        formData.append("activityLevel", activityLevel)

        const result = await completeOnboarding(formData)
        if (result?.error) {
            setError(result.error)
            setIsSubmitting(false)
        }
    }

    const handleNext = () => {
        if (step < TOTAL_STEPS) {
            setStep(step + 1)
        } else {
            handleSubmit()
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
                    >
                        <Sparkles className="text-white" size={28} />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-white mb-2">Bem-vinda ao Clube!</h1>
                    <p className="text-slate-400">Vamos personalizar sua experiência. Leva menos de 1 minuto.</p>
                </div>

                {/* Card Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-2 pt-4 mb-6">
                        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    i + 1 === step ? 'w-8 bg-indigo-500' :
                                    i + 1 < step ? 'w-2 bg-indigo-400' : 'w-2 bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>

                    <AnimatePresence mode="wait">

                        {/* STEP 1: Medidas */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="mx-auto w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-3">
                                        <Scale size={24} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Suas medidas iniciais</h2>
                                    <p className="text-sm text-slate-500 mt-1">Isso ajuda a IA a personalizar tudo para você</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-slate-400 font-medium mb-1 block">Peso atual (kg)</label>
                                        <input
                                            type="number"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            placeholder="Ex: 68.5"
                                            step="0.1"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-400 font-medium mb-1 block">Altura (cm)</label>
                                        <input
                                            type="number"
                                            value={height}
                                            onChange={(e) => setHeight(e.target.value)}
                                            placeholder="Ex: 165"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Objetivo + Dores */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="mx-auto w-12 h-12 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mb-3">
                                        <Target size={24} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Seu objetivo</h2>
                                </div>

                                <div className="space-y-2">
                                    {GOALS.map((goal) => (
                                        <button
                                            key={goal.id}
                                            type="button"
                                            onClick={() => setMainGoal(goal.id)}
                                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${
                                                mainGoal === goal.id
                                                    ? 'bg-indigo-500/15 border border-indigo-500/40 text-white'
                                                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                        >
                                            <span className="text-xl">{goal.emoji}</span>
                                            <span className="text-sm font-medium flex-1">{goal.label}</span>
                                            {mainGoal === goal.id && <CheckCircle size={18} className="text-indigo-400" />}
                                        </button>
                                    ))}
                                </div>

                                {mainGoal && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                    >
                                        <p className="text-sm text-slate-400 font-medium mb-3 mt-4">O que mais te incomoda hoje?</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {PAIN_POINTS.map((pain) => {
                                                const Icon = pain.icon
                                                const isSelected = selectedPains.includes(pain.id)
                                                return (
                                                    <button
                                                        key={pain.id}
                                                        type="button"
                                                        onClick={() => togglePain(pain.id)}
                                                        className={`text-left p-3 rounded-xl flex items-center gap-2 transition-all text-xs ${
                                                            isSelected
                                                                ? 'bg-indigo-500/15 border border-indigo-500/40 text-white'
                                                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <Icon size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-500'} />
                                                        <span className="flex-1 leading-tight">{pain.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 3: Restrições Alimentares */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="mx-auto w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-3">
                                        <Utensils size={24} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Restrições alimentares</h2>
                                    <p className="text-sm text-slate-500 mt-1">Para a IA respeitar suas necessidades</p>
                                </div>

                                <div className="space-y-2">
                                    {DIETARY_OPTIONS.map((opt) => {
                                        const isSelected = dietaryRestrictions.includes(opt.id)
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => toggleRestriction(opt.id)}
                                                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${
                                                    isSelected
                                                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-white'
                                                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                                    isSelected ? 'bg-emerald-600 border-emerald-500' : 'border-slate-700'
                                                }`}>
                                                    {isSelected && <CheckCircle size={12} className="text-white" />}
                                                </div>
                                                <span className="text-sm font-medium">{opt.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: Nível de Atividade */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="text-center mb-4">
                                    <div className="mx-auto w-12 h-12 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center mb-3">
                                        <Dumbbell size={24} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Nível de atividade</h2>
                                    <p className="text-sm text-slate-500 mt-1">Como é sua rotina de exercícios?</p>
                                </div>

                                <div className="space-y-3">
                                    {ACTIVITY_LEVELS.map((level) => {
                                        const Icon = level.icon
                                        const isSelected = activityLevel === level.id
                                        return (
                                            <button
                                                key={level.id}
                                                type="button"
                                                onClick={() => setActivityLevel(level.id)}
                                                className={`w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all ${
                                                    isSelected
                                                        ? 'bg-orange-500/15 border border-orange-500/40'
                                                        : 'bg-slate-950 border border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                    isSelected ? 'bg-orange-500/20' : 'bg-slate-800'
                                                }`}>
                                                    <Icon size={20} className={isSelected ? 'text-orange-400' : 'text-slate-500'} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{level.label}</p>
                                                    <p className="text-xs text-slate-500">{level.desc}</p>
                                                </div>
                                                {isSelected && <CheckCircle size={18} className="text-orange-400 ml-auto" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400 text-center">
                            {error}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex gap-3 mt-6">
                        {step > 1 && (
                            <Button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                className="h-12 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl flex-shrink-0 px-4"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                        )}
                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={!canAdvance() || isSubmitting}
                            className="h-12 flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Preparando tudo...
                                </>
                            ) : step === TOTAL_STEPS ? (
                                <>
                                    <Sparkles size={18} />
                                    Começar minha jornada
                                </>
                            ) : (
                                <>
                                    Continuar
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Privacy note */}
                <p className="text-center text-[10px] text-slate-600 mt-4">
                    Seus dados são protegidos e usados apenas para personalizar sua experiência.
                </p>
            </div>
        </div>
    )
}
