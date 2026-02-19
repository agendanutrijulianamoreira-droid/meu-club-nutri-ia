"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Scale, Ruler, Target, Apple, ArrowRight, ArrowLeft,
    Sparkles, Loader2, CheckCircle, Heart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-browser"
import { saveOnboardingData } from "./actions"
import { useRouter } from "next/navigation"

const GOALS = [
    { label: "Emagrecer", emoji: "🔥" },
    { label: "Ganhar massa", emoji: "💪" },
    { label: "Desinchar", emoji: "💧" },
    { label: "Mais energia", emoji: "⚡" },
    { label: "Comer melhor", emoji: "🥗" },
    { label: "Saúde intestinal", emoji: "🦠" },
]

const RESTRICTIONS = [
    { id: "lactose", label: "Intolerância à Lactose", emoji: "🥛" },
    { id: "gluten", label: "Sem Glúten", emoji: "🌾" },
    { id: "vegetarian", label: "Vegetariana", emoji: "🥬" },
    { id: "vegan", label: "Vegana", emoji: "🌱" },
    { id: "egg", label: "Sem Ovo", emoji: "🥚" },
    { id: "seafood", label: "Sem Frutos do Mar", emoji: "🦐" },
    { id: "nuts", label: "Sem Oleaginosas", emoji: "🥜" },
    { id: "none", label: "Nenhuma restrição", emoji: "✅" },
]

export default function PatientOnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [saving, setSaving] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    // Form data
    const [weight, setWeight] = useState("")
    const [height, setHeight] = useState("")
    const [gender, setGender] = useState<string>("")
    const [goal, setGoal] = useState("")
    const [customGoal, setCustomGoal] = useState("")
    const [restrictions, setRestrictions] = useState<string[]>([])

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUserId(user.id)

            // Check if already completed
            const { data: profile } = await supabase
                .from('profiles')
                .select('onboarding_completed, onboarding_step')
                .eq('user_id', user.id)
                .single()

            if (profile?.onboarding_completed) {
                router.push('/patient/home')
            }
        }
        loadUser()
    }, [router])

    const toggleRestriction = (id: string) => {
        if (id === 'none') {
            setRestrictions(['none'])
            return
        }
        setRestrictions(prev => {
            const filtered = prev.filter(r => r !== 'none')
            return filtered.includes(id)
                ? filtered.filter(r => r !== id)
                : [...filtered, id]
        })
    }

    const handleComplete = async () => {
        setSaving(true)
        try {
            const finalGoal = goal === 'custom' ? customGoal : goal
            const result = await saveOnboardingData({
                initial_weight: weight ? parseFloat(weight) : undefined,
                current_weight: weight ? parseFloat(weight) : undefined,
                height: height ? parseFloat(height) : undefined,
                gender: gender as any || undefined,
                primary_goal: finalGoal || undefined,
                dietary_restrictions: restrictions.filter(r => r !== 'none'),
            })

            if (result.error) {
                console.error('Onboarding error:', result.error)
                setSaving(false)
                return
            }

            // Success! Navigate to home
            router.push('/patient/home')
        } catch (err) {
            console.error('Onboarding error:', err)
            setSaving(false)
        }
    }

    const canAdvance = () => {
        if (step === 1) return weight && height
        if (step === 2) return goal || customGoal
        if (step === 3) return restrictions.length > 0
        return true
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Progress Bar */}
            <div className="px-6 pt-6">
                <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3].map(s => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                : 'bg-white/10'
                                }`}
                        />
                    ))}
                </div>
                <p className="text-xs text-slate-500 text-right">Passo {step} de 3</p>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-center px-6 py-8">
                <AnimatePresence mode="wait">
                    {/* Step 1: Body Data */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-8"
                        >
                            <div>
                                <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
                                    <Scale size={14} className="text-indigo-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Seus Dados</span>
                                </div>
                                <h1 className="text-3xl font-bold mb-2">Vamos te conhecer! 💜</h1>
                                <p className="text-slate-400">Dados básicos para personalizar sua experiência.</p>
                            </div>

                            <div className="space-y-6">
                                {/* Weight */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                        Peso atual (kg)
                                    </label>
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="Ex: 68.5"
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-lg"
                                    />
                                </div>

                                {/* Height */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                        Altura (cm)
                                    </label>
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value)}
                                        placeholder="Ex: 165"
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-lg"
                                    />
                                </div>

                                {/* Gender */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                                        Gênero
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { value: 'female', label: 'Feminino', emoji: '👩' },
                                            { value: 'male', label: 'Masculino', emoji: '👨' },
                                            { value: 'other', label: 'Outro', emoji: '🌈' },
                                            { value: 'prefer_not_say', label: 'Prefiro não dizer', emoji: '🤫' },
                                        ].map(g => (
                                            <button
                                                key={g.value}
                                                onClick={() => setGender(g.value)}
                                                className={`h-14 rounded-2xl border text-sm font-bold transition-all ${gender === g.value
                                                    ? 'border-indigo-500 bg-indigo-600/10 text-indigo-400'
                                                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                                                    }`}
                                            >
                                                {g.emoji} {g.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Goal */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-8"
                        >
                            <div>
                                <div className="inline-flex items-center gap-2 bg-purple-600/10 border border-purple-500/20 rounded-full px-4 py-2 mb-4">
                                    <Target size={14} className="text-purple-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Seu Objetivo</span>
                                </div>
                                <h1 className="text-3xl font-bold mb-2">Qual seu objetivo? 🎯</h1>
                                <p className="text-slate-400">Isso nos ajuda a direcionar seu protocolo.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {GOALS.map(g => (
                                    <button
                                        key={g.label}
                                        onClick={() => { setGoal(g.label); setCustomGoal("") }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${goal === g.label
                                            ? 'border-purple-500 bg-purple-600/10'
                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="text-2xl mb-2">{g.emoji}</div>
                                        <div className="text-sm font-bold text-white">{g.label}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Custom goal */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Ou descreva com suas palavras:
                                </label>
                                <input
                                    type="text"
                                    value={customGoal}
                                    onChange={(e) => { setCustomGoal(e.target.value); setGoal('custom') }}
                                    placeholder="Ex: Emagrecer 10kg até o casamento"
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all"
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Restrictions */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-8"
                        >
                            <div>
                                <div className="inline-flex items-center gap-2 bg-green-600/10 border border-green-500/20 rounded-full px-4 py-2 mb-4">
                                    <Apple size={14} className="text-green-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Restrições</span>
                                </div>
                                <h1 className="text-3xl font-bold mb-2">Alguma restrição? 🍽️</h1>
                                <p className="text-slate-400">Selecione todas que se aplicam ao seu caso.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {RESTRICTIONS.map(r => {
                                    const selected = restrictions.includes(r.id)
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => toggleRestriction(r.id)}
                                            className={`p-4 rounded-2xl border text-left transition-all ${selected
                                                ? 'border-green-500 bg-green-600/10'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="text-2xl mb-2">{r.emoji}</div>
                                            <div className="text-xs font-bold text-white">{r.label}</div>
                                            {selected && (
                                                <CheckCircle size={14} className="text-green-400 absolute top-3 right-3" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Nav */}
            <div className="p-6 border-t border-white/10">
                <div className="flex items-center gap-4">
                    {step > 1 && (
                        <Button
                            onClick={() => setStep(step - 1)}
                            variant="outline"
                            className="h-14 px-6 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                            <ArrowLeft size={18} />
                        </Button>
                    )}

                    <Button
                        onClick={() => {
                            if (step < 3) setStep(step + 1)
                            else handleComplete()
                        }}
                        disabled={!canAdvance() || saving}
                        className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-sm border-none gap-2 disabled:opacity-40"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : step === 3 ? (
                            <>
                                <Sparkles size={18} />
                                Começar Jornada!
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
        </div>
    )
}
