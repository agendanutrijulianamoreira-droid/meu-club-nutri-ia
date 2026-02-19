"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Activity, Zap, CheckCircle, Scale, Target, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "./actions"

const PAIN_POINTS = [
    { id: 'efeito_sanfona', label: 'Efeito sanfona constante', icon: Activity },
    { id: 'falta_energia', label: 'Falta de energia e cansaço', icon: Zap },
    { id: 'rotina_corrida', label: 'Dificuldade de focar na dieta com a rotina corrida', icon: Target },
]

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [weight, setWeight] = useState("")
    const [height, setHeight] = useState("")
    const [mainGoal, setMainGoal] = useState("emagrecimento")
    const [selectedPains, setSelectedPains] = useState<string[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const togglePain = (id: string) => {
        setSelectedPains(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append("weight", weight);
        formData.append("height", height);
        formData.append("mainGoal", mainGoal);
        formData.append("painPoints", JSON.stringify(selectedPains));

        const result = await completeOnboarding(formData);
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">

                {/* Cabeçalho */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Bem-vinda ao Clube! ✨</h1>
                    <p className="text-slate-400">Vamos configurar seu espaço. Leva só 30 segundos.</p>
                </div>

                {/* Container do Wizard */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    {/* Barra de Progresso */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            initial={{ width: '33%' }}
                            animate={{ width: `${(step / 2) * 100}%` }}
                        />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <AnimatePresence mode="wait">

                            {/* PASSO 1: Medidas */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6 pt-4"
                                >
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
                                            <Scale size={24} />
                                        </div>
                                        <h2 className="text-xl font-semibold text-white">Suas medidas iniciais</h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm text-slate-400 font-medium mb-1 block">Peso Atual (kg)</label>
                                            <input
                                                type="number"
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                                placeholder="Ex: 68.5"
                                                step="0.1"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-400 font-medium mb-1 block">Altura (cm)</label>
                                            <input
                                                type="number"
                                                value={height}
                                                onChange={(e) => setHeight(e.target.value)}
                                                placeholder="Ex: 165"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={() => weight && height && setStep(2)}
                                        disabled={!weight || !height}
                                        className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2"
                                    >
                                        Continuar <ArrowRight size={18} />
                                    </Button>
                                </motion.div>
                            )}

                            {/* PASSO 2: Dores e Objetivo */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6 pt-4"
                                >
                                    <div className="text-center mb-6">
                                        <h2 className="text-xl font-semibold text-white mb-2">O que mais te incomoda hoje?</h2>
                                        <p className="text-sm text-slate-400">Isso ajudará a IA a personalizar seus lembretes.</p>
                                    </div>

                                    <div className="space-y-3">
                                        {PAIN_POINTS.map((pain) => {
                                            const Icon = pain.icon
                                            const isSelected = selectedPains.includes(pain.id)
                                            return (
                                                <div
                                                    key={pain.id}
                                                    onClick={() => togglePain(pain.id)}
                                                    className={`cursor-pointer border rounded-xl p-4 flex items-center gap-4 transition-all ${isSelected ? 'bg-indigo-500/10 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                                >
                                                    <div className={isSelected ? 'text-indigo-400' : 'text-slate-500'}>
                                                        <Icon size={24} />
                                                    </div>
                                                    <span className={`flex-1 text-sm ${isSelected ? 'text-white font-medium' : 'text-slate-400'}`}>
                                                        {pain.label}
                                                    </span>
                                                    {isSelected && <CheckCircle size={20} className="text-indigo-400" />}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                                    <div className="flex gap-3 mt-8">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setStep(1)}
                                            className="h-12 border-slate-700 text-slate-300 hover:bg-slate-800 flex-1"
                                        >
                                            Voltar
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || selectedPains.length === 0}
                                            className="h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold flex-1 flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Finalizar"}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </form>
                </div>
            </div>
        </div>
    )
}
