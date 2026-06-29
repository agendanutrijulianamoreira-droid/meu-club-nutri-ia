"use client"

import { useState, useEffect } from "react"
import {
    Layout, Globe, DollarSign, Upload, Eye, ExternalLink,
    Sparkles, CheckCircle, Smartphone, Monitor, Save,
    Loader2, Clock, Copy, Check, Plus, X, Trash2,
    ToggleLeft, ToggleRight, Bot, AlertCircle, Zap,
    Image as ImageIcon, Link as LinkIcon
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"

interface FAQ { question: string; answer: string }

interface SalesData {
    headline: string
    subheadline: string
    checkoutLink: string
    benefits: string[]
    countdownEnabled: boolean
    faqs: FAQ[]
    useInternalCheckout: boolean
    price_community: string
    price_tech_diet: string
    price_vip: string
}

const DEFAULT_DATA: SalesData = {
    headline: "Emagreça 5kg em 21 dias sem passar fome",
    subheadline: "O método que já ajudou mais de 120 mulheres a recuperarem a autoestima e o corpo dos sonhos.",
    checkoutLink: "https://hotmart.com/exemplo",
    benefits: ["Cardápio Fácil", "App Exclusivo", "Suporte Diário", "Comunidade VIP"],
    countdownEnabled: true,
    faqs: [
        { question: "Como funciona o acesso?", answer: "Você receberá os dados de acesso por e-mail imediatamente após o pagamento." },
        { question: "Tem garantia?", answer: "Sim! Oferecemos 7 dias de garantia incondicional." }
    ],
    useInternalCheckout: true,
    price_community: 'R$ 47',
    price_tech_diet: 'R$ 97',
    price_vip: 'R$ 197',
}

// ─── Toggle component ────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-11 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}/>
        </button>
    )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, className = '' }: { title?: string; children?: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3 ${className}`}>
            {title && <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</p>}
            {children}
        </div>
    )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LivePreview({ data, brandName, slug, proofUrls, mobile }: {
    data: SalesData; brandName: string; slug: string
    proofUrls: string[]; mobile: boolean
}) {
    const pageUrl = slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/vender/${slug}` : null

    return (
        <div className={`flex-1 bg-slate-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl transition-all mx-auto w-full ${mobile ? 'max-w-[375px]' : ''}`}>
            {/* Browser bar */}
            <div className="bg-white/5 px-4 py-2.5 border-b border-white/10 flex items-center gap-3">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"/>
                </div>
                <div className="flex-1 bg-black/40 px-3 py-1 rounded-full text-[10px] text-slate-500 font-mono border border-white/5 truncate text-center">
                    {slug ? `${typeof window !== 'undefined' ? window.location.hostname : 'seudominio.com'}/vender/${slug}` : 'seudominio.com/vender/seu-clube'}
                </div>
                {pageUrl && (
                    <a href={pageUrl} target="_blank" rel="noopener" className="text-slate-600 hover:text-indigo-400 transition-colors">
                        <ExternalLink size={12}/>
                    </a>
                )}
            </div>

            {/* Page content */}
            <div className="h-[calc(100%-42px)] overflow-y-auto select-none pointer-events-none">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white">
                    {/* Hero */}
                    <div className="px-6 pt-12 pb-8 bg-gradient-to-b from-indigo-950/60 to-slate-950">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                            {brandName}
                        </div>
                        <h1 className="text-xl font-black text-white mb-4 leading-tight">
                            {data.headline}
                        </h1>
                        <p className="text-slate-400 text-xs mb-6 mx-auto max-w-xs leading-relaxed">
                            {data.subheadline}
                        </p>
                        <button className="bg-emerald-500 text-white font-black text-xs px-8 py-3 rounded-full shadow-lg shadow-emerald-900/40">
                            QUERO ENTRAR AGORA 🚀
                        </button>
                    </div>

                    {/* Benefits */}
                    <div className="px-4 py-6 grid grid-cols-2 gap-2 text-left">
                        {data.benefits.filter(Boolean).map((b, i) => (
                            <div key={i} className="bg-white/5 px-3 py-2.5 rounded-xl border border-white/5 flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px]">✓</div>
                                <span className="text-xs font-bold text-white">{b}</span>
                            </div>
                        ))}
                    </div>

                    {/* Social Proof */}
                    <div className="px-4 pb-6">
                        <h3 className="text-sm font-bold mb-4 text-slate-300">O que nossas alunas dizem...</h3>
                        {proofUrls.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {proofUrls.slice(0, 4).map((url, i) => (
                                    <img key={i} src={url} className="rounded-xl border border-white/10 w-full" alt="Depoimento"/>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {[
                                    { color: 'bg-rose-500/20', text: '"Perdi 3kg na primeira semana! Não acredito."', name: 'Ana S.' },
                                    { color: 'bg-indigo-500/20', text: '"As receitas são deliciosas, família toda aderiu."', name: 'Maria P.' },
                                ].map((t, i) => (
                                    <div key={i} className="bg-white/5 p-3 rounded-xl text-left flex gap-3">
                                        <div className={`w-8 h-8 rounded-full ${t.color} flex-shrink-0`}/>
                                        <div>
                                            <p className="text-xs text-slate-300 italic">{t.text}</p>
                                            <p className="text-[10px] text-slate-600 mt-1">— {t.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* FAQ */}
                    {data.faqs.filter(f => f.question).length > 0 && (
                        <div className="px-4 pb-6 text-left">
                            <h3 className="text-sm font-bold mb-3 text-slate-300 text-center">Perguntas Frequentes</h3>
                            {data.faqs.filter(f => f.question).map((faq, i) => (
                                <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5 mb-2 border border-white/5">
                                    <p className="text-xs font-bold text-white">{faq.question}</p>
                                    {faq.answer && <p className="text-[11px] text-slate-500 mt-1">{faq.answer}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA final + countdown */}
                    <div className="px-4 pb-8 bg-white/[0.02] py-6">
                        {data.countdownEnabled && (
                            <div className="text-orange-400 text-xs font-bold mb-3 flex items-center justify-center gap-1.5 animate-pulse">
                                <Clock size={12}/> ÚLTIMAS VAGAS COM DESCONTO
                            </div>
                        )}
                        <button className="bg-white text-slate-900 font-black text-xs px-8 py-3 rounded-full w-full max-w-xs">
                            GARANTIR MINHA VAGA
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="py-4 px-4 text-slate-700 text-[9px] uppercase tracking-widest">
                        © {new Date().getFullYear()} {brandName} · Todos os direitos reservados
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function SalesPageGenerator({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
    const { tenant, updateTenant, loading: loadingTenant } = useTenant(tenantId)
    const { uploadImage, uploading: uploadingFile } = useStorage()

    const [data, setData] = useState<SalesData>(DEFAULT_DATA)
    const [proofUrls, setProofUrls] = useState<string[]>([])
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
    const [isSaving, setIsSaving] = useState(false)
    const [isPublished, setIsPublished] = useState(false)
    const [copied, setCopied] = useState(false)
    const [saveToast, setSaveToast] = useState<'success' | 'error' | null>(null)

    // AI state per field
    const [aiGenerating, setAiGenerating] = useState<'all' | 'headline' | 'subheadline' | null>(null)
    const [aiError, setAiError] = useState('')

    // Load saved data
    useEffect(() => {
        if (tenant?.settings?.sales_page) {
            const s = tenant.settings.sales_page
            setData({
                headline: s.headline || DEFAULT_DATA.headline,
                subheadline: s.subheadline || DEFAULT_DATA.subheadline,
                checkoutLink: s.checkoutLink || DEFAULT_DATA.checkoutLink,
                benefits: s.benefits || DEFAULT_DATA.benefits,
                countdownEnabled: s.countdownEnabled ?? DEFAULT_DATA.countdownEnabled,
                faqs: s.faqs || DEFAULT_DATA.faqs,
                useInternalCheckout: s.useInternalCheckout ?? DEFAULT_DATA.useInternalCheckout,
                price_community: s.price_community || DEFAULT_DATA.price_community,
                price_tech_diet: s.price_tech_diet || DEFAULT_DATA.price_tech_diet,
                price_vip: s.price_vip || DEFAULT_DATA.price_vip,
            })
            setProofUrls(s.socialProofUrls || [])
            setIsPublished(true)
        }
    }, [tenant])

    const update = (patch: Partial<SalesData>) => setData(d => ({ ...d, ...patch }))

    const pageUrl = tenant?.slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/vender/${tenant.slug}` : null

    const handleSave = async () => {
        if (!tenant) return
        setIsSaving(true)
        setSaveToast(null)
        try {
            const { error } = await updateTenant(tenant.id, {
                settings: {
                    ...(tenant.settings || {}),
                    sales_page: { ...data, socialProofUrls: proofUrls }
                }
            })
            if (error) throw new Error(error)
            setIsPublished(true)
            setSaveToast('success')
            setTimeout(() => setSaveToast(null), 3500)
        } catch (err: any) {
            setSaveToast('error')
            setTimeout(() => setSaveToast(null), 4000)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCopy = () => {
        if (!pageUrl) return
        navigator.clipboard.writeText(pageUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    const callAI = async (field: 'headline' | 'subheadline' | 'all') => {
        setAiGenerating(field); setAiError('')
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'sales-copy',
                    context: `Clube de nutrição "${tenant?.brand_name || 'Meu Club Nutri'}". Headline atual: "${data.headline}". Benefícios: ${data.benefits.join(', ')}.`,
                    prompt: field === 'headline' ? 'Gere apenas uma nova headline de alta conversão.'
                        : field === 'subheadline' ? 'Gere apenas um novo subheadline de apoio.'
                        : 'Gere headline, subheadline, benefits e cta.'
                })
            })
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            if (field === 'all') {
                if (json.headline) update({ headline: json.headline })
                if (json.subheadline) update({ subheadline: json.subheadline })
                if (json.benefits) update({ benefits: json.benefits })
            } else if (field === 'headline' && json.headline) {
                update({ headline: json.headline })
            } else if (field === 'subheadline' && json.subheadline) {
                update({ subheadline: json.subheadline })
            }
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
                setAiError('A IA está recebendo muitas requisições agora. Tente novamente em alguns instantes.')
            } else {
                setAiError(msg || 'Erro ao gerar cópia com IA')
            }
        } finally {
            setAiGenerating(null)
        }
    }

    const addBenefit = () => update({ benefits: [...data.benefits, ''] })
    const updateBenefit = (i: number, v: string) => update({ benefits: data.benefits.map((b, idx) => idx === i ? v : b) })
    const removeBenefit = (i: number) => update({ benefits: data.benefits.filter((_, idx) => idx !== i) })

    const addFaq = () => update({ faqs: [...data.faqs, { question: '', answer: '' }] })
    const updateFaq = (i: number, field: 'question' | 'answer', v: string) =>
        update({ faqs: data.faqs.map((f, idx) => idx === i ? { ...f, [field]: v } : f) })
    const removeFaq = (i: number) => update({ faqs: data.faqs.filter((_, idx) => idx !== i) })

    const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files) return
        for (let i = 0; i < files.length; i++) {
            const { url, error } = await uploadImage(files[i], 'social-proof')
            if (error) { setSaveToast('error'); setTimeout(() => setSaveToast(null), 3500) }
            else if (url) setProofUrls(prev => [...prev, url])
        }
    }

    const brandName = tenant?.brand_name || 'Meu Clube'

    if (loadingTenant) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 size={28} className="animate-spin text-slate-600"/>
        </div>
    )

    return (
        <div className="flex gap-6 h-[calc(100vh-96px)] overflow-hidden">

            {/* ── LEFT: config ─────────────────────────────────────────────── */}
            <div className="w-[420px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 pb-10">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-light text-white">Página de <span className="font-bold">Vendas</span></h1>
                    <p className="text-slate-500 text-sm mt-0.5">Personalize e publique sua landing page.</p>
                </div>

                {/* Published banner */}
                <AnimatePresence>
                    {isPublished && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle size={14} className="text-emerald-400"/>
                                <div>
                                    <p className="text-xs font-bold text-white">Página publicada!</p>
                                    {tenant?.slug && (
                                        <p className="text-[10px] text-emerald-500 font-mono">/vender/{tenant.slug}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={handleCopy} disabled={!pageUrl}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl text-[10px] font-bold text-slate-300 transition-all disabled:opacity-40">
                                    {copied ? <Check size={11} className="text-emerald-400"/> : <Copy size={11}/>}
                                    {copied ? 'Copiado!' : 'Copiar link'}
                                </button>
                                {pageUrl && (
                                    <a href={pageUrl} target="_blank" rel="noopener"
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl text-[10px] font-bold text-slate-300 transition-all">
                                        <ExternalLink size={11}/> Abrir
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* AI error */}
                {aiError && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                        <AlertCircle size={12}/> {aiError}
                        <button onClick={() => setAiError('')} className="ml-auto text-rose-500 hover:text-rose-300"><X size={11}/></button>
                    </div>
                )}

                {/* AI — gerar tudo */}
                <Section>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot size={14} className="text-indigo-400"/>
                            <span className="text-xs font-bold text-white">Gerar copy com IA</span>
                        </div>
                        <button onClick={() => callAI('all')} disabled={!!aiGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition-all">
                            {aiGenerating === 'all' ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
                            {aiGenerating === 'all' ? 'Gerando...' : 'Gerar tudo'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-600">A IA cria headline, sub-headline e benefícios com base no nome do seu clube.</p>
                </Section>

                {/* Headline */}
                <Section title="Headline Principal">
                    <textarea value={data.headline} onChange={e => update({ headline: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-20"
                        placeholder="Sua grande promessa"/>
                    <button onClick={() => callAI('headline')} disabled={!!aiGenerating}
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors disabled:opacity-50">
                        {aiGenerating === 'headline' ? <Loader2 size={11} className="animate-spin"/> : <Zap size={11}/>}
                        {aiGenerating === 'headline' ? 'Gerando...' : 'Sugestão da IA'}
                    </button>
                </Section>

                {/* Subheadline */}
                <Section title="Sub-headline (apoio)">
                    <textarea value={data.subheadline} onChange={e => update({ subheadline: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none h-16"
                        placeholder="Explique como você vai cumprir a promessa..."/>
                    <button onClick={() => callAI('subheadline')} disabled={!!aiGenerating}
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors disabled:opacity-50">
                        {aiGenerating === 'subheadline' ? <Loader2 size={11} className="animate-spin"/> : <Zap size={11}/>}
                        {aiGenerating === 'subheadline' ? 'Gerando...' : 'Sugestão da IA'}
                    </button>
                </Section>

                {/* Benefits */}
                <Section title="Benefícios incluídos">
                    <div className="space-y-2">
                        {data.benefits.map((b, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input value={b} onChange={e => updateBenefit(i, e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    placeholder={`Benefício ${i + 1}`}/>
                                <button onClick={() => removeBenefit(i)} className="text-slate-600 hover:text-rose-400 transition-colors flex-shrink-0">
                                    <X size={14}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addBenefit}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                        <Plus size={12}/> Adicionar benefício
                    </button>
                </Section>

                {/* Preços por plano */}
                <Section title="Preços por Plano">
                    <p className="text-[10px] text-slate-500">Exibido na tabela de planos da página de vendas</p>
                    {[
                        { key: 'price_community' as keyof SalesData, label: 'Comunidade' },
                        { key: 'price_tech_diet' as keyof SalesData, label: 'Tech Diet (destaque)' },
                        { key: 'price_vip' as keyof SalesData, label: 'VIP Premium' },
                    ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
                            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
                                <DollarSign size={12} className="text-slate-500 shrink-0" />
                                <input value={data[key] as string} onChange={e => update({ [key]: e.target.value })}
                                    className="flex-1 bg-transparent py-2 text-sm text-white focus:outline-none"
                                    placeholder="R$ 97" />
                            </div>
                        </div>
                    ))}
                </Section>

                {/* Checkout */}
                <Section title="Checkout">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-white">Checkout interno do sistema</p>
                            <p className="text-[10px] text-slate-500">Usa automaticamente o checkout do Reino</p>
                        </div>
                        <Toggle on={data.useInternalCheckout} onToggle={() => update({ useInternalCheckout: !data.useInternalCheckout })}/>
                    </div>
                    {!data.useInternalCheckout && (
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
                            <LinkIcon size={13} className="text-slate-500 flex-shrink-0"/>
                            <input value={data.checkoutLink} onChange={e => update({ checkoutLink: e.target.value })}
                                className="flex-1 bg-transparent py-2.5 text-sm text-white focus:outline-none"
                                placeholder="https://hotmart.com/..."/>
                        </div>
                    )}
                </Section>

                {/* Provas sociais */}
                <Section title="Prova Social (prints de WhatsApp)">
                    <input type="file" id="proof-upload" className="hidden" accept="image/*" multiple onChange={handleProofUpload}/>
                    <div onClick={() => document.getElementById('proof-upload')?.click()}
                        className="border border-dashed border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500/30 transition-all group">
                        {uploadingFile ? (
                            <div className="flex items-center justify-center gap-2 py-1">
                                <Loader2 size={15} className="animate-spin text-indigo-400"/>
                                <span className="text-xs text-slate-400">Enviando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 py-1 text-slate-600 group-hover:text-slate-400 transition-colors">
                                <Upload size={14}/>
                                <span className="text-xs font-bold">Arrastar prints aqui · PNG / JPG</span>
                            </div>
                        )}
                    </div>
                    {proofUrls.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                            {proofUrls.map((url, i) => (
                                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/10 relative group">
                                    <img src={url} className="w-full h-full object-cover" alt="Print"/>
                                    <button onClick={() => setProofUrls(p => p.filter((_, idx) => idx !== i))}
                                        className="absolute inset-0 bg-rose-900/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={14} className="text-rose-300"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* FAQ */}
                <Section title="Perguntas Frequentes (FAQ)">
                    <div className="space-y-3">
                        {data.faqs.map((faq, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 relative group">
                                <button onClick={() => removeFaq(i)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all">
                                    <X size={13}/>
                                </button>
                                <input value={faq.question} onChange={e => updateFaq(i, 'question', e.target.value)}
                                    className="w-full bg-transparent border-b border-white/10 pb-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 pr-6"
                                    placeholder="Pergunta"/>
                                <textarea value={faq.answer} onChange={e => updateFaq(i, 'answer', e.target.value)}
                                    className="w-full bg-transparent text-xs text-slate-400 focus:outline-none resize-none h-14"
                                    placeholder="Resposta"/>
                            </div>
                        ))}
                    </div>
                    <button onClick={addFaq}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                        <Plus size={12}/> Adicionar pergunta
                    </button>
                </Section>

                {/* Countdown */}
                <Section>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-white">Contagem Regressiva</p>
                            <p className="text-[10px] text-slate-500">Ativa sensor de urgência (FOMO)</p>
                        </div>
                        <Toggle on={data.countdownEnabled} onToggle={() => update({ countdownEnabled: !data.countdownEnabled })}/>
                    </div>
                </Section>

                {/* Save */}
                <button onClick={handleSave} disabled={isSaving || loadingTenant}
                    className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                        ${isPublished ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}
                        disabled:opacity-50`}>
                    {isSaving ? <Loader2 size={16} className="animate-spin"/> : isPublished ? <Save size={16}/> : <Layout size={16}/>}
                    {isSaving ? 'Salvando...' : isPublished ? 'Salvar e Atualizar' : 'Publicar Página'}
                </button>

                {/* Save toast */}
                <AnimatePresence>
                    {saveToast === 'success' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                            <CheckCircle size={13}/> Página salva e publicada com sucesso!
                        </motion.div>
                    )}
                    {saveToast === 'error' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                            <AlertCircle size={13}/> Erro ao salvar. Tente novamente.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── RIGHT: preview ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                        <Eye size={13}/> Preview em tempo real
                    </span>
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                        {([['desktop', <Monitor size={14}/>], ['mobile', <Smartphone size={14}/>]] as const).map(([mode, icon]) => (
                            <button key={mode} onClick={() => setPreviewMode(mode)}
                                className={`p-2 rounded-lg transition-all ${previewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                <LivePreview
                    data={data}
                    brandName={brandName}
                    slug={tenant?.slug || ''}
                    proofUrls={proofUrls}
                    mobile={previewMode === 'mobile'}
                />
            </div>
        </div>
    )
}
