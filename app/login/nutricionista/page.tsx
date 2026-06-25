'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { signupUser } from '@/app/auth/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, ArrowRight, Brain, ShieldCheck, Sparkles,
    CheckCircle, Zap, Users, BarChart2, Bot, Crown, Star,
    TrendingUp, Calculator, ChevronDown
} from 'lucide-react';

const FEATURES = [
    { icon: Bot, text: 'Nutricionista IA disponível 24h para suas pacientes', color: 'text-indigo-400' },
    { icon: Users, text: 'Gestão completa de pacientes com risk score inteligente', color: 'text-violet-400' },
    { icon: BarChart2, text: 'Analytics e check-ins automáticos com gamificação', color: 'text-emerald-400' },
    { icon: Zap, text: '8 agentes de IA que trabalham por você enquanto dorme', color: 'text-amber-400' },
]

const PLANS = [
    { name: 'Starter', price: 'R$ 97', desc: 'Até 30 pacientes', popular: false },
    { name: 'Professional', price: 'R$ 197', desc: 'Até 100 pacientes', popular: true },
    { name: 'Premium', price: 'R$ 397', desc: 'Ilimitado + suporte', popular: false },
]

/* ─── Calculadora de Receita ─────────────────────────────────────────────────── */
function RevenueCalculator({ onSignup }: { onSignup: () => void }) {
    const [patients, setPatients] = useState(20);
    const [consultPrice, setConsultPrice] = useState(300);
    const [consultsPerMonth, setConsultsPerMonth] = useState(2);
    const [planPrice, setPlanPrice] = useState(97);
    const [showDetails, setShowDetails] = useState(false);

    const currentRevenue = patients * consultPrice * consultsPerMonth;

    // Conversão realista: 70% trimestral (3m), 20% semestral (6m), 10% mensal (1m)
    const subsMonthly = Math.round(patients * 0.10);
    const subsTrimestral = Math.round(patients * 0.70);
    const subsSemestral = Math.round(patients * 0.20);

    const revenueMonthly = subsMonthly * planPrice;
    const revenueTrimestral = subsTrimestral * (planPrice * 3) / 3; // normalizado p/ mês
    const revenueSemestral = subsSemestral * (planPrice * 6) / 6;
    const newRevenue = Math.round(revenueMonthly + revenueTrimestral + revenueSemestral);
    const gain = newRevenue - currentRevenue;
    const multiplier = currentRevenue > 0 ? (newRevenue / currentRevenue).toFixed(1) : '∞';
    const annualGain = gain * 12;

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-3">
                    <Calculator size={12} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Simulador de Receita</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">Quanto você pode ganhar?</h3>
                <p className="text-slate-500 text-xs mt-1">Ajuste os valores abaixo para ver sua projeção real</p>
            </div>

            {/* Sliders */}
            <div className="space-y-5 bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                <SliderField
                    label="Pacientes ativas"
                    value={patients}
                    min={5} max={200} step={5}
                    display={`${patients} pacientes`}
                    onChange={setPatients}
                    color="indigo"
                />
                <SliderField
                    label="Valor da consulta individual"
                    value={consultPrice}
                    min={100} max={1000} step={50}
                    display={fmt(consultPrice)}
                    onChange={setConsultPrice}
                    color="violet"
                />
                <SliderField
                    label="Consultas por paciente/mês"
                    value={consultsPerMonth}
                    min={1} max={4} step={1}
                    display={`${consultsPerMonth}x por mês`}
                    onChange={setConsultsPerMonth}
                    color="violet"
                />
                <SliderField
                    label="Preço do plano mensal (paciente)"
                    value={planPrice}
                    min={47} max={497} step={10}
                    display={fmt(planPrice) + '/mês'}
                    onChange={setPlanPrice}
                    color="emerald"
                />
            </div>

            {/* Resultado */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Receita Atual</p>
                    <p className="text-xl font-black text-white">{fmt(currentRevenue)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">consultas avulsas/mês</p>
                </div>
                <div className={`rounded-2xl p-4 text-center border ${gain >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/25'
                    : 'bg-rose-500/10 border-rose-500/25'
                    }`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">Com VitaClub</p>
                    <p className="text-xl font-black text-white">{fmt(newRevenue)}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">{multiplier}x mais receita/mês</p>
                </div>
            </div>

            {/* Destaque do ganho anual */}
            <motion.div
                key={annualGain}
                initial={{ scale: 0.97, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-r from-emerald-500/15 via-indigo-500/10 to-emerald-500/15 border border-emerald-500/25 rounded-2xl p-5 text-center"
            >
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Ganho adicional estimado</p>
                <p className="text-3xl font-black text-white mb-1">
                    {gain >= 0 ? '+' : ''}{fmt(gain)}<span className="text-slate-400 text-base font-normal">/mês</span>
                </p>
                <p className="text-sm text-emerald-400 font-bold">
                    = {fmt(Math.abs(annualGain))} a mais por ano
                </p>
            </motion.div>

            {/* Detalhamento */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
            >
                Ver como foi calculado
                <ChevronDown size={12} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {showDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2 text-xs text-slate-500">
                            <p className="font-black text-slate-400 uppercase tracking-widest text-[9px] mb-3">Premissas de conversão</p>
                            <div className="flex justify-between">
                                <span>Plano mensal ({subsMonthly} pacientes × {fmt(planPrice)})</span>
                                <span className="text-white">{fmt(revenueMonthly)}/mês</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Plano trimestral ({subsTrimestral} pacientes × {fmt(planPrice * 3)}/3)</span>
                                <span className="text-white">{fmt(revenueTrimestral)}/mês</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Plano semestral ({subsSemestral} pacientes × {fmt(planPrice * 6)}/6)</span>
                                <span className="text-white">{fmt(revenueSemestral)}/mês</span>
                            </div>
                            <div className="border-t border-white/5 pt-2 flex justify-between font-bold">
                                <span className="text-slate-400">Total com VitaClub</span>
                                <span className="text-emerald-400">{fmt(newRevenue)}/mês</span>
                            </div>
                            <p className="text-[9px] text-slate-700 pt-1">* Projeção baseada em taxas médias de conversão: 10% mensal, 70% trimestral, 20% semestral</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={onSignup}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
            >
                <TrendingUp size={16} />
                Começar agora e multiplicar minha receita
                <ArrowRight size={16} />
            </button>

            <p className="text-center text-[9px] text-slate-700 font-black uppercase tracking-widest">
                14 dias grátis · Sem cartão · Cancele quando quiser
            </p>
        </div>
    );
}

function SliderField({
    label, value, min, max, step, display, onChange, color
}: {
    label: string; value: number; min: number; max: number; step: number;
    display: string; onChange: (v: number) => void; color: 'indigo' | 'violet' | 'emerald'
}) {
    const pct = ((value - min) / (max - min)) * 100;
    const trackColor = {
        indigo: 'accent-indigo-500',
        violet: 'accent-violet-500',
        emerald: 'accent-emerald-500',
    }[color];

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</span>
                <span className={`text-xs font-black ${color === 'emerald' ? 'text-emerald-400' : color === 'violet' ? 'text-violet-400' : 'text-indigo-400'}`}>
                    {display}
                </span>
            </div>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className={`w-full h-1.5 rounded-full appearance-none bg-white/8 cursor-pointer ${trackColor}`}
                style={{
                    background: `linear-gradient(to right, ${color === 'emerald' ? '#10b981' : color === 'violet' ? '#8b5cf6' : '#6366f1'} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`
                }}
            />
        </div>
    );
}

/* ─── Plan Card ──────────────────────────────────────────────────────────────── */
function PlanCard({ name, price, desc, features, popular, premium, onSelect }: {
    name: string; price: string; desc: string; features: string[]
    popular?: boolean; premium?: boolean; onSelect: () => void
}) {
    return (
        <div className={`relative rounded-2xl p-5 border transition-all ${popular
            ? 'bg-gradient-to-br from-indigo-600/15 to-transparent border-indigo-500/40'
            : premium
                ? 'bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/25'
                : 'bg-white/[0.03] border-white/8'
            }`}>
            {popular && (
                <div className="absolute -top-2.5 left-5">
                    <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        ⭐ Mais popular
                    </span>
                </div>
            )}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {premium && <Crown size={12} className="text-amber-400" />}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${premium ? 'text-amber-400' : popular ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {name}
                        </span>
                    </div>
                    <p className="text-2xl font-black text-white">{price}<span className="text-slate-500 text-sm font-normal">/mês</span></p>
                    <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
                <button onClick={onSelect}
                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${popular
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : premium
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300'
                            : 'bg-white/8 hover:bg-white/12 border border-white/10 text-white'
                        }`}>
                    Começar
                </button>
            </div>
            <ul className="space-y-1.5">
                {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle size={11} className={popular ? 'text-indigo-400' : premium ? 'text-amber-400' : 'text-slate-500'} />
                        {f}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ─── Feedback Block ─────────────────────────────────────────────────────────── */
function FeedbackBlock({ error, success }: { error: string | null; success: string | null }) {
    if (!error && !success) return null;
    return (
        <div className={`p-4 rounded-2xl text-xs font-bold ${error
            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            }`}>
            {error || success}
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
function NutricionistaLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'comprar' ? 'buy' : 'login';

    const [tab, setTab] = useState<'login' | 'criar' | 'buy'>(initialTab as any);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
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
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
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

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const formData = new FormData();
            formData.set('email', email);
            formData.set('password', password);
            formData.set('fullName', fullName);
            formData.set('userType', 'nutritionist');
            const result = await signupUser(formData);
            if (!result.success) throw new Error(result.error);
            setSuccessMsg('Conta criada! Verifique seu e-mail para ativar o acesso.');
            setTab('login');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta.');
        } finally {
            setLoading(false);
        }
    };

    const switchTab = useCallback((t: 'login' | 'criar' | 'buy') => {
        setTab(t);
        setError(null);
        setSuccessMsg(null);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 flex overflow-hidden">
            {/* Left — Sales/Marketing */}
            <div className="hidden lg:flex flex-col justify-between w-[52%] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-r border-white/5 p-14 relative overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 blur-[130px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

                {/* Logo / Brand */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <Brain size={20} className="text-indigo-400" />
                        </div>
                        <span className="font-black text-white text-lg tracking-tight">VitaClub</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">PRO</span>
                    </div>

                    <div className="mb-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-4">
                            Plataforma para Nutricionistas
                        </p>
                        <h1 className="text-5xl font-black text-white tracking-tighter leading-[1.05] mb-5">
                            Seu clube de nutrição<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400">
                                com IA trabalhando por você
                            </span>
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed font-light">
                            Escale sua clínica, fidelize pacientes e automatize resultados com 8 agentes de IA personalizados para o seu método.
                        </p>
                    </div>

                    <div className="space-y-4 mb-10">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.08 }}
                                className="flex items-center gap-4"
                            >
                                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                                    <f.icon size={14} className={f.color} />
                                </div>
                                <span className="text-slate-300 text-sm font-medium">{f.text}</span>
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/8 rounded-2xl">
                        <div className="flex -space-x-2">
                            {['bg-indigo-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'].map((c, i) => (
                                <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-slate-950`} />
                            ))}
                        </div>
                        <div>
                            <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(i => <Star key={i} size={10} fill="#f59e0b" className="text-amber-400" />)}
                            </div>
                            <p className="text-slate-400 text-xs">+340 nutricionistas ativas na plataforma</p>
                        </div>
                    </div>
                </div>

                {/* Plans preview */}
                <div className="relative z-10">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-600 mb-4">Planos a partir de</p>
                    <div className="flex gap-3">
                        {PLANS.map((plan) => (
                            <div key={plan.name}
                                className={`flex-1 rounded-2xl p-4 border transition-all ${plan.popular
                                    ? 'bg-indigo-600/15 border-indigo-500/40'
                                    : 'bg-white/[0.03] border-white/8'
                                }`}>
                                {plan.popular && (
                                    <span className="text-[8px] font-black uppercase text-indigo-400 block mb-1">Popular</span>
                                )}
                                <p className="text-white font-black text-lg">{plan.price}</p>
                                <p className="text-slate-500 text-[10px]">{plan.name}</p>
                                <p className="text-slate-600 text-[9px] mt-1">{plan.desc}</p>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => switchTab('buy')}
                        className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        Simular minha receita <ArrowRight size={10} />
                    </button>
                </div>
            </div>

            {/* Right — Auth Panel */}
            <div className="flex-1 flex flex-col justify-center p-8 lg:p-12 relative overflow-y-auto">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="w-full max-w-md mx-auto relative z-10 py-8">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-10 lg:hidden">
                        <Brain size={20} className="text-indigo-400" />
                        <span className="font-black text-white">VitaClub</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">PRO</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-white/[0.04] border border-white/8 rounded-2xl p-1 gap-1 mb-8">
                        {[
                            { key: 'login', label: 'Entrar' },
                            { key: 'criar', label: 'Criar Conta' },
                            { key: 'buy', label: '📊 Simular' },
                        ].map((t) => (
                            <button key={t.key}
                                onClick={() => switchTab(t.key as any)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.key
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                                    : 'text-slate-500 hover:text-white'
                                    }`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {/* LOGIN TAB */}
                        {tab === 'login' && (
                            <motion.div key="login"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-8">
                                    <h2 className="text-2xl font-black text-white tracking-tight mb-1">Acessar painel</h2>
                                    <p className="text-slate-500 text-sm">Entre com suas credenciais de nutricionista</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">E-mail</label>
                                        <input
                                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-slate-700"
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
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="Sua senha"
                                            required
                                        />
                                    </div>

                                    <FeedbackBlock error={error} success={successMsg} />

                                    <button type="submit" disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30">
                                        {loading
                                            ? <Loader2 size={18} className="animate-spin" />
                                            : <><ShieldCheck size={16} /> Acessar Painel <ArrowRight size={16} /></>
                                        }
                                    </button>
                                </form>

                                <p className="mt-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Não tem conta?{' '}
                                    <button onClick={() => switchTab('criar')} className="text-indigo-500 hover:text-indigo-300 transition-colors">
                                        Criar agora
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* CRIAR CONTA TAB */}
                        {tab === 'criar' && (
                            <motion.div key="criar"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-8">
                                    <h2 className="text-2xl font-black text-white tracking-tight mb-1">Criar sua conta</h2>
                                    <p className="text-slate-500 text-sm">Comece com 14 dias grátis, sem cartão</p>
                                </div>

                                <form onSubmit={handleSignup} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Nome Completo</label>
                                        <input
                                            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="Seu nome completo"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">E-mail profissional</label>
                                        <input
                                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="nutricionista@exemplo.com"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Senha</label>
                                        <input
                                            type="password" value={password} onChange={e => setPassword(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-2xl py-4 px-5 text-white outline-none focus:border-indigo-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="Mínimo 8 caracteres"
                                            required minLength={8}
                                        />
                                    </div>

                                    <FeedbackBlock error={error} success={successMsg} />

                                    <button type="submit" disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30">
                                        {loading
                                            ? <Loader2 size={18} className="animate-spin" />
                                            : <><Sparkles size={16} /> Criar minha conta <ArrowRight size={16} /></>
                                        }
                                    </button>
                                </form>

                                <div className="mt-5 flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl">
                                    <CheckCircle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        14 dias de acesso completo grátis. Após o período, escolha o plano ideal para você. Sem cobrança automática.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* SIMULAR TAB */}
                        {tab === 'buy' && (
                            <motion.div key="buy"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <RevenueCalculator onSignup={() => switchTab('criar')} />

                                {/* Plans below calculator */}
                                <div className="mt-8 space-y-4">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 text-center">Escolha seu plano</p>
                                    <PlanCard
                                        name="Starter"
                                        price="R$ 97"
                                        desc="Até 30 pacientes ativas"
                                        features={['IA nutricionista personalizada', 'Painel de gestão completo', 'Check-ins automáticos', 'Gamificação e XP']}
                                        onSelect={() => switchTab('criar')}
                                    />
                                    <PlanCard
                                        name="Professional"
                                        price="R$ 197"
                                        desc="Até 100 pacientes ativas"
                                        features={['Tudo do Starter', '8 agentes de IA ativos', 'Analytics avançado', 'Página de vendas própria', 'Suporte prioritário']}
                                        popular
                                        onSelect={() => switchTab('criar')}
                                    />
                                    <PlanCard
                                        name="Premium"
                                        price="R$ 397"
                                        desc="Pacientes ilimitadas"
                                        features={['Tudo do Professional', 'White-label completo', 'Onboarding dedicado', 'API de integrações']}
                                        premium
                                        onSelect={() => switchTab('criar')}
                                    />
                                </div>

                                <p className="mt-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Já tem conta?{' '}
                                    <button onClick={() => switchTab('login')} className="text-indigo-500 hover:text-indigo-300 transition-colors">
                                        Fazer login
                                    </button>
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Back link */}
                <div className="text-center mt-4 relative z-10 pb-4">
                    <a href="/login" className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-500 transition-colors">
                        ← Voltar à seleção
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function NutricionistaLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-t-indigo-500 border-white/10 animate-spin" />
            </div>
        }>
            <NutricionistaLoginContent />
        </Suspense>
    );
}
