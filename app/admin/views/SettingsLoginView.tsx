"use client"

import { useState, useEffect } from "react"
import {
    Save, Image as ImageIcon, Type, List, Loader2, X,
    CheckCircle, AlertTriangle, Plus, Trash2, Eye, EyeOff,
    RefreshCw
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { updatePublicSetting } from "../actions/settingsActions"

interface LoginConfig {
    template: string
    background_url: string
    headline: string
    subheadline: string
    cta_text: string
    cta_link: string
    badge_text: string
    bullets: string[]
}

const DEFAULT: LoginConfig = {
    template: 'clean',
    background_url: '',
    headline: '',
    subheadline: '',
    cta_text: 'Entrar no clube',
    cta_link: '/cadastro',
    badge_text: '',
    bullets: ['', '', ''],
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold
                ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
            {type === 'success' ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
            {msg}
            <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100"><X size={11}/></button>
        </motion.div>
    )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LoginPreview({ config }: { config: LoginConfig }) {
    const hasBg = !!config.background_url
    return (
        <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-white/10 aspect-[4/3]">
            {/* Background */}
            {hasBg && (
                <div className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${config.background_url}')`, opacity: 0.35 }}/>
            )}
            {!hasBg && <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 to-slate-950"/>}

            {/* Layout */}
            <div className="absolute inset-0 flex">
                {/* Left: copy */}
                <div className="w-1/2 flex flex-col justify-center p-5 space-y-2.5">
                    {config.badge_text && (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full w-fit">
                            {config.badge_text}
                        </span>
                    )}
                    <h2 className="text-base font-black text-white leading-tight">
                        {config.headline || <span className="text-slate-700 italic">Headline aqui</span>}
                    </h2>
                    <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
                        {config.subheadline || <span className="text-slate-700 italic">Subheadline…</span>}
                    </p>
                    {config.bullets.filter(Boolean).length > 0 && (
                        <ul className="space-y-1 mt-1">
                            {config.bullets.filter(Boolean).map((b, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-[9px] text-slate-300">
                                    <span className="w-3 h-3 rounded-full bg-indigo-600 flex items-center justify-center text-[6px] text-white flex-shrink-0">✓</span>
                                    {b}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Right: login card */}
                <div className="w-1/2 flex items-center justify-center p-4">
                    <div className="w-full max-w-[160px] bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4 space-y-2.5">
                        <p className="text-[9px] font-black text-white uppercase tracking-widest text-center">Acessar</p>
                        <div className="h-7 bg-white/5 rounded-lg border border-white/10"/>
                        <div className="h-7 bg-white/5 rounded-lg border border-white/10"/>
                        <div className="h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <p className="text-[8px] text-white font-bold">{config.cta_text || 'Entrar'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function SettingsLoginView() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<LoginConfig>(DEFAULT)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [previewVisible, setPreviewVisible] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('public_settings')
                .select('value')
                .eq('key', 'login_config')
                .single()
            if (data?.value) setConfig(prev => ({ ...DEFAULT, ...data.value }))
            setLoading(false)
        }
        load()
    }, [])

    const update = (patch: Partial<LoginConfig>) => setConfig(c => ({ ...c, ...patch }))

    const handleSave = async () => {
        setSaving(true)
        const result = await updatePublicSetting('login_config', config)
        setSaving(false)
        if (result.success) {
            setToast({ type: 'success', msg: 'Página de login atualizada!' })
        } else {
            setToast({ type: 'error', msg: 'Erro ao salvar: ' + result.error })
        }
    }

    const addBullet = () => update({ bullets: [...config.bullets, ''] })
    const updateBullet = (i: number, v: string) => update({ bullets: config.bullets.map((b, idx) => idx === i ? v : b) })
    const removeBullet = (i: number) => update({ bullets: config.bullets.filter((_, idx) => idx !== i) })

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-slate-600"/>
        </div>
    )

    return (
        <div className="space-y-5 pb-10 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Página de <span className="font-bold">Login</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Personalize a primeira impressão do seu sistema.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPreviewVisible(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 border border-white/10 text-slate-400 text-xs font-bold rounded-xl hover:bg-white/10 transition-all">
                        {previewVisible ? <EyeOff size={13}/> : <Eye size={13}/>}
                        {previewVisible ? 'Ocultar preview' : 'Ver preview'}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                        {saving ? 'Salvando…' : 'Publicar'}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)}/>}
            </AnimatePresence>

            {/* Preview */}
            <AnimatePresence>
                {previewVisible && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Eye size={10}/> Preview em tempo real</p>
                            <LoginPreview config={config}/>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Visual */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><ImageIcon size={11}/> Visual</p>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">URL da imagem de fundo</label>
                        <input value={config.background_url} onChange={e => update({ background_url: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
                            placeholder="https://images.unsplash.com/..."/>
                        <p className="text-[9px] text-slate-700 mt-1">Cole URL de imagem (Unsplash, seu bucket, etc)</p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Badge (mini-label)</label>
                        <input value={config.badge_text} onChange={e => update({ badge_text: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                            placeholder="Ex: Método Exclusivo"/>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Texto do botão</label>
                        <input value={config.cta_text} onChange={e => update({ cta_text: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                            placeholder="Entrar no clube"/>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Link do botão CTA</label>
                        <input value={config.cta_link} onChange={e => update({ cta_link: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
                            placeholder="/cadastro"/>
                    </div>
                </div>

                {/* Copy */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Type size={11}/> Textos Persuasivos</p>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Headline</label>
                        <input value={config.headline} onChange={e => update({ headline: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                            placeholder="Ex: Transforme seu corpo em 21 dias"/>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 block">Subheadline</label>
                        <textarea value={config.subheadline} onChange={e => update({ subheadline: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-20"
                            placeholder="Texto explicando o método e o benefício principal…"/>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1"><List size={10}/> Bullets de benefícios</label>
                            <button onClick={addBullet} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors">
                                <Plus size={11}/> Adicionar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {config.bullets.map((b, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600/30 flex items-center justify-center text-[9px] text-indigo-400 font-bold flex-shrink-0">{i+1}</span>
                                    <input value={b} onChange={e => updateBullet(i, e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                        placeholder={`Benefício ${i+1}`}/>
                                    {config.bullets.length > 1 && (
                                        <button onClick={() => removeBullet(i)} className="text-slate-700 hover:text-rose-400 transition-colors flex-shrink-0">
                                            <Trash2 size={13}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
