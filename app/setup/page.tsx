"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Brain,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Check,
    Crown,
    Zap,
    Rocket,
    CheckCircle2,
    Palette,
    Loader2,
    AlertCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"

type ToastState = { type: 'error'; msg: string } | null

interface FormData {
    name: string
    specialty: string
    methodName: string
    niche: 'emagrecimento' | 'hipertrofia'
    archetype: 'sage' | 'hero' | 'ruler' | 'lover'
    tone: 'acolhedora' | 'general' | 'cientifica'
}

export default function SetupWizard() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [isGenerating, setIsGenerating] = useState(false)
    const [toast, setToast] = useState<ToastState>(null)

    const [formData, setFormData] = useState<FormData>({
        name: "",
        specialty: "",
        methodName: "",
        niche: "emagrecimento",
        archetype: "sage",
        tone: "acolhedora",
    })

    const totalSteps = 4

    const showError = (msg: string) => {
        setToast({ type: 'error', msg })
        setTimeout(() => setToast(null), 4000)
    }

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1)
        else generateSystem()
    }

    const generateSystem = async () => {
        setIsGenerating(true)
        try {
            const res = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao configurar sistema')

            setTimeout(() => {
                router.push('/admin')
            }, 3000)
        } catch (err: any) {
            console.error('[Setup]', err)
            setIsGenerating(false)
            showError(err.message || 'Houve um erro ao gerar seu sistema. Verifique a conexão.')
        }
    }

    const update = (patch: Partial<FormData>) => setFormData(prev => ({ ...prev, ...patch }))

    if (isGenerating) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-white">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="mb-8"
                >
                    <Brain size={80} className="text-indigo-400" />
                </motion.div>

                <h2 className="text-3xl font-black mb-4">IA está configurando seu Clube...</h2>
                <div className="space-y-3 max-w-sm">
                    {[
                        'Personalizando prompt do método...',
                        'Criando planejamento anual...',
                        'Ativando protocolo do mês...',
                        `Calibrando tom ${formData.tone}...`,
                    ].map((msg, i) => (
                        <motion.p
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.6 }}
                            className="text-slate-400 text-sm flex items-center gap-2 justify-center"
                        >
                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            {msg}
                        </motion.p>
                    ))}
                </div>

                <div className="mt-12 w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4.5 }}
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-600"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-2xl">
                {/* Progress bar */}
                <div className="flex justify-between items-center mb-12">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                                step > s
                                    ? 'border-indigo-500 bg-indigo-500 text-white'
                                    : step === s
                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                    : 'border-white/10 text-slate-600'
                            }`}>
                                {step > s ? <Check size={18} /> : s}
                            </div>
                            {s < 4 && (
                                <div className={`h-0.5 flex-1 mx-2 rounded-full transition-all ${step > s ? 'bg-indigo-500' : 'bg-white/5'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-6 flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-medium"
                        >
                            <AlertCircle size={16} className="shrink-0" />
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {/* ── STEP 1: Identidade ── */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-indigo-600/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/30">
                                    Fase 1 de 4 — Identidade
                                </span>
                                <h1 className="text-4xl font-light mt-4 mb-2">
                                    Quem está no <span className="font-black">Comando?</span>
                                </h1>
                                <p className="text-slate-400">Configure sua marca profissional em segundos.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seu Nome Profissional</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => update({ name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition"
                                        placeholder="Ex: Dra. Juliana Moreira"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sua Especialidade</label>
                                    <input
                                        value={formData.specialty}
                                        onChange={e => update({ specialty: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition"
                                        placeholder="Ex: Nutrição Funcional"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seu Nicho Principal</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'emagrecimento' as const, label: 'Emagrecimento', icon: '🥗', desc: 'Perda de peso funcional e sustentável' },
                                        { id: 'hipertrofia' as const, label: 'Hipertrofia', icon: '💪', desc: 'Ganho de massa e performance' },
                                    ].map(n => (
                                        <button
                                            key={n.id}
                                            onClick={() => update({ niche: n.id })}
                                            className={`p-5 rounded-3xl border flex flex-col items-start gap-2 transition-all text-left ${
                                                formData.niche === n.id
                                                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                                            }`}
                                        >
                                            <span className="text-2xl">{n.icon}</span>
                                            <span className="font-bold text-sm">{n.label}</span>
                                            <span className="text-[10px] text-slate-500 leading-snug">{n.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleNext}
                                disabled={!formData.name || !formData.specialty}
                                className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-black rounded-2xl transition-all"
                            >
                                Próximo Passo <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}

                    {/* ── STEP 2: Método ── */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-violet-600/20 text-violet-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-violet-500/30">
                                    Fase 2 de 4 — O Método
                                </span>
                                <h1 className="text-4xl font-light mt-4 mb-2">
                                    Sua Assinatura <span className="font-black">Única.</span>
                                </h1>
                                <p className="text-slate-400">Como se chama o seu método de transformação?</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome do Método</label>
                                    <input
                                        value={formData.methodName}
                                        onChange={e => update({ methodName: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xl font-black text-white placeholder:text-slate-600 outline-none focus:border-violet-500 transition"
                                        placeholder="Ex: Método BioGen 360"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Arquétipo da Nutricionista</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { id: 'sage' as const, icon: <Brain size={20} />, label: 'Sábia', desc: 'Ciência e consciência' },
                                            { id: 'hero' as const, icon: <Zap size={20} />, label: 'Heroína', desc: 'Energia e desafio' },
                                            { id: 'ruler' as const, icon: <Crown size={20} />, label: 'Rainha', desc: 'Poder e soberania' },
                                            { id: 'lover' as const, icon: <Palette size={20} />, label: 'Afetiva', desc: 'Cuidado e conexão' },
                                        ].map(arch => (
                                            <button
                                                key={arch.id}
                                                onClick={() => update({ archetype: arch.id })}
                                                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                                                    formData.archetype === arch.id
                                                        ? 'bg-violet-600/20 border-violet-500 text-violet-400'
                                                        : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                                                }`}
                                            >
                                                {arch.icon}
                                                <span className="text-[10px] font-black uppercase tracking-widest">{arch.label}</span>
                                                <span className="text-[9px] text-slate-500 text-center leading-snug">{arch.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="flex items-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
                                >
                                    <ArrowLeft size={16} /> Voltar
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={!formData.methodName}
                                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-black rounded-2xl transition-all"
                                >
                                    Quase lá... <ArrowRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 3: Tom de Voz ── */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-amber-600/20 text-amber-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/30">
                                    Fase 3 de 4 — Tom de Voz
                                </span>
                                <h1 className="text-4xl font-light mt-4 mb-2">
                                    A Voz do seu <span className="font-black">Clube.</span>
                                </h1>
                                <p className="text-slate-400">Como a IA deve falar com suas pacientes no dia a dia?</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { id: 'acolhedora' as const, icon: '💖', name: 'Acolhedora', desc: 'Foco no emocional e cuidado. Linguagem gentil e empática.' },
                                    { id: 'general' as const, icon: '⚡', name: 'Motivadora', desc: 'Foco em resultados e energia. Linguagem inspiradora.' },
                                    { id: 'cientifica' as const, icon: '🔬', name: 'Científica', desc: 'Foco em dados e fisiologia. Linguagem técnica e precisa.' },
                                ].map(tone => (
                                    <button
                                        key={tone.id}
                                        onClick={() => update({ tone: tone.id })}
                                        className={`p-6 rounded-3xl border text-left transition-all ${
                                            formData.tone === tone.id
                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                                                : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                                        }`}
                                    >
                                        <div className="text-3xl mb-3">{tone.icon}</div>
                                        <p className="font-black text-sm mb-1 text-white">{tone.name}</p>
                                        <p className="text-[10px] opacity-60 leading-relaxed">{tone.desc}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="flex items-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
                                >
                                    <ArrowLeft size={16} /> Voltar
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-2xl transition-all"
                                >
                                    Último Passo <ArrowRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 4: Confirmação ── */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-center">
                                <motion.div
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="inline-block mb-6"
                                >
                                    <Rocket size={52} className="text-emerald-400 mx-auto" />
                                </motion.div>
                                <h1 className="text-4xl font-light mb-2">
                                    Tudo pronto para o <span className="font-black text-emerald-400">Lançamento?</span>
                                </h1>
                                <p className="text-slate-400">
                                    Ao confirmar, a IA irá configurar seu clube com base nas informações abaixo.
                                </p>
                            </div>

                            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-3">
                                {[
                                    { icon: <Sparkles size={16} />, label: `Método: ${formData.methodName}` },
                                    { icon: <CheckCircle2 size={16} />, label: `Especialidade: ${formData.specialty || 'Nutrição'}` },
                                    { icon: <CheckCircle2 size={16} />, label: `Nicho: ${formData.niche === 'hipertrofia' ? 'Hipertrofia e Performance' : 'Emagrecimento Funcional'}` },
                                    { icon: <CheckCircle2 size={16} />, label: `Tom de voz: ${formData.tone}` },
                                    { icon: <CheckCircle2 size={16} />, label: `Planejamento anual criado (${TEMPLATE_COUNTS[formData.niche]} protocolos)` },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm font-medium text-emerald-400">
                                        <span className="shrink-0">{item.icon}</span>
                                        {item.label}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="flex items-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm font-bold rounded-2xl transition-all"
                                >
                                    <ArrowLeft size={16} /> Voltar
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="flex-1 flex items-center justify-center gap-2 py-5 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-black rounded-2xl transition-all shadow-xl shadow-emerald-900/30"
                                >
                                    <Crown size={18} /> Gerar Inteligência e Lançar
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

const TEMPLATE_COUNTS: Record<string, number> = {
    emagrecimento: 12,
    hipertrofia: 5,
}
