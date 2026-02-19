"use client"

import { useState } from "react"
import { Sparkles, ArrowRight, Loader2, Save } from "lucide-react"
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

    // Estado agora é texto livre, não mais tags ou IDs engessados
    const [formData, setFormData] = useState({
        niche: "",
        targetAudience: "",
        biggestPain: "",
        mainGoal: "",
        toneOfVoice: ""
    })

    // 🪄 O botão que injeta a persona no sistema de verdade
    const handlePreFillWithAI = async () => {
        const nicheToUse = formData.niche.trim() || "Nutrição Saúde da Mulher e Emagrecimento (Exemplo)";

        if (!formData.niche.trim()) {
            // Se não tiver nicho, avisa que estamos usando um exemplo
            alert("Como você não preencheu o nicho, vou gerar um exemplo base para Saúde da Mulher. Edite conforme sua realidade depois! 🚀");
        }

        setIsGenerating(true)

        // Chamada real à Server Action
        try {
            const result = await generateClinicalContent(
                `Sou uma nutricionista focada em: ${nicheToUse}. Crie minha persona de marca.`,
                'persona'
            );

            if (result.success && result.data) {
                setFormData({
                    niche: result.data.niche || formData.niche,
                    targetAudience: result.data.targetAudience || "",
                    biggestPain: result.data.biggestPain || "",
                    mainGoal: result.data.mainGoal || "",
                    toneOfVoice: result.data.toneOfVoice || ""
                })
            } else {
                alert("Erro ao gerar persona: " + (result.error || "Tente novamente."));
            }
        } catch (error) {
            console.error("Erro na geração:", error);
            alert("Erro de comunicação com a IA.");
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
                    // P0 Review Fix: Save to real columns to enable Generator
                    club_audience: formData.targetAudience,
                    club_goal: formData.mainGoal,
                    club_tone: formData.toneOfVoice,
                    club_restrictions: formData.biggestPain, // Mapping Pain to Restrictions
                    club_top_themes: formData.niche, // Mapping Niche to Themes
                    club_setup_done: true,

                    // Keep metadata as backup
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
            console.error('Erro ao salvar setup:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const hasContent = formData.targetAudience.length > 0 || formData.biggestPain.length > 0

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto mt-10 p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Configure a Alma do seu Clube</h2>
                    <p className="text-slate-400">Não comece do zero. Deixe a IA escrever o primeiro rascunho por você.</p>
                </div>

                {/* O BOTÃO MÁGICO */}
                <Button
                    onClick={handlePreFillWithAI}
                    disabled={isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shrink-0"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    {isGenerating ? 'Pensando...' : 'Auto-preencher com minha Persona'}
                </Button>
            </div>

            {/* Campos de texto livre */}
            <div className="space-y-6">
                <div>
                    <label className="text-sm text-slate-300 font-medium mb-2 block">Seu Nicho</label>
                    <textarea
                        value={formData.niche}
                        onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                        className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="Ex: Nutrição para saúde da mulher, emagrecimento funcional..."
                    />
                </div>

                <div>
                    <label className="text-sm text-slate-300 font-medium mb-2 block">Público-Alvo Ideal</label>
                    <textarea
                        value={formData.targetAudience}
                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="Ex: Mulheres que sofrem com SOP, endometriose, rotina corrida..."
                    />
                </div>

                <div>
                    <label className="text-sm text-slate-300 font-medium mb-2 block">A Maior Dor Delas</label>
                    <textarea
                        value={formData.biggestPain}
                        onChange={(e) => setFormData({ ...formData, biggestPain: e.target.value })}
                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="Ex: Falta de energia, inchaço, efeito sanfona..."
                    />
                </div>

                <div>
                    <label className="text-sm text-slate-300 font-medium mb-2 block">A Sua Grande Promessa (Objetivo)</label>
                    <textarea
                        value={formData.mainGoal}
                        onChange={(e) => setFormData({ ...formData, mainGoal: e.target.value })}
                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="O que você resolve na vida delas?"
                    />
                </div>

                <div>
                    <label className="text-sm text-slate-300 font-medium mb-2 block">Tom de Voz da Marca</label>
                    <textarea
                        value={formData.toneOfVoice}
                        onChange={(e) => setFormData({ ...formData, toneOfVoice: e.target.value })}
                        className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        placeholder="Ex: Acolhedora, científica, sem neuras..."
                    />
                </div>

                {/* Ações */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Pular por agora
                    </button>

                    <Button
                        onClick={handleSave}
                        disabled={!hasContent || isSaving || saved}
                        className={`gap-2 ${saved
                            ? 'bg-green-600 hover:bg-green-600'
                            : 'bg-white text-slate-900 hover:bg-slate-200'
                            }`}
                    >
                        {saved ? (
                            <>✓ Salvo!</>
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
