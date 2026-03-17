"use client"

import { useState, useEffect, useCallback } from "react"
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
    Activity,
    EyeOff,
    Heart,
    Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

export default function PatientProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [toast, setToast] = useState<string | null>(null)

    // Cycle tracking state
    const [cycleEnabled, setCycleEnabled] = useState(false)
    const [lastPeriodStart, setLastPeriodStart] = useState("")
    const [cycleLength, setCycleLength] = useState(28)
    const [calculatedPhase, setCalculatedPhase] = useState<string | null>(null)
    const [calculatedDay, setCalculatedDay] = useState<number | null>(null)

    // Discretion mode state
    const [discretionMode, setDiscretionMode] = useState(false)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const calculatePhase = useCallback((periodStart: string, length: number) => {
        if (!periodStart) {
            setCalculatedPhase(null)
            setCalculatedDay(null)
            return
        }
        const lastPeriod = new Date(periodStart)
        const today = new Date()
        const diffDays = Math.floor((today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24))
        const currentDay = (diffDays % length) + 1

        let phase = 'menstrual'
        if (currentDay <= 5) phase = 'menstrual'
        else if (currentDay <= 13) phase = 'follicular'
        else if (currentDay <= 16) phase = 'ovulatory'
        else phase = 'luteal'

        setCalculatedPhase(phase)
        setCalculatedDay(currentDay)
    }, [])

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

                if (profileData) {
                    setCycleEnabled(profileData.cycle_tracking_enabled || false)
                    setLastPeriodStart(profileData.last_period_start || "")
                    setCycleLength(profileData.cycle_length || 28)
                    setDiscretionMode(profileData.discretion_mode || false)

                    if (profileData.cycle_tracking_enabled && profileData.last_period_start) {
                        calculatePhase(profileData.last_period_start, profileData.cycle_length || 28)
                    }
                }
            }
        }
        loadProfile()
    }, [calculatePhase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const saveCycleSettings = async () => {
        if (!user) return

        const updates: any = {
            cycle_tracking_enabled: cycleEnabled,
            cycle_length: cycleLength,
        }

        if (lastPeriodStart) {
            updates.last_period_start = lastPeriodStart
        }

        if (cycleEnabled && lastPeriodStart) {
            calculatePhase(lastPeriodStart, cycleLength)

            // Also store phase and day in DB
            const lastPeriod = new Date(lastPeriodStart)
            const today = new Date()
            const diffDays = Math.floor((today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24))
            const currentDay = (diffDays % cycleLength) + 1

            let phase = 'menstrual'
            if (currentDay <= 5) phase = 'menstrual'
            else if (currentDay <= 13) phase = 'follicular'
            else if (currentDay <= 16) phase = 'ovulatory'
            else phase = 'luteal'

            updates.cycle_phase = phase
            updates.cycle_day = currentDay
        } else {
            updates.cycle_phase = null
            updates.cycle_day = null
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('user_id', user.id)

        if (error) {
            showToast("Erro ao salvar. Tente novamente.")
        } else {
            showToast("Ciclo atualizado com sucesso!")
        }
    }

    const toggleDiscretionMode = async () => {
        if (!user) return
        const newValue = !discretionMode
        setDiscretionMode(newValue)

        const { error } = await supabase
            .from('profiles')
            .update({ discretion_mode: newValue })
            .eq('user_id', user.id)

        if (error) {
            setDiscretionMode(!newValue) // revert
            showToast("Erro ao salvar. Tente novamente.")
        } else {
            showToast(newValue ? "Modo discreto ativado" : "Modo discreto desativado")
            // Reload page to apply layout changes
            if (newValue) {
                document.title = 'My Wellness'
            } else {
                document.title = 'Meu Club Nutri'
            }
        }
    }

    const PHASE_LABELS: Record<string, { emoji: string; label: string }> = {
        menstrual: { emoji: "\uD83D\uDD34", label: "Menstrual" },
        follicular: { emoji: "\uD83C\uDF31", label: "Folicular" },
        ovulatory: { emoji: "\uD83C\uDF38", label: "Ovulat\u00f3ria" },
        luteal: { emoji: "\uD83C\uDF42", label: "L\u00fatea" },
    }

    const stats = [
        { label: "Dias no Clube", value: "28", icon: Calendar, color: "indigo", bg: "bg-indigo-600/20", text: "text-indigo-400" },
        { label: "XP Total", value: profile?.total_xp || "0", icon: Award, color: "purple", bg: "bg-purple-600/20", text: "text-purple-400" },
        { label: "Sequ\u00eancia Atual", value: profile?.current_streak || "0", icon: Activity, color: "orange", bg: "bg-orange-600/20", text: "text-orange-400" },
        { label: "Conquistas", value: "12", icon: Target, color: "green", bg: "bg-green-600/20", text: "text-green-400" },
    ]

    const achievements = [
        { title: "Primeira Semana", description: "Complete 7 dias consecutivos", unlocked: true },
        { title: "Guerreira da \u00c1gua", description: "Bebeu 2L por 14 dias", unlocked: true },
        { title: "Rainha da Disciplina", description: "Complete 30 dias sem falhas", unlocked: false },
    ]

    return (
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Toast */}
            {toast && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-4 left-4 right-4 z-50 bg-indigo-600/90 backdrop-blur-xl text-white text-sm font-bold px-4 py-3 rounded-2xl text-center shadow-lg"
                >
                    <div className="flex items-center justify-center gap-2">
                        <Check size={16} />
                        {toast}
                    </div>
                </motion.div>
            )}

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
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Conquistas</h2>
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

            {/* Menstrual Cycle Section */}
            <div className="mb-6">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Ciclo Menstrual</h2>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Heart className="text-pink-400" size={20} />
                            <div>
                                <p className="text-sm font-bold text-white">Rastreamento de Ciclo</p>
                                <p className="text-xs text-slate-500">Adapta recomenda\u00e7\u00f5es ao seu ciclo</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setCycleEnabled(!cycleEnabled)}
                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${cycleEnabled ? 'bg-pink-500' : 'bg-slate-700'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${cycleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {cycleEnabled && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4 pt-2 border-t border-white/10"
                        >
                            {/* Last period date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">
                                    In\u00edcio da \u00faltima menstrua\u00e7\u00e3o
                                </label>
                                <input
                                    type="date"
                                    value={lastPeriodStart}
                                    onChange={(e) => {
                                        setLastPeriodStart(e.target.value)
                                        calculatePhase(e.target.value, cycleLength)
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/50 transition-colors [color-scheme:dark]"
                                />
                            </div>

                            {/* Cycle length */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">
                                    Dura\u00e7\u00e3o do ciclo (dias)
                                </label>
                                <input
                                    type="number"
                                    min={21}
                                    max={40}
                                    value={cycleLength}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 28
                                        setCycleLength(val)
                                        calculatePhase(lastPeriodStart, val)
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/50 transition-colors"
                                />
                            </div>

                            {/* Calculated phase preview */}
                            {calculatedPhase && calculatedDay && (
                                <div className="bg-pink-600/10 border border-pink-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{PHASE_LABELS[calculatedPhase]?.emoji}</span>
                                        <span className="text-sm font-bold text-white">Fase {PHASE_LABELS[calculatedPhase]?.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-400">Dia {calculatedDay} de {cycleLength}</p>
                                </div>
                            )}

                            {/* Save button */}
                            <Button
                                onClick={saveCycleSettings}
                                className="w-full bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/20 rounded-xl"
                            >
                                Salvar Configura\u00e7\u00f5es do Ciclo
                            </Button>
                        </motion.div>
                    )}

                    {!cycleEnabled && (
                        <Button
                            onClick={saveCycleSettings}
                            variant="ghost"
                            className="w-full text-slate-500 text-xs"
                        >
                            Salvar
                        </Button>
                    )}
                </div>
            </div>

            {/* Discretion Mode Section */}
            <div className="mb-6">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Privacidade</h2>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <EyeOff className="text-slate-400" size={20} />
                            <div>
                                <p className="text-sm font-bold text-white">Modo Discreto</p>
                                <p className="text-xs text-slate-500">Oculta nome do clube e usa \u00edcones gen\u00e9ricos</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleDiscretionMode}
                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${discretionMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${discretionMode ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Account Settings */}
            <div className="space-y-3 mb-6">
                <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Configura\u00e7\u00f5es</h2>

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
                Vers\u00e3o 1.0.0 \u00b7 Meu Club Nutri.AI
            </p>
        </div>
    )
}
