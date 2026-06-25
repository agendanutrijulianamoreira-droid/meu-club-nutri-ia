'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight, Sparkles, ShieldCheck, Heart, Trophy, Zap } from 'lucide-react';

const PERKS = [
    { icon: Zap, text: 'Check-ins inteligentes com IA', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { icon: Trophy, text: 'Gamificação e ranking de XP', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { icon: Heart, text: 'Comunidade exclusiva do clube', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    { icon: ShieldCheck, text: 'Protocolos personalizados', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
]

export default function PacienteLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (!data.session) return;
            const role = data.session.user.user_metadata?.user_type;
            if (role === 'admin' || role === 'nutritionist' || role === 'nutri') {
                router.push('/admin');
            } else {
                router.push('/patient/home');
            }
        });
    }, [router]);

    const handleForgotPassword = async () => {
        if (!email) { setError('Digite seu e-mail antes de solicitar redefinição.'); return; }
        setLoading(true); setError(null); setSuccessMsg(null);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/patient/home`,
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
            if (data.user) router.push('/patient/home');
        } catch (err: any) {
            setError(err.message || 'E-mail ou senha inválidos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex overflow-hidden">
            {/* Left — Visual/Brand */}
            <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-emerald-950/50 via-slate-950 to-slate-950 border-r border-white/5 p-14 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-600/8 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-16">
                        <Sparkles size={20} className="text-emerald-400" />
                        <span className="font-black text-white text-lg tracking-tight">VitaClub</span>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-5">Área da Aluna</p>
                    <h1 className="text-4xl font-black text-white tracking-tighter leading-tight mb-5">
                        Continue sua<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                            jornada hoje
                        </span>
                    </h1>
                    <p className="text-slate-400 text-base leading-relaxed font-light mb-10">
                        Registre seu check-in, veja seu progresso e interaja com a comunidade do seu clube.
                    </p>

                    <div className="space-y-3">
                        {PERKS.map((p, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.08 }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${p.bg}`}
                            >
                                <p.icon size={15} className={p.color} />
                                <span className="text-white text-sm font-medium">{p.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/8 rounded-2xl">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-white text-xs font-bold">Acesso 100% seguro</p>
                            <p className="text-slate-500 text-xs">Seus dados são protegidos e criptografados</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right — Login Form */}
            <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 relative">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="w-full max-w-md mx-auto relative z-10">
                    {/* Mobile header */}
                    <div className="mb-10 lg:hidden flex items-center gap-2">
                        <Sparkles size={20} className="text-emerald-400" />
                        <span className="font-black text-white text-lg">VitaClub</span>
                    </div>

                    <div className="mb-10">
                        <h2 className="text-2xl font-black text-white tracking-tight mb-1">Bem-vinda de volta!</h2>
                        <p className="text-slate-500 text-sm">Entre com seu e-mail e senha para continuar</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">E-mail</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Senha</label>
                                <button type="button" onClick={handleForgotPassword}
                                    className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-300 transition-colors">
                                    Esqueceu?
                                </button>
                            </div>
                            <input
                                type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700"
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
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30">
                            {loading
                                ? <Loader2 size={18} className="animate-spin" />
                                : <>Entrar na minha conta <ArrowRight size={16} /></>
                            }
                        </button>
                    </form>

                    <div className="mt-8 p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                        <p className="text-slate-500 text-xs mb-1">Ainda não tem conta?</p>
                        <p className="text-slate-400 text-sm font-bold">
                            Entre em contato com sua nutricionista para receber seu convite.
                        </p>
                    </div>

                    <div className="mt-6 text-center">
                        <a href="/login" className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-500 transition-colors">
                            ← Voltar à seleção
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
