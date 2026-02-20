"use client"

import { useState, useEffect } from "react"
import { Sparkles, Save, Loader2, Target, Heart, Zap, Megaphone, Repeat, LayoutList, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { generateClinicalContent } from "@/app/admin/actions/generateAI"

interface WizardProps {
    tenantId: string
    onComplete: () => void
    onClose: () => void
}

export default function ClubSetupWizard({ tenantId, onComplete, onClose }: WizardProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [formData, setFormData] = useState({
        niche: "",
        targetAudience: "",
        biggestPain: "",
        mainGoal: "",
        toneOfVoice: "",
        duration: "6",
        frequency: "semanal",
        intensity: "moderada",
        products: "",
        pillars: "",
        format: ""
    })

    useEffect(() => {
        const loadExistingData = async () => {
            if (!tenantId) return;
            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('club_audience, club_goal, club_tone, club_restrictions, club_top_themes, club_frequency, club_upgrades, club_duration, club_intensity, club_pillars, club_format')
                    .eq('id', tenantId)
                    .single();

                if (error) throw error;
                if (data) {
                    setFormData({
                        niche: data.club_top_themes || "",
                        targetAudience: data.club_audience || "",
                        biggestPain: data.club_restrictions || "",
                        mainGoal: data.club_goal || "",
                        toneOfVoice: data.club_tone || "",
                        duration: data.club_duration?.toString() || "6",
                        frequency: data.club_frequency || "semanal",
                        intensity: data.club_intensity || "moderada",
                        products: data.club_upgrades || "",
                        pillars: data.club_pillars || "",
                        format: data.club_format || ""
                    });
                }
            } catch (err) {
                console.error('Erro ao carregar dados do tenant:', err)
            }
        }
        loadExistingData()
    }, [tenantId])

    const handlePreFillWithAI = async () => {
        const nicheToUse = formData.niche.trim() || "Nutrição Saúde da Mulher (Exemplo)"
        if (!formData.niche.trim()) {
            alert("Preencha o nicho para uma geração mais precisa! Usando exemplo base... 🚀")
        }
        setIsGenerating(true)
        try {
            const result = await generateClinicalContent(
                `Nicho: ${nicheToUse}. Duração: ${formData.duration} meses.`,
                'club_setup'
            )
            if (result.success && result.data) {
                setFormData(prev => ({
                    ...prev,
                    ...result.data
                }))
            } else {
                alert("Erro ao gerar: " + (result.error || "Tente novamente."))
            }
        } catch (error) {
            console.error("Erro na geração:", error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    club_audience: formData.targetAudience,
                    club_goal: formData.mainGoal,
                    club_tone: formData.toneOfVoice,
                    club_restrictions: formData.biggestPain,
                    club_top_themes: formData.niche,
                    club_frequency: formData.frequency,
                    club_upgrades: formData.products,
                    club_duration: parseInt(formData.duration),
                    club_intensity: formData.intensity,
                    club_pillars: formData.pillars,
                    club_format: formData.format,
                    club_setup_done: true,
                    metadata: {
                        club_setup: formData,
                        setup_completed_at: new Date().toISOString()
                    }
                })
                .eq('id', tenantId)

            if (error) throw error
            setSaved(true)
            setTimeout(() => onComplete(), 1000)
        } catch (err) {
            console.error('Erro ao salvar:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const hasContent = formData.niche.length > 3

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto mt-6 p-10 bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -z-10" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tight mb-2 uppercase tracking-widest">
                        A Alma do seu <span className="text-indigo-400">Clube</span>
                    </h2>
                    <p className="text-slate-400 font-medium">Defina a estratégia por trás do seu ecossistema.</p>
                </div>
                <Button
                    onClick={handlePreFillWithAI}
                    disabled={isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white h-14 px-8 rounded-2xl shadow-xl shadow-indigo-900/40 gap-2 font-black uppercase tracking-widest text-xs transition-all"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    {isGenerating ? 'IA Pensando...' : 'Preencher com IA'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna 1: Negócio */}
                <div className="space-y-6">
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Target size={12} className="text-indigo-400" /> Seu Nicho de Atuação
                        </label>
                        <input
                            value={formData.niche}
                            onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Ex: Saúde da Mulher & SOP"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Rocket size={12} className="text-indigo-400" /> Grande Promessa
                        </label>
                        <input
                            value={formData.mainGoal}
                            onChange={(e) => setFormData({ ...formData, mainGoal: e.target.value })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Ex: Liberdade do efeito sanfona"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Heart size={12} className="text-indigo-400" /> Público e Dores
                        </label>
                        <textarea
                            value={formData.targetAudience}
                            onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                            className="w-full h-32 bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="Quem ajuda e o que dói nelas?"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Megaphone size={12} className="text-indigo-400" /> Personalidade (Tom de Voz)
                        </label>
                        <input
                            value={formData.toneOfVoice}
                            onChange={(e) => setFormData({ ...formData, toneOfVoice: e.target.value })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Ex: Acolhedora, científica, direta..."
                        />
                    </div>
                </div>

                {/* Coluna 2: Produto */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                                <Repeat size={12} className="text-indigo-400" /> Duração
                            </label>
                            <select
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                            >
                                <option value="6">6 Meses</option>
                                <option value="12">12 Meses</option>
                            </select>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                                <Zap size={12} className="text-indigo-400" /> Intensidade
                            </label>
                            <select
                                value={formData.intensity}
                                onChange={(e) => setFormData({ ...formData, intensity: e.target.value })}
                                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                            >
                                <option value="leve">Leve</option>
                                <option value="moderada">Moderada</option>
                                <option value="intensa">Intensa</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <LayoutList size={12} className="text-indigo-400" /> Pilares do Método
                        </label>
                        <textarea
                            value={formData.pillars}
                            onChange={(e) => setFormData({ ...formData, pillars: e.target.value })}
                            className="w-full h-32 bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="Quais as bases da sua entrega?"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Rocket size={12} className="text-indigo-400" /> Formato da Entrega
                        </label>
                        <input
                            value={formData.format}
                            onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Ex: Mentoria semanal + App"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                            <Sparkles size={12} className="text-indigo-400" /> Upgrades Propostos
                        </label>
                        <input
                            value={formData.products}
                            onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Ex: Consultas VIP, E-books"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
                <button
                    onClick={onClose}
                    className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-white transition-all"
                >
                    Pular configuração
                </button>
                <div className="flex gap-4">
                    <Button
                        onClick={handleSave}
                        disabled={!hasContent || isSaving || saved}
                        className={`h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs transition-all gap-2 shadow-xl ${saved
                                ? 'bg-emerald-600 text-white shadow-emerald-900/20'
                                : 'bg-white text-slate-900 hover:bg-slate-200'
                            }`}
                    >
                        {saved ? (
                            <>✓ Configuração Salva</>
                        ) : isSaving ? (
                            <><Loader2 className="animate-spin" size={18} /> Salvando...</>
                        ) : (
                            <><Save size={18} /> Salvar e Continuar</>
                        )}
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
