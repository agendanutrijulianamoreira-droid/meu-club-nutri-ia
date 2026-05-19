"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, CheckCircle, Smartphone, Monitor, ChevronDown, ChevronUp, Star, ShieldCheck, Zap, Sparkles } from "lucide-react"

export default function PublicSalesPage({ params }: { params: { slug: string } }) {
    const [tenant, setTenant] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTenant = async () => {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('slug', params.slug)
                .single()

            if (data) setTenant(data)
            setLoading(false)
        }
        fetchTenant()
    }, [params.slug])

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500"></div>
        </div>
    )

    if (!tenant || !tenant.settings?.sales_page) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-4xl font-bold mb-4">Página não encontrada 🌑</h1>
                <p className="text-gray-400">Esta página de vendas ainda não foi publicada ou o endereço está incorreto.</p>
            </div>
        )
    }

    const page = tenant.settings.sales_page
    const checkoutFinalLink = page.useInternalCheckout 
        ? `/${tenant.slug}/checkout?plan=tech_diet` 
        : page.checkoutLink

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
            {/* Hero Section */}
            <div className="relative overflow-hidden pt-20 pb-32">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-purple-600/20 blur-[130px] rounded-full opacity-50" />
                <div className="absolute top-20 right-0 w-[300px] h-[300px] bg-pink-500/10 blur-[100px] rounded-full" />

                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {tenant.logo_url && (
                            <img src={tenant.logo_url} alt="Logo" className="h-20 mx-auto mb-16 drop-shadow-2xl" />
                        )}

                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md">
                            <Sparkles className="text-purple-400" size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Método Exclusivo {tenant.name}</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[1.1] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                            {page.headline}
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-400 mb-14 max-w-2xl mx-auto leading-relaxed font-light">
                            {page.subheadline}
                        </p>

                        <div className="relative inline-block group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <a
                                href={checkoutFinalLink}
                                className="relative inline-block bg-white text-black font-black px-16 py-7 rounded-full text-2xl shadow-2xl hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
                            >
                                QUERO ENTRAR AGORA 🚀
                            </a>
                        </div>

                        <div className="mt-10 flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 text-orange-400 font-bold animate-pulse">
                                <Clock size={20} /> <span className="uppercase tracking-widest text-xs">A oferta encerra em breve</span>
                            </div>
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center overflow-hidden">
                                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                                    </div>
                                ))}
                                <div className="w-10 h-10 rounded-full border-2 border-black bg-purple-600 flex items-center justify-center text-[10px] font-bold">
                                    +120
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Junte-se a mais de 120 alunas satisfeitas</p>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Benefits */}
            <div className="max-w-4xl mx-auto px-6 py-24 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {page.benefits?.map((benefit: string, i: number) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/5 p-6 rounded-2xl border border-white/5 flex items-center gap-4 hover:bg-white/[0.07] transition-colors"
                        >
                            <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white shrink-0">
                                <CheckCircle size={18} />
                            </div>
                            <span className="font-bold text-lg">{benefit}</span>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Social Proof */}
            {page.socialProofUrls?.length > 0 && (
                <div className="max-w-6xl mx-auto px-6 py-32 border-t border-white/5">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black mb-6 italic">
                            O que as <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Rainhas</span> estão dizendo...
                        </h2>
                        <div className="w-24 h-1 bg-purple-500 mx-auto rounded-full" />
                    </div>
                    
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
                        {page.socialProofUrls.map((url: string, idx: number) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="break-inside-avoid"
                            >
                                <img
                                    src={url}
                                    className="rounded-[2rem] border border-white/10 w-full shadow-2xl hover:scale-[1.02] transition-transform duration-500"
                                    alt="Depoimento de Aluna"
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pricing Plans Section */}
            <div className="max-w-5xl mx-auto px-6 py-24 border-t border-white/5">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full mb-6">
                        <Zap className="text-purple-400" size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Escolha seu plano</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                        Invista na sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">transformação</span>
                    </h2>
                    <p className="text-slate-400 text-lg max-w-xl mx-auto">Comece no seu ritmo. Evolua quando quiser. Cancele quando quiser.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Community Plan */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
                        className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col"
                    >
                        <div className="mb-6">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">Comunidade</span>
                            <div className="mt-4">
                                <p className="text-slate-400 text-sm mb-2">A partir de</p>
                                <p className="text-4xl font-black text-white">{page.price_community ?? 'R$ 47'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-8">
                            {['Acesso à comunidade', 'Cardápio qualitativo', 'Missões diárias', 'Desafios em grupo', 'Chat com IA nutricionista', 'Ranking e gamificação'].map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={page.useInternalCheckout ? `/${tenant.slug}/checkout?plan=community` : page.checkoutLink}
                            className="block w-full text-center bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all">
                            Começar agora
                        </a>
                    </motion.div>

                    {/* Tech Diet Plan - DESTAQUE */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-gradient-to-b from-purple-600/20 to-purple-600/5 border border-purple-500/30 rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-purple-900/20"
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">Mais popular</span>
                        </div>
                        <div className="mb-6">
                            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">Tech Diet</span>
                            <div className="mt-4">
                                <p className="text-slate-400 text-sm mb-2">A partir de</p>
                                <p className="text-4xl font-black text-white">{page.price_tech_diet ?? 'R$ 97'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-8">
                            {['Tudo do plano Comunidade', 'Cardápio calculado com macros', 'Protocolos sazonais personalizados', 'Check-in semanal com IA', 'Agenda de consultas', 'Alertas de água e refeições', 'Ofertas exclusivas de upgrade'].map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-200">
                                    <CheckCircle size={16} className="text-purple-400 shrink-0" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={page.useInternalCheckout ? `/${tenant.slug}/checkout?plan=tech_diet` : page.checkoutLink}
                            className="block w-full text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-purple-900/30">
                            QUERO ENTRAR AGORA 🚀
                        </a>
                    </motion.div>

                    {/* VIP Plan */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl p-8 flex flex-col"
                    >
                        <div className="mb-6">
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">VIP Premium</span>
                            <div className="mt-4">
                                <p className="text-slate-400 text-sm mb-2">A partir de</p>
                                <p className="text-4xl font-black text-white">{page.price_vip ?? 'R$ 197'}<span className="text-slate-500 text-base font-normal">/mês</span></p>
                            </div>
                        </div>
                        <ul className="space-y-3 flex-1 mb-8">
                            {['Tudo do plano Tech Diet', 'Cardápio ilustrado com fotos', 'Opções de substituição', 'Consulta individual mensal', 'Método 90 Dias incluído', 'Teste genético nutricional', 'Atendimento prioritário'].map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-200">
                                    <CheckCircle size={16} className="text-amber-400 shrink-0" /> {f}
                                </li>
                            ))}
                        </ul>
                        <a href={page.useInternalCheckout ? `/${tenant.slug}/checkout?plan=vip` : page.checkoutLink}
                            className="block w-full text-center bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold py-4 rounded-2xl transition-all">
                            Quero o VIP
                        </a>
                    </motion.div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-8">
                    Todos os planos incluem garantia de 7 dias. Upgrade ou downgrade a qualquer momento.
                </p>
            </div>

            {/* FAQ Section */}
            {page.faqs?.length > 0 && (
                <div className="max-w-3xl mx-auto px-6 py-32 border-t border-white/5">
                    <h2 className="text-4xl font-black mb-16 text-center tracking-tight">Dúvidas Frequentes</h2>
                    <div className="space-y-4">
                        {page.faqs.map((faq: any, idx: number) => (
                            <FAQItem key={idx} question={faq.question} answer={faq.answer} />
                        ))}
                    </div>
                </div>
            )}

            {/* Guarantees */}
            <div className="max-w-4xl mx-auto px-6 py-20">
                <div className="bg-gradient-to-br from-white/[0.05] to-transparent p-12 rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-32 h-32 shrink-0 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20">
                        <ShieldCheck size={64} className="text-purple-500" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black mb-4">Garantia Incondicional de 7 Dias</h3>
                        <p className="text-slate-400 leading-relaxed">
                            Se por qualquer motivo você achar que o Reino não é para você, basta solicitar o reembolso em até 7 dias. Devolvemos 100% do seu investimento, sem perguntas e sem letras miúdas.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer CTA */}
            <div className="bg-white/5 py-40 text-center border-t border-white/5 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-full h-[300px] bg-pink-500/10 blur-[120px] rounded-full -mb-[150px]" />
                
                <div className="max-w-xl mx-auto px-6 relative z-10">
                    <h2 className="text-4xl font-black mb-8 italic tracking-tighter">Pronta para o seu próximo nível?</h2>
                    <p className="text-xl text-slate-400 mb-14 font-light">Não deixe sua transformação para amanhã. Entre no Reino hoje mesmo e comece a ver os resultados.</p>
                    
                    <a
                        href={checkoutFinalLink}
                        className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-7 rounded-full text-2xl hover:scale-105 transition-transform shadow-2xl shadow-purple-900/40"
                    >
                        GARANTIR MINHA VAGA
                    </a>

                    <div className="mt-12 flex items-center justify-center gap-6 opacity-30 grayscale grayscale-100">
                        <img src="https://logodownload.org/wp-content/uploads/2014/10/stripe-logo-4.png" className="h-6" alt="Stripe" />
                        <img src="https://logodownload.org/wp-content/uploads/2019/09/pci-dss-logo.png" className="h-10" alt="PCI" />
                    </div>

                    <p className="mt-16 text-slate-600 text-[10px] uppercase tracking-[0.3em] font-medium">
                        © 2026 {tenant.name} • TODOS OS DIREITOS RESERVADOS
                    </p>
                </div>
            </div>

            {/* Sticky Countdown Footer */}
            {page.countdownEnabled && (
                <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="fixed bottom-0 left-0 w-full bg-white/10 backdrop-blur-xl border-t border-white/10 p-4 z-50 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            <CountdownBox unit="min" />
                            <span className="text-purple-500 font-bold self-center text-xl">:</span>
                            <CountdownBox unit="sec" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 hidden md:block">Oferta expira em breve</p>
                    </div>
                    
                    <a
                        href={checkoutFinalLink}
                        className="bg-white text-black font-black px-8 py-3 rounded-full text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
                    >
                        APROVEITAR DESCONTO <Zap size={14} className="fill-black" />
                    </a>
                </motion.div>
            )}
        </div>
    )
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = useState(false)
    return (
        <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.03]">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
                <span className="font-bold text-lg">{question}</span>
                {isOpen ? <ChevronUp className="text-purple-500" /> : <ChevronDown className="text-slate-500" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-6 pt-0 text-slate-400 leading-relaxed border-t border-white/5">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function CountdownBox({ unit }: { unit: string }) {
    const [val, setVal] = useState(unit === 'min' ? 14 : 59)
    useEffect(() => {
        const timer = setInterval(() => {
            setVal(v => (v > 0 ? v - 1 : (unit === 'min' ? 14 : 59)))
        }, 1000)
        return () => clearInterval(timer)
    }, [unit])

    return (
        <div className="flex flex-col items-center">
            <div className="bg-white/10 w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xl font-bold border border-white/5">
                {val.toString().padStart(2, '0')}
            </div>
            <span className="text-[8px] font-black uppercase text-slate-500 mt-1">{unit === 'min' ? 'Min' : 'Seg'}</span>
        </div>
    )
}
