"use client"

import { useState, useEffect } from "react"
import {
    Gift,
    Star,
    ArrowLeft,
    ShoppingBag,
    CheckCircle2,
    Lock,
    Sparkles,
    Coins
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"

export default function RewardsPage() {
    const [coins, setCoins] = useState(0)
    const [rewards, setRewards] = useState([
        {
            id: '1',
            name: "E-book: Receitas Detox 7 Dias",
            description: "Um guia completo com as melhores receitas para limpar o organismo.",
            emoji: "📚",
            cost: 500,
            stock: -1,
            isLocked: false
        },
        {
            id: '2',
            name: "Consulta Individual (Glow Up)",
            description: "Sessão de 30min focada em ajustes finos do seu protocolo.",
            emoji: "👩‍⚕️",
            cost: 2500,
            stock: 5,
            isLocked: true
        },
        {
            id: '3',
            name: "Kit Suplementação VIP",
            description: "Receba em casa um kit exclusivo de colágeno + shot matinal.",
            emoji: "📦",
            cost: 5000,
            stock: 2,
            isLocked: true
        }
    ])

    const [loading, setLoading] = useState(true)
    const [selectedReward, setSelectedReward] = useState<any>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    useEffect(() => {
        async function fetchProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('nutri_coins')
                    .eq('user_id', user.id)
                    .single()
                
                if (profile) setCoins(profile.nutri_coins || 0)
            }
            setLoading(false)
        }
        fetchProfile()
    }, [supabase])

    const handleRedeem = (reward: any) => {
        if (coins < reward.cost) return
        setSelectedReward(reward)
    }

    const confirmRedeem = () => {
        // Lógica de resgate (Backend)
        setCoins(prev => prev - selectedReward.cost)
        setIsSuccess(true)
        setTimeout(() => {
            setIsSuccess(false)
            setSelectedReward(null)
        }, 3000)
    }

    return (
        <div className="min-h-screen bg-[#FAF7F2] text-slate-800 pb-32 overflow-x-hidden font-['DM_Sans']">
            {/* --- PREMIUM BRANDING AS PER PROMPT --- */}
            <div className="fixed inset-0 bg-[#FAF7F2] -z-10" />
            <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#D4847A]/10 to-transparent -z-10" />

            {/* Header */}
            <header className="px-6 py-8 flex items-center justify-between">
                <Link href="/" className="h-12 w-12 rounded-2xl bg-white border border-[#D4847A]/20 flex items-center justify-center shadow-sm">
                    <ArrowLeft size={20} className="text-[#D4847A]" />
                </Link>
                <div className="text-right">
                    <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#D4847A]">Loja Real</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Troque seus pontos por mimos</p>
                </div>
            </header>

            <div className="max-w-md mx-auto px-6 space-y-8">
                {/* SALDO DE PONTOS */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br from-[#D4847A] to-[#8BAF8B] shadow-2xl shadow-[#D4847A]/30 text-white"
                >
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
                            <Coins size={32} className="text-white" />
                        </div>
                        <p className="text-sm font-medium opacity-80">Seu Saldo Atual</p>
                        <h2 className="text-5xl font-['Playfair_Display'] font-black">
                            {coins} <span className="text-xl">Coins</span>
                        </h2>
                    </div>
                    {/* Decorative Sparkles */}
                    <Sparkles className="absolute top-4 right-4 opacity-30 text-white" size={40} />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                </motion.div>

                {/* LISTA DE PRÊMIOS */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest pl-2">Prêmios Disponíveis</h3>
                    
                    {rewards.map((reward, i) => (
                        <motion.div
                            key={reward.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`group relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden
                                ${coins >= reward.cost 
                                    ? 'bg-white border-[#D4847A]/10 shadow-lg' 
                                    : 'bg-slate-100 border-transparent opacity-70'
                                }`}
                        >
                            <div className="flex items-start gap-5">
                                <div className="text-4xl h-16 w-16 rounded-2xl bg-[#FAF7F2] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                    {reward.emoji}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{reward.name}</h4>
                                        {reward.stock > 0 && (
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                                                {reward.stock} RESTANTES
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        {reward.description}
                                    </p>
                                    
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Coins size={14} className="text-[#C9A96E]" />
                                            <span className="text-sm font-black text-[#C9A96E]">{reward.cost}</span>
                                        </div>
                                        
                                        <button
                                            onClick={() => handleRedeem(reward)}
                                            disabled={coins < reward.cost}
                                            className={`px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95
                                                ${coins >= reward.cost 
                                                    ? 'bg-[#D4847A] text-white shadow-lg shadow-[#D4847A]/20 hover:bg-[#c3746a]' 
                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            {coins >= reward.cost ? 'RESGATAR' : 'BLOQUEADO'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* MODAL DE CONFIRMAÇÃO */}
            <AnimatePresence>
                {selectedReward && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isSuccess && setSelectedReward(null)}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 text-center shadow-2xl border border-white"
                        >
                            {!isSuccess ? (
                                <>
                                    <div className="text-6xl mb-6">{selectedReward.emoji}</div>
                                    <h3 className="text-2xl font-['Playfair_Display'] font-bold text-slate-800 mb-2">Confirmar Resgate?</h3>
                                    <p className="text-sm text-slate-500 mb-8 px-4">
                                        Você está prestes a gastar <span className="font-bold text-[#D4847A]">{selectedReward.cost} Coins</span> com {selectedReward.name}.
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={confirmRedeem}
                                            className="w-full bg-[#D4847A] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-[#D4847A]/20"
                                        >
                                            SIM, EU QUERO! 🎁
                                        </button>
                                        <button
                                            onClick={() => setSelectedReward(null)}
                                            className="w-full py-4 text-slate-400 font-bold text-xs"
                                        >
                                            AGORA NÃO
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <motion.div 
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="py-12 flex flex-col items-center"
                                >
                                    <div className="h-24 w-24 rounded-full bg-[#8BAF8B]/20 flex items-center justify-center mb-6">
                                        <CheckCircle2 size={48} className="text-[#8BAF8B]" />
                                    </div>
                                    <h3 className="text-2xl font-['Playfair_Display'] font-bold text-slate-800 mb-2">Parabéns, Rainha!</h3>
                                    <p className="text-sm text-slate-500">Seu prêmio estará disponível em breve no seu perfil.</p>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
