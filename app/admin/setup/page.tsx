"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Crown,
    Sparkles,
    ChevronRight,
    LayoutDashboard,
    Target,
    Users,
    Settings,
    ArrowRight,
    Loader2,
    CheckCircle,
    MessageCircle,
    Calendar,
    Zap,
    Scale,
    Dna,
    Lock,
    Unlock,
    Plus,
    Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ANNUAL_TEMPLATES } from "@/lib/templates/annual-plans"
import { supabase } from "@/lib/supabase"

export default function SetupWizardPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        brandName: "",
        niche: "", // Agora é texto livre
        methodName: "",
        hasGenetics: false,
        methodStorytelling: "Realista e Científico",
        phases: [
            { id: 1, name: 'Fase 1', technical: 'Desinflamação e limpeza hepática', type: 'entry', locked: false, duration: '21 dias' },
            { id: 2, name: 'Fase 2', technical: 'Introdução de FODMAPs e reparo', type: 'upsell', locked: true, duration: 'Consulta' },
        ],
        aiTone: "acolhedora",
        pilotActive: true,
        checkinEnabled: true
    })

    const generatePhaseNames = () => {
        // Simulação de IA gerando nomes baseados no storytelling
        const prefixMap: any = {
            "Realista e Científico": ["Protocolo", "Módulo", "Etapa"],
            "Épico e Inspirador": ["Portal", "Ascensão", "Reinado"],
            "Minimalista": ["Fluxo", "Base", "Essência"],
            "Desafiador": ["Sprint", "Batalha", "Conquista"]
        }
        const prefixes = prefixMap[formData.methodStorytelling] || ["Fase"]

        setFormData({
            ...formData,
            phases: formData.phases.map((p, i) => ({
                ...p,
                name: `${prefixes[i % prefixes.length]} ${p.technical.split(' ')[0]}`
            }))
        })
    }

    const addPhase = () => {
        setFormData({
            ...formData,
            phases: [...formData.phases, {
                id: Date.now(),
                name: 'Nova Fase',
                technical: '',
                type: 'maintenance',
                locked: true,
                duration: '60 dias'
            }]
        })
    }

    const removePhase = (id: number) => {
        setFormData({
            ...formData,
            phases: formData.phases.filter(p => p.id !== id)
        })
    }

    const updatePhase = (id: number, field: string, value: string | boolean) => {
        setFormData({
            ...formData,
            phases: formData.phases.map(p => p.id === id ? { ...p, [field]: value } : p)
        })
    }

    const handleFinish = async () => {
        setLoading(true)

        try {
            // 1. Salvar Configurações no Tenant
            const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()

            if (tenant) {
                await supabase.from('tenants').update({
                    name: formData.brandName,
                    niche: formData.niche,
                    ai_tone: formData.aiTone,
                    method_name: formData.methodName,
                    has_genetic_testing: formData.hasGenetics,
                    method_storytelling: formData.methodStorytelling,
                    method_phases: formData.phases,
                    pilot_active: formData.pilotActive,
                    checkin_enabled: formData.checkinEnabled
                }).eq('id', tenant.id)
            }

            // 2. Determinar Template (Fuzzy Match)
            const nicheKey = formData.niche.toLowerCase().includes('hiper') || formData.niche.toLowerCase().includes('massa')
                ? 'hipertrofia'
                : 'emagrecimento'

            const template = ANNUAL_TEMPLATES[nicheKey] || ANNUAL_TEMPLATES.emagrecimento
            const today = new Date()
            const currentMonth = today.getMonth()
            const currentYear = today.getFullYear()

            // 3. Injetar Planejamento Anual
            for (const item of template) {
                let year = currentYear
                if (item.month_index < currentMonth) year = currentYear + 1

                const startDate = new Date(year, item.month_index, 1)
                const endDate = new Date(startDate.getTime() + (item.duration_days * 24 * 60 * 60 * 1000))

                if (item.type === 'protocolo') {
                    const { data: protocol } = await supabase.from('protocols').insert({
                        title: item.title,
                        description: `${item.description} (Adaptado para o ${formData.methodName})`,
                        duration_days: item.duration_days,
                        is_active: true,
                        tenant_id: tenant?.id || null,
                        content_json: []
                    }).select().single()

                    if (protocol) {
                        // Criar Dia 1 (Protocolo Uau)
                        const { data: day } = await supabase.from('protocol_days').insert({
                            protocol_id: protocol.id,
                            day_number: 1,
                            title: "Fase de Despertar",
                            subtitle: "Iniciando sua jornada no " + formData.methodName
                        }).select().single()

                        if (day) {
                            await supabase.from('protocol_items').insert([
                                {
                                    protocol_day_id: day.id,
                                    type: 'meal',
                                    title: 'Café da Manhã (3 Opções Nutrigenéticas)',
                                    description: 'Opção 1: Ovos com Cúrcuma\nOpção 2: Shake de Proteína\nOpção 3: Iogurte com Sementes',
                                    is_mandatory: true,
                                    points: 30
                                },
                                {
                                    protocol_day_id: day.id,
                                    type: 'content',
                                    title: 'Contrato de Compromisso',
                                    description: 'Eu me comprometo a seguir as orientações do ' + formData.methodName + ' por ' + item.duration_days + ' dias.',
                                    is_mandatory: true,
                                    points: 10
                                }
                            ])
                        }
                    }
                } else {
                    // Injetar como Desafio
                    await supabase.from('challenges').insert({
                        title: item.title,
                        description: item.description,
                        emoji: item.emoji || '🏆',
                        duration_days: item.duration_days,
                        start_date: startDate.toISOString(),
                        end_date: endDate.toISOString(),
                        is_active: true,
                        tenant_id: tenant?.id || null
                    })
                }
            }

            await new Promise(resolve => setTimeout(resolve, 4000))
            router.push('/admin')
        } catch (error) {
            console.error("Erro no setup:", error)
            alert("Ocorreu um erro ao configurar seu reino. Tente novamente.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0f0c29] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-queen-pink/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-4xl w-full z-10 transition-all">
                <div className="flex flex-col items-center mb-12 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-queen-pink to-purple-600 flex items-center justify-center shadow-lg shadow-queen-pink/20 mb-6 mx-auto">
                        <Crown size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold font-outfit tracking-tight mb-2">Configure seu Império 👑</h1>

                    <div className="flex items-center gap-2 mt-8">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= s ? 'bg-queen-pink' : 'bg-white/10'}`}
                            />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Passo 1: Identidade */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6 max-w-2xl mx-auto"
                        >
                            <div className="space-y-4 text-center">
                                <h2 className="text-2xl font-bold">1. Sua Comunidade</h2>
                                <p className="text-gray-400">Dê um nome para a sua comunidade exclusiva.</p>
                                <input
                                    type="text"
                                    placeholder="Ex: Comunidade Rainhas da Nutri"
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-6 text-white text-2xl focus:outline-none focus:border-queen-pink/50 transition-all font-bold text-center"
                                    value={formData.brandName}
                                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                                />
                            </div>

                            <Button
                                onClick={() => setStep(2)}
                                disabled={!formData.brandName}
                                className="w-full py-8 text-lg bg-queen-pink hover:bg-queen-pink/90 rounded-2xl font-bold group shadow-xl shadow-queen-pink/20"
                            >
                                Avançar para meu Nicho
                                <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </motion.div>
                    )}

                    {/* Passo 2: Nicho (Texto Livre) */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6 max-w-2xl mx-auto"
                        >
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold">2. Seu Nicho Principal</h2>
                                <p className="text-gray-400">Descreva seu foco de atuação (ex: Emagrecimento, SOP, Nutrição Esportiva...)</p>

                                <input
                                    type="text"
                                    placeholder="Escreva seu nicho principal aqui..."
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-6 text-white text-xl focus:outline-none focus:border-queen-pink/50 transition-all font-bold"
                                    value={formData.niche}
                                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4">
                                <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-400">Voltar</Button>
                                <Button
                                    onClick={() => setStep(3)}
                                    disabled={!formData.niche}
                                    className="flex-1 py-7 text-lg bg-queen-pink hover:bg-queen-pink/90 rounded-2xl font-bold"
                                >
                                    Configurar Meu Método
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Passo 3: O Método (Refinado) */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 space-y-8 w-full"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            <Crown className="text-yellow-400" />
                                            Assinatura do Método
                                        </h2>
                                        <p className="text-gray-400 mt-1">Defina a inteligência técnica e narrativa.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 block">Nome do seu Método</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Método BioLifting"
                                                className={`w-full bg-black/40 border ${!formData.methodName ? 'border-rose-500/50' : 'border-white/10'} rounded-xl p-4 text-white text-lg focus:outline-none focus:border-purple-500 transition-all font-bold`}
                                                value={formData.methodName}
                                                onChange={(e) => setFormData({ ...formData, methodName: e.target.value })}
                                            />
                                            {!formData.methodName && <p className="text-[10px] text-rose-500 mt-1 font-bold uppercase tracking-widest leading-none">⚠️ O nome do método é essencial para a identidade IA</p>}
                                        </div>

                                        <div
                                            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${formData.hasGenetics ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:border-white/20'
                                                }`}
                                            onClick={() => setFormData({ ...formData, hasGenetics: !formData.hasGenetics })}
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${formData.hasGenetics ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                                                    <Dna size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold">Testes Genéticos?</h3>
                                                    <p className="text-[10px] text-gray-500">Argumento de marketing high-ticket ativo.</p>
                                                </div>
                                            </div>
                                            <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${formData.hasGenetics ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${formData.hasGenetics ? 'translate-x-6' : ''}`} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-queen-pink uppercase tracking-widest mb-2 block">Storytelling / Estilo Visual</label>
                                            <select
                                                value={formData.methodStorytelling}
                                                onChange={(e) => setFormData({ ...formData, methodStorytelling: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-queen-pink transition-all font-medium appearance-none"
                                            >
                                                <option>Realista e Científico</option>
                                                <option>Épico e Inspirador</option>
                                                <option>Minimalista</option>
                                                <option>Desafiador</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold">Fases & Definição Técnica</h3>
                                        <Button
                                            size="sm"
                                            onClick={generatePhaseNames}
                                            className="bg-purple-600 hover:bg-purple-500 text-[10px] font-extrabold uppercase py-1 px-3 h-auto rounded-lg"
                                        >
                                            <Sparkles size={12} className="mr-1" /> Gerar Nomes IA
                                        </Button>
                                    </div>

                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {formData.phases.map((phase, index) => (
                                            <div
                                                key={phase.id}
                                                className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 relative group ${phase.locked
                                                    ? 'border-white/5 bg-white/[0.02]'
                                                    : 'border-green-500/30 bg-green-500/5'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => updatePhase(phase.id, 'locked', !phase.locked)}
                                                        className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${phase.locked ? 'bg-purple-600/20 text-purple-400' : 'bg-green-600 text-white'
                                                            }`}
                                                    >
                                                        {phase.locked ? <Lock size={20} /> : <Unlock size={20} />}
                                                    </button>

                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">NOME CRIATIVO</span>
                                                            {index > 1 && (
                                                                <button onClick={() => removePhase(phase.id)} className="text-gray-600 hover:text-red-400">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <input
                                                            value={phase.name}
                                                            onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white font-bold text-sm focus:outline-none w-full"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-bold text-gray-600 uppercase">Definição Técnica (O que acontece nessa fase)</label>
                                                    <textarea
                                                        value={phase.technical}
                                                        onChange={(e) => updatePhase(phase.id, 'technical', e.target.value)}
                                                        placeholder="Ex: Eliminar toxinas e reduzir inchaço..."
                                                        className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white/70 h-16 resize-none focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={addPhase}
                                            className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center gap-3 text-gray-500 hover:text-white transition-all font-bold group"
                                        >
                                            <Plus size={18} />
                                            Nova Fase do Método
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
                                <Button variant="ghost" onClick={() => setStep(2)} className="text-gray-400">Voltar</Button>
                                <Button
                                    onClick={() => setStep(4)}
                                    className="flex-1 py-7 text-lg bg-queen-pink hover:bg-queen-pink/90 rounded-2xl font-bold"
                                >
                                    Continuar para Tom de Voz
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Passo 4: Tom de Voz (Mantém) */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6 max-w-2xl mx-auto"
                        >
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold">4. Alma da sua Assistente</h2>
                                <p className="text-gray-400">Como a IA deve falar com suas Rainhas?</p>

                                <div className="space-y-3">
                                    {[
                                        { id: 'acolhedora', title: '💖 Acolhedora', desc: 'Foco em empatia e carinho.' },
                                        { id: 'general', title: '⚔️ General', desc: 'Foco em disciplina e cobrança.' },
                                        { id: 'cientifica', title: '🔬 Científica', desc: 'Foco em dados e evidências.' }
                                    ].map(tone => (
                                        <button
                                            key={tone.id}
                                            onClick={() => setFormData({ ...formData, aiTone: tone.id })}
                                            className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group ${formData.aiTone === tone.id ? 'bg-purple-600/20 border-purple-500' : 'bg-white/5 border-white/10'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-bold">{tone.title}</div>
                                                <p className="text-xs text-gray-500">{tone.desc}</p>
                                            </div>
                                            {formData.aiTone === tone.id && <CheckCircle size={20} className="text-purple-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-400">Voltar</Button>
                                <Button onClick={() => setStep(5)} className="flex-1 py-7 text-lg bg-queen-pink hover:bg-queen-pink/90 rounded-2xl font-bold">Último Passo</Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Passo 5: Piloto Automático & Check-ins */}
                    {step === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 space-y-10 max-w-2xl mx-auto"
                        >
                            <div className="space-y-6 text-center">
                                <div className="h-16 w-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                                    <Zap size={32} />
                                </div>
                                <h2 className="text-3xl font-bold">5. Piloto Automático & Monitoramento</h2>
                                <p className="text-gray-400">O robô que cuida do seu Reino.</p>
                            </div>

                            <div className="space-y-4">
                                {/* Pilot Automation */}
                                <div
                                    className={`p-6 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${formData.pilotActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5'
                                        }`}
                                    onClick={() => setFormData({ ...formData, pilotActive: !formData.pilotActive })}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${formData.pilotActive ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                                            <Sparkles size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold">Monitoramento Diário da IA</h3>
                                            <p className="text-xs text-gray-500">A IA analisa o progresso e manda feedbacks diários.</p>
                                        </div>
                                    </div>
                                    <div className={`w-14 h-8 rounded-full flex items-center p-1 transition-colors ${formData.pilotActive ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${formData.pilotActive ? 'translate-x-6' : ''}`} />
                                    </div>
                                </div>

                                {/* Check-ins Enabled */}
                                <div
                                    className={`p-6 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${formData.checkinEnabled ? 'border-queen-pink bg-queen-pink/10' : 'border-white/5 bg-white/5'
                                        }`}
                                    onClick={() => setFormData({ ...formData, checkinEnabled: !formData.checkinEnabled })}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${formData.checkinEnabled ? 'bg-queen-pink text-white' : 'bg-white/10 text-gray-400'}`}>
                                            <MessageCircle size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold">Check-ins & Questionários</h3>
                                            <p className="text-xs text-gray-500">Alertas push para monitoração, satisfação e sugestões.</p>
                                        </div>
                                    </div>
                                    <div className={`w-14 h-8 rounded-full flex items-center p-1 transition-colors ${formData.checkinEnabled ? 'bg-queen-pink' : 'bg-gray-600'}`}>
                                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${formData.checkinEnabled ? 'translate-x-6' : ''}`} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button
                                    onClick={handleFinish}
                                    disabled={loading}
                                    className="w-full py-8 text-xl bg-gradient-to-r from-queen-pink via-purple-600 to-blue-600 rounded-2xl font-extrabold shadow-xl shadow-queen-pink/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : "ATIVAR MEU IMPÉRIO DIGITAL 👑"}
                                </Button>
                                <Button variant="ghost" onClick={() => setStep(4)} className="text-gray-500">Voltar</Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Loading State Overlay */}
                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="fixed inset-0 bg-[#0f0c29]/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center"
                        >
                            <Loader2 size={80} className="text-queen-pink animate-spin mb-8" />
                            <h2 className="text-3xl font-bold mb-4">Arquitetando seu Método Único...</h2>
                            <p className="text-queen-pink animate-pulse font-medium text-lg mb-8">
                                "Semeando Fases 1 e preparando o Upsell para a Fase 2..."
                            </p>

                            <div className="max-w-xs w-full space-y-4">
                                <LoadingStep label="Configurando Alavanca Nutrigenética" delay={0.5} />
                                <LoadingStep label="Bloqueando Fases Premium" delay={1.5} />
                                <LoadingStep label="Injetando Gatilhos de Marketing High-Ticket" delay={2.5} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

function LoadingStep({ label, delay }: { label: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="flex items-center gap-3 text-gray-300"
        >
            <div className="h-2 w-2 rounded-full bg-queen-pink animate-ping" />
            <span className="text-sm font-medium">{label}</span>
        </motion.div>
    )
}
