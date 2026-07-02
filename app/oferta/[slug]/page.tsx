"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Loader2, Sparkles, MessageCircle, ShieldCheck } from "lucide-react"

export default function ProtocolOfferPage({ params }: { params: { slug: string } }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [name, setName] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch(`/api/public/protocols/${params.slug}`)
            .then(r => r.json())
            .then(d => setData(d.error ? null : d))
            .finally(() => setLoading(false))
    }, [params.slug])

    const handleSubmit = async () => {
        if (!name.trim()) { setError('Digite seu nome'); return }
        if (!whatsapp.trim() && !email.trim()) { setError('Informe WhatsApp ou e-mail'); return }
        setError('')
        setSubmitting(true)
        try {
            const res = await fetch('/api/public/protocol-leads', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolId: data.protocol.id, name, whatsapp, email }),
            })
            const result = await res.json()
            if (!res.ok) { setError(result.error || 'Erro ao enviar'); return }
            setSubmitted(true)
        } catch {
            setError('Erro ao enviar. Tente novamente.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-400" size={32} />
            </div>
        )
    }

    if (!data?.protocol) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
                <div className="text-6xl mb-6">🌑</div>
                <h1 className="text-2xl font-black mb-3">Oferta não encontrada</h1>
                <p className="text-slate-400">Este protocolo não está disponível ou o link está incorreto.</p>
            </div>
        )
    }

    const { protocol, tenant } = data
    const priceLabel = protocol.price_cents ? `R$ ${(protocol.price_cents / 100).toFixed(2).replace('.', ',')}` : null

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
                {tenant?.logo_url && <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-full object-cover" />}
                <span className="font-bold text-sm">{tenant?.name}</span>
            </div>

            {/* Hero */}
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
                {protocol.cover_image_url && (
                    <img src={protocol.cover_image_url} alt={protocol.title} className="w-full max-h-72 object-cover rounded-3xl mb-8 border border-white/10" />
                )}
                <span className="inline-flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/25 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                    <Sparkles size={12} /> {protocol.duration_days} dias de transformação
                </span>
                <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
                    {protocol.sales_headline || protocol.title}
                </h1>
                <p className="text-slate-400 text-base leading-relaxed max-w-xl mx-auto">
                    {protocol.sales_description || protocol.description}
                </p>

                {priceLabel && (
                    <p className="mt-6 text-2xl font-black text-emerald-400">{priceLabel}</p>
                )}
            </div>

            {/* Metas */}
            {protocol.goals?.length > 0 && (
                <div className="max-w-2xl mx-auto px-6 pb-14">
                    <h2 className="text-xl font-bold mb-5 text-center">O que você vai conquistar</h2>
                    <div className="grid gap-3">
                        {protocol.goals.map((goal: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span className="text-sm text-slate-200">{goal}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview do cardápio */}
            {protocol.days?.[0]?.items?.length > 0 && (
                <div className="max-w-2xl mx-auto px-6 pb-14">
                    <h2 className="text-xl font-bold mb-5 text-center">Prévia do cardápio</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {protocol.days[0].items.slice(0, 4).map((item: any, i: number) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover" />}
                                <div className="p-3">
                                    <p className="text-sm font-bold text-white">{item.title}</p>
                                    {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lead form */}
            <div className="max-w-md mx-auto px-6 pb-20">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <AnimatePresence mode="wait">
                        {submitted ? (
                            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                                <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
                                <p className="text-white font-bold mb-1">Recebemos seu interesse!</p>
                                <p className="text-slate-400 text-sm">{tenant?.name} vai entrar em contato para finalizar sua compra.</p>
                            </motion.div>
                        ) : (
                            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h3 className="text-lg font-bold text-white mb-1 text-center">Quero começar agora</h3>
                                <p className="text-slate-400 text-xs text-center mb-5">Deixe seus dados que entramos em contato para fechar sua compra.</p>
                                <div className="space-y-3">
                                    <input type="text" placeholder="Seu nome"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={name} onChange={e => setName(e.target.value)} />
                                    <input type="text" placeholder="WhatsApp"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                                    <input type="email" placeholder="E-mail (opcional)"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        value={email} onChange={e => setEmail(e.target.value)} />
                                    {error && <p className="text-xs text-rose-400">{error}</p>}
                                    <button onClick={handleSubmit} disabled={submitting}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all">
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                                        {submitting ? 'Enviando...' : 'Quero garantir minha vaga'}
                                    </button>
                                    <p className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600 pt-1">
                                        <ShieldCheck size={11} /> Seus dados estão seguros e não serão compartilhados.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
