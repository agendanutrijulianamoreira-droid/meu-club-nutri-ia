"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Check, Loader2, ClipboardList } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"

interface Question {
    id: string
    question_text: string
    question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'yesno' | 'scale'
    question_order: number
    options: string[] | null
    is_required: boolean
}

interface Questionnaire {
    id: string
    name: string
    description: string | null
    estimated_minutes: number
    is_active: boolean
    tenant_id: string
}

export default function PatientQuestionnairePage() {
    const params = useParams()
    const router = useRouter()
    const id = params?.id as string

    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setUserId(user.id)

            const { data: qData, error: qErr } = await supabase
                .from('questionnaires')
                .select('*')
                .eq('id', id)
                .eq('is_active', true)
                .single()

            if (qErr || !qData) {
                setError('Questionário não encontrado ou inativo.')
                setLoading(false)
                return
            }

            const { data: questions } = await supabase
                .from('questionnaire_questions')
                .select('*')
                .eq('questionnaire_id', id)
                .order('question_order')

            setQuestionnaire(qData)
            setQuestions(questions || [])
            setLoading(false)
        }
        if (id) init()
    }, [id])

    const currentQ = questions[currentStep]
    const isLast = currentStep === questions.length - 1
    const progress = questions.length > 0 ? ((currentStep + 1) / questions.length) * 100 : 0

    const setAnswer = (value: string | string[]) => {
        setAnswers(prev => ({ ...prev, [currentQ.id]: value }))
    }

    const toggleMultiselect = (option: string) => {
        const current = (answers[currentQ.id] as string[]) || []
        const updated = current.includes(option)
            ? current.filter(o => o !== option)
            : [...current, option]
        setAnswer(updated)
    }

    const canProceed = () => {
        if (!currentQ) return false
        if (!currentQ.is_required) return true
        const val = answers[currentQ.id]
        if (!val) return false
        if (Array.isArray(val)) return val.length > 0
        return String(val).trim().length > 0
    }

    const next = () => {
        if (!canProceed()) return
        if (isLast) {
            submit()
        } else {
            setCurrentStep(s => s + 1)
        }
    }

    const back = () => {
        if (currentStep > 0) setCurrentStep(s => s - 1)
    }

    const submit = async () => {
        if (!questionnaire || !userId) return
        setSubmitting(true)
        try {
            const { error } = await supabase.from('questionnaire_responses').insert({
                questionnaire_id: questionnaire.id,
                tenant_id: questionnaire.tenant_id,
                patient_id: userId,
                answers,
                completed_at: new Date().toISOString(),
            })
            if (error) throw error
            setSubmitted(true)
        } catch (e: any) {
            setError(e.message || 'Erro ao enviar resposta.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b] flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b] flex items-center justify-center px-4">
                <div className="text-center">
                    <ClipboardList size={48} className="mx-auto text-slate-700 mb-3" />
                    <p className="text-slate-400">{error}</p>
                    <button onClick={() => router.back()} className="mt-4 text-indigo-400 text-sm hover:underline">Voltar</button>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b] flex items-center justify-center px-4">
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-6">
                        <Check size={36} className="text-emerald-400" />
                    </div>
                    <h2 className="text-white text-2xl font-black mb-2">Respostas enviadas!</h2>
                    <p className="text-slate-400 text-sm mb-8">Obrigada por responder. Sua nutricionista já pode ver suas respostas.</p>
                    <button onClick={() => router.push('/patient/home')}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all text-sm">
                        Voltar ao início
                    </button>
                </motion.div>
            </div>
        )
    }

    if (!questionnaire || questions.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b] flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-slate-400">Este questionário não possui perguntas.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1a2b] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4 flex-shrink-0">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => router.back()}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <ChevronLeft size={18} className="text-white" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-black truncate">{questionnaire.name}</p>
                            <p className="text-slate-500 text-[10px]">
                                Pergunta {currentStep + 1} de {questions.length} · ~{questionnaire.estimated_minutes} min
                            </p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-indigo-500 rounded-full"
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="flex-1 overflow-y-auto px-4 py-8 max-w-md mx-auto w-full">
                {questionnaire.description && currentStep === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white/[0.03] border border-white/8 rounded-2xl px-4 py-3 mb-6 text-sm text-slate-400">
                        {questionnaire.description}
                    </motion.div>
                )}

                <AnimatePresence mode="wait">
                    <motion.div key={currentStep}
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6">

                        <div>
                            <p className="text-white text-lg font-bold leading-snug mb-1">{currentQ.question_text}</p>
                            {currentQ.is_required && <p className="text-[10px] text-slate-600 uppercase tracking-wider">Obrigatória</p>}
                        </div>

                        {/* Text */}
                        {currentQ.question_type === 'text' && (
                            <input
                                value={(answers[currentQ.id] as string) || ''}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="Sua resposta..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all"
                            />
                        )}

                        {/* Textarea */}
                        {currentQ.question_type === 'textarea' && (
                            <textarea
                                value={(answers[currentQ.id] as string) || ''}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="Sua resposta..."
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all resize-none"
                            />
                        )}

                        {/* Select */}
                        {currentQ.question_type === 'select' && (
                            <div className="space-y-2">
                                {(currentQ.options || []).map(opt => (
                                    <button key={opt} onClick={() => setAnswer(opt)}
                                        className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all border ${
                                            answers[currentQ.id] === opt
                                                ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                                : 'bg-white/[0.03] border-white/8 text-slate-300 hover:border-white/20'
                                        }`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Multiselect */}
                        {currentQ.question_type === 'multiselect' && (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-500">Selecione todas que se aplicam</p>
                                {(currentQ.options || []).map(opt => {
                                    const selected = ((answers[currentQ.id] as string[]) || []).includes(opt)
                                    return (
                                        <button key={opt} onClick={() => toggleMultiselect(opt)}
                                            className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all border flex items-center gap-3 ${
                                                selected
                                                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                                    : 'bg-white/[0.03] border-white/8 text-slate-300 hover:border-white/20'
                                            }`}>
                                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                                selected ? 'bg-indigo-500 border-indigo-400' : 'border-slate-600'
                                            }`}>
                                                {selected && <Check size={10} className="text-white" />}
                                            </div>
                                            {opt}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Yes / No */}
                        {currentQ.question_type === 'yesno' && (
                            <div className="grid grid-cols-2 gap-3">
                                {['Sim', 'Não'].map(opt => (
                                    <button key={opt} onClick={() => setAnswer(opt)}
                                        className={`py-4 rounded-2xl text-sm font-bold transition-all border ${
                                            answers[currentQ.id] === opt
                                                ? opt === 'Sim'
                                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                                    : 'bg-rose-600/20 border-rose-500/40 text-rose-300'
                                                : 'bg-white/[0.03] border-white/8 text-slate-300 hover:border-white/20'
                                        }`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Scale */}
                        {currentQ.question_type === 'scale' && (
                            <div>
                                <div className="grid grid-cols-5 gap-2 mb-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <button key={n} onClick={() => setAnswer(String(n))}
                                            className={`aspect-square rounded-xl text-sm font-black transition-all border ${
                                                answers[currentQ.id] === String(n)
                                                    ? 'bg-indigo-600 border-indigo-400 text-white'
                                                    : 'bg-white/[0.03] border-white/8 text-slate-400 hover:border-white/20 hover:text-white'
                                            }`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span>Nada</span>
                                    <span>Muito</span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 pb-8 pt-4 px-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent flex-shrink-0">
                <div className="max-w-md mx-auto flex gap-3">
                    {currentStep > 0 && (
                        <button onClick={back}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex-shrink-0">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <button onClick={next} disabled={!canProceed() || submitting}
                        className="flex-1 flex items-center justify-center gap-2 h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-2xl transition-all text-sm">
                        {submitting
                            ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                            : isLast
                                ? <><Check size={16} /> Enviar respostas</>
                                : <>Próxima <ChevronRight size={16} /></>
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}
