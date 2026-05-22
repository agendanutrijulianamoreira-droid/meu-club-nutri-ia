'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('As senhas não coincidem.');
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
            setTimeout(() => router.push('/admin'), 2500);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl p-12"
            >
                <div className="flex flex-col items-center mb-10">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                        <KeyRound size={26} className="text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2 text-center">
                        Nova Senha
                    </h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] text-center">
                        Defina sua nova senha de acesso
                    </p>
                </div>

                {success ? (
                    <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-[10px] font-black uppercase tracking-widest text-center">
                        Senha atualizada! Redirecionando...
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Nova Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Confirmar Senha</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="Repita a nova senha"
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-slate-950 hover:bg-slate-200 h-16 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-black/20 gap-3"
                        >
                            {loading
                                ? <Loader2 className="animate-spin" size={20} />
                                : <>Salvar Nova Senha <ArrowRight size={18} /></>
                            }
                        </Button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
