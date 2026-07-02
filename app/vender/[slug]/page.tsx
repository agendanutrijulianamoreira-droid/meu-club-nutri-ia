"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle, ShieldCheck, Zap, Sparkles, Star,
    ArrowRight, Clock, ChevronDown, ChevronUp,
    Smartphone, Brain, Utensils, Trophy, MessageCircle,
    Target, Heart, TrendingUp, Users
} from "lucide-react"

export default function PublicSalesPage({ params }: { params: { slug: string } }) {
    const [tenant, setTenant] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    // Preço real de tech_diet/vip vem de /api/tenant-info (mesma fonte do
    // checkout) em vez do texto livre salvo em sales_page — evita a paciente
    // ver um preço na landing e pagar outro no checkout.
    const [realPrices, setRealPrices] = useState<Record<string, number>>({})

    useEffect(() => {
        supabase
            .from('tenants')
            .select('*')
            .eq('slug', params.slug)
            .single()
            .then(({ data }: { data: any }) => {
                if (data) setTenant(data)
                setLoading(false)
            })

        fetch(`/api/tenant-info?slug=${encodeURIComponent(params.slug)}`)
            .then(r => r.json())
            .then(d => {
                const map: Record<string, number> = {}
                for (const p of d.plans || []) map[p.plan] = p.price_cents
                setRealPrices(map)
            })
            .catch(() => {})
    }, [params.slug])

    const fmtPrice = (cents: number | undefined, fallback: string) =>
        cents != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) : fallback

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-t-indigo-500 border-white/10 animate-spin" />
        </div>
    )

    if (!tenant || !tenant.settings?.sales_page) return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
            <div className="text-6xl mb-6">🌑</div>
            <h1 className="text-3xl font-black mb-3">Página não encontrada</h1>
            <p className="text-slate-400">Esta página ainda não foi publicada ou o endereço está incorreto.</p>
        </div>
    )

    const page = tenant.settings.sales_page
    const brandColor = tenant.brand_color || '#6366f1'
    const checkoutLink = page.useInternalCheckout
        ? `/${tenant.slug}/checkout?plan=tech_diet`
        : page.checkoutLink

    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 overflow-x-hidden">
            <StickyHeader logo={tenant.logo_url} name={tenant.name} checkoutLink={checkoutLink} />

            <HeroSection
                logo={tenant.logo_url}
                name={tenant.name}
                headline={page.headline}
                subheadline={page.subheadline}
                checkoutLink={checkoutLink}
                brandColor={brandColor}
            />

            <PainSection />

            <HowItWorksSection name={tenant.name} methodName={tenant.method_name} />

            {page.benefits?.length > 0 && (
                <BenefitsSection benefits={page.benefits} />
            )}

            {page.socialProofUrls?.length > 0 && (
                <SocialProofSection proofUrls={page.socialProofUrls} />
            )}

            <PlansSection
                slug={tenant.slug}
                checkoutLink={page.checkoutLink}
                useInternal={page.useInternalCheckout}
                priceCommunity={page.price_community}
                priceTechDiet={fmtPrice(realPrices.tech_diet, page.price_tech_diet || 'R$ 97')}
                priceVip={fmtPrice(realPrices.vip, page.price_vip || 'R$ 197')}
            />

            <GuaranteeSection />

            {page.faqs?.length > 0 && (
                <FAQSection faqs={page.faqs} />
            )}

            <FinalCTASection name={tenant.name} checkoutLink={checkoutLink} />

            <Footer name={tenant.name} />

            {page.countdownEnabled && <CountdownFooter checkoutLink={checkoutLink} />}
        </div>
    )
}

/* ─── Sticky Header ──────────────────────────────────────────────────────────── */
function StickyHeader({ logo, name, checkoutLink }: { logo?: string; name: string; checkoutLink: string }) {
    const [scrolled, setScrolled] = useState(false)
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 60)
        window.addEventListener('scroll', fn, { passive: true })
        return () => window.removeEventListener('scroll', fn)
    }, [])

    return (
        <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur-xl border-b border-white/5 py-3' : 'py-5'}`}>
            <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {logo
                        ? <img src={logo} alt={name} className="h-8 object-contain" />
                        : <span className="font-black text-lg text-white">{name}</span>
                    }
                </div>
                <div className="flex items-center gap-3">
                    <a href="/login/paciente"
                        className="hidden md:flex items-center text-slate-400 hover:text-white text-sm font-bold px-4 py-2.5 transition-all">
                        Já sou aluna
                    </a>
                    <a href={checkoutLink}
                        className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all">
                        Quero entrar agora <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </header>
    )
}

/* ─── Hero Section ───────────────────────────────────────────────────────────── */
function HeroSection({ logo, name, headline, subheadline, checkoutLink, brandColor }: {
    logo?: string; name: string; headline: string; subheadline: string
    checkoutLink: string; brandColor: string
}) {
    return (
        <section className="relative pt-32 pb-24 overflow-hidden">
            {/* BG glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/15 blur-[120px] rounded-full" />
                <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-emerald-500/8 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
                >
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 px-4 py-1.5 rounded-full mb-10">
                        <Sparkles size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                            Método Exclusivo · {name}
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-black mb-7 leading-[1.05] tracking-tighter">
                        <span className="text-white">{headline.split(' ').slice(0, Math.ceil(headline.split(' ').length * 0.6)).join(' ')}</span>
                        {' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400">
                            {headline.split(' ').slice(Math.ceil(headline.split(' ').length * 0.6)).join(' ')}
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
                        {subheadline}
                    </p>

                    {/* CTA */}
                    <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-block"
                    >
                        <a href={checkoutLink}
                            className="inline-flex items-center gap-3 bg-white text-slate-950 font-black text-xl px-12 py-6 rounded-full shadow-2xl hover:bg-slate-100 transition-colors">
                            QUERO ENTRAR AGORA
                            <ArrowRight size={20} />
                        </a>
                    </motion.div>

                    {/* Trust signals */}
                    <div className="mt-10 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-1.5 text-amber-400">
                            {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor" />)}
                            <span className="text-sm font-bold text-white ml-1">4.9/5</span>
                            <span className="text-slate-500 text-sm">— mais de 120 alunas</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <ShieldCheck size={13} className="text-emerald-400" />
                            <span>Garantia incondicional de 7 dias · Cancele quando quiser</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ─── Pain Section ───────────────────────────────────────────────────────────── */
const PAINS = [
    { icon: Target, label: "Já tentou várias dietas mas nada dura?", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    { icon: Heart, label: "Tem vergonha do próprio corpo na praia?", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
    { icon: TrendingUp, label: "Perde e recupera o mesmo peso todo ano?", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { icon: Users, label: "Sente falta de suporte e comunidade?", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
]

function PainSection() {
    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">Reconhecimento</p>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                        Você se <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400">identifica</span> com alguma dessas situações?
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PAINS.map((pain, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={`flex items-start gap-4 p-5 rounded-2xl border ${pain.bg}`}
                        >
                            <pain.icon className={`${pain.color} shrink-0 mt-0.5`} size={22} />
                            <p className="font-bold text-white leading-snug">{pain.label}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-10 text-center bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6"
                >
                    <p className="text-emerald-400 font-bold text-lg">
                        Se você disse <span className="text-white">sim</span> para pelo menos uma dessas perguntas, você está no lugar certo. 💚
                    </p>
                </motion.div>
            </div>
        </section>
    )
}

/* ─── How it Works ───────────────────────────────────────────────────────────── */
const STEPS = [
    {
        icon: Smartphone,
        step: "01",
        title: "Entre para o clube",
        desc: "Acesse o app, crie seu perfil e nos conte seus objetivos. Em minutos você já está dentro da comunidade.",
        color: "text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20"
    },
    {
        icon: Brain,
        step: "02",
        title: "Siga o método com IA",
        desc: "Receba cardápios personalizados, protocolos semanais e apoio da sua nutricionista virtual disponível 24h.",
        color: "text-violet-400",
        bg: "bg-violet-500/10 border-violet-500/20"
    },
    {
        icon: Trophy,
        step: "03",
        title: "Conquiste seus resultados",
        desc: "Acumule pontos, complete desafios e veja sua transformação acontecer de forma divertida e sustentável.",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20"
    },
]

function HowItWorksSection({ name, methodName }: { name: string; methodName?: string }) {
    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-5xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">
                        Como funciona
                    </p>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                        Simples, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">poderoso</span> e personalizado
                    </h2>
                    <p className="text-slate-400 mt-4 max-w-xl mx-auto">
                        O {methodName || name} usa inteligência artificial e gamificação para tornar sua jornada de emagrecimento irresistível.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    {/* Connector line (desktop only) */}
                    <div className="hidden md:block absolute top-[52px] left-[calc(16.6%+2rem)] right-[calc(16.6%+2rem)] h-px bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-indigo-500/0" />

                    {STEPS.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15 }}
                            className="flex flex-col items-center text-center"
                        >
                            <div className={`w-[72px] h-[72px] rounded-2xl ${step.bg} border flex items-center justify-center mb-6 relative z-10`}>
                                <step.icon size={28} className={step.color} />
                            </div>
                            <span className="text-[10px] font-black text-slate-600 tracking-[0.3em] mb-2">PASSO {step.step}</span>
                            <h3 className="text-xl font-black text-white mb-3">{step.title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ─── Benefits Section ───────────────────────────────────────────────────────── */
function BenefitsSection({ benefits }: { benefits: string[] }) {
    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">O que está incluído</p>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                        Tudo o que você precisa para <span className="text-emerald-400">nunca mais desistir</span>
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {benefits.map((benefit, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -15 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.07 }}
                            className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-2xl p-5 hover:border-indigo-500/25 hover:bg-white/5 transition-all group"
                        >
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                                <CheckCircle size={18} className="text-indigo-400" />
                            </div>
                            <span className="font-bold text-white">{benefit}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ─── Social Proof ───────────────────────────────────────────────────────────── */
function SocialProofSection({ proofUrls }: { proofUrls: string[] }) {
    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-5xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">Resultados reais</p>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                        O que as alunas estão <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">dizendo</span>
                    </h2>
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                        {[1,2,3,4,5].map(i => <Star key={i} size={18} fill="#f59e0b" className="text-amber-400" />)}
                        <span className="text-slate-400 text-sm ml-2">Mais de 120 mulheres transformadas</span>
                    </div>
                </motion.div>

                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                    {proofUrls.map((url, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="break-inside-avoid"
                        >
                            <img
                                src={url}
                                alt="Depoimento de aluna"
                                className="rounded-3xl border border-white/10 w-full shadow-xl hover:scale-[1.02] transition-transform duration-500"
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ─── Plans Section ──────────────────────────────────────────────────────────── */
const PLAN_FEATURES = {
    community: [
        'Acesso à comunidade exclusiva',
        'Cardápio qualitativo diário',
        'Missões e desafios em grupo',
        'Chat com IA nutricionista',
        'Ranking e gamificação XP',
        'Biblioteca de receitas',
    ],
    tech_diet: [
        'Tudo do plano Comunidade',
        'Cardápio calculado com macros',
        'Protocolos personalizados IA',
        'Check-in semanal inteligente',
        'Alertas de água e refeições',
        'Análise de adesão semanal',
        'Acesso prioritário a novidades',
    ],
    vip: [
        'Tudo do plano Tech Diet',
        'Cardápio ilustrado com fotos',
        'Opções de substituição ilimitadas',
        'Consulta individual mensal',
        'Método 90 Dias incluído',
        'Suporte direto com nutricionista',
        'Atendimento prioritário',
    ],
}

function PlansSection({ slug, checkoutLink, useInternal, priceCommunity, priceTechDiet, priceVip }: {
    slug: string; checkoutLink: string; useInternal: boolean
    priceCommunity?: string; priceTechDiet?: string; priceVip?: string
}) {
    const link = (plan: string) => useInternal ? `/${slug}/checkout?plan=${plan}` : checkoutLink

    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-5xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">Planos e preços</p>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                        Escolha o plano <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">ideal para você</span>
                    </h2>
                    <p className="text-slate-400 mt-3 max-w-md mx-auto">
                        Comece no seu ritmo. Faça upgrade quando quiser. Cancele a qualquer momento.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                    {/* Community */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-white/[0.03] border border-white/10 rounded-3xl p-7 flex flex-col"
                    >
                        <div className="mb-7">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                Comunidade
                            </span>
                            <div className="mt-5">
                                <p className="text-4xl font-black text-white">{priceCommunity || 'R$ 47'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                                <p className="text-slate-500 text-xs mt-1">Para quem quer começar com a comunidade</p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-7">
                            {PLAN_FEATURES.community.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                                    <CheckCircle size={15} className="text-slate-400 shrink-0 mt-0.5" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={link('community')}
                            className="block w-full text-center bg-white/8 hover:bg-white/12 border border-white/12 text-white font-bold py-3.5 rounded-2xl transition-all text-sm">
                            Começar agora
                        </a>
                    </motion.div>

                    {/* Tech Diet — DESTAQUE */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="relative bg-gradient-to-b from-indigo-600/20 via-indigo-600/10 to-transparent border border-indigo-500/40 rounded-3xl p-7 flex flex-col shadow-2xl shadow-indigo-950/50"
                    >
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
                                ⭐ Mais popular
                            </span>
                        </div>
                        <div className="mb-7">
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/25">
                                Tech Diet
                            </span>
                            <div className="mt-5">
                                <p className="text-4xl font-black text-white">{priceTechDiet || 'R$ 97'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                                <p className="text-indigo-400/70 text-xs mt-1">O equilíbrio perfeito entre resultado e custo</p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-7">
                            {PLAN_FEATURES.tech_diet.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                                    <CheckCircle size={15} className="text-indigo-400 shrink-0 mt-0.5" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={link('tech_diet')}
                            className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-2xl transition-all text-sm shadow-lg shadow-indigo-900/40">
                            QUERO ENTRAR AGORA 🚀
                        </a>
                    </motion.div>

                    {/* VIP */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-b from-amber-500/12 to-transparent border border-amber-500/25 rounded-3xl p-7 flex flex-col"
                    >
                        <div className="mb-7">
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
                                👑 VIP Premium
                            </span>
                            <div className="mt-5">
                                <p className="text-4xl font-black text-white">{priceVip || 'R$ 197'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                                <p className="text-amber-400/60 text-xs mt-1">Para quem quer o máximo de resultados</p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-7">
                            {PLAN_FEATURES.vip.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                                    <CheckCircle size={15} className="text-amber-400 shrink-0 mt-0.5" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={link('vip')}
                            className="block w-full text-center bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold py-3.5 rounded-2xl transition-all text-sm">
                            Quero o VIP 👑
                        </a>
                    </motion.div>
                </div>

                <p className="text-center text-slate-600 text-xs mt-8">
                    Todos os planos incluem garantia de 7 dias · Upgrade ou downgrade a qualquer momento
                </p>
            </div>
        </section>
    )
}

/* ─── Guarantee Section ──────────────────────────────────────────────────────── */
function GuaranteeSection() {
    return (
        <section className="py-20 border-t border-white/5">
            <div className="max-w-3xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left"
                >
                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={44} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white mb-3">Garantia Incondicional de 7 Dias</h3>
                        <p className="text-slate-400 leading-relaxed">
                            Se por qualquer motivo você achar que o clube não é para você, basta solicitar o reembolso em até 7 dias.
                            Devolvemos <strong className="text-white">100% do seu investimento</strong>, sem perguntas, sem burocracia e sem letras miúdas.
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ─── FAQ Section ────────────────────────────────────────────────────────────── */
function FAQSection({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
    return (
        <section className="py-24 border-t border-white/5">
            <div className="max-w-2xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4">Dúvidas</p>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">Perguntas Frequentes</h2>
                </motion.div>
                <div className="space-y-3">
                    {faqs.map((faq: any, i: number) => (
                        <div key={i}><FAQItem faq={faq} index={i} /></div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function FAQItem({ faq, index }: { faq: any; index: number }) {
    const [open, setOpen] = useState(false)
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]"
        >
            <button onClick={() => setOpen(!open)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors gap-4">
                <span className="font-bold text-white leading-snug">{faq.question}</span>
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'}`}>
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-5 text-slate-400 leading-relaxed border-t border-white/5 pt-4 text-sm">
                            {faq.answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

/* ─── Final CTA Section ──────────────────────────────────────────────────────── */
function FinalCTASection({ name, checkoutLink }: { name: string; checkoutLink: string }) {
    return (
        <section className="py-32 border-t border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/15 blur-[100px] rounded-full" />
                <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-violet-600/8 blur-[120px] rounded-full -translate-y-1/2" />
            </div>

            <div className="max-w-2xl mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Sua vez</p>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">
                        Pronta para sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">transformação</span>?
                    </h2>
                    <p className="text-xl text-slate-400 mb-12 font-light leading-relaxed">
                        Não deixe para amanhã. Mais de 120 mulheres já começaram. Sua vez é agora.
                    </p>

                    <motion.a
                        href={checkoutLink}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-3 bg-white text-slate-950 font-black text-xl px-14 py-6 rounded-full shadow-2xl hover:bg-slate-100 transition-colors"
                    >
                        GARANTIR MINHA VAGA
                        <ArrowRight size={20} />
                    </motion.a>

                    <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
                        <ShieldCheck size={13} className="text-emerald-400" />
                        Garantia de 7 dias · Pagamento seguro · Cancele quando quiser
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ─── Footer ─────────────────────────────────────────────────────────────────── */
function Footer({ name }: { name: string }) {
    return (
        <footer className="border-t border-white/5 py-8">
            <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-600 text-xs">
                <p className="font-black uppercase tracking-widest">© {new Date().getFullYear()} {name}</p>
                <div className="flex items-center gap-6">
                    <a href="/login/paciente" className="hover:text-slate-400 transition-colors font-bold uppercase tracking-widest">
                        Área da Aluna
                    </a>
                    <a href="/login/nutricionista" className="hover:text-slate-400 transition-colors font-bold uppercase tracking-widest">
                        Área da Nutricionista
                    </a>
                </div>
                <p>Todos os direitos reservados · Plataforma VitaClub</p>
            </div>
        </footer>
    )
}

/* ─── Countdown Footer ───────────────────────────────────────────────────────── */
function CountdownFooter({ checkoutLink }: { checkoutLink: string }) {
    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 2, type: 'spring', stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-white/8 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
        >
            <div className="max-w-5xl mx-auto px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
                        <Clock size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">Oferta por tempo limitado</span>
                    </div>
                    <div className="flex gap-1">
                        <CountdownBox unit="min" />
                        <span className="text-indigo-500 font-bold self-center text-lg">:</span>
                        <CountdownBox unit="sec" />
                    </div>
                </div>
                <a href={checkoutLink}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm px-6 py-2.5 rounded-full transition-all shrink-0">
                    APROVEITAR AGORA <Zap size={13} fill="currentColor" />
                </a>
            </div>
        </motion.div>
    )
}

function CountdownBox({ unit }: { unit: 'min' | 'sec' }) {
    const [val, setVal] = useState(unit === 'min' ? 14 : 59)
    useEffect(() => {
        const id = setInterval(() => setVal(v => v > 0 ? v - 1 : (unit === 'min' ? 14 : 59)), 1000)
        return () => clearInterval(id)
    }, [unit])
    return (
        <div className="flex flex-col items-center">
            <div className="bg-white/10 w-9 h-9 rounded-lg flex items-center justify-center font-mono text-lg font-black border border-white/8">
                {val.toString().padStart(2, '0')}
            </div>
            <span className="text-[7px] font-black uppercase text-slate-600 mt-0.5">{unit === 'min' ? 'Min' : 'Seg'}</span>
        </div>
    )
}
