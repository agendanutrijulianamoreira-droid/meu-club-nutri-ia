"use client"

import { Flame, Trophy, Target } from "lucide-react"

export function UserHeaderStats() {
    // Mock data - depois conectar com Supabase
    const stats = {
        streak: 12,
        points: 1450,
        level: 5
    }

    return (
        <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <div className="grid grid-cols-3 gap-4">
                {/* Streak */}
                <div className="text-center">
                    <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-2 shadow-lg">
                        <Flame size={24} className="text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.streak}</p>
                    <p className="text-xs text-gray-400">dias seguidos</p>
                </div>

                {/* Points */}
                <div className="text-center border-x border-white/10">
                    <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mb-2 shadow-lg">
                        <Trophy size={24} className="text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.points}</p>
                    <p className="text-xs text-gray-400">XP total</p>
                </div>

                {/* Level */}
                <div className="text-center">
                    <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-queen-pink to-purple-600 flex items-center justify-center mb-2 shadow-lg">
                        <Target size={24} className="text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">Nv {stats.level}</p>
                    <p className="text-xs text-gray-400">rainha</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>Nível {stats.level}</span>
                    <span>Nível {stats.level + 1}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-queen-pink to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: '67%' }}
                    />
                </div>
                <p className="text-xs text-center text-gray-500 mt-2">Faltam 350 XP para subir de nível</p>
            </div>
        </div>
    )
}
