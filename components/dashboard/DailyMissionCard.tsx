"use client"

import { useState } from "react"
import { Camera, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

interface DailyMissionCardProps {
    title: string
    description: string
    points: number
    status: "pending" | "completed"
}

export function DailyMissionCard({ title, description, points, status }: DailyMissionCardProps) {
    const [isCompleted, setIsCompleted] = useState(status === "completed")

    const handleComplete = () => {
        setIsCompleted(true)
        // Aqui você conectaria com o backend
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white/5 p-6 rounded-3xl border border-white/10 overflow-hidden"
        >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-emerald-500/5 opacity-50" />

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                        <p className="text-sm text-gray-300">{description}</p>
                    </div>
                    <div className="bg-yellow-500/20 text-yellow-500 rounded-full px-3 py-1 text-sm font-bold flex items-center gap-1">
                        <Sparkles size={14} />
                        {points} XP
                    </div>
                </div>

                {!isCompleted ? (
                    <Button
                        onClick={handleComplete}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 border-0 font-bold text-lg shadow-lg shadow-indigo-900/40"
                    >
                        <Camera size={20} className="mr-2" />
                        Enviar Evidência
                    </Button>
                ) : (
                    <div className="w-full h-14 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center gap-2 text-green-400 font-bold">
                        <Check size={20} />
                        Missão Concluída!
                    </div>
                )}
            </div>

            {/* Completion Confetti Effect */}
            {isCompleted && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    className="absolute top-4 right-4 text-4xl"
                >
                    🎉
                </motion.div>
            )}
        </motion.div>
    )
}
