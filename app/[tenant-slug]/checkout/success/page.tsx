"use client"

import { motion } from "framer-motion"
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"

export default function CheckoutSuccessPage({ params }: { params: { 'tenant-slug': string } }) {
    const router = useRouter()
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setTimeout(() => router.push('/patient/home'), 3000)
            }
            setChecking(false)
        })
    }, [router])

    const handleContinue = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        router.push(session ? '/patient/home' : '/login/paciente')
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full text-center"
            >
                {/* Success Animation */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="mb-8"
                >
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto shadow-2xl shadow-green-900/40">
                        <CheckCircle size={48} className="text-white" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-4">
                        <Sparkles size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Pagamento confirmado</span>
                    </div>

                    <h1 className="text-3xl font-bold mb-4">
                        Bem-vinda ao <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Reino!</span> 👑
                    </h1>

                    <p className="text-slate-400 mb-8 leading-relaxed">
                        Sua assinatura foi ativada com sucesso!
                        {checking ? ' Redirecionando...' : ' Acesse o app para completar seu perfil e começar sua jornada de transformação.'}
                    </p>

                    <div className="space-y-4">
                        <Button
                            onClick={handleContinue}
                            disabled={checking}
                            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black uppercase tracking-widest text-xs border-none shadow-2xl shadow-indigo-900/40 gap-3"
                        >
                            Acessar Meu Clube
                            <ArrowRight size={18} />
                        </Button>

                        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                            Verifique seu e-mail para instruções de acesso
                        </p>
                    </div>
                </motion.div>

                {/* Confetti-like decoration */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
                    <div className="absolute top-20 left-10 w-3 h-3 bg-indigo-500/30 rounded-full animate-pulse" />
                    <div className="absolute top-32 right-16 w-2 h-2 bg-emerald-500/30 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute bottom-32 left-20 w-4 h-4 bg-green-500/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute bottom-20 right-10 w-2 h-2 bg-amber-500/30 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
                </div>
            </motion.div>
        </div>
    )
}
