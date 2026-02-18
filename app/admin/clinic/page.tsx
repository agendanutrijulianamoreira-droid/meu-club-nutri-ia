"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import {
    Brain,
    Sparkles,
    ArrowRight,
    Loader2,
    CheckCircle2,
    Building2,
    User
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function ClinicOnboardingPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        brandName: "",
        adminName: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.brandName.trim()) return

        setIsLoading(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Usuário não autenticado")

            const { data, error: rpcError } = await supabase.rpc('create_clinic_and_profile', {
                p_brand_name: formData.brandName,
                p_admin_name: formData.adminName || undefined,
                p_email: user.email
            })

            if (rpcError) throw rpcError

            // Validação pós-RPC: Verificar se o banco realmente atualizou o perfil
            const { data: updatedProfile, error: verifyError } = await supabase
                .from('profiles')
                .select('tenant_id, role')
                .eq('user_id', user.id)
                .single()

            const hasTenant = updatedProfile?.tenant_id && updatedProfile.tenant_id !== '00000000-0000-0000-0000-000000000001'
            if (verifyError || !hasTenant) {
                console.warn("Aviso: Perfil ainda não reflete a nova clínica. A 'autocura' no /admin tentará resolver.")
            }

            // Força a atualização do metadata do usuário para 'admin'
            await supabase.auth.updateUser({
                data: { user_type: 'admin', role: 'admin' }
            })

            setIsSuccess(true)

            // Invalida o cache e força recarregamento total para atualizar cookies de sessão/role
            router.refresh()

            setTimeout(() => {
                window.location.assign('/admin')
            }, 2000)

        } catch (err: any) {
            console.error("Erro no onboarding:", err)
            setError(err.message || "Ocorreu um erro ao criar sua clínica. Tente novamente.")
        } finally {
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-slate-200">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full text-center space-y-6"
                >
                    <div className="h-20 w-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 size={40} className="text-emerald-400" />
                    </div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Clínica Criada!
                    </h1>
                    <p className="text-slate-400 font-medium">
                        Estamos preparando seu painel central. Prepare-se para decolar! 🚀
                    </p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] relative flex items-center justify-center p-6 overflow-hidden text-slate-200">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full -z-10" />

            <div className="max-w-xl w-full">
                <div className="flex flex-col items-center mb-12">
                    <div className="h-16 w-16 rounded-2xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-6 group">
                        <Brain size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h1 className="text-4xl font-black text-center bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent leading-tight lowercase">
                        Configurar Clínica <span className="font-light">em 1 minuto</span>
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium italic">O primeiro passo para sua gestão de alta performance.</p>
                </div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="glass-panel p-8 md:p-10 rounded-[2.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sparkles size={120} className="text-indigo-400" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Building2 size={12} /> Nome da Clínica / Sua Marca
                                </label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-lg placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                                    placeholder="Ex: Vida Ativa Nutrição"
                                    value={formData.brandName}
                                    onChange={e => setFormData({ ...formData, brandName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <User size={12} /> Seu Nome (Admin)
                                </label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-lg placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                                    placeholder="Como quer ser chamado(a)?"
                                    value={formData.adminName}
                                    onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-600 font-medium ml-1">Opcional. Padrão: "Admin"</p>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold"
                            >
                                {error}
                            </motion.div>
                        )}

                        <Button
                            type="submit"
                            disabled={isLoading || !formData.brandName.trim()}
                            className="w-full h-20 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase tracking-widest text-sm gap-4 shadow-xl shadow-indigo-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    Criar Clínica Agora
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="pt-4 flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <div className="flex items-center gap-2 italic">
                            <CheckCircle2 size={12} className="text-indigo-500/40" /> Sem SQL Manual
                        </div>
                        <div className="flex items-center gap-2 italic">
                            <CheckCircle2 size={12} className="text-indigo-500/40" /> Setup em 1min
                        </div>
                        <div className="flex items-center gap-2 italic">
                            <CheckCircle2 size={12} className="text-indigo-500/40" /> Acesso Imediato
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
