'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Sparkles, AlertCircle, Heart, ArrowRight } from 'lucide-react'

function SignupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const refCode = searchParams.get('ref')

    const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading')
    const [info, setInfo] = useState<{
        tenant_slug: string
        tenant_name: string
        nutritionist_name: string
        referral_code: string
    } | null>(null)

    useEffect(() => {
        if (!refCode) {
            setStatus('not_found')
            return
        }

        fetch(`/api/resolve-referral?code=${encodeURIComponent(refCode)}`)
            .then(r => r.json())
            .then(data => {
                if (data.tenant_slug) {
                    setInfo(data)
                    setStatus('found')
                } else {
                    setStatus('not_found')
                }
            })
            .catch(() => setStatus('not_found'))
    }, [refCode])

    const handleContinue = () => {
        if (!info) return
        router.push(`/${info.tenant_slug}/checkout?ref=${info.referral_code}`)
    }

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <div className="text-center">
                    <Loader2 size={32} className="text-indigo-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">Verificando convite...</p>
                </div>
            </div>
        )
    }

    if (status === 'not_found') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm text-center"
                >
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={28} className="text-rose-400" />
                    </div>
                    <h1 className="text-xl font-black text-white mb-2">Link inválido</h1>
                    <p className="text-slate-400 text-sm mb-8">
                        Este link de convite não existe ou expirou. Peça um novo link para sua nutricionista.
                    </p>
                    <button
                        onClick={() => router.push('/login')}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                    >
                        Ir para o login
                    </button>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-slate-950 to-indigo-950/20 -z-10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/8 blur-[120px] rounded-full pointer-events-none -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                {/* Logo */}
                <div className="flex items-center gap-2 mb-10 justify-center">
                    <Sparkles size={20} className="text-indigo-400" />
                    <span className="font-black text-white text-lg tracking-tight">VitaClub</span>
                </div>

                {/* Invite card */}
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6">
                        <Heart size={28} className="text-indigo-400" />
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-3">
                        Convite exclusivo
                    </p>

                    <h1 className="text-2xl font-black text-white mb-2 leading-tight">
                        {info?.nutritionist_name?.split(' ')[0]} convidou você!
                    </h1>

                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Você foi convidada para fazer parte do{' '}
                        <span className="text-white font-semibold">{info?.tenant_name}</span>.
                        Comece sua jornada de transformação hoje.
                    </p>

                    <div className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-white/5 mb-6">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">
                            Código de indicação
                        </p>
                        <p className="text-lg font-mono font-black text-indigo-400">
                            {info?.referral_code}
                        </p>
                    </div>

                    <button
                        onClick={handleContinue}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                        Quero participar
                        <ArrowRight size={18} />
                    </button>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Já tem conta?{' '}
                    <button
                        onClick={() => router.push('/login/paciente')}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                    >
                        Entrar
                    </button>
                </p>
            </motion.div>
        </div>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <Loader2 size={28} className="text-indigo-400 animate-spin" />
            </div>
        }>
            <SignupContent />
        </Suspense>
    )
}
