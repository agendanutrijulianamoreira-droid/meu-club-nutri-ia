"use client"

import { useState } from "react"
import { Trophy, Crown, Star, Flame, ChevronRight, Home, Apple, User, Camera, MessageCircle } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

export default function RankingPage() {
    const [user] = useState({
        name: "Júlia",
        avatar: "https://api.dicebear.com/9.x/micah/svg?seed=JuliaQueen",
        xp: 1250,
        position: 12
    })

    const topRainhas = [
        { id: 1, name: "Fernanda", xp: 3420, streak: 21, avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Fer", level: 12 },
        { id: 2, name: "Claudia", xp: 2980, streak: 18, avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Clau", level: 10 },
        { id: 3, name: "Renata", xp: 2750, streak: 15, avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Re", level: 9 },
        { id: 4, name: "Ana Paula", xp: 2100, streak: 12, avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Ana", level: 8 },
        { id: 5, name: "Beatriz", xp: 1950, streak: 9, avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Bia", level: 7 },
    ]

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-32">

            {/* Header */}
            <div className="p-8 pt-12 bg-gradient-to-b from-yellow-500/10 to-transparent text-center">
                <Trophy className="mx-auto text-yellow-500 mb-4" size={48} />
                <h1 className="text-3xl font-black mb-2">Arena das Rainhas 👑</h1>
                <p className="text-gray-400 text-sm">As pacientes mais engajadas do Reino</p>
            </div>

            {/* Podium */}
            <div className="px-6 flex items-end justify-center gap-2 mb-10 pt-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative">
                        <img src={topRainhas[1].avatar} className="w-16 h-16 rounded-full border-2 border-gray-400" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">2º</div>
                    </div>
                    <p className="text-xs font-bold truncate w-20 text-center">{topRainhas[1].name}</p>
                    <div className="w-full bg-gray-400/20 h-20 rounded-t-xl" />
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center gap-2 flex-1 -mt-8">
                    <Crown size={24} className="text-yellow-500 animate-bounce" />
                    <div className="relative">
                        <img src={topRainhas[0].avatar} className="w-20 h-20 rounded-full border-4 border-yellow-500 p-1" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full">1º</div>
                    </div>
                    <p className="text-sm font-black truncate w-24 text-center">{topRainhas[0].name}</p>
                    <div className="w-full bg-yellow-500/20 h-28 rounded-t-xl" />
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="relative">
                        <img src={topRainhas[2].avatar} className="w-14 h-14 rounded-full border-2 border-orange-700" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">3º</div>
                    </div>
                    <p className="text-xs font-bold truncate w-20 text-center">{topRainhas[2].name}</p>
                    <div className="w-full bg-orange-700/20 h-16 rounded-t-xl" />
                </div>
            </div>

            {/* List */}
            <div className="px-6 space-y-3">
                {topRainhas.slice(3).map((rainha, i) => (
                    <div key={rainha.id} className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 font-black text-sm w-4">{i + 4}</span>
                            <img src={rainha.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                            <div>
                                <p className="font-bold text-sm">{rainha.name}</p>
                                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Flame size={10} className="text-orange-500" /> {rainha.streak} dias de fogo
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-yellow-500">{rainha.xp} XP</p>
                            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Nível {rainha.level}</p>
                        </div>
                    </div>
                ))}

                {/* My Position */}
                <div className="mt-8 pt-4 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] mb-3 text-center">Sua Posição</p>
                    <div className="bg-white/[0.03] p-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-between shadow-lg shadow-indigo-900/20">
                        <div className="flex items-center gap-4">
                            <span className="text-indigo-400 font-black text-lg w-6">{user.position}º</span>
                            <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-indigo-500" />
                            <div>
                                <p className="font-black text-white italic">Você (Rainha {user.name})</p>
                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Faltam 120 XP para subir</p>
                            </div>
                        </div>
                        <ChevronRight className="text-indigo-400" />
                    </div>
                </div>
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-6 left-6 right-6 z-50">
                <div className="bg-white/[0.03] p-2 rounded-[2rem] border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-full text-gray-600">
                        <Home size={22} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-full text-gray-600">
                        <Apple size={22} />
                    </Link>

                    <div className="relative -top-8">
                        <button className="relative bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-indigo-900/50 border-4 border-slate-950">
                            <Camera className="text-white" size={28} />
                        </button>
                    </div>

                    <Link href="/ranking" className="p-4 rounded-full bg-indigo-600/20 text-indigo-400">
                        <Trophy size={22} fill="currentColor" />
                    </Link>
                    <Link href="/perfil" className="p-4 rounded-full text-gray-600">
                        <User size={22} />
                    </Link>
                </div>
            </div>

        </div>
    )
}
