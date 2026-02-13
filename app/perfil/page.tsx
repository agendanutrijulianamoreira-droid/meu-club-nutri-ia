"use client"

import { useState } from "react"
import {
    User,
    Settings,
    Camera,
    Scale,
    Activity,
    ChevronRight,
    Lock,
    LogOut,
    Home,
    Apple,
    Trophy,
    Target,
    Zap,
    History
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"

export default function ProfilePage() {
    const [user] = useState({
        name: "Júlia",
        avatar: "https://api.dicebear.com/9.x/micah/svg?seed=JuliaQueen",
        level: 7,
        xp: 1250,
        weight: 65.2,
        height: 165,
        goal: "Emagrecimento",
        plan: "Reinado Anual • Ativo"
    })

    return (
        <div className="min-h-screen bg-[#0a0a16] text-white pb-36">

            {/* Profile Header */}
            <div className="p-8 pt-16 bg-gradient-to-b from-purple-900/20 to-transparent flex flex-col items-center">
                <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 p-1">
                        <img src={user.avatar} className="w-full h-full rounded-full bg-black" />
                    </div>
                    <button className="absolute bottom-0 right-0 bg-purple-600 p-2 rounded-full border-4 border-[#0a0a16]">
                        <Camera size={14} />
                    </button>
                </div>
                <h1 className="text-2xl font-black italic">{user.name}</h1>
                <p className="text-purple-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">{user.plan}</p>

                <div className="flex gap-4 mt-8 w-full max-w-sm">
                    <div className="flex-1 glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">XP Atual</p>
                        <p className="text-xl font-black text-yellow-500">{user.xp}</p>
                    </div>
                    <div className="flex-1 glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Nível</p>
                        <p className="text-xl font-black text-purple-400">{user.level}</p>
                    </div>
                </div>
            </div>

            {/* Assessment Section */}
            <div className="px-6 space-y-4">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest pl-2 mb-2 flex items-center gap-2">
                    <Activity size={16} /> Meus Dados & Evolução
                </h2>

                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02] flex items-center justify-between group cursor-pointer hover:border-white/20 transition">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-green-400">
                            <Scale size={24} />
                        </div>
                        <div>
                            <p className="font-bold">Pesagens & IMC</p>
                            <p className="text-xs text-gray-500">Último registro: 65.2kg</p>
                        </div>
                    </div>
                    <ChevronRight className="text-gray-600" size={20} />
                </div>

                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02] flex items-center justify-between group cursor-pointer hover:border-white/20 transition">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-pink-400">
                            <Camera size={24} />
                        </div>
                        <div>
                            <p className="font-bold">Diário de Fotos</p>
                            <p className="text-xs text-gray-500">2 fotos enviadas este mês</p>
                        </div>
                    </div>
                    <ChevronRight className="text-gray-600" size={20} />
                </div>

                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02] flex items-center justify-between group cursor-pointer hover:border-white/20 transition opacity-60">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400">
                            <History size={24} />
                        </div>
                        <div>
                            <p className="font-bold flex items-center gap-2">Avaliação de Bioimpedância <Lock size={12} /></p>
                            <p className="text-xs text-gray-500">Fase 2 (Próximo Mês)</p>
                        </div>
                    </div>
                    <ChevronRight className="text-gray-600" size={20} />
                </div>
            </div>

            {/* App Settings */}
            <div className="px-6 mt-10 space-y-4">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest pl-2 mb-2">Conta</h2>

                <div className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center justify-between text-gray-400">
                    <div className="flex items-center gap-3">
                        <Settings size={18} />
                        <span className="text-sm font-medium">Configurações do App</span>
                    </div>
                    <ChevronRight size={16} />
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center justify-between text-red-400">
                    <div className="flex items-center gap-3">
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Sair da Conta</span>
                    </div>
                </div>
            </div>

            {/* Bottom Nav Bar */}
            <div className="fixed bottom-6 left-6 right-6 z-50">
                <div className="glass-panel p-2 rounded-[2rem] border border-white/10 bg-[#131320]/90 backdrop-blur-xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-full text-gray-600">
                        <Home size={22} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-full text-gray-600">
                        <Apple size={22} />
                    </Link>

                    <div className="relative -top-8">
                        <button className="relative bg-gradient-to-tr from-purple-600 to-pink-600 w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-purple-900/50 border-4 border-[#131320]">
                            <Camera className="text-white" size={28} />
                        </button>
                    </div>

                    <Link href="/ranking" className="p-4 rounded-full text-gray-600">
                        <Trophy size={22} />
                    </Link>
                    <Link href="/perfil" className="p-4 rounded-full bg-purple-600/20 text-purple-400">
                        <User size={22} fill="currentColor" />
                    </Link>
                </div>
            </div>

        </div>
    )
}
