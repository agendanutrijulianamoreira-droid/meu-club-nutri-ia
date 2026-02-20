"use client"

import { useState, useEffect } from "react"
import { Layout, Image as ImageIcon, Type, List, Sparkles, Save, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-browser"
import { updatePublicSetting } from "../actions/settingsActions"
import { motion } from "framer-motion"

export function SettingsLoginView() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState({
        template: "clean",
        background_url: "",
        headline: "",
        subheadline: "",
        cta_text: "",
        cta_link: "/cadastro",
        badge_text: "",
        bullets: ["", "", ""]
    })

    useEffect(() => {
        const loadConfig = async () => {
            const { data } = await supabase
                .from('public_settings')
                .select('value')
                .eq('key', 'login_config')
                .single()

            if (data?.value) {
                setConfig(prev => ({ ...prev, ...data.value }))
            }
            setLoading(false)
        }
        loadConfig()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const result = await updatePublicSetting('login_config', config)
        if (result.success) {
            alert("Landing page do Login atualizada com sucesso! 🚀")
        } else {
            alert("Erro ao salvar: " + result.error)
        }
        setSaving(false)
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-10 max-w-5xl">
            <header className="flex justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div>
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Login Experience Designer</h1>
                    <p className="text-slate-400 font-medium">Personalize a primeira impressão do seu sistema.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-white text-slate-950 hover:bg-slate-200 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs gap-3">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Publicar Alterações
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Editor */}
                <div className="space-y-8">
                    <section className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                            <ImageIcon size={14} /> Fundo & Visual
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">URL da Imagem de Fundo</label>
                                <input
                                    value={config.background_url}
                                    onChange={e => setConfig({ ...config, background_url: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Badge (Mini-H1)</label>
                                <input
                                    value={config.badge_text}
                                    onChange={e => setConfig({ ...config, badge_text: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-6 flex items-center gap-2">
                            <Type size={14} /> Conteúdo Persuasivo (Copy)
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Headline (Título Principal)</label>
                                <input
                                    value={config.headline}
                                    onChange={e => setConfig({ ...config, headline: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Subheadline (Subtítulo)</label>
                                <textarea
                                    value={config.subheadline}
                                    onChange={e => setConfig({ ...config, subheadline: e.target.value })}
                                    className="w-full h-24 bg-slate-950 border border-white/5 rounded-xl p-4 text-white resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem]">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-6 flex items-center gap-2">
                            <List size={14} /> Benefícios (Bullets)
                        </h3>
                        <div className="space-y-3">
                            {config.bullets.map((b, i) => (
                                <input
                                    key={i}
                                    value={b}
                                    onChange={e => {
                                        const nb = [...config.bullets]
                                        nb[i] = e.target.value
                                        setConfig({ ...config, bullets: nb })
                                    }}
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white outline-none focus:border-emerald-500"
                                    placeholder={`Benefício ${i + 1}`}
                                />
                            ))}
                        </div>
                    </section>
                </div>

                {/* Live Preview (Simulated) */}
                <div className="sticky top-28 h-fit">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 ml-4">Preview em Tempo Real</h3>
                    <div className="aspect-video bg-slate-950 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative">
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-40"
                            style={{ backgroundImage: `url('${config.background_url || "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80"}')` }}
                        />
                        <div className="absolute inset-x-8 inset-y-8 flex">
                            <div className="w-1/2 flex flex-col justify-center p-4 space-y-4">
                                <div className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-[6px] font-black rounded-full w-fit uppercase">
                                    {config.badge_text || "Preencha o Campo Badge"}
                                </div>
                                <h4 className="text-xl font-black text-white italic leading-tight">{config.headline || "Seu Título Aqui"}</h4>
                                <p className="text-[8px] text-slate-400 line-clamp-2">{config.subheadline || "Sua descrição persuasiva..."}</p>
                            </div>
                            <div className="flex-1 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 m-2 flex items-center justify-center">
                                <span className="text-[10px] font-black uppercase text-slate-600">Simulação do Login</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
