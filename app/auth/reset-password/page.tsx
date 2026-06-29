'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react'

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasSession, setHasSession] = useState<boolean | null>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setHasSession(!!data.session)
            if (!data.session) {
                setTimeout(() => router.push('/login'), 3000)
            }
        })
    }, [router])

    const handleReset = async () => {
        if (!password) { setError('Digite a nova senha.'); return }
        if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return }
        if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }

        setLoading(true)
        setError(null)

        const { error: updateError } = await supabase.auth.updateUser({ password })

        if (updateError) {
            setError(updateError.message)
            setLoading(false)
            return
        }

        setSuccess(true)

        const { data: { session } } = await supabase.auth.getSession()
        const role = session?.user?.user_metadata?.user_type || session?.user?.user_metadata?.role

        setTimeout(async () => {
            if (!role) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('user_id', session?.user?.id)
                    .single()
                const resolvedRole = profile?.role
                router.push(['nutri', 'nutritionist', 'admin'].includes(resolvedRole || '') ? '/admin' : '/patient/home')
            } else {
                router.push(['nutri', 'nutritionist', 'admin'].includes(role) ? '/admin' : '/patient/home')
            }
        }, 2500)
    }

    if (hasSession === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <Loader2 size={28} className="text-indigo-400 animate-spin" />
            </div>
        )
    }

    if (hasSession === false) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6">
                <div className="text-center">
                    <AlertCircle size={48} className="text-rose-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Link expirado</h2>
                    <p className="text-slate-400 text-sm">Redirecionando para o login...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-slate-950 to-indigo-950/20 -z-10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="flex items-center gap-2 mb-10 justify-center">
                    <Sparkles size={20} className="text-indigo-400" />
                    <span className="font-black text-white text-lg tracking-tight">VitaClub</span>
                </div>

                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center text-center py-8"
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-6">
                                <CheckCircle2 size={40} className="text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2">Senha atualizada!</h2>
                            <p className="text-slate-400 text-sm">Redirecionando para o seu painel...</p>
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* Header */}
                            <div className="mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                                    <Lock size={22} className="text-indigo-400" />
                                </div>
                                <h1 className="text-2xl font-black text-white mb-1">Nova senha</h1>
                                <p className="text-slate-400 text-sm">Escolha uma senha forte para proteger sua conta.</p>
                            </div>

                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm mb-5"
                                    >
                                        <AlertCircle size={16} className="shrink-0" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Fields */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">
                                        Nova senha
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => { setPassword(e.target.value); setError(null) }}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-slate-600 text-sm outline-none focus:border-indigo-500/50 transition-colors pr-12"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">
                                        Confirmar senha
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
                                        placeholder="Repita a nova senha"
                                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-slate-600 text-sm outline-none focus:border-indigo-500/50 transition-colors"
                                        onKeyDown={e => e.key === 'Enter' && handleReset()}
                                    />
                                </div>
                            </div>

                            {/* Password strength indicator */}
                            {password.length > 0 && (
                                <div className="mb-5">
                                    <div className="flex gap-1 mb-1">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-colors ${
                                                    i < Math.min(Math.floor(password.length / 3), 4)
                                                        ? password.length < 6 ? 'bg-rose-500'
                                                            : password.length < 10 ? 'bg-amber-400'
                                                            : 'bg-emerald-400'
                                                        : 'bg-white/10'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                        {password.length < 6 ? 'Senha muito curta'
                                            : password.length < 10 ? 'Senha razoável'
                                            : 'Senha forte'}
                                    </p>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                onClick={handleReset}
                                disabled={loading || !password || !confirmPassword}
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Atualizando...</>
                                ) : (
                                    'Redefinir senha'
                                )}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <Loader2 size={28} className="text-indigo-400 animate-spin" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    )
}
