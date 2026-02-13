"use client"

import { motion } from "framer-motion"
import { Crown, Trophy, TrendingUp, Medal, Flame } from "lucide-react"

export default function PatientRankingPage() {
    // Mock data (será conectado ao Supabase depois)
    const currentUser = {
        rank: 3,
        name: "Você",
        points: 850,
        streak: 7,
        isCurrentUser: true
    }

    const leaderboard = [
        { rank: 1, name: "Marina Silva", points: 1250, streak: 14, avatar: "M" },
        { rank: 2, name: "Julia Santos", points: 1100, streak: 12, avatar: "J" },
        { rank: 3, name: "Você", points: 850, streak: 7, avatar: "V", isCurrentUser: true },
        { rank: 4, name: "Ana Costa", points: 720, streak: 8, avatar: "A" },
        { rank: 5, name: "Carolina Lima", points: 680, streak: 5, avatar: "C" },
        { rank: 6, name: "Beatriz Alves", points: 550, streak: 4, avatar: "B" },
        { rank: 7, name: "Laura Rocha", points: 420, streak: 3, avatar: "L" },
    ]

    const getRankColor = (rank: number) => {
        if (rank === 1) return "from-yellow-500 to-orange-500"
        if (rank === 2) return "from-slate-300 to-slate-400"
        if (rank === 3) return "from-orange-600 to-orange-700"
        return "from-indigo-600 to-purple-600"
    }

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="text-yellow-400" size={20} />
        if (rank === 2) return <Medal className="text-slate-300" size={20} />
        if (rank === 3) return <Medal className="text-orange-600" size={20} />
        return <Trophy className="text-indigo-400" size={16} />
    }

    return (
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Trophy className="text-indigo-400" size={24} />
                    <h1 className="text-2xl font-bold text-white">Ranking do Reino</h1>
                </div>
                <p className="text-slate-400 text-sm">
                    Veja sua posição e conquiste o topo!
                </p>
            </div>

            {/* Your Stats Card */}
            <div className="mb-6 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider mb-1">Sua Posição</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(currentUser.rank)} flex items-center justify-center`}>
                                {getRankIcon(currentUser.rank)}
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-white">#{currentUser.rank}</p>
                                <p className="text-xs text-slate-400">de {leaderboard.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-2">
                            <TrendingUp className="text-green-400" size={16} />
                            <span className="text-sm font-bold text-green-400">+120 XP</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                            <Flame className="text-orange-400" size={16} />
                            <span className="text-sm font-bold text-white">{currentUser.streak} dias</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">Total de XP</p>
                        <p className="text-xl font-bold text-white">{currentUser.points}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">Próximo Nível</p>
                        <p className="text-xl font-bold text-white">150 XP</p>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Top Rainhas 👑</h2>

                {leaderboard.map((player, index) => {
                    const isTop3 = player.rank <= 3

                    return (
                        <motion.div
                            key={player.rank}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${player.isCurrentUser
                                    ? "bg-indigo-600/10 border-indigo-500/30 ring-2 ring-indigo-500/20"
                                    : "bg-white/5 border-white/10"
                                }`}
                        >
                            {/* Rank Badge */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isTop3
                                    ? `bg-gradient-to-br ${getRankColor(player.rank)}`
                                    : "bg-slate-800/50"
                                }`}>
                                {isTop3 ? (
                                    getRankIcon(player.rank)
                                ) : (
                                    <span className="text-sm font-bold text-slate-400">#{player.rank}</span>
                                )}
                            </div>

                            {/* Player Info */}
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${player.isCurrentUser ? "text-indigo-300" : "text-white"}`}>
                                    {player.name}
                                    {player.isCurrentUser && (
                                        <span className="ml-2 text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">VOCÊ</span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1">
                                        <TrendingUp className="text-slate-500" size={12} />
                                        <span className="text-xs text-slate-400">{player.points} XP</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Flame className="text-orange-400" size={12} />
                                        <span className="text-xs text-slate-400">{player.streak}d</span>
                                    </div>
                                </div>
                            </div>

                            {/* Points Display */}
                            <div className="text-right">
                                <p className="text-lg font-bold text-white">{player.points}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500">pontos</p>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Achievement Hint */}
            <div className="mt-8 p-4 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-2xl">
                <p className="text-xs text-center text-slate-400">
                    💡 <span className="font-bold text-purple-400">Dica:</span> Complete suas missões diárias para ganhar mais XP e subir no ranking!
                </p>
            </div>
        </div>
    )
}
