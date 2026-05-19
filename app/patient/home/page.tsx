"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
    Flame,
    Droplet,
    CheckCircle2,
    Circle,
    Sparkles,
    TrendingUp,
    Award,
    Clock,
    Loader2,
    Bell,
    CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePatientEngine } from "@/lib/hooks/usePatientEngine"
import Link from "next/link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"
import { ReminderSettings } from "@/components/patient/ReminderSettings"

export default function PatientHomePage() {
    const router = useRouter()
    const {
        loading,
        activeProtocol,
        currentDayItems,
        progress,
        stats,
        toggleCheckin
    } = usePatientEngine()
    const [unreadCount, setUnreadCount] = useState(0)
    const [firstName, setFirstName] = useState("Rainha")
    const [showReminders, setShowReminders] = useState(false)
    const [isNewMember, setIsNewMember] = useState(false)
    const [showWelcomeTour, setShowWelcomeTour] = useState(false)

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Load profile name + check if new member
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, created_at')
                .eq('user_id', session.user.id)
                .single()

            if (profile?.name) {
                setFirstName(profile.name.split(' ')[0])
            }
            // Show welcome tour for accounts created in last 48h
            if (profile?.created_at) {
                const createdAt = new Date(profile.created_at)
                const hoursOld = (Date.now() - createdAt.getTime()) / 3_600_000
                if (hoursOld < 48) {
                    setIsNewMember(true)
                    const tourDone = localStorage.getItem(`welcome_tour_${session.user.id}`)
                    if (!tourDone) setShowWelcomeTour(true)
                }
            }

            // Load unread count
            const { count } = await supabase
                .from('inbox_messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .eq('status', 'unread')
            setUnreadCount(count || 0)
        }
        init()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="text-indigo-500 animate-spin" size={32} />
            </div>
        )
    }

    const completedCount = currentDayItems.filter(item => progress[item.id]).length
    const progressPercentage = stats.completionRate

    return (
        <>
        <AnimatePresence>
          {showReminders && <ReminderSettings onClose={() => setShowReminders(false)} />}
          {showWelcomeTour && (
            <motion.div
              key="welcome-tour"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-end justify-center p-4"
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                className="w-full max-w-[430px] bg-slate-900 border border-white/10 rounded-3xl p-6 mb-4 space-y-5"
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <h2 className="text-xl font-bold text-white">Bem-vinda ao Clube, {firstName}!</h2>
                  <p className="text-slate-400 text-sm mt-1">Aqui está tudo que você pode acessar</p>
                </div>
                <div className="space-y-3">
                  {[
                    { emoji: '🍽️', title: 'Cardápio personalizado', desc: 'Veja seu plano alimentar na aba Dieta', href: '/patient/diet' },
                    { emoji: '🏆', title: 'Missões e Desafios', desc: 'Complete missões diárias e ganhe XP', href: null },
                    { emoji: '💧', title: 'Lembretes inteligentes', desc: 'Configure alertas de água e refeições', href: null },
                    { emoji: '💬', title: 'Chat com IA nutricionista', desc: 'Tire dúvidas a qualquer hora', href: null },
                    { emoji: '🌟', title: 'Comunidade e Ranking', desc: 'Conecte-se com outras mulheres', href: '/patient/feed' },
                    { emoji: '🛍️', title: 'Próximos passos', desc: 'Consulta, Método 90d e Teste Genético', href: '/patient/gateway' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">{item.title}</p>
                        <p className="text-slate-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                      if (session) localStorage.setItem(`welcome_tour_${session.user.id}`, '1')
                    })
                    setShowWelcomeTour(false)
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all"
                >
                  Começar minha jornada 🚀
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="min-h-screen px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{firstName}</span>! 👋
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {activeProtocol ? `Dia ${stats.currentDay} de ${stats.totalDays}` : "Sua jornada de hoje"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/patient/inbox" className="relative group">
                            <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                <Bell className="text-slate-300 group-hover:text-white" size={20} />
                            </div>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-indigo-600 border-2 border-[#020617] rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full h-11">
                            <Flame className="text-orange-400" size={18} />
                            <span className="font-bold text-white">{stats.currentStreak} dias</span>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-yellow-400" size={16} />
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">XP Total</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.totalPoints}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="text-green-400" size={16} />
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Progresso</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{progressPercentage}%</p>
                    </div>
                </div>
            </div>

            {/* Daily Progress Ring */}
            <div className="mb-8">
                <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white mb-1">Missões de Hoje</h2>
                            <p className="text-xs text-slate-400">{completedCount} de {currentDayItems.length} completas</p>
                        </div>
                        <div className="relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                                <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="6"
                                    fill="none"
                                />
                                <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="url(#gradient)"
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 28}`}
                                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                {completedCount}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                </div>
            </div>

            {/* Daily Items List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Missões de Hoje</h3>
                    <button className="text-xs text-indigo-400 font-bold">Ver Histórico</button>
                </div>

                {!activeProtocol ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center p-8 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-3xl border border-purple-500/20"
                    >
                        <div className="h-16 w-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="text-purple-400" size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Protocolo a caminho! 🚀</h3>
                        <p className="text-sm text-slate-400 mb-4 max-w-xs mx-auto">
                            Sua nutricionista está preparando um plano personalizado para você. Em breve ele aparecerá aqui!
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-purple-400">
                            <Loader2 size={14} className="animate-spin" />
                            Aguardando protocolo...
                        </div>
                    </motion.div>
                ) : currentDayItems.length === 0 ? (
                    <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-slate-400">Dia livre! 🎉</p>
                        <p className="text-xs text-slate-500 mt-2">Aproveite o descanso</p>
                    </div>
                ) : (
                    currentDayItems.map((item, index) => {
                        const isCompleted = progress[item.id]
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => toggleCheckin(item.id, isCompleted)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isCompleted
                                    ? "bg-indigo-600/10 border-indigo-500/30"
                                    : "bg-white/5 border-white/10 hover:border-white/20"
                                    }`}
                            >
                                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isCompleted ? "bg-indigo-600/20" : "bg-white/5"
                                    }`}>
                                    <Clock size={20} className={isCompleted ? "text-indigo-400" : "text-slate-400"} />
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.time && (
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                                {item.time}
                                            </span>
                                        )}
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.type === 'shot'
                                            ? 'bg-orange-500/20 text-orange-400'
                                            : 'bg-green-500/20 text-green-400'
                                            }`}>
                                            {item.type === 'shot' ? 'SHOT' : item.type?.toUpperCase() || 'MISSÃO'}
                                        </span>
                                    </div>
                                    <h4 className={`font-bold text-sm ${isCompleted ? "text-white line-through" : "text-white"}`}>
                                        {item.title}
                                    </h4>
                                    {item.description && (
                                        <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-0.5">+{item.points || 10} XP</p>
                                </div>

                                {isCompleted ? (
                                    <CheckCircle2 className="text-indigo-400 flex-shrink-0" size={24} />
                                ) : (
                                    <Circle className="text-slate-600 flex-shrink-0" size={24} />
                                )}
                            </motion.div>
                        )
                    })
                )}
            </div>

            {/* Current Protocol Card */}
            {activeProtocol && (
                <div className="mt-8 bg-gradient-to-br from-purple-600/10 to-pink-600/10 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                            <Award className="text-purple-400" size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-purple-400 tracking-wider">Protocolo Ativo</p>
                            <h3 className="font-bold text-white">{activeProtocol.title}</h3>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-white/5 rounded-xl">
                        <p className="text-xs text-slate-400">{activeProtocol.description || "Seu plano nutricional personalizado"}</p>
                    </div>
                    <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-none mt-4">
                        Ver Todos os Dias →
                    </Button>
                </div>
            )}
        </div>
        </>
    )
}
