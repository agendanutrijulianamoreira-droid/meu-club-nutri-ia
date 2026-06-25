"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Shield, Sparkles, Crown, CheckCircle, Loader2, ArrowRight,
    Star, User, Mail, Lock, Eye, EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function CheckoutContent({ params }: { params: { 'tenant-slug': string } }) {
    const tenantSlug = params['tenant-slug']
    const searchParams = useSearchParams()
    const selectedPlan = searchParams.get('plan') || 'tech_diet'
    const refCode = searchParams.get('ref') || null
    const cancelled = searchParams.get('cancelled') === 'true'

    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [tenant, setTenant] = useState<any>(null)
    const [plans, setPlans] = useState<any[]>([])
    const [activePlan, setActivePlan] = useState(selectedPlan)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState<'plan' | 'signup'>('plan')

    // Signup fields
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            try {
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

    const handleSelectPlan = () => {
        setError(null)
        setStep('signup')
    }

    const handleSignupAndCheckout = async () => {
        setError(null)

        // Validações básicas
        if (!name.trim()) { setError('Preencha seu nome'); return }
        if (!email.trim()) { setError('Preencha seu e-mail'); return }
        if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres'); return }

        setProcessing(true)
        try {
            // 1. Criar conta no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: name.trim(),
                        user_type: 'patient',
                    },
                },
            })

            // Se o user já existe, tentar login
            if (authError?.message?.includes('already registered')) {
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                })
                if (loginError) {
                    setError('E-mail já cadastrado. Senha incorreta.')
                    setProcessing(false)
                    return
                }
                // Login OK — seguir com checkout usando user existente
                await createCheckoutSession(loginData.user!.id)
                return
            }

            if (authError) {
                setError(authError.message)
                setProcessing(false)
                return
            }

            if (!authData.user) {
                setError('Erro ao criar conta. Tente novamente.')
                setProcessing(false)
                return
            }

            // 2. Redirecionar para Stripe com user_id
            await createCheckoutSession(authData.user.id)

        } catch (err: any) {
            setError(err.message || 'Erro inesperado')
            setProcessing(false)
        }
    }

    const createCheckoutSession = async (userId: string) => {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: activePlan,
                tenantSlug,
                userId,
                customerEmail: email.trim(),
                customerName: name.trim(),
                referralCode: refCode,
            }),
        })

        const data = await res.json()
        if (data.error) {
            setError(data.error)
            setProcessing(false)
            return
        }
        if (data.url) window.location.href = data.url
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
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-3 mb-12">
                    <div className={`flex items-center gap-2 ${step === 'plan' ? 'text-indigo-400' : 'text-green-400'}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'plan' ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-green-600/20 border border-green-500'}`}>
                            {step === 'plan' ? '1' : <CheckCircle size={16} />}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Escolher Plano</span>
                    </div>
                    <div className="w-12 h-px bg-white/20" />
                    <div className={`flex items-center gap-2 ${step === 'signup' ? 'text-indigo-400' : 'text-slate-600'}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'signup' ? 'bg-indigo-600/20 border border-indigo-500' : 'bg-white/5 border border-white/10'}`}>
                            2
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Criar Conta</span>
                    </div>
                    <div className="w-12 h-px bg-white/20" />
                    <div className="flex items-center gap-2 text-slate-600">
                        <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">3</div>
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Pagamento</span>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Plan Selection */}
                    {step === 'plan' && (
                        <motion.div
                            key="plan"
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                        >
                            {/* Title */}
                            <div className="text-center mb-12">
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
                            </div>

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

                            {plans.length === 0 && (
                                <div className="text-center py-16">
                                    <p className="text-slate-400">Os planos ainda não foram configurados para esta clínica.</p>
                                </div>
                            )}

                            {plans.length > 0 && (
                                <div className="text-center">
                                    <Button
                                        onClick={handleSelectPlan}
                                        className="h-16 px-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-900/40 border-none gap-3"
                                    >
                                        Continuar
                                        <ArrowRight size={20} />
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* STEP 2: Signup + Pay */}
                    {step === 'signup' && (
                        <motion.div
                            key="signup"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="max-w-md mx-auto"
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold mb-2">Criar sua conta 🔐</h2>
                                <p className="text-slate-400">
                                    Preencha seus dados e depois siga para o pagamento seguro.
                                </p>
                            </div>

                            {/* Selected plan summary */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                                        {activePlan === 'vip' ? <Crown size={20} className="text-amber-400" /> : <Star size={20} className="text-indigo-400" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">{activePlan === 'tech_diet' ? 'Tech Diet' : 'VIP Premium'}</p>
                                        <p className="text-xs text-slate-400">Assinatura mensal</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white">R${price}/mês</p>
                                    <button onClick={() => setStep('plan')} className="text-[10px] text-indigo-400 font-bold uppercase">
                                        Trocar plano
                                    </button>
                                </div>
                            </div>

                            {/* Signup form */}
                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Nome completo</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Seu nome"
                                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">E-mail</label>
                                    <div className="relative">
                                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="seu@email.com"
                                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Senha</label>
                                    <div className="relative">
                                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <div className="mt-8 space-y-4">
                                <Button
                                    onClick={handleSignupAndCheckout}
                                    disabled={processing}
                                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-900/40 border-none gap-3"
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Criando conta...
                                        </>
                                    ) : (
                                        <>
                                            <Shield size={18} />
                                            Ir para Pagamento Seguro
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </Button>

                                <p className="text-xs text-slate-500 text-center">
                                    Ao continuar, você concorda com os termos de uso. • Pagamento 100% seguro via Stripe
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
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
