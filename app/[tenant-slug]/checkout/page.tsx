"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Shield, Sparkles, Crown, CheckCircle, Loader2, ArrowRight, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function CheckoutContent({ params }: { params: { 'tenant-slug': string } }) {
    const tenantSlug = params['tenant-slug']
    const searchParams = useSearchParams()
    const selectedPlan = searchParams.get('plan') || 'tech_diet'
    const cancelled = searchParams.get('cancelled') === 'true'

    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [tenant, setTenant] = useState<any>(null)
    const [plans, setPlans] = useState<any[]>([])
    const [activePlan, setActivePlan] = useState(selectedPlan)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                // Buscar tenant e planos via API
                const res = await fetch(`/api/tenant-info?slug=${tenantSlug}`)
                if (!res.ok) throw new Error('Clínica não encontrada')
                const data = await res.json()
                setTenant(data.tenant)
                setPlans(data.plans || [])
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [tenantSlug])

    const handleCheckout = async () => {
        setProcessing(true)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: activePlan,
                    tenantSlug,
                }),
            })

            const data = await res.json()
            if (data.error) throw new Error(data.error)
            if (data.url) window.location.href = data.url
        } catch (err: any) {
            setError(err.message)
            setProcessing(false)
        }
    }

    const currentPlan = plans.find((p: any) => p.plan === activePlan)
    const price = currentPlan?.price_cents ? (currentPlan.price_cents / 100).toFixed(2).replace('.', ',') : '---'

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        )
    }

    if (error && !tenant) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold text-white mb-2">Ops!</h2>
                    <p className="text-slate-400">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {tenant?.logo_url && (
                            <img src={tenant.logo_url} alt={tenant.brand_name} className="h-10 w-10 rounded-xl object-cover" />
                        )}
                        <span className="font-bold text-lg">{tenant?.brand_name || 'Club Nutri'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Shield size={16} className="text-green-400" />
                        Pagamento seguro
                    </div>
                </div>
            </div>

            {/* Cancelled banner */}
            {cancelled && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
                    <p className="text-center text-sm text-amber-400">
                        Pagamento cancelado. Sem problemas! Escolha seu plano quando estiver pronta. 💛
                    </p>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
                        <Sparkles size={16} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Transformação começa aqui</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Escolha seu <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">plano</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-xl mx-auto">
                        Junte-se ao {tenant?.brand_name} e comece sua jornada de transformação hoje.
                    </p>
                </motion.div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-12">
                    {plans.map((plan: any) => {
                        const isActive = activePlan === plan.plan
                        const isVip = plan.plan === 'vip'
                        const planPrice = (plan.price_cents / 100).toFixed(2).replace('.', ',')
                        const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || [])

                        return (
                            <motion.div
                                key={plan.plan}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setActivePlan(plan.plan)}
                                className={`relative cursor-pointer rounded-3xl p-8 border-2 transition-all ${isActive
                                    ? 'border-indigo-500 bg-indigo-600/5 shadow-xl shadow-indigo-900/20'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                    }`}
                            >
                                {isVip && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 rounded-full">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Mais Popular</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isVip ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-600/20 text-indigo-400'}`}>
                                        {isVip ? <Crown size={24} /> : <Star size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">
                                            {plan.plan === 'tech_diet' ? 'Tech Diet' : 'VIP Premium'}
                                        </h3>
                                        <p className="text-xs text-slate-400">{plan.description || 'Assinatura mensal'}</p>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <span className="text-4xl font-bold text-white">R${planPrice}</span>
                                    <span className="text-slate-500">/mês</span>
                                </div>

                                {features.length > 0 && (
                                    <ul className="space-y-3">
                                        {features.map((feature: string, i: number) => (
                                            <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                                <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {isActive && (
                                    <div className="absolute top-4 right-4">
                                        <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center">
                                            <CheckCircle size={14} className="text-white" />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>

                {/* No plans configured */}
                {plans.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-slate-400">Os planos ainda não foram configurados para esta clínica.</p>
                    </div>
                )}

                {/* CTA Button */}
                {plans.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-center"
                    >
                        <Button
                            onClick={handleCheckout}
                            disabled={processing}
                            className="h-16 px-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-900/40 border-none gap-3"
                        >
                            {processing ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Assinar por R${price}/mês
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-slate-500 mt-4">
                            Cancele quando quiser • Pagamento 100% seguro via Stripe
                        </p>
                    </motion.div>
                )}

                {error && !cancelled && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function CheckoutPage({ params }: { params: { 'tenant-slug': string } }) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        }>
            <CheckoutContent params={params} />
        </Suspense>
    )
}
