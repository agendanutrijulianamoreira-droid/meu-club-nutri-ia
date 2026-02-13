"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Brain,
    Sparkles,
    Target,
    ArrowRight,
    Check,
    Crown,
    Zap,
    Smartphone,
    Rocket,
    CheckCircle2,
    Palette,
    Mic
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { generateInitialSystem } from "@/lib/setup-engine"

export default function SetupWizard() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [isGenerating, setIsGenerating] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        specialty: "",
        methodName: "",
        niche: "emagrecimento", // Default
        archetype: "sage", // sage, lover, hero, ruler
        tone: "acolhedora",
        price: "497"
    })

    const totalSteps = 4

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1)
        } else {
            generateSystem()
        }
    }

    const generateSystem = async () => {
        setIsGenerating(true)

        try {
            await generateInitialSystem({
                name: formData.name,
                specialty: formData.specialty,
                methodName: formData.methodName,
                archetype: formData.archetype,
                tone: formData.tone,
                niche: formData.niche
            })

            // Wait a bit more for dramatic effect/UI
            setTimeout(() => {
                setIsGenerating(false)
                router.push("/admin")
            }, 3000)
        } catch (error) {
            console.error("Erro no setup:", error)
            setIsGenerating(false)
            alert("Houve um erro ao gerar seu sistema. Verifique a conexão.")
        }
    }

    if (isGenerating) {
        return (
            <div className="min-h-screen bg-[#0a0a16] flex flex-col items-center justify-center p-8 text-center text-white">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="mb-8"
                >
                    <Brain size={80} className="text-purple-500" />
                </motion.div>

                <h2 className="text-3xl font-black mb-4">IA está configurando seu Reino...</h2>
                <div className="space-y-3 max-w-sm">
                    <p className="text-gray-400 text-sm animate-pulse">✓ Gerando escada de produtos...</p>
                    <p className="text-gray-400 text-sm animate-pulse" style={{ animationDelay: '0.5s' }}>✓ Criando mensagens de boas-vindas...</p>
                    <p className="text-gray-400 text-sm animate-pulse" style={{ animationDelay: '1s' }}>✓ Estruturando calendário estratégico...</p>
                    <p className="text-gray-400 text-sm animate-pulse" style={{ animationDelay: '1.5s' }}>✓ Personalizando tom de voz {formData.tone}...</p>
                </div>

                <div className="mt-12 w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 5 }}
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a16] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/10 via-black to-black -z-10" />
            <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-2xl">
                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-12">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= s ? 'border-purple-500 bg-purple-500/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-white/10 text-gray-600'
                                }`}>
                                {step > s ? <Check size={20} /> : s}
                            </div>
                            {s < 4 && (
                                <div className={`h-1 flex-1 mx-2 rounded-full transition-all ${step > s ? 'bg-purple-500' : 'bg-white/5'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-purple-600/20 text-purple-400 text-xs font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-purple-500/30">Fase 1: Identidade</span>
                                <h1 className="text-4xl font-black mt-4 mb-2">Quem está no <span className="text-purple-500">Comando?</span></h1>
                                <p className="text-gray-400">Rainha, vamos configurar sua marca profissional em segundos.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Seu Nome Profissional</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-700 outline-none focus:border-purple-500 transition"
                                        placeholder="Ex: Dra. Julia Silva"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Sua Especialidade</label>
                                    <input
                                        value={formData.specialty}
                                        onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-700 outline-none focus:border-purple-500 transition"
                                        placeholder="Ex: Nutrição Esportiva"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Seu Nicho Principal</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'emagrecimento', label: 'Emagrecimento', icon: '🥗' },
                                        { id: 'hipertrofia', label: 'Hipertrofia', icon: '💪' },
                                    ].map(n => (
                                        <button
                                            key={n.id}
                                            onClick={() => setFormData({ ...formData, niche: n.id })}
                                            className={`p-4 rounded-2xl border flex items-center gap-3 transition ${formData.niche === n.id
                                                ? 'bg-purple-600/20 border-purple-500 text-white'
                                                : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                                                }`}
                                        >
                                            <span className="text-xl">{n.icon}</span>
                                            <span className="font-bold">{n.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button onClick={handleNext} className="h-16 px-12 text-lg font-black rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 shadow-xl shadow-purple-900/20" disabled={!formData.name || !formData.specialty}>
                                Próximo Passo <ArrowRight className="ml-2" />
                            </Button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-pink-600/20 text-pink-400 text-xs font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-pink-500/30">Fase 2: O Método</span>
                                <h1 className="text-4xl font-black mt-4 mb-2">Sua Assinatura <span className="text-pink-500">Única.</span></h1>
                                <p className="text-gray-400">Como se chama o seu método de transformação?</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Nome do Método</label>
                                    <input
                                        value={formData.methodName}
                                        onChange={e => setFormData({ ...formData, methodName: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-2xl font-black text-white placeholder:text-gray-700 outline-none focus:border-pink-500 transition"
                                        placeholder="Ex: Método BioGen 360"
                                    />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { id: 'sage', icon: <Brain size={20} />, label: 'Sábia' },
                                        { id: 'hero', icon: <Zap size={20} />, label: 'Heroína' },
                                        { id: 'ruler', icon: <Crown size={20} />, label: 'Rainha' },
                                        { id: 'lover', icon: <Palette size={20} />, label: 'Afetiva' },
                                    ].map(arch => (
                                        <button
                                            key={arch.id}
                                            onClick={() => setFormData({ ...formData, archetype: arch.id })}
                                            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition ${formData.archetype === arch.id
                                                ? 'bg-pink-600/20 border-pink-500 text-pink-400 shadow-lg shadow-pink-900/20'
                                                : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                                                }`}
                                        >
                                            {arch.icon}
                                            <span className="text-xs font-bold uppercase tracking-widest">{arch.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button onClick={() => setStep(step - 1)} variant="glass" className="h-16 px-8 rounded-2xl font-bold">Voltar</Button>
                                <Button onClick={handleNext} className="flex-1 h-16 text-lg font-black rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 shadow-xl shadow-pink-900/20" disabled={!formData.methodName}>
                                    Quase lá... <ArrowRight className="ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <span className="bg-yellow-600/20 text-yellow-400 text-xs font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-yellow-500/30">Fase 3: O Tom</span>
                                <h1 className="text-4xl font-black mt-4 mb-2">A Voz do seu <span className="text-yellow-500">Império.</span></h1>
                                <p className="text-gray-400">Como a IA deve falar com suas pacientes no dia a dia?</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { id: 'acolhedora', icon: '💖', name: 'Acolhedora', desc: 'Foco no emocional e cuidado' },
                                    { id: 'general', icon: '⭐', name: 'Motivadora', desc: 'Foco em resultados e energia' },
                                    { id: 'cientifica', icon: '🔬', name: 'Científica', desc: 'Foco em dados e fisiologia' }
                                ].map(tone => (
                                    <button
                                        key={tone.id}
                                        onClick={() => setFormData({ ...formData, tone: tone.id })}
                                        className={`p-6 rounded-3xl border text-center transition-all ${formData.tone === tone.id
                                            ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400 shadow-lg shadow-yellow-900/20'
                                            : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="text-3xl mb-3">{tone.icon}</div>
                                        <p className="font-bold mb-1">{tone.name}</p>
                                        <p className="text-[10px] uppercase font-black opacity-50 leading-relaxed">{tone.desc}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <Button onClick={() => setStep(step - 1)} variant="glass" className="h-16 px-8 rounded-2xl font-bold">Voltar</Button>
                                <Button onClick={handleNext} className="flex-1 h-16 text-lg font-black rounded-2xl bg-gradient-to-r from-yellow-600 to-orange-600 shadow-xl shadow-yellow-900/20">
                                    Último Passo <ArrowRight className="ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-center">
                                <Rocket size={48} className="text-green-500 mx-auto mb-4 animate-bounce" />
                                <h1 className="text-4xl font-black mb-2">Tudo pronto para o <span className="text-green-500">Lançamento?</span></h1>
                                <p className="text-gray-400">Ao clicar abaixo, nossa Inteligência desenhará seu **Planejamento de 365 dias** no banco de dados.</p>
                            </div>

                            <div className="glass-panel p-8 rounded-[2rem] border border-green-500/20 bg-green-500/5 space-y-4">
                                <div className="flex items-center gap-3 text-sm font-bold text-green-400">
                                    <CheckCircle2 size={18} /> Calendário Anual Completo (12 Protocolos Estratégicos)
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-green-400">
                                    <CheckCircle2 size={18} /> Sistema de Check-ins automáticos para {formData.niche}
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-green-400">
                                    <CheckCircle2 size={18} /> IA Concierge treinada no tom {formData.tone}
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-green-400">
                                    <CheckCircle2 size={18} /> Fases do {formData.methodName} estruturadas
                                </div>
                            </div>

                            <Button onClick={handleNext} className="w-full h-20 text-xl font-black rounded-3xl bg-green-600 hover:bg-green-500 shadow-2xl shadow-green-900/40">
                                FINALIZAR E GERAR INTELIGÊNCIA 👑
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
