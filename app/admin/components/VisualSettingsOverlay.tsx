"use client"

import React, { useState, useEffect } from "react"
import { Palette, Moon, Sun, Monitor, Layout, Sparkles, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/SlideOver"
import { useOverlays } from "@/components/ui/OverlayStack"
import { supabase } from "@/lib/supabase-browser"

export default function VisualSettingsOverlay({ index }: { index: number }) {
    const { closeOverlay } = useOverlays()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [theme, setTheme] = useState("dark")
    const [glassIntensity, setGlassIntensity] = useState(80)
    const [savedMsg, setSavedMsg] = useState(false)

    useEffect(() => {
        // Mock loading for now as appearance might be local or in settings JSON
        setTimeout(() => setLoading(false), 500)
    }, [])

    const handleSave = async () => {
        setSaving(true)
        // Save appearance settings to localStorage or metadata
        localStorage.setItem("clinical_theme", theme)
        localStorage.setItem("glass_intensity", glassIntensity.toString())

        setTimeout(() => {
            setSaving(false)
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 3000)
        }, 1000)
    }

    if (loading) return (
        <SlideOver id="visual" title="Carregando..." index={index}>
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        </SlideOver>
    )

    return (
        <SlideOver id="visual" title="Customização Profissional" index={index}>
            <div className="space-y-10 pb-20">
                {savedMsg && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-sm font-bold text-emerald-300">
                        Preferências visuais salvas!
                    </div>
                )}
                {/* Theme Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-400 ml-1">
                        <Palette size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Tema da Base</h4>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'dark', label: 'Dark Mode', icon: Moon },
                            { id: 'light', label: 'Light Mode', icon: Sun },
                            { id: 'system', label: 'Sistema', icon: Monitor },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${theme === t.id
                                        ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                                        : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                            >
                                <t.icon size={20} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Glassmorphism Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-purple-400 ml-1">
                        <Sparkles size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Efeitos de Transparência</h4>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Intensidade do Vidro</span>
                            <span className="text-xs font-black text-white">{glassIntensity}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={glassIntensity}
                            onChange={(e) => setGlassIntensity(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <p className="text-[9px] text-slate-600 font-medium leading-relaxed">
                            O efeito visual "Glassmorphism" adiciona profundidade e sofisticação à sua interface profissional.
                        </p>
                    </div>
                </section>

                {/* Dashboard Layout */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-emerald-400 ml-1">
                        <Layout size={18} />
                        <h4 className="font-black uppercase tracking-widest text-xs">Organização do Painel</h4>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-900/50 border border-white/5 rounded-2xl group cursor-pointer hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                <Monitor size={18} />
                            </div>
                            <div>
                                <h5 className="text-xs font-black text-white uppercase tracking-widest">Layout Compacto</h5>
                                <p className="text-[10px] text-slate-500 font-medium">Maximizar espaço para pacientes</p>
                            </div>
                        </div>
                        <div className="w-12 h-6 bg-slate-800 rounded-full p-1 relative">
                            <div className="h-4 w-4 bg-slate-600 rounded-full" />
                        </div>
                    </div>
                </section>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-white text-slate-950 hover:bg-slate-200 h-16 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-white/5 gap-3"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Aplicar Preferências
                </Button>
            </div>
        </SlideOver>
    )
}
