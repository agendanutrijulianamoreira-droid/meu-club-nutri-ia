"use client"

import { useState } from "react"
import {
    Layout,
    Globe,
    DollarSign,
    Upload,
    Eye,
    ExternalLink,
    Sparkles,
    CheckCircle,
    Smartphone,
    Monitor,
    MousePointer2,
    Save,
    Loader2,
    Clock,
    Copy,
    Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useTenant } from "@/lib/hooks/useDatabase"
import { useStorage } from "@/lib/hooks/useStorage"
import { useEffect } from "react"

export function SalesPageGenerator({ setView, tenantId }: { setView: (v: any) => void, tenantId?: string }) {
    const { tenant, updateTenant, loading: loadingTenant } = useTenant(tenantId)
    const { uploadImage, uploading: isUploadingFile } = useStorage()
    const [socialProofUrls, setSocialProofUrls] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isGenerated, setIsGenerated] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [copied, setCopied] = useState(false)
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

    const [formData, setFormData] = useState({
        headline: "Emagreça 5kg em 21 dias sem passar fome",
        subheadline: "Descubra o método que já ajudou mais de 120 rainhas a recuperarem a autoestima e o corpo dos sonhos.",
        checkoutLink: "https://hotmart.com/exemplo",
        benefits: ["Cardápio Fácil", "App Exclusivo", "Suporte Diário", "Comunidade VIP"]
    })

    // Carregar dados salvos
    useEffect(() => {
        if (tenant?.settings?.sales_page) {
            const saved = tenant.settings.sales_page
            setFormData({
                headline: saved.headline || formData.headline,
                subheadline: saved.subheadline || formData.subheadline,
                checkoutLink: saved.checkoutLink || formData.checkoutLink,
                benefits: saved.benefits || formData.benefits
            })
            setSocialProofUrls(saved.socialProofUrls || [])
            setIsGenerated(true)
        }
    }, [tenant])
    const handleGenerate = async () => {
        setGenerating(true)
        setIsSaving(true)

        try {
            const { error } = await updateTenant(tenant!.id, {
                settings: {
                    ...(tenant?.settings || {}),
                    sales_page: {
                        ...formData,
                        socialProofUrls
                    }
                }
            })

            if (error) throw new Error(error)

            await new Promise(r => setTimeout(r, 1500))
            setIsGenerated(true)
            alert("Sua página foi publicada no Reino! 💎")
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message)
        } finally {
            setGenerating(false)
            setIsSaving(false)
        }
    }

    const copyToClipboard = () => {
        const url = `${window.location.origin}/vender/${tenant?.slug}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handlePrintUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        for (let i = 0; i < files.length; i++) {
            const { url, error } = await uploadImage(files[i], 'social-proof')
            if (error) {
                alert("Erro ao subir print: " + error)
            } else if (url) {
                setSocialProofUrls(prev => [...prev, url])
            }
        }
    }

    return (
        <div className="flex gap-8 h-[calc(100vh-160px)] -m-2">

            {/* LEFT SIDE: CONFIGURATION */}
            <div className="w-1/2 space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Página de Vendas
                        <Globe className="text-purple-500" />
                    </h1>
                    <p className="text-gray-400">Preencha os dados e a IA criará um site de alta conversão para você.</p>
                </div>

                {isGenerated && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                                <CheckCircle size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">Página Publicada!</p>
                                <p className="text-[10px] text-green-400 font-mono">vender/{tenant?.slug}</p>
                            </div>
                        </div>
                        <Button
                            onClick={copyToClipboard}
                            variant="ghost"
                            size="sm"
                            className="text-white hover:bg-white/10 flex items-center gap-2"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar Link'}
                        </Button>
                    </motion.div>
                )}

                <div className="space-y-4 pb-10">
                    <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <label className="block text-sm font-bold text-gray-400 mb-2">Sua Grande Promessa (Headline)</label>
                        <textarea
                            value={formData.headline}
                            onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none min-h-[80px]"
                            placeholder="Ex: Emagreça 5kg em 21 dias sem passar fome"
                        />
                        <button
                            onClick={async () => {
                                setGenerating(true);
                                await new Promise(r => setTimeout(r, 1500));
                                setFormData(prev => ({
                                    ...prev,
                                    headline: "Sincronize sua Biologia: O Método Definitivo para um Corpo de Rainha"
                                }));
                                setGenerating(false);
                            }}
                            className="mt-2 text-xs text-purple-400 flex items-center gap-1 hover:text-white transition"
                        >
                            <Sparkles size={12} /> Pedir sugestão para IA
                        </button>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <label className="block text-sm font-bold text-gray-400 mb-2">Sub-headline (Apoio)</label>
                        <textarea
                            value={formData.subheadline}
                            onChange={(e) => setFormData({ ...formData, subheadline: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none min-h-[60px]"
                            placeholder="Texto que explica como você vai cumprir a promessa..."
                        />
                    </div>

                    <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <label className="block text-sm font-bold text-gray-400 mb-2">Link do Checkout (Pagamento)</label>
                        <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 group focus-within:border-purple-500 transition">
                            <DollarSign size={16} className="text-gray-500" />
                            <input
                                value={formData.checkoutLink}
                                onChange={(e) => setFormData({ ...formData, checkoutLink: e.target.value })}
                                className="w-full bg-transparent p-3 text-white outline-none"
                                placeholder="Link do Stripe/Hotmart/Eduzz"
                            />
                        </div>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <label className="block text-sm font-bold text-gray-400 mb-2">Prova Social (Prints)</label>
                        <input
                            type="file"
                            id="print-upload"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handlePrintUpload}
                        />
                        <div
                            onClick={() => document.getElementById('print-upload')?.click()}
                            className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:bg-white/5 cursor-pointer transition group relative"
                        >
                            {isUploadingFile ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="animate-spin text-purple-500 mb-2" size={24} />
                                    <p className="text-sm text-gray-400">Subindo prova social...</p>
                                </div>
                            ) : (
                                <>
                                    <Upload className="mx-auto text-gray-500 mb-2 group-hover:text-purple-400 transition" />
                                    <p className="text-sm text-gray-400 font-medium">Arraste prints de WhatsApp aqui</p>
                                    <p className="text-xs text-gray-600 mt-1">PNG, JPG até 5MB</p>
                                </>
                            )}
                        </div>

                        {socialProofUrls.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-4">
                                {socialProofUrls.map((url, idx) => (
                                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/10 relative group">
                                        <img src={url} className="w-full h-full object-cover" alt="Social Proof" />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSocialProofUrls(prev => prev.filter((_, i) => i !== idx));
                                            }}
                                            className="absolute inset-0 bg-red-500/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <span className="text-[10px] font-bold text-white">REMOVER</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={`w-full py-6 text-lg font-black shadow-xl transition-all ${isGenerated
                            ? 'bg-white text-black hover:bg-gray-200'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-900/20'
                            }`}
                    >
                        {generating ? (
                            <Loader2 className="animate-spin mr-2" />
                        ) : isGenerated ? (
                            <Save size={20} className="mr-2" />
                        ) : (
                            <Layout size={20} className="mr-2" />
                        )}
                        {generating ? "Publicando no Reino..." : isGenerated ? "Salvar e Atualizar Site" : "Gerar e Publicar Site"}
                    </Button>
                </div>
            </div>

            {/* RIGHT SIDE: LIVE PREVIEW */}
            <div className="w-1/2 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Eye size={16} /> Preview em tempo real
                    </span>
                    <div className="flex bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setPreviewMode('desktop')}
                            className={`p-2 rounded-md transition ${previewMode === 'desktop' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                        >
                            <Monitor size={16} />
                        </button>
                        <button
                            onClick={() => setPreviewMode('mobile')}
                            className={`p-2 rounded-md transition ${previewMode === 'mobile' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                        >
                            <Smartphone size={16} />
                        </button>
                    </div>
                </div>

                <div className={`flex-1 bg-black rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl transition-all duration-500 mx-auto ${previewMode === 'mobile' ? 'max-w-[375px]' : 'w-full'}`}>
                    {/* Browser Chrome */}
                    <div className="bg-white/5 p-3 border-b border-white/10 flex justify-between items-center">
                        <div className="flex gap-1.5 px-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                        </div>
                        <div className="bg-black/40 px-4 py-1 rounded-full text-[10px] text-gray-500 font-mono border border-white/5">
                            {tenant?.slug ? `reinodanutri.com/vender/${tenant.slug}` : 'reinodanutri.com/vender/seu-clube'}
                        </div>
                        <a
                            href={tenant?.slug ? `/vender/${tenant.slug}` : '#'}
                            target="_blank"
                            className="text-gray-500 hover:text-purple-400 transition"
                        >
                            <ExternalLink size={12} />
                        </a>
                    </div>

                    {/* LIVED SITE CONTENT */}
                    <div className="h-[calc(100%-43px)] overflow-y-auto bg-black custom-scrollbar select-none pointer-events-none">
                        {!isGenerated && !generating ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 animate-pulse">
                                <Layout size={80} className="mb-4 opacity-10" />
                                <p className="font-medium">Sua página está sendo preparada...</p>
                            </div>
                        ) : generating ? (
                            <div className="h-full flex flex-col items-center justify-center">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="mb-4"
                                >
                                    <Sparkles size={40} className="text-purple-500" />
                                </motion.div>
                                <p className="text-purple-400 font-bold animate-pulse">IA construindo sua estrutura...</p>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center"
                            >
                                {/* Hero Section */}
                                <div className="p-8 pt-16 bg-gradient-to-b from-purple-900/20 to-black">
                                    <h1 className="text-2xl md:text-3xl font-black text-white mb-6 leading-tight">
                                        "{formData.headline}"
                                    </h1>
                                    <p className="text-gray-400 text-sm mb-10 mx-auto max-w-md">
                                        {formData.subheadline}
                                    </p>
                                    <button className="bg-green-600 text-white font-black px-10 py-4 rounded-full mb-12 shadow-2xl shadow-green-500/30 scale-105 transition-transform">
                                        QUERO ENTRAR AGORA 🚀
                                    </button>
                                </div>

                                {/* Benefits Grid */}
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    {formData.benefits.map((benefit, i) => (
                                        <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center text-[10px]">✓</div>
                                            <span className="font-bold text-sm">{benefit}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Social Proof Mock/Real */}
                                <div className="p-8">
                                    <h3 className="text-xl font-bold mb-6 italic">O que as Rainhas estão dizendo...</h3>
                                    <div className="space-y-4">
                                        {socialProofUrls.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {socialProofUrls.map((url, idx) => (
                                                    <img key={idx} src={url} className="rounded-xl border border-white/10 w-full" alt="Depoimento" />
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-white/5 p-4 rounded-2xl text-left border border-white/5 flex gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-pink-500/20" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-bold text-pink-400 mb-1">Feedback de Aluna</div>
                                                        <p className="text-sm text-gray-300 italic">"Gente, eu perdi 3kg na primeira semana! Não acredito que é tão fácil."</p>
                                                    </div>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-2xl text-left border border-white/10 flex gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-purple-500/20" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-bold text-purple-400 mb-1">Feedback de Aluna</div>
                                                        <p className="text-sm text-gray-300 italic">"As receitas são maravilhosas, minha família toda está comendo melhor."</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* FOMO / Countdown Mock */}
                                <div className="p-8 bg-white/5 mt-8">
                                    <div className="text-orange-400 font-bold mb-2 animate-pulse flex items-center justify-center gap-2">
                                        <Clock size={16} /> ÚLTIMAS VAGAS COM DESCONTO
                                    </div>
                                    <button className="bg-white text-black font-black px-10 py-4 rounded-full mt-4 w-full">
                                        GARANTIR MINHA VAGA
                                    </button>
                                </div>

                                <div className="p-8 text-gray-600 text-[10px] uppercase tracking-widest">
                                    © 2026 REINO DA NUTRI - TODOS OS DIREITOS RESERVADOS
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Mouse Mock in Preview */}
                    {isGenerated && (
                        <motion.div
                            animate={{ x: [0, 100, 50], y: [0, 150, 100] }}
                            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
                            className="absolute z-10 text-white/50"
                        >
                            <MousePointer2 size={24} className="drop-shadow-lg" />
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}
