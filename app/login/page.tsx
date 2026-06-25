'use client';

import { motion } from 'framer-motion';
import { Brain, Sparkles, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

export default function LoginGatewayPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-indigo-600/10 blur-[140px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-emerald-500/8 blur-[140px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-4xl relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full mb-6">
                        <Zap size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">VitaClub Platform</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-3">
                        Bem-vinda de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">volta</span>
                    </h1>
                    <p className="text-slate-500 text-base">Selecione como deseja acessar a plataforma</p>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Nutricionista */}
                    <Link href="/login/nutricionista">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            className="group relative bg-gradient-to-b from-indigo-600/15 via-indigo-600/5 to-transparent border border-indigo-500/30 hover:border-indigo-400/50 rounded-3xl p-10 cursor-pointer transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[60px] rounded-full" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-8 group-hover:bg-indigo-500/25 transition-colors">
                                    <Brain size={30} className="text-indigo-400" />
                                </div>

                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-3">Área Profissional</p>
                                <h2 className="text-2xl font-black text-white tracking-tight mb-3">Sou Nutricionista</h2>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    Acesse seu painel de gestão, acompanhe suas pacientes e gerencie seu clube de nutrição.
                                </p>

                                <div className="flex items-center gap-2 text-indigo-400 font-black text-sm group-hover:gap-3 transition-all">
                                    Acessar painel <ArrowRight size={16} />
                                </div>
                            </div>
                        </motion.div>
                    </Link>

                    {/* Paciente */}
                    <Link href="/login/paciente">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            className="group relative bg-gradient-to-b from-emerald-500/12 via-emerald-500/5 to-transparent border border-emerald-500/25 hover:border-emerald-400/50 rounded-3xl p-10 cursor-pointer transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-8 group-hover:bg-emerald-500/25 transition-colors">
                                    <Sparkles size={30} className="text-emerald-400" />
                                </div>

                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400 mb-3">Área da Aluna</p>
                                <h2 className="text-2xl font-black text-white tracking-tight mb-3">Sou Paciente</h2>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    Entre na sua conta para continuar sua jornada, registrar check-ins e acompanhar seus resultados.
                                </p>

                                <div className="flex items-center gap-2 text-emerald-400 font-black text-sm group-hover:gap-3 transition-all">
                                    Acessar minha conta <ArrowRight size={16} />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                </div>

                <p className="text-center text-slate-700 text-[10px] font-black uppercase tracking-widest mt-10">
                    Nutricionista sem conta?{' '}
                    <Link href="/login/nutricionista?tab=comprar" className="text-indigo-500 hover:text-indigo-400 transition-colors">
                        Conhecer planos
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
