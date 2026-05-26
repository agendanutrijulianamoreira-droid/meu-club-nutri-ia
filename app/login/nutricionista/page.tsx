'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight, Brain, ShieldCheck } from 'lucide-react';

export default function NutricionistaLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('error') === 'auth_failed') {
            setError('Link inválido ou expirado. Solicite um novo link de redefinição.');
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.push('/admin');
        });
    }, [router]);

    const handleForgotPassword = async () => {
        if (!email) { setError('Digite seu e-mail antes de solicitar redefinição.'); return; }
        setLoading(true); setError(null); setSuccessMsg(null);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
        });
        setLoading(false);
        if (resetError) setError(resetError.message);
        else setSuccessMsg(`E-mail enviado para ${email}. Verifique sua caixa de entrada.`);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) throw loginError;
            if (data.user) router.push('/admin');
        } catch (err: any) {
            setError(err.message || 'E-mail ou senha inválidos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                        <Brain size={32} className="text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Área Restrita</p>
                    <h1 className="text-3xl font-black text-white tracking-tight">Painel da Nutricionista</h1>
                    <p className="text-slate-500 text-sm mt-2">Acesse seu painel de gestão do clube</p>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">E-mail</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                placeholder="nutricionista@exemplo.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Senha</label>
                                <button type="button" onClick={handleForgotPassword}
                                    className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-300 transition-colors">
                                    Esqueceu?
                                </button>
                            </div>
                            <input
                                type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                placeholder="Sua senha"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold">
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <Loader2 size={18} className="animate-spin" />
                                : <><ShieldCheck size={16} /> Acessar Painel <ArrowRight size={16} /></>
                            }
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    Esta área é exclusiva para nutricionistas cadastradas.
                </p>
            </motion.div>
        </div>
    );
}
