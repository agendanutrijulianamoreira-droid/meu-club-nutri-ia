"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    User,
    Mail,
    Calendar,
    Award,
    TrendingUp,
    Target,
    LogOut,
    ChevronRight,
    Scale,
    Activity
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

export default function PatientProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUser(user)

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                setProfile(profileData)
            }
        }
        loadProfile()
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const stats = [
        { label: "Dias no Clube", value: "28", icon: Calendar, color: "indigo", bg: "bg-indigo-600/20", text: "text-indigo-400" },
        { label: "XP Total", value: profile?.total_xp || "0", icon: Award, color: "purple", bg: "bg-purple-600/20", text: "text-purple-400" },
        { label: "Sequência Atual", value: profile?.current_streak || "0", icon: Activity, color: "orange", bg: "bg-orange-600/20", text: "text-orange-400" },
        { label: "Conquistas", value: "12", icon: Target, color: "green", bg: "bg-green-600/20", text: "text-green-400" },
    ]

    const achievements = [
        { title: "Primeira Semana", description: "Complete 7 dias consecutivos", unlocked: true },
        { title: "Guerreira da Água", description: "Bebeu 2L por 14 dias", unlocked: true },
        { title: "Rainha da Disciplina", description: "Complete 30 dias sem falhas", unlocked: false },
    ]

    return (
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 mb-4 text-3xl font-bold text-white shadow-lg shadow-indigo-500/30">
                    {profile?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "R"}
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">
                    {profile?.name || "Rainha do Reino"}
                </h1>
                <p className="text-sm text-slate-400">{user?.email}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
                        >
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                                <Icon className={stat.text} size={20} />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{stat.label}</p>
                        </motion.div>
                    )
                })}
            </div>

            {/* Achievements */}
            <div className="mb-6">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Conquistas 🏆</h2>
                <div className="space-y-3">
                    {achievements.map((achievement, index) => (
                        <motion.div
                            key={achievement.title}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-4 p-4 rounded-2xl border ${achievement.unlocked
                                ? "bg-indigo-600/10 border-indigo-500/30"
                                : "bg-white/5 border-white/10 opacity-50"
                                }`}
                        >
                            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${achievement.unlocked ? "bg-indigo-600/20" : "bg-slate-800/50"
                                }`}>
                                <Award className={achievement.unlocked ? "text-indigo-400" : "text-slate-600"} size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-sm text-white mb-1">{achievement.title}</h3>
                                <p className="text-xs text-slate-400">{achievement.description}</p>
                            </div>
                            {achievement.unlocked && (
                                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Account Settings */}
            <div className="space-y-3 mb-6">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Configurações</h2>

                <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                        <User className="text-slate-400" size={20} />
                        <span className="text-sm font-bold text-white">Editar Perfil</span>
                    </div>
                    <ChevronRight className="text-slate-500" size={20} />
                </button>

                <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                        <Scale className="text-slate-400" size={20} />
                        <span className="text-sm font-bold text-white">Meu Progresso</span>
                    </div>
                    <ChevronRight className="text-slate-500" size={20} />
                </button>
            </div>

            {/* Sign Out Button */}
            <Button
                onClick={handleSignOut}
                className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 h-14 rounded-2xl"
            >
                <LogOut size={18} className="mr-2" />
                Sair do Clube
            </Button>

            <p className="text-center text-xs text-slate-600 mt-6">
                Versão 1.0.0 · Meu Club Nutri.AI
            </p>
        </div>
    )
}
