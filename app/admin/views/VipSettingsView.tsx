"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, Plus, Trash2, Loader2, CheckCircle, Video, DollarSign, Sparkles, Lock, Unlock } from "lucide-react"

interface VipSettings {
    enabled: boolean
    price_monthly: number
    price_annual: number
    benefits: string[]
    video_url: string
    cta_text: string
    badge_label: string
}

const DEFAULTS: VipSettings = {
    enabled: false,
    price_monthly: 97,
    price_annual: 797,
    benefits: [
        "Plano alimentar personalizado mensal",
        "Chat com IA ilimitado",
        "Acesso a todos os desafios exclusivos",
        "Suporte prioritário da nutricionista",
    ],
    video_url: "",
    cta_text: "Quero ser VIP 👑",
    badge_label: "VIP",
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-amber-500' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
        </button>
    )
}

export function VipSettingsView({ tenantId = '' }: { setView?: (v: any) => void; tenantId?: string }) {
    const [settings, setSettings] = useState<VipSettings>(DEFAULTS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [newBenefit, setNewBenefit] = useState("")
    const [billingTab, setBillingTab] = useState<'monthly' | 'annual'>('monthly')

    useEffect(() => {
        fetch('/api/admin/vip-settings')
            .then(r => r.json())
            .then(data => {
                if (data.vip && Object.keys(data.vip).length > 0) {
                    setSettings({ ...DEFAULTS, ...data.vip })
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3500)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/vip-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            })
            if (res.ok) showToast('success', 'Configurações VIP salvas!')
            else showToast('error', 'Erro ao salvar. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }

    const addBenefit = () => {
        const trimmed = newBenefit.trim()
        if (!trimmed) return
        setSettings(s => ({ ...s, benefits: [...s.benefits, trimmed] }))
        setNewBenefit("")
    }

    const removeBenefit = (i: number) => {
        setSettings(s => ({ ...s, benefits: s.benefits.filter((_, idx) => idx !== i) }))
    }

    const discount = settings.price_monthly > 0
        ? Math.round((1 - settings.price_annual / (settings.price_monthly * 12)) * 100)
        : 0

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-slate-600" size={28} />
        </div>
    )

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Área <span className="font-bold">VIP</span></h1>
                    <p className="text-slate-500 text-sm mt-1">Configure o plano premium do seu clube</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    Salvar
                </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`px-4 py-3 rounded-2xl text-sm font-bold border ${toast.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                    >
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Enable toggle */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${settings.enabled ? 'bg-amber-500/20' : 'bg-white/5'}`}>
                            {settings.enabled ? <Crown size={18} className="text-amber-400" /> : <Lock size={18} className="text-slate-500" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Área VIP {settings.enabled ? 'ativada' : 'desativada'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {settings.enabled ? 'Pacientes podem ver e contratar o plano VIP' : 'Nenhuma paciente vê a área VIP'}
                            </p>
                        </div>
                    </div>
                    <Toggle on={settings.enabled} onToggle={() => setSettings(s => ({ ...s, enabled: !s.enabled }))} />
                </div>
            </div>

            {/* Prices */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <DollarSign size={11} /> Preços
                </p>

                {/* Preview toggle */}
                <div className="flex gap-1 bg-white/5 rounded-2xl p-1 w-fit">
                    {(['monthly', 'annual'] as const).map(t => (
                        <button key={t} onClick={() => setBillingTab(t)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${billingTab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t === 'monthly' ? 'Mensal' : 'Anual'}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preço Mensal (R$)</label>
                        <input
                            type="number"
                            value={settings.price_monthly}
                            onChange={e => setSettings(s => ({ ...s, price_monthly: Number(e.target.value) }))}
                            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            min={0}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preço Anual (R$)</label>
                        <input
                            type="number"
                            value={settings.price_annual}
                            onChange={e => setSettings(s => ({ ...s, price_annual: Number(e.target.value) }))}
                            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                            min={0}
                        />
                        {discount > 0 && (
                            <p className="text-[10px] text-emerald-400 mt-1 font-bold">Economiza {discount}% vs mensal</p>
                        )}
                    </div>
                </div>

                {/* Price preview card */}
                <div className="bg-gradient-to-br from-amber-950/50 to-yellow-950/30 border border-amber-500/20 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2">Preview do preço</p>
                    <p className="text-3xl font-black text-white">
                        R$ {billingTab === 'monthly' ? settings.price_monthly : (settings.price_annual / 12).toFixed(0)}
                        <span className="text-sm font-normal text-slate-400">/mês</span>
                    </p>
                    {billingTab === 'annual' && (
                        <p className="text-xs text-slate-500 mt-1">R$ {settings.price_annual} cobrado anualmente</p>
                    )}
                    {discount > 0 && billingTab === 'annual' && (
                        <span className="inline-block mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                            -{discount}% de desconto
                        </span>
                    )}
                </div>
            </div>

            {/* Benefits */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles size={11} /> Benefícios VIP
                </p>

                <div className="space-y-2">
                    <AnimatePresence>
                        {settings.benefits.map((benefit, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 group"
                            >
                                <Crown size={12} className="text-amber-400 flex-shrink-0" />
                                <span className="text-sm text-slate-200 flex-1">{benefit}</span>
                                <button
                                    onClick={() => removeBenefit(i)}
                                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="flex gap-2">
                    <input
                        value={newBenefit}
                        onChange={e => setNewBenefit(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addBenefit()}
                        placeholder="Adicionar benefício..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                        onClick={addBenefit}
                        disabled={!newBenefit.trim()}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all"
                    >
                        <Plus size={15} />
                    </button>
                </div>
            </div>

            {/* Video */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Video size={11} /> Vídeo de Apresentação (opcional)
                </p>
                <input
                    value={settings.video_url}
                    onChange={e => setSettings(s => ({ ...s, video_url: e.target.value }))}
                    placeholder="https://youtube.com/embed/... ou https://vimeo.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
                {settings.video_url && (
                    <div className="rounded-2xl overflow-hidden border border-white/10 aspect-video">
                        <iframe
                            src={settings.video_url}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                    </div>
                )}
                <p className="text-[11px] text-slate-600">Use o link de incorporação (embed) do YouTube ou Vimeo</p>
            </div>

            {/* CTA & Badge */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Textos</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Texto do botão CTA</label>
                        <input
                            value={settings.cta_text}
                            onChange={e => setSettings(s => ({ ...s, cta_text: e.target.value }))}
                            placeholder="Quero ser VIP 👑"
                            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Badge VIP</label>
                        <input
                            value={settings.badge_label}
                            onChange={e => setSettings(s => ({ ...s, badge_label: e.target.value }))}
                            placeholder="VIP"
                            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
