'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPwd, setShowPwd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [sessionReady, setSessionReady] = useState(false)

    // Supabase envia o token via hash (#access_token=...) ao clicar no link do e-mail.
    // O SDK detecta e processa automaticamente ao inicializar.
    useEffect(() => {
        supabase.auth.getSession().then(({ data }: { data: any }) => {
            const session = data.session
            if (session) {
                setSessionReady(true)
            } else {
                setToast({ type: 'error', msg: 'Link inválido ou expirado. Solicite um novo link de redefinição.' })
            }
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password.length < 6) {
            setToast({ type: 'error', msg: 'A senha deve ter pelo menos 6 caracteres.' })
            return
        }
        if (password !== confirm) {
            setToast({ type: 'error', msg: 'As senhas não coincidem.' })
            return
        }

        setLoading(true)
        setToast(null)

        const { error } = await supabase.auth.updateUser({ password })

        setLoading(false)

        if (error) {
            setToast({ type: 'error', msg: error.message || 'Erro ao atualizar senha. Tente novamente.' })
        } else {
            setToast({ type: 'success', msg: 'Senha atualizada com sucesso! Redirecionando...' })
            setTimeout(() => router.push('/admin'), 2000)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-3xl p-10"
            >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-8 mx-auto">
                    <ShieldCheck size={28} className="text-indigo-400" />
                </div>

                <h1 className="text-2xl font-black text-white text-center mb-1">Nova Senha</h1>
                <p className="text-slate-500 text-sm text-center mb-8">
                    Escolha uma senha forte com pelo menos 6 caracteres.
                </p>

                {/* Toast */}
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-2.5 text-xs font-bold rounded-2xl px-4 py-3 mb-6 ${
                            toast.type === 'success'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle size={14} />
                            : <AlertCircle size={14} />
                        }
                        {toast.msg}
                    </motion.div>
                )}

                {sessionReady && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                Nova senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/8 rounded-2xl py-4 px-5 pr-12 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                Confirmar nova senha
                            </label>
                            <input
                                type={showPwd ? 'text' : 'password'}
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                className="w-full bg-slate-950 border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                placeholder="Repita a senha"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            {loading
                                ? <><Loader2 size={18} className="animate-spin" /> Atualizando...</>
                                : 'Salvar nova senha'
                            }
                        </button>
                    </form>
                )}

                <button
                    onClick={() => router.push('/login')}
                    className="w-full mt-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
                >
                    Voltar para o login
                </button>
            </motion.div>
        </div>
    )
}
