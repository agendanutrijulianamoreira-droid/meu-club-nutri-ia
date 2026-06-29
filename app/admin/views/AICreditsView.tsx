"use client"

import React, { useState } from 'react'
import {
    Coins, TrendingUp, TrendingDown, RefreshCw, Sparkles, Loader2,
    ArrowUpRight, ArrowDownRight, Clock, Zap, Crown, Gift, BarChart3
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useAICredits, type AITransaction } from "@/lib/hooks/useAICredits"
import { refillCredits } from "@/lib/ai-credits"

interface AICreditsViewProps {
    setView: (v: any) => void
    tenantId?: string
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
    consumption: { label: 'Consumo', icon: ArrowDownRight, color: 'text-rose-400' },
    monthly_refill: { label: 'Renovação Mensal', icon: RefreshCw, color: 'text-emerald-400' },
    manual_add: { label: 'Recarga Manual', icon: ArrowUpRight, color: 'text-indigo-400' },
    bonus: { label: 'Bônus', icon: Gift, color: 'text-amber-400' },
}

const GENERATION_LABELS: Record<string, string> = {
    protocol: '🧬 Protocolo',
    challenge: '🏆 Desafio',
    persona: '🎭 Persona',
    club_plan: '📅 Plano do Clube',
    club_setup: '⚙️ Setup do Clube',
}

export function AICreditsView({ setView, tenantId }: AICreditsViewProps) {
    const { credits, transactions, loading, usagePercentage, refresh } = useAICredits(tenantId)
    const [isRefilling, setIsRefilling] = useState(false)
    const [refillAmount, setRefillAmount] = useState(10)
    const [showRefillModal, setShowRefillModal] = useState(false)
    const [refillError, setRefillError] = useState<string | null>(null)
    const showError = (msg: string) => { setRefillError(msg); setTimeout(() => setRefillError(null), 3500) }

    const handleRefill = async () => {
        if (!tenantId) return
        setIsRefilling(true)
        try {
            const result = await refillCredits(tenantId, refillAmount, 'manual_add', `Recarga manual de ${refillAmount} créditos`)
            if (result.success) {
                refresh()
                setShowRefillModal(false)
            } else {
                showError('Erro: ' + (result.error || 'Falha ao recarregar'))
            }
        } catch {
            showError('Erro inesperado ao recarregar créditos.')
        } finally {
            setIsRefilling(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-indigo-400" size={48} />
            </div>
        )
    }

    const remaining = credits?.credits_remaining ?? 0
    const monthlyLimit = credits?.monthly_limit ?? 5
    const totalUsed = credits?.credits_total_used ?? 0
    const progressPercent = monthlyLimit > 0 ? Math.min(100, Math.round((remaining / monthlyLimit) * 100)) : 0

    return (
        <div className="space-y-8 pb-20">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-4xl font-light text-white flex items-center gap-4">
                        <div className="bg-amber-500/20 p-3 rounded-2xl border border-amber-500/30 shadow-xl shadow-amber-900/20">
                            <Coins className="text-amber-400" size={32} />
                        </div>
                        Créditos de <span className="font-bold uppercase tracking-tighter">Inteligência</span>
                    </h1>
                    <p className="text-slate-400 mt-4 max-w-2xl text-lg font-medium">
                        Gerencie seus créditos de IA. Cada geração consome 1 crédito do seu saldo mensal.
                    </p>
                </div>
                <Button
                    onClick={() => setShowRefillModal(true)}
                    className="h-16 px-10 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-amber-900/40 gap-3 transition-all hover:scale-105 active:scale-95"
                >
                    <Zap size={20} />
                    Recarregar Créditos
                </Button>
            </div>

            {/* CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1: Saldo Atual */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-[80px] -z-10" />

                    <h3 className="text-amber-300 font-black uppercase tracking-[0.2em] text-[10px] mb-6 flex items-center gap-3">
                        <Coins size={16} /> Saldo Disponível
                    </h3>

                    <div className="text-center mb-6">
                        <div className="text-7xl font-black text-white mb-2 tabular-nums">
                            {remaining}
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                            de {monthlyLimit} créditos mensais
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full transition-colors ${
                                progressPercent > 50 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                progressPercent > 20 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                'bg-gradient-to-r from-rose-500 to-rose-400'
                            }`}
                        />
                    </div>

                    <div className="flex justify-between mt-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {progressPercent}% disponível
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            remaining <= 2 ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                            {remaining <= 2 ? '⚠️ Baixo' : '✅ OK'}
                        </span>
                    </div>
                </motion.div>

                {/* Card 2: Total Usado */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[80px] -z-10" />

                    <h3 className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px] mb-6 flex items-center gap-3">
                        <BarChart3 size={16} /> Total Consumido
                    </h3>

                    <div className="text-center mb-6">
                        <div className="text-7xl font-black text-white mb-2 tabular-nums">
                            {totalUsed}
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                            gerações desde o início
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-white/[0.03] rounded-2xl p-4 text-center border border-white/5">
                            <div className="text-xl font-black text-white">{transactions.filter(t => t.type === 'consumption').length}</div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Este Período</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-2xl p-4 text-center border border-white/5">
                            <div className="text-xl font-black text-white">{monthlyLimit - remaining}</div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Usados Agora</p>
                        </div>
                    </div>
                </motion.div>

                {/* Card 3: Plano */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-indigo-600/10 to-violet-600/10 border border-indigo-500/20 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 blur-[80px] -z-10" />

                    <h3 className="text-violet-300 font-black uppercase tracking-[0.2em] text-[10px] mb-6 flex items-center gap-3">
                        <Crown size={16} /> Seu Plano
                    </h3>

                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-3 bg-white/[0.05] px-6 py-3 rounded-2xl border border-white/10 mb-4">
                            <Sparkles size={20} className="text-indigo-400" />
                            <span className="text-xl font-black text-white uppercase tracking-widest">
                                {monthlyLimit >= 999 ? 'Premium' : monthlyLimit >= 50 ? 'Professional' : 'Free'}
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                            {monthlyLimit >= 999 ? 'Créditos ilimitados' : `${monthlyLimit} créditos/mês`}
                        </p>
                    </div>

                    <div className="space-y-3 mt-4">
                        {[
                            { plan: 'Free', limit: '5 créditos/mês', active: monthlyLimit <= 5 },
                            { plan: 'Professional', limit: '50 créditos/mês', active: monthlyLimit === 50 },
                            { plan: 'Premium', limit: 'Ilimitado', active: monthlyLimit >= 999 }
                        ].map(p => (
                            <div key={p.plan} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                                p.active
                                    ? 'bg-indigo-600/20 border-indigo-500/40'
                                    : 'bg-white/[0.02] border-white/5 opacity-50'
                            }`}>
                                <span className="text-xs font-black uppercase tracking-widest text-white">{p.plan}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{p.limit}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* HISTÓRICO DE TRANSAÇÕES */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-3">
                        <Clock size={16} className="text-indigo-400" /> Histórico de Transações
                    </h3>
                    <Button
                        onClick={() => refresh()}
                        variant="ghost"
                        className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest gap-2"
                    >
                        <RefreshCw size={14} /> Atualizar
                    </Button>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-16">
                        <Coins size={48} className="mx-auto mb-4 text-slate-700" />
                        <p className="text-slate-500 font-bold">Nenhuma transação registrada ainda.</p>
                        <p className="text-slate-600 text-sm mt-2">Seus créditos aparecerão aqui quando você usar a IA.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {transactions.map((tx, idx) => {
                                const typeInfo = TYPE_LABELS[tx.type] || TYPE_LABELS.consumption
                                const Icon = typeInfo.icon
                                const isNegative = tx.amount < 0

                                return (
                                    <motion.div
                                        key={tx.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="flex items-center gap-5 px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group"
                                    >
                                        <div className={`p-2.5 rounded-xl ${
                                            isNegative ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
                                        }`}>
                                            <Icon size={18} className={typeInfo.color} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-white">{typeInfo.label}</span>
                                                {tx.generation_type && (
                                                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">
                                                        {GENERATION_LABELS[tx.generation_type] || tx.generation_type}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate font-medium">
                                                {tx.description || 'Sem descrição'}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <div className={`text-lg font-black tabular-nums ${
                                                isNegative ? 'text-rose-400' : 'text-emerald-400'
                                            }`}>
                                                {isNegative ? '' : '+'}{tx.amount}
                                            </div>
                                            <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                                                Saldo: {tx.balance_after}
                                            </div>
                                        </div>

                                        <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-right min-w-[80px]">
                                            {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            <br />
                                            {new Date(tx.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* MODAL RECARGA */}
            <AnimatePresence>
                {showRefillModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900/95 backdrop-blur-2xl max-w-lg w-full p-10 rounded-[2.5rem] border border-white/10 shadow-2xl"
                        >
                            <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                                <Zap className="text-amber-400" size={28} />
                                Recarregar Créditos
                            </h2>
                            {refillError && (
                                <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs font-bold text-rose-300">
                                    {refillError}
                                </div>
                            )}
                            <p className="text-slate-400 mb-8 font-medium">
                                Adicione créditos extras ao seu saldo para continuar gerando conteúdo com IA.
                            </p>

                            <div className="space-y-4 mb-8">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block ml-1">
                                    Quantidade de Créditos
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[5, 10, 25].map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setRefillAmount(amount)}
                                            className={`p-5 rounded-2xl border transition-all text-center ${
                                                refillAmount === amount
                                                    ? 'bg-amber-600/20 border-amber-500/50 shadow-lg'
                                                    : 'bg-white/[0.03] border-white/10 hover:border-amber-500/30'
                                            }`}
                                        >
                                            <div className="text-3xl font-black text-white">{amount}</div>
                                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">créditos</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowRefillModal(false)}
                                    className="flex-1 h-14 text-slate-400 font-bold rounded-2xl"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleRefill}
                                    disabled={isRefilling}
                                    className="flex-1 h-14 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl gap-2"
                                >
                                    {isRefilling ? (
                                        <><Loader2 className="animate-spin" size={18} /> Processando...</>
                                    ) : (
                                        <><Zap size={18} /> Adicionar {refillAmount} Créditos</>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
