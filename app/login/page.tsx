'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser'
import { signupUser } from '@/app/auth/actions';
import { useRouter } from 'next/navigation';

import { loginBanners } from './loginBanners';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
    const router = useRouter();
    const [userType, setUserType] = useState<'patient' | 'nutritionist'>('patient');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [bannerIndex, setBannerIndex] = useState(0);

    // Auto-rotate banners
    useEffect(() => {
        const interval = setInterval(() => {
            setBannerIndex((prev) => (prev + 1) % loginBanners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Redirecionar se já estiver logado
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

                if (role === 'nutri' || role === 'nutritionist' || role === 'admin') {
                    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', session.user.id).single();
                    const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';
                    if (!profile?.tenant_id || isDemoTenant) {
                        router.push('/admin/clinic');
                    } else {
                        router.push('/admin');
                    }
                } else if (role === 'patient') {
                    router.push('/patient/home');
                } else {
                    // Não redireciona automaticamente se não tiver certeza do papel
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
                // Cadastro
                const formData = new FormData();
                formData.append('email', email);
                formData.append('password', password);
                formData.append('fullName', fullName);
                formData.append('userType', userType);

                const result = await signupUser(formData);

                if (!result.success) {
                    throw new Error(result.error);
                }

                alert('✨ Conta criada! Você ganhou 100 NutriCoins! Faça login para continuar.');
                setIsSignUp(false);
                setFullName('');
            } else {
                // Login
                // supabase importado do singleton
                const { data: authData, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                if (authData.user) {
                    // Redirecionar baseado no metadata do usuário (mais rápido)
                    const userMetadata = authData.user.user_metadata;
                    let detectedRole = userMetadata?.user_type || userMetadata?.role;

                    // Fallback: Se não tiver no metadata, busca no banco e tenta "curar" o metadata
                    if (!detectedRole) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('user_id', authData.user.id)
                            .single();

                        if (profile) {
                            detectedRole = profile.role;
                            // Update metadata for next time (Self-healing)
                            await supabase.auth.updateUser({
                                data: { user_type: detectedRole }
                            });
                        }
                    }

                    // Normalizar papel para evitar problemas de case/várias strings
                    const role = (detectedRole || '').toLowerCase();
                    const isAdmin = ['nutri', 'nutritionist', 'admin'].includes(role);

                    if (isAdmin) {
                        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', authData.user.id).single();
                        const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';
                        if (!profile?.tenant_id || isDemoTenant) {
                            router.push('/admin/clinic');
                        } else {
                            router.push('/admin');
                        }
                    } else if (role === 'patient') {
                        router.push('/patient/home');
                    } else {
                        // Se o perfil/metadata falhou mas ele escolheu ser nutri no formulário, confia no formulário
                        if (userType === 'nutritionist') {
                            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', authData.user.id).single();
                            const isDemoTenant = profile?.tenant_id === '00000000-0000-0000-0000-000000000001';
                            router.push((!profile?.tenant_id || isDemoTenant) ? '/admin/clinic' : '/admin');
                        } else {
                            router.push('/patient/home');
                        }
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar autenticação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950 overflow-hidden">

            {/* Left Column: Banners (Desktop Only) */}
            <div className="hidden lg:flex flex-col justify-center p-20 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />

                <div className="relative z-10 max-w-lg">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-black uppercase tracking-widest mb-10">
                        <Sparkles size={14} /> Solução All-in-One para Nutris
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={bannerIndex}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <span className="text-6xl">{loginBanners[bannerIndex].emoji}</span>
                            <h2 className="text-5xl font-black text-white italic leading-tight">
                                {loginBanners[bannerIndex].title}
                            </h2>
                            <p className="text-xl text-slate-400 leading-relaxed">
                                {loginBanners[bannerIndex].description}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    {/* Banner Progress Dots */}
                    <div className="flex gap-2 mt-12">
                        {loginBanners.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-500 ${i === bannerIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-white/10'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Ambient Glow */}
                <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full" />
            </div>

            {/* Right Column: Auth Form */}
            <div className="flex items-center justify-center p-8 lg:p-20 relative bg-[#020617]">

                <div className="w-full max-w-md space-y-8 relative z-10">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 mb-6 shadow-xl">
                            <span className="text-3xl">🧠</span>
                        </div>
                        <h1 className="text-4xl font-black text-white mb-2 italic tracking-tight">
                            {isSignUp ? 'Criar Conta' : 'Portal do Rei'}
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {isSignUp ? 'Junte-se ao 1% das nutris que usam tecnologia de ponta' : 'Acesse sua área exclusiva para membros'}
                        </p>
                    </div>

                    {/* User Type Selector (apenas no login) */}
                    {!isSignUp && (
                        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => setUserType('patient')}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${userType === 'patient'
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                👑 Aluna
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserType('nutritionist')}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${userType === 'nutritionist'
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                🩺 Nutri
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-5">
                        {isSignUp && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Ex: Dra. Juliana"
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">
                                E-mail Institucional
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={userType === 'patient' ? 'seuemail@exemplo.com' : 'dra@clinica.com'}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                    Senha de Acesso
                                </label>
                                {!isSignUp && (
                                    <span className="text-[10px] font-bold text-indigo-400 cursor-pointer hover:underline">Esqueceu?</span>
                                )}
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-all"
                                required
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center font-bold"
                            >
                                ⚠️ {error}
                            </motion.div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black h-16 rounded-2xl shadow-xl shadow-indigo-950/40 transition-all disabled:opacity-50 gap-2 uppercase tracking-widest text-xs"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    {isSignUp ? 'Criar Conta Agora' : 'Entrar no Sistema'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center pt-8 border-t border-white/5">
                        <p className="text-slate-500 text-sm mb-4">
                            {isSignUp ? 'Já possui acesso?' : 'Ainda não tem acesso?'}
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-white font-black uppercase tracking-widest text-xs hover:text-indigo-400 transition-colors"
                        >
                            {isSignUp ? 'Fazer Login' : 'Criar minha conta gratuita'}
                        </button>
                    </div>
                </div>

                {/* Mobile ambient decoration */}
                <div className="lg:hidden absolute top-[-10%] right-[-10%] w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full -z-10" />
            </div>
        </div>
    );
}
