"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"
import { Clock, CheckCircle, Smartphone, Monitor } from "lucide-react"

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

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
            {/* Hero Section */}
            <div className="relative overflow-hidden pt-20 pb-32">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-purple-600/10 blur-[120px] rounded-full" />

                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {tenant.logo_url && (
                            <img src={tenant.logo_url} alt="Logo" className="h-16 mx-auto mb-12" />
                        )}
                        <h1 className="text-4xl md:text-6xl font-black mb-8 leading-tight tracking-tight">
                            {page.headline}
                        </h1>
                        <p className="text-xl md:text-2x; text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            {page.subheadline}
                        </p>

                        <a
                            href={page.checkoutLink}
                            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black px-12 py-6 rounded-full text-xl shadow-2xl shadow-purple-500/20 hover:scale-105 transition-transform"
                        >
                            QUERO ENTRAR AGORA 🚀
                        </a>

                        <div className="mt-8 flex items-center justify-center gap-2 text-orange-400 font-bold animate-pulse">
                            <Clock size={20} /> ÚLTIMAS VAGAS DISPONÍVEIS
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
                <div className="max-w-5xl mx-auto px-6 py-24 border-t border-white/5 text-center">
                    <h2 className="text-3xl font-black mb-16 italic underline decoration-purple-500 underline-offset-8">
                        O que as Rainhas estão dizendo...
                    </h2>
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                        {page.socialProofUrls.map((url: string, idx: number) => (
                            <motion.img
                                key={idx}
                                src={url}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                className="rounded-2xl border border-white/10 w-full shadow-xl"
                                alt="Depoimento de Aluna"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Footer CTA */}
            <div className="bg-white/5 py-32 text-center border-t border-white/5">
                <div className="max-w-xl mx-auto px-6">
                    <h2 className="text-3xl font-black mb-8 italic">Pronta para o seu próximo nível?</h2>
                    <p className="text-gray-400 mb-12">Não deixe sua transformação para amanhã. Entre no Reino hoje mesmo.</p>
                    <a
                        href={page.checkoutLink}
                        className="block w-full bg-white text-black font-black py-6 rounded-full text-xl hover:bg-gray-200 transition-colors"
                    >
                        GARANTIR MINHA VAGA
                    </a>
                    <p className="mt-8 text-gray-600 text-[10px] uppercase tracking-widest">
                        © 2026 {tenant.name} - Todos os direitos reservados
                    </p>
                </div>
            </div>
        </div>
    )
}
