import { Crown, Trophy, TrendingUp, Medal, Flame, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"

export default function PatientRankingPage() {
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const loadRanking = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) setUserId(user.id)

                const { data, error } = await supabase
                    .from('patient_ranking')
                    .select('*')
                    .order('rank', { ascending: true })
                    .limit(50)

                if (error) throw error
                setLeaderboard(data || [])
            } catch (err) {
                console.error("Erro ao carregar ranking:", err)
            } finally {
                setLoading(false)
            }
        }
        loadRanking()
    }, [])

    const currentUser = leaderboard.find(p => p.user_id === userId) || {
        rank: '-',
        name: "Você",
        total_xp: 0,
        current_streak: 0,
        isCurrentUser: true
    }

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
                                <p className="text-xs text-slate-400">no Reino</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-2">
                            <TrendingUp className="text-green-400" size={16} />
                            <span className="text-sm font-bold text-green-400">Nível {currentUser.current_level || 1}</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                            <Flame className="text-orange-400" size={16} />
                            <span className="text-sm font-bold text-white">{currentUser.current_streak || 0} dias</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">Total de XP</p>
                        <p className="text-xl font-bold text-white">{currentUser.total_xp || 0}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">NutriCoins</p>
                        <p className="text-xl font-bold text-white">{currentUser.nutri_coins || 0} 🪙</p>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Top Rainhas 👑</h2>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                        <p className="text-slate-500 text-sm">Carregando Reino...</p>
                    </div>
                ) : (
                    leaderboard.map((player, index) => {
                        const isTop3 = player.rank <= 3
                        const isMe = player.user_id === userId

                        return (
                            <motion.div
                                key={player.user_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isMe
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
                                    <h3 className={`font-bold text-sm ${isMe ? "text-indigo-300" : "text-white"}`}>
                                        {player.name}
                                        {isMe && (
                                            <span className="ml-2 text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">VOCÊ</span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="text-slate-500" size={12} />
                                            <span className="text-xs text-slate-400">Nível {player.current_level}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Flame className="text-orange-400" size={12} />
                                            <span className="text-xs text-slate-400">{player.current_streak}d</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Points Display */}
                                <div className="text-right">
                                    <p className="text-lg font-bold text-white">{player.total_xp}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-500">XP</p>
                                </div>
                            </motion.div>
                        )
                    })
                )}
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
