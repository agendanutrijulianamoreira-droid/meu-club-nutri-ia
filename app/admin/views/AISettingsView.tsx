"use client"

import React, { useState } from 'react';
import {
    Brain, Save, MessageCircle, Lock, Unlock,
    Zap, ChevronRight, Sliders, Smartphone, Check, Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useTenant } from "@/lib/hooks/useDatabase";

export function AISettingsView({ setView, tenantId }: { setView: (v: any) => void, tenantId?: string }) {
    const { tenant, updateTenant, loading: loadingTenant } = useTenant(tenantId);
    const [tone, setTone] = useState('acolhedora');
    const [emojiLevel, setEmojiLevel] = useState(2);
    const [methodName, setMethodName] = useState('Método NutriGenética 360º');
    const [isSaving, setIsSaving] = useState(false);

    // Sync state with tenant data
    React.useEffect(() => {
        if (tenant) {
            setMethodName(tenant.method_name || tenant.name || 'Meu Método');
            const aiSettings = tenant.settings?.ai || {};
            if (aiSettings.tone) setTone(aiSettings.tone);
            if (aiSettings.emojiLevel) setEmojiLevel(aiSettings.emojiLevel);
        }
    }, [tenant]);

    // Simulação de mensagens baseadas no Tom escolhido
    const getPreviewMessage = () => {
        if (tone === 'acolhedora') return {
            title: "Check-in Matinal",
            msg: "Bom dia, querida! 💖 Como você acordou hoje? Lembre-se que estou aqui segurando sua mão nesse processo. Vamos tomar aquele copo d'água com gratidão? 🌸"
        };
        if (tone === 'motivadora') return {
            title: "Desafio do Dia",
            msg: "BORA RAINHA! 👑 O dia começou e sua meta não vai se bater sozinha! Já mandou o shot matinal pra dentro? Seu corpo é seu templo, cuide dele agora! 🔥🚀"
        };
        return { // tecnica
            title: "Lembrete de Protocolo",
            msg: "Olá. Lembrete do protocolo: A ingestão de 500ml de água em jejum ativa o metabolismo em 24%. Mantenha a constância para garantir a eficácia da Fase 1. ✅"
        };
    };

    const preview = getPreviewMessage();

    const handleSave = async () => {
        if (!tenant) return;

        setIsSaving(true);
        try {
            const { error } = await updateTenant(tenant.id, {
                method_name: methodName,
                settings: {
                    ...tenant.settings,
                    ai: {
                        tone,
                        emojiLevel
                    }
                }
            });

            if (error) throw new Error(error);
            alert("Cérebro da IA calibrado e salvo no Reino! 🧠✨");
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingTenant) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-indigo-400" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">

            {/* HEADER: Título e Ação */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-4xl font-light text-white flex items-center gap-4">
                        <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30 shadow-xl shadow-indigo-900/20">
                            <Brain className="text-indigo-400" size={32} />
                        </div>
                        Laboratório de <span className="font-bold uppercase tracking-tighter">Inteligência</span>
                    </h1>
                    <p className="text-slate-400 mt-4 max-w-2xl text-lg font-medium">
                        Treine o cérebro da sua assistente virtual. As alterações modulam o comportamento da IA em tempo real.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-16 px-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-indigo-900/40 gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save size={20} />}
                    {isSaving ? "Calibrando..." : "Publicar Alterações"}
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* COLUNA 1: PERSONALIDADE (Left) */}
                <div className="xl:col-span-4 space-y-8">
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[80px] -z-10" />

                        <h3 className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-3">
                            <MessageCircle size={16} /> Tom de Voz & Personalidade
                        </h3>

                        <div className="space-y-4">
                            {[
                                { id: 'acolhedora', label: '💖 A Acolhedora', desc: 'Foco em escuta e carinho. Ideal para ansiedade.' },
                                { id: 'motivadora', label: '⭐ A Motivadora', desc: 'Energia alta, emojis e cobrança ativa.' },
                                { id: 'tecnica', label: '🔬 A Técnica', desc: 'Direta, científica e sem rodeios.' }
                            ].map((item) => (
                                <motion.div
                                    key={item.id}
                                    whileHover={{ x: 5 }}
                                    onClick={() => setTone(item.id)}
                                    className={`p-5 rounded-2xl border cursor-pointer transition-all relative overflow-hidden group ${tone === item.id
                                        ? 'bg-indigo-600/10 border-indigo-500 shadow-xl shadow-indigo-900/20'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold text-base ${tone === item.id ? 'text-white' : 'text-slate-300'}`}>{item.label}</span>
                                        {tone === item.id && (
                                            <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                                                <Check size={12} />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Slider de Calibragem */}
                        <div className="mt-10 pt-8 border-t border-white/5">
                            <div className="flex justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Sliders size={14} className="text-indigo-400" /> Intensidade de Emojis
                                </span>
                                <span className="text-xs text-indigo-400 font-black uppercase tracking-widest">{emojiLevel === 1 ? 'Baixa' : emojiLevel === 2 ? 'Média' : 'Alta'}</span>
                            </div>
                            <input
                                type="range" min="1" max="3"
                                value={emojiLevel} onChange={(e) => setEmojiLevel(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between mt-2 px-1">
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-[2rem] p-6">
                        <div className="flex items-center gap-4 text-indigo-300">
                            <Zap size={20} />
                            <p className="text-xs font-bold leading-relaxed">
                                Dica IA: O tom <span className="text-white">Acolhedor</span> aumenta a retenção em 18% em grupos de emagrecimento.
                            </p>
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: ESTRUTURA DO MÉTODO (Middle) */}
                <div className="xl:col-span-4 space-y-8">
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 h-full backdrop-blur-3xl shadow-2xl relative">
                        <h3 className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-3">
                            <Brain size={16} /> Arquitetura do Seu Método
                        </h3>

                        <div className="mb-10">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Nome Oficial do Ativo</label>
                            <input
                                value={methodName}
                                onChange={(e) => setMethodName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold text-lg outline-none focus:border-indigo-500/50 transition shadow-inner placeholder:text-slate-700"
                            />
                        </div>

                        {/* Timeline Visual das Fases */}
                        <div className="relative space-y-10 pl-6 before:content-[''] before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-indigo-500/20 before:to-slate-800">

                            {/* FASE 1 */}
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative pl-10 group cursor-pointer">
                                <div className="absolute left-[-11px] top-1.5 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#020617] shadow-lg shadow-emerald-500/30 z-10 transition-transform group-hover:scale-110">
                                    <Unlock size={10} className="text-black" />
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] hover:bg-white/[0.05] transition group-hover:border-emerald-500/30">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Fase 01 • Liberada</span>
                                        <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-3 py-1 rounded-lg font-black uppercase tracking-tighter">Entrada</span>
                                    </div>
                                    <h4 className="font-bold text-white text-lg group-hover:text-emerald-400 transition-colors">Desinflamação Express</h4>
                                    <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">Limpeza de paladar e perda de peso inicial (foco em retenção).</p>
                                </div>
                            </motion.div>

                            {/* FASE 2 */}
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="relative pl-10 group cursor-pointer">
                                <div className="absolute left-[-11px] top-1.5 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-4 border-[#020617] shadow-lg shadow-amber-500/30 z-10 transition-transform group-hover:scale-110">
                                    <Lock size={10} className="text-black" />
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] hover:bg-white/[0.05] transition group-hover:border-amber-500/30">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Fase 02 • Bloqueada</span>
                                        <span className="bg-amber-500/20 text-amber-300 text-[9px] px-3 py-1 rounded-lg font-black uppercase tracking-tighter">Upsell</span>
                                    </div>
                                    <h4 className="font-bold text-white text-lg group-hover:text-amber-400 transition-colors">Modulação & VIP</h4>
                                    <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">Acesso via Teste Genético ou Upgrade de Plano Mentoria.</p>

                                    <button className="mt-4 text-[10px] text-amber-300 font-black uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                                        Calibrar Monetização <ChevronRight size={14} />
                                    </button>
                                </div>
                            </motion.div>

                            {/* Botão Adicionar */}
                            <div className="relative pl-10">
                                <div className="absolute left-[-4px] top-3 w-2 h-2 bg-slate-700 rounded-full z-10"></div>
                                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 border border-dashed border-white/10 p-5 rounded-2xl hover:text-white hover:border-indigo-500/40 hover:bg-white/[0.02] transition-all w-full text-left flex items-center gap-4 group">
                                    <PlusIcon size={16} className="group-hover:rotate-90 transition-transform" />
                                    Adicionar Nova Etapa ao Mapa
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* COLUNA 3: SIMULADOR (Right) */}
                <div className="xl:col-span-4 flex flex-col h-full">
                    <h3 className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-3 ml-2">
                        <Smartphone size={16} /> Monitor de Comportamento IA
                    </h3>

                    <div className="flex-1 flex items-center justify-center bg-white/5 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl relative overflow-hidden shadow-2xl">
                        {/* Background glow effect */}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[120px] transition-all duration-1000 ${tone === 'motivadora' ? 'bg-amber-500/10' : tone === 'tecnica' ? 'bg-blue-500/10' : 'bg-indigo-500/10'
                            }`}></div>

                        {/* Phone Mockup Premium */}
                        <div className="w-[300px] h-[600px] bg-[#000] rounded-[3.5rem] border-[10px] border-[#1e293b] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden z-10 p-1">
                            {/* Phone Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-[#1e293b] rounded-b-[1.2rem] z-20 flex items-center justify-center">
                                <div className="w-10 h-1 rounded-full bg-black/20" />
                            </div>

                            {/* Screen Content */}
                            <div className="bg-[#0b1016] h-full w-full pt-14 px-5 pb-6 flex flex-col rounded-[2.8rem] relative">

                                {/* App Header Mock */}
                                <div className="flex items-center gap-3 mb-8 pb-5 border-b border-white/5">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/30">
                                        <Brain size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">Assistente {methodName.split(' ')[0]}</p>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                                            <p className="text-[9px] text-green-500 uppercase font-black tracking-widest">Sincronizada</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={tone}
                                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            className="bg-[#1f2c34] p-4 rounded-2xl rounded-tl-none shadow-xl border border-white/5 relative"
                                        >
                                            <p className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-[0.15em]">{preview.title}</p>
                                            <p className="text-[13px] text-white leading-relaxed font-medium">
                                                {preview.msg}
                                            </p>
                                            <span className="text-[8px] text-slate-500 block text-right mt-2 font-black">09:41</span>
                                        </motion.div>
                                    </AnimatePresence>

                                    {/* Resposta do Usuário (Fake) */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="bg-indigo-600 p-4 rounded-2xl rounded-tr-none shadow-xl max-w-[85%] ml-auto"
                                    >
                                        <p className="text-[13px] text-white font-medium">
                                            {tone === 'acolhedora' ? "Obrigada! Vou tomar minha água agora 💖" : "Feito Dra! Missão cumprida. 🔥"}
                                        </p>
                                        <span className="text-[8px] text-indigo-200 block text-right mt-2 font-black uppercase">Visualizada</span>
                                    </motion.div>
                                </div>

                                {/* Input Area Mock */}
                                <div className="bg-white/5 h-12 rounded-2xl flex items-center px-5 gap-3 mt-6 border border-white/5 opacity-40">
                                    <div className="w-5 h-5 rounded-lg bg-white/10" />
                                    <div className="h-2 w-32 bg-white/10 rounded-full" />
                                </div>

                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-4 text-slate-500">
                        <Smartphone size={14} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Preview em tempo real do ecossistema</p>
                    </div>
                </div>

            </div>
        </div>
    );
}

function PlusIcon({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            width={size || 24}
            height={size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}
