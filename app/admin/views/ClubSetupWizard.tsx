"use client"

import { useState, useEffect } from "react"
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
        toneOfVoice: "",
        duration: "6", // "6" or "12"
        frequency: "semanal", // semanal, quinzenal, mensal
        intensity: "moderada", // leve, moderada, intensa
        products: "" // consulta, acompanhamento, etc.
    })

    // Carregar dados existentes ao montar o componente
    useEffect(() => {
        const loadExistingData = async () => {
            if (!tenantId) return;

            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('club_audience, club_goal, club_tone, club_restrictions, club_top_themes')
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
                        products: data.club_upgrades || ""
                    });
                }
            } catch (err) {
                console.error('Erro ao carregar dados do tenant:', err);
            }
        };

        loadExistingData();
    }, [tenantId]);

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
                setFormData(prev => ({
                    ...prev,
                    niche: result.data.niche || prev.niche,
                    targetAudience: result.data.targetAudience || "",
                    biggestPain: result.data.biggestPain || "",
                    mainGoal: result.data.mainGoal || "",
                    toneOfVoice: result.data.toneOfVoice || ""
                }))
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
                    club_restrictions: formData.biggestPain,
                    club_top_themes: formData.niche,
                    club_frequency: formData.frequency,
                    club_upgrades: formData.products,
                    club_duration: parseInt(formData.duration),
                    club_intensity: formData.intensity,
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm text-slate-300 font-medium mb-2 block">Duração do Plano</label>
                        <select
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="6">Semestral (6 meses)</option>
                            <option value="12">Anual (12 meses)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-slate-300 font-medium mb-2 block">Frequência de Conteúdo</label>
                        <select
                            value={formData.frequency}
                            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="semanal">Semanal</option>
                            <option value="quinzenal">Quinzenal</option>
                            <option value="mensal">Mensal</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm text-slate-300 font-medium mb-2 block">Intensidade do Clube</label>
                        <select
                            value={formData.intensity}
                            onChange={(e) => setFormData({ ...formData, intensity: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="leve">Leve (Foco em adesão)</option>
                            <option value="moderada">Moderada (Equilibrada)</option>
                            <option value="intensa">Intensa (Hardcore/Resultados rápidos)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-slate-300 font-medium mb-2 block">Produtos p/ Ofertar (Upgrade)</label>
                        <input
                            value={formData.products}
                            onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder-slate-600 focus:border-indigo-500 outline-none"
                            placeholder="Ex: Consultas, E-books, Teste Genético"
                        />
                    </div>
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
