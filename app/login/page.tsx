'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser'
import { signupUser } from '@/app/auth/actions';
import { useRouter } from 'next/navigation';

import { loginBanners } from './loginBanners';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleButton } from '@/components/auth/GoogleButton';

export default function LoginPage() {
    const router = useRouter();
    const [userType, setUserType] = useState<'patient' | 'nutritionist'>('patient');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<any>(null);

    // Fetch Public Settings for Login
    useEffect(() => {
        const loadConfig = async () => {
            const { data } = await supabase
                .from('public_settings')
                .select('value')
                .eq('key', 'login_config')
                .single();
            if (data?.value) setConfig(data.value);
        };
        loadConfig();
    }, []);

    // Redirecionar se já estiver logado (Logic preserved from original)
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const userMetadata = session.user.user_metadata;
                let role = userMetadata?.user_type || userMetadata?.role;
                if (!role) {
                    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', session.user.id).single();
                    if (profile) role = profile.role;
                }
                if (['nutri', 'nutritionist', 'admin'].includes(role)) {
                    router.push('/admin');
                } else if (role === 'patient') {
                    router.push('/patient/home');
                }
            }
        };
        checkUser();
    }, [router]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const formData = new FormData();
                formData.set('email', email);
                formData.set('password', password);
                formData.set('fullName', fullName);
                formData.set('userType', userType);
                const result = await signupUser(formData);
                if (!result.success) throw new Error(result.error);
                alert('✨ Conta criada! Faça login para continuar.');
                setIsSignUp(false);
            } else {
                const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (authData.user) {
                    const userMetadata = authData.user.user_metadata;
                    let detectedRole = (userMetadata?.user_type || userMetadata?.role || '').toLowerCase();
                    const isAdmin = ['nutri', 'nutritionist', 'admin'].includes(detectedRole);
                    router.push(isAdmin ? '/admin' : '/patient/home');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar autenticação');
        } finally {
            setLoading(false);
        }
    };

    const bgUrl = config?.background_url || "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80";

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-hidden bg-slate-950">
            {/* Fullscreen Background */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: `url('${bgUrl}')` }}
            >
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
            </div>

            {/* Main Overlay Container */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden relative z-10"
            >
                {/* Left Side: Marketing (Dynamic) */}
                <div className="hidden lg:flex flex-col justify-center p-16 space-y-8 bg-indigo-600/10 border-r border-white/5 relative overflow-hidden">
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 blur-[100px]" />

                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-4 w-fit">
                        <Sparkles size={14} /> {config?.badge_text || "Premium Edition"}
                    </div>

                    <h1 className="text-5xl font-black text-white italic leading-[1.1] tracking-tighter">
                        {config?.headline || "Transforme sua carreira com Inteligência."}
                    </h1>

                    <p className="text-lg text-slate-300 font-medium">
                        {config?.subheadline || "A plataforma definitiva para Nutricionistas que buscam o próximo nível de escala e fidelização."}
                    </p>

                    <ul className="space-y-4 pt-4">
                        {(config?.bullets || ["Automação que economiza 15h por semana", "Experiência WOW para suas pacientes", "Sua marca profissional em alta performance"]).map((bullet: string, i: number) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-400 font-bold uppercase tracking-widest">
                                <div className="h-5 w-5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                                    <ArrowRight size={12} />
                                </div>
                                {bullet}
                            </li>
                        ))}
                    </ul>

                    <div className="pt-8 underline underline-offset-8 text-indigo-400 font-black text-xs uppercase tracking-[0.2em] cursor-pointer hover:text-white transition-all">
                        {config?.cta_text || "Conhecer Metodologia"}
                    </div>
                </div>

                {/* Right Side: Auth Form */}
                <div className="p-12 lg:p-16 flex flex-col justify-center">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
                            {isSignUp ? "Criar Conta" : "Bem-vinda de volta"}
                        </h2>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                            {isSignUp ? "Inicie sua jornada lucrativa hoje" : "Acesse seu painel administrativo"}
                        </p>
                    </div>

                    {!isSignUp && (
                        <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 mb-8">
                            {['patient', 'nutritionist'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setUserType(t as any)}
                                    className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${userType === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {t === 'patient' ? 'Paciente' : 'Nutricionista'}
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-5">
                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input
                                    type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">E-mail</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Senha</label>
                                {!isSignUp && <span className="text-[10px] font-black uppercase text-indigo-500 cursor-pointer">Esqueceu?</span>}
                            </div>
                            <input
                                type="password" value={password} onChange={e => setPassword(e.target.value)}
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
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <>{isSignUp ? "Finalizar Cadastro" : "Entrar no Sistema"} <ArrowRight size={18} /></>}
                        </Button>

                        {!isSignUp && (
                            <>
                                <div className="flex items-center gap-4 my-6">
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">ou</span>
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                </div>

                                <GoogleButton />
                            </>
                        )}
                    </form>

                    <div className="mt-10 text-center">
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
                        >
                            {isSignUp ? "Já tenho acesso • Fazer Login" : "Ainda não tenho acesso • Criar Conta"}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
