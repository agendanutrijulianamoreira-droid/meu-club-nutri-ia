'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-browser'
import { signupUser } from '@/app/auth/actions';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [userType, setUserType] = useState<'patient' | 'nutri'>('patient');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);

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
                    // Redirecionar baseado no metadata do usuário (mais rápido e evita issues de permissão inicial)
                    const userType = authData.user.user_metadata?.user_type;

                    if (userType === 'nutri' || userType === 'nutritionist' || userType === 'admin') {
                        router.push('/admin');
                    } else {
                        router.push('/patient/home');
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 mb-4 shadow-lg">
                        <span className="text-3xl">🧠</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {isSignUp ? 'Criar Conta' : 'Portal do Reino'}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isSignUp ? 'Inicie sua jornada no clube de elite' : 'Acesse sua jornada de saúde'}
                    </p>
                </div>

                {/* User Type Selector (apenas no login) */}
                {!isSignUp && (
                    <div className="flex bg-slate-900/50 p-1 rounded-xl mb-6 border border-white/5">
                        <button
                            type="button"
                            onClick={() => setUserType('patient')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${userType === 'patient'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <span>👑</span> Sou Aluna
                        </button>
                        <button
                            type="button"
                            onClick={() => setUserType('nutri')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${userType === 'nutri'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <span>🩺</span> Sou Nutri
                        </button>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase ml-1 mb-2">
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Seu nome"
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase ml-1 mb-2">
                            E-mail
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={userType === 'patient' ? 'aluna@exemplo.com' : 'dra@clinic.com'}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase ml-1 mb-2">
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span>Processando...</span>
                        ) : (
                            <>
                                {isSignUp
                                    ? 'Criar Conta'
                                    : userType === 'patient'
                                        ? 'Entrar no Meu Club'
                                        : 'Acessar Painel Clínico'}
                                <span>→</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center border-t border-white/5 pt-6">
                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                    >
                        {isSignUp ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar'}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-500 mt-4">
                    Esqueceu sua senha? <span className="text-indigo-400 cursor-pointer hover:underline">Recuperar acesso</span>
                </p>
            </div>
        </div>
    );
}
