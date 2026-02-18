"use client"

import { useState } from "react"
import {
    Sparkles,
    Users,
    Target,
    Clock,
    MessageCircle,
    TrendingUp,
    ShieldCheck,
    Palette,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"

interface WizardProps {
    tenantId: string
    onComplete: () => void
    onClose: () => void
}

const questions = [
    {
        key: 'club_audience',
        icon: Users,
        title: 'Qual seu público principal?',
        subtitle: 'O que define suas pacientes',
        placeholder: 'Ex: Mulheres com endometriose, mioma, SOP, intestino irritável...',
        type: 'text' as const,
    },
    {
        key: 'club_goal',
        icon: Target,
        title: 'Qual o objetivo do clube?',
        subtitle: 'O que suas pacientes querem alcançar',
        placeholder: 'Ex: Emagrecimento saudável, controle de sintomas, rotina alimentar...',
        type: 'text' as const,
    },
    {
        key: 'club_frequency',
        icon: Clock,
        title: 'Frequência de engajamento',
        subtitle: 'Com que ritmo você quer interagir',
        options: [
            'Desafio mensal + check-in semanal',
            'Aulas semanais + desafio mensal',
            'Check-in diário + desafio mensal',
            'Conteúdo quinzenal + desafio mensal',
        ],
        type: 'select' as const,
    },
    {
        key: 'club_tone',
        icon: MessageCircle,
        title: 'Tom de comunicação',
        subtitle: 'Como você fala com suas pacientes',
        options: [
            '💜 Acolhedor e empático',
            '⚡ Direto e motivador',
            '🧬 Técnico e científico',
            '🌸 Leve e inspirador',
        ],
        type: 'select' as const,
    },
    {
        key: 'club_upgrades',
        icon: TrendingUp,
        title: 'Quais upgrades você oferece?',
        subtitle: 'Seus serviços premium para upsell',
        placeholder: 'Ex: Consulta individual, teste genético, acompanhamento semanal, mentoria...',
        type: 'text' as const,
    },
    {
        key: 'club_restrictions',
        icon: ShieldCheck,
        title: 'Alguma restrição?',
        subtitle: 'Algo que você NÃO quer no seu clube',
        placeholder: 'Ex: Nada de dietas extremas, sem contar calorias, sem promessas milagrosas...',
        type: 'text' as const,
    },
    {
        key: 'club_top_themes',
        icon: Palette,
        title: 'Top 3 temas do semestre',
        subtitle: 'O que você mais quer trabalhar com elas',
        placeholder: 'Ex: Saúde intestinal, hormônios, anti-inflamatório...',
        type: 'text' as const,
    },
]

export function ClubSetupWizard({ tenantId, onComplete, onClose }: WizardProps) {
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    const current = questions[step]
    const isLast = step === questions.length - 1
    const progress = ((step + 1) / questions.length) * 100

    const handleAnswer = (value: string) => {
        setAnswers(prev => ({ ...prev, [current.key]: value }))
    }

    const handleNext = async () => {
        if (isLast) {
            // Save to tenant
            setSaving(true)
            try {
                await supabase
                    .from('tenants')
                    .update({
                        ...answers,
                        club_setup_done: true
                    })
                    .eq('id', tenantId)
                onComplete()
            } catch (err) {
                console.error("Erro ao salvar setup:", err)
            } finally {
                setSaving(false)
            }
        } else {
            setStep(s => s + 1)
        }
    }

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1)
    }

    const Icon = current.icon

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-xl w-full bg-[#0f172a] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl"
            >
                {/* Progress bar */}
                <div className="h-1 bg-white/5">
                    <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                {/* Header */}
                <div className="px-8 pt-8 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-violet-500/20 p-2.5 rounded-xl border border-violet-500/30">
                            <Sparkles size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Setup Express • {step + 1}/{questions.length}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-xs font-bold">
                        Pular
                    </button>
                </div>

                {/* Question */}
                <div className="px-8 py-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                    <Icon size={24} className="text-violet-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{current.title}</h2>
                                    <p className="text-sm text-slate-400">{current.subtitle}</p>
                                </div>
                            </div>

                            {current.type === 'text' ? (
                                <textarea
                                    autoFocus
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none"
                                    placeholder={current.placeholder}
                                    value={answers[current.key] || ''}
                                    onChange={e => handleAnswer(e.target.value)}
                                />
                            ) : (
                                <div className="space-y-2">
                                    {current.options?.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleAnswer(opt)}
                                            className={`w-full text-left px-5 py-4 rounded-2xl border transition-all text-sm font-medium ${answers[current.key] === opt
                                                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{opt}</span>
                                                {answers[current.key] === opt && <Check size={16} className="text-violet-400" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-8 pb-8 flex items-center justify-between">
                    <Button
                        onClick={handleBack}
                        variant="outline"
                        disabled={step === 0}
                        className="h-12 border-white/10 text-slate-400 rounded-xl gap-2"
                    >
                        <ChevronLeft size={16} /> Voltar
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={saving || (!answers[current.key] && current.type === 'select')}
                        className="h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold gap-2 px-8"
                    >
                        {saving ? (
                            <><Loader2 className="animate-spin" size={16} /> Salvando...</>
                        ) : isLast ? (
                            <><Sparkles size={16} /> Gerar Meu Plano</>
                        ) : (
                            <>Próximo <ChevronRight size={16} /></>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
