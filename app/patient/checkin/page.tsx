"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, ArrowLeft, ArrowRight, Sparkles, Loader2, Star, Heart, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const STEPS = 6

const CYCLE_PHASES = [
    { value: 'menstrual',  label: 'Menstrual',   emoji: '🌑', desc: 'Dias 1-5 — descanso e introspecção' },
    { value: 'folicular',  label: 'Folicular',   emoji: '🌒', desc: 'Dias 6-13 — energia crescente' },
    { value: 'ovulatoria', label: 'Ovulatória',  emoji: '🌕', desc: 'Dias 14-17 — pico de energia' },
    { value: 'lutea',      label: 'Lútea',       emoji: '🌘', desc: 'Dias 18-28 — TPM e introspecção' },
    { value: 'nao_sei',    label: 'Não sei',     emoji: '🔮', desc: 'Tudo bem, pularemos esse dado' },
]

export default function WeeklyCheckinPage() {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)
    const [aiSummary, setAiSummary] = useState("")
    const [alreadyDone, setAlreadyDone] = useState(false)
    const [prevCheckin, setPrevCheckin] = useState<{ ai_summary?: string; diet_score?: number; mood?: string } | null>(null)
    const [checking, setChecking] = useState(true)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const [form, setForm] = useState({
        cycle_phase: "",
        diet_score: 7,
        main_difficulty: "",
        bowel: "",
        had_binge: false,
        mood: "",
        extra_notes: "",
    })

    useEffect(() => {
        fetch("/api/patient/weekly-checkin")
            .then(r => r.json())
            .then(d => {
                if (d.submitted) {
                    setAlreadyDone(true)
                    if (d.checkin) setPrevCheckin(d.checkin)
                }
            })
            .finally(() => setChecking(false))
    }, [])

    const handleSubmit = async () => {
        setSubmitting(true)
        setSubmitError(null)
        try {
            const res = await fetch("/api/patient/weekly-checkin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar')
            setAiSummary(data.ai_summary || "Semana registrada com sucesso!")
            setDone(true)
        } catch (err: any) {
            setSubmitError(err.message || "Erro ao enviar. Tente novamente.")
        } finally {
            setSubmitting(false)
        }
    }

    if (checking) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="text-indigo-500 animate-spin" size={32} />
        </div>
    )

    if (alreadyDone) return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
            <div className="h-16 w-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check-in da semana feito!</h2>
            <p className="text-slate-400 text-sm mb-5 max-w-xs">Você já enviou seu check-in esta semana. Volte na semana que vem. 💜</p>
            {prevCheckin?.ai_summary && (
                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 mb-6 max-w-sm w-full text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">Análise desta semana</p>
                    <p className="text-sm text-slate-300 italic leading-relaxed">"{prevCheckin.ai_summary}"</p>
                    {prevCheckin.diet_score !== undefined && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                            <span className="text-xs text-slate-500">Dieta:</span>
                            <span className={`text-sm font-bold ${prevCheckin.diet_score >= 8 ? 'text-emerald-400' : prevCheckin.diet_score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {prevCheckin.diet_score}/10
                            </span>
                            {prevCheckin.mood && <>
                                <span className="text-xs text-slate-500 ml-2">Humor:</span>
                                <span className="text-sm font-bold text-slate-300">{prevCheckin.mood}</span>
                            </>}
                        </div>
                    )}
                </div>
            )}
            <Link href="/patient/home" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-sm transition-all">
                ← Voltar ao início
            </Link>
        </div>
    )

    if (done) return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        >
            <div className="h-20 w-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-5">
                <Sparkles size={36} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check-in enviado! 👑</h2>
            <p className="text-slate-400 text-sm mb-4 max-w-xs">Sua nutricionista já recebeu seus dados desta semana.</p>
            {aiSummary && (
                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 mb-6 max-w-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">Análise da equipe</p>
                    <p className="text-sm text-slate-300 italic">"{aiSummary}"</p>
                </div>
            )}
            <Link href="/patient/home" className="px-6 py-3 bg-indigo-600 rounded-xl text-white font-bold text-sm">
                Voltar ao início →
            </Link>
        </motion.div>
    )

    return (
        <div className="min-h-screen px-4 pt-6 pb-10 flex flex-col max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link href="/patient/home">
                    <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <ArrowLeft size={18} className="text-slate-400" />
                    </div>
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-white">Check-in Semanal</h1>
                    <p className="text-xs text-slate-500">Passo {step + 1} de {STEPS}</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/10 rounded-full mb-8">
                <motion.div
                    className="h-full bg-indigo-500 rounded-full"
                    animate={{ width: `${((step + 1) / STEPS) * 100}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            <AnimatePresence mode="wait">
                {/* Step 0 - Ciclo hormonal */}
                {step === 0 && (
                    <motion.div key="s0h" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <Heart size={18} className="text-rose-400" />
                            <p className="text-white text-xl font-bold">Fase do ciclo esta semana</p>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Isso ajuda a entender seus sintomas e personalizar as recomendações.</p>
                        <div className="space-y-2">
                            {CYCLE_PHASES.map(phase => (
                                <button
                                    key={phase.value}
                                    onClick={() => setForm(f => ({ ...f, cycle_phase: phase.value }))}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                                        form.cycle_phase === phase.value
                                            ? "bg-rose-500/15 border-rose-500/40 text-white"
                                            : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                    }`}
                                >
                                    <span className="text-2xl flex-shrink-0">{phase.emoji}</span>
                                    <div>
                                        <p className="font-bold text-sm text-white">{phase.label}</p>
                                        <p className="text-xs text-slate-500">{phase.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Step 1 - Diet score */}
                {step === 1 && (
                    <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        <p className="text-white text-xl font-bold mb-2">Como foi sua dieta essa semana?</p>
                        <p className="text-slate-400 text-sm mb-8">De 0 a 10, qual nota você daria para sua adesão ao protocolo?</p>
                        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                            {Array.from({ length: 11 }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setForm(f => ({ ...f, diet_score: i }))}
                                    className={`w-11 h-11 rounded-xl font-bold text-sm transition-all ${
                                        form.diet_score === i
                                            ? "bg-indigo-600 text-white border-indigo-500"
                                            : "bg-white/5 border border-white/10 text-slate-400 hover:border-white/20"
                                    }`}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mb-8 px-1">
                            <span>Péssimo</span>
                            <span>Perfeito</span>
                        </div>
                        <div className="text-center mb-8">
                            <span className={`text-5xl font-black ${form.diet_score >= 8 ? "text-emerald-400" : form.diet_score >= 5 ? "text-amber-400" : "text-rose-400"}`}>
                                {form.diet_score}
                            </span>
                            <span className="text-slate-500 text-xl">/10</span>
                        </div>
                    </motion.div>
                )}

                {/* Step 2 - Main difficulty */}
                {step === 2 && (
                    <motion.div key="s2d" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        <p className="text-white text-xl font-bold mb-2">Qual foi sua maior dificuldade?</p>
                        <p className="text-slate-400 text-sm mb-6">Seja honesta, isso ajuda sua nutricionista a te ajudar melhor.</p>
                        <textarea
                            value={form.main_difficulty}
                            onChange={e => setForm(f => ({ ...f, main_difficulty: e.target.value }))}
                            placeholder="Ex: Não consigo resistir ao doce no fim do dia..."
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                        />
                    </motion.div>
                )}

                {/* Step 3 - Bowel + binge */}
                {step === 3 && (
                    <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col gap-6">
                        <div>
                            <p className="text-white text-xl font-bold mb-2">Como está seu intestino?</p>
                            <div className="flex gap-3 flex-wrap">
                                {["Normal", "Preso", "Solto"].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setForm(f => ({ ...f, bowel: opt }))}
                                        className={`px-5 py-3 rounded-xl text-sm font-bold border transition-all ${
                                            form.bowel === opt
                                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-white text-xl font-bold mb-2">Sentiu compulsão alimentar?</p>
                            <div className="flex gap-3">
                                {[{ label: "Sim", val: true }, { label: "Não", val: false }].map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setForm(f => ({ ...f, had_binge: opt.val }))}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                                            form.had_binge === opt.val
                                                ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Step 4 - Mood */}
                {step === 4 && (
                    <motion.div key="s4m" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        <p className="text-white text-xl font-bold mb-2">Como está seu humor?</p>
                        <p className="text-slate-400 text-sm mb-8">De modo geral, como você se sentiu essa semana?</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Ótimo", emoji: "🌟" },
                                { label: "Bom", emoji: "😊" },
                                { label: "Regular", emoji: "😐" },
                                { label: "Ruim", emoji: "😔" },
                            ].map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => setForm(f => ({ ...f, mood: opt.label }))}
                                    className={`p-4 rounded-2xl text-sm font-bold border transition-all flex flex-col items-center gap-2 ${
                                        form.mood === opt.label
                                            ? "bg-indigo-600/20 border-indigo-500 text-white"
                                            : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                    }`}
                                >
                                    <span className="text-2xl">{opt.emoji}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Step 5 - Extra notes */}
                {step === 5 && (
                    <motion.div key="s5n" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        <p className="text-white text-xl font-bold mb-2">Algo mais que queira compartilhar?</p>
                        <p className="text-slate-400 text-sm mb-6">Opcional. Pode falar sobre resultados, medidas, como se sentiu, qualquer coisa.</p>
                        <textarea
                            value={form.extra_notes}
                            onChange={e => setForm(f => ({ ...f, extra_notes: e.target.value }))}
                            placeholder="Opcional..."
                            rows={5}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none mb-6"
                        />
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Resumo do seu check-in</p>
                            <p className="text-sm text-slate-300">
                                {CYCLE_PHASES.find(p => p.value === form.cycle_phase)?.emoji || '—'} {CYCLE_PHASES.find(p => p.value === form.cycle_phase)?.label || '—'} · Nota: {form.diet_score}/10 · {form.bowel || "—"} · {form.had_binge ? "Teve compulsão" : "Sem compulsão"} · {form.mood || "—"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error banner */}
            {submitError && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3">
                    <AlertCircle size={14} className="text-rose-400 flex-shrink-0"/>
                    <p className="text-xs text-rose-300">{submitError}</p>
                </motion.div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-auto pt-6">
                {step > 0 && (
                    <button
                        onClick={() => setStep(s => s - 1)}
                        className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
                    >
                        <ArrowLeft size={20} className="text-slate-400" />
                    </button>
                )}
                {step < STEPS - 1 ? (
                    <button
                        onClick={() => setStep(s => s + 1)}
                        className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all text-white font-bold flex items-center justify-center gap-2"
                    >
                        Próximo <ArrowRight size={18} />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all text-white font-bold flex items-center justify-center gap-2"
                    >
                        {submitting ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <><Sparkles size={18} /> Enviar Check-in</>}
                    </button>
                )}
            </div>
        </div>
    )
}
