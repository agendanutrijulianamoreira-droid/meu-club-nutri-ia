"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, CheckCircle, ArrowLeft, Loader2, Sparkles, Star } from "lucide-react"
import Link from "next/link"

interface VipConfig {
    enabled: boolean
    price_monthly: number
    price_annual: number
    benefits: string[]
    video_url: string
    cta_text: string
    badge_label: string
}

export default function VipPage() {
    const [vip, setVip] = useState<VipConfig | null>(null)
    const [tenantName, setTenantName] = useState("")
    const [currentPlan, setCurrentPlan] = useState("community")
    const [loading, setLoading] = useState(true)
    const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

    useEffect(() => {
        fetch('/api/patient/vip')
            .then(r => r.json())
            .then(data => {
                setVip(data.vip)
                setTenantName(data.tenant_name)
                setCurrentPlan(data.current_plan)
            })
            .finally(() => setLoading(false))
    }, [])

    const isVip = currentPlan === 'vip'
    const discount = vip && vip.price_monthly > 0
        ? Math.round((1 - vip.price_annual / (vip.price_monthly * 12)) * 100)
        : 0
    const displayPrice = vip
        ? billing === 'annual'
            ? (vip.price_annual / 12).toFixed(0)
            : vip.price_monthly
        : 0

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-600" size={28} />
        </div>
    )

    if (!vip?.enabled) return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
            <Crown size={48} className="text-slate-700 mb-4" />
            <p className="text-white font-bold text-lg">Área VIP em breve</p>
            <p className="text-slate-500 text-sm mt-2 mb-6">Sua nutricionista está preparando algo especial para você.</p>
            <Link href="/patient/home" className="text-indigo-400 text-sm font-bold flex items-center gap-1">
                <ArrowLeft size={14} /> Voltar ao início
            </Link>
        </div>
    )

    return (
        <div className="min-h-screen pb-28">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <Link href="/patient/home" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft size={17} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            <Crown size={18} className="text-amber-400" />
                            Área {vip.badge_label}
                        </h1>
                        <p className="text-[11px] text-slate-500">{tenantName}</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-5 max-w-lg mx-auto space-y-5">
                {/* Already VIP banner */}
                {isVip && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl px-5 py-4 flex items-center gap-3">
                        <Crown size={22} className="text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-300">Você já é {vip.badge_label}! 👑</p>
                            <p className="text-xs text-slate-500 mt-0.5">Aproveite todos os seus benefícios exclusivos.</p>
                        </div>
                    </div>
                )}

                {/* Video */}
                {vip.video_url && (
                    <div className="rounded-3xl overflow-hidden border border-white/10 aspect-video">
                        <iframe
                            src={vip.video_url}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                    </div>
                )}

                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-amber-950/50 to-yellow-950/30 border border-amber-500/25 rounded-3xl p-6 text-center"
                >
                    <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Crown size={28} className="text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Plano {vip.badge_label}</h2>
                    <p className="text-slate-400 text-sm">Eleve sua jornada de saúde com acesso exclusivo a tudo que {tenantName} tem de melhor.</p>
                </motion.div>

                {/* Billing toggle */}
                <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
                    {(['monthly', 'annual'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setBilling(t)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${billing === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {t === 'monthly' ? 'Mensal' : 'Anual'}
                            {t === 'annual' && discount > 0 && (
                                <span className="absolute -top-2 -right-1 text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                                    -{discount}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Price */}
                <div className="text-center py-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={billing}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                        >
                            <p className="text-5xl font-black text-white">
                                R$ {displayPrice}
                                <span className="text-xl font-normal text-slate-400">/mês</span>
                            </p>
                            {billing === 'annual' && (
                                <p className="text-sm text-slate-500 mt-1">R$ {vip.price_annual} cobrado uma vez por ano</p>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Benefits */}
                {vip.benefits.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Sparkles size={11} /> O que está incluído
                        </p>
                        {vip.benefits.map((b, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-start gap-3"
                            >
                                <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-slate-200">{b}</span>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* CTA */}
                {!isVip && (
                    <button className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-2xl transition-all active:scale-98 shadow-lg shadow-amber-900/30">
                        <Crown size={18} />
                        {vip.cta_text}
                    </button>
                )}

                <p className="text-center text-[11px] text-slate-600 pb-4">
                    Entre em contato com sua nutricionista para contratar o plano VIP.
                </p>
            </div>
        </div>
    )
}
