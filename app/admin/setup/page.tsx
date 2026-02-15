"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Crown,
    Sparkles,
    ChevronRight,
    Loader2,
    MessageCircle,
    Globe,
    Settings,
    Layout
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createTenantAndBindProfileAction } from "@/app/admin/actions/tenantActions"

export default function SetupWizardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        brandName: "",
        slug: "",
        primaryColor: "#4f46e5",
        secondaryColor: "#7c3aed",
        whatsapp: "",
        logoUrl: ""
    })

    // Auto-generate slug from brand name
    useEffect(() => {
        if (formData.brandName) {
            const slug = formData.brandName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .trim()
            setFormData(prev => ({ ...prev, slug }))
        }
    }, [formData.brandName])

    const handleCreateClinic = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await createTenantAndBindProfileAction({
                brandName: formData.brandName,
                slug: formData.slug,
                primaryColor: formData.primaryColor,
                secondaryColor: formData.secondaryColor,
                whatsapp: formData.whatsapp,
                logoUrl: formData.logoUrl
            })

            if (result.success) {
                router.push('/admin')
                router.refresh()
            } else {
                alert("Erro: " + result.error)
            }
        } catch (err: any) {
            alert("Erro inesperado: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-outfit">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full -z-10" />

            <div className="max-w-xl w-full z-10">
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-6">
                        <Crown size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Configure sua Clínica</h1>
                    <p className="text-slate-400 mt-2 font-medium">Ative seu portal administrativo em menos de 1 minuto.</p>
                </div>

                <form onSubmit={handleCreateClinic} className="bg-white/[0.02] border border-white/10 backdrop-blur-3xl p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-2 block">Nome da Clínica</label>
                            <input
                                required
                                type="text"
                                placeholder="Ex: Clínica Rainha da Nutrição"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
                                value={formData.brandName}
                                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-2 block">Slug Personalizado (URL)</label>
                            <div className="relative">
                                <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    required
                                    type="text"
                                    placeholder="seu-endereco"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                />
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2 ml-1 italic">Este será o endereço do seu portal (ex: meuclube.ai/{formData.slug || 'sua-clinica'})</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-2 block">Cor Primária</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        className="h-12 w-12 rounded-xl bg-transparent border-none cursor-pointer"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono uppercase"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-2 block">Cor Secundária</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        className="h-12 w-12 rounded-xl bg-transparent border-none cursor-pointer"
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono uppercase"
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-2 block">WhatsApp de Suporte (Opcional)</label>
                            <div className="relative">
                                <MessageCircle size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="tel"
                                    placeholder="+55 (00) 00000-0000"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                    value={formData.whatsapp}
                                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || !formData.brandName || !formData.slug}
                        className="w-full h-16 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-900/40 gap-3 group transition-all"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <>
                                Ativar Meu Portal Clinical
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-center text-[10px] text-slate-600 mt-8 uppercase tracking-widest font-black">
                    Ao ativar, você aceita os termos do <span className="text-slate-400">Meu Club Nutri.AI</span>
                </p>
            </div>
        </div>
    )
}
