"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
    Flame,
    Droplet,
    CheckCircle2,
    Circle,
    Sparkles,
    Award,
    Loader2,
    Bell,
    ClipboardCheck,
    Dumbbell,
    UtensilsCrossed,
    ChevronRight,
} from "lucide-react"
import { usePatientEngine } from "@/lib/hooks/usePatientEngine"
import Link from "next/link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"
import { ReminderSettings } from "@/components/patient/ReminderSettings"

export default function PatientHomePage() {
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
    const [checkinPending, setCheckinPending] = useState(false)
    const [quickTaps, setQuickTaps] = useState<{ water: boolean; meal: boolean; workout: boolean }>({ water: false, meal: false, workout: false })
    const [nextReward, setNextReward] = useState<{ name: string; cost: number; emoji: string } | null>(null)
    const [nutriCoins, setNutriCoins] = useState(0)

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

            // Check if weekly check-in is pending
            const checkinRes = await fetch('/api/patient/weekly-checkin')
            const checkinData = await checkinRes.json().catch(() => ({}))
            setCheckinPending(!checkinData.submitted)

            // Load nutri coins and next reward
            const { data: profileData } = await supabase
                .from('profiles')
                .select('nutri_coins')
                .eq('user_id', session.user.id)
                .single()
            const coins = profileData?.nutri_coins || 0
            setNutriCoins(coins)

            const { data: rewards } = await supabase
                .from('reward_items')
                .select('name, cost, emoji')
                .gt('cost', coins)
                .eq('is_active', true)
                .order('cost', { ascending: true })
                .limit(1)
            if (rewards && rewards.length > 0) setNextReward(rewards[0])
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
              className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-end justify-center p-4 px-4"
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
                    { emoji: '🌟', title: 'Comunidade e Ranking', desc: 'Conecte-se com outras mulheres', href: '/patient/feed' },
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all"
                >
                  Começar minha jornada
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-[430px] mx-auto px-4 pt-6 pb-28">

            {/* ─── SEÇÃO 1: Saudação + Streak ─────────────────────────── */}
            <div className="mb-7">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">
                            {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}
                        </p>
                        <h1 className="text-2xl font-bold text-white leading-tight">{firstName}</h1>
                        {activeProtocol && (
                            <p className="text-slate-500 text-xs mt-0.5">
                                Dia {stats.currentDay} de {stats.totalDays} no protocolo
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowReminders(true)}
                            className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
                        >
                            <Bell className="text-slate-400" size={18} />
                        </button>
                        <Link href="/patient/inbox" className="relative">
                            <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <Sparkles className="text-slate-400" size={18} />
                            </div>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 border border-[#020617] rounded-full flex items-center justify-center text-[9px] font-black text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>

                {/* Streak + XP row */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 rounded-2xl flex-1">
                        <Flame className="text-orange-400 shrink-0" size={18} />
                        <span className="font-black text-white text-lg leading-none">{stats.currentStreak}</span>
                        <span className="text-orange-400/70 text-xs">dias</span>
                        <span className="ml-auto text-[9px] text-slate-600 uppercase font-black tracking-widest">Streak</span>
                    </div>
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5 rounded-2xl flex-1">
                        <Sparkles className="text-yellow-400 shrink-0" size={16} />
                        <span className="font-black text-white text-lg leading-none">{stats.totalPoints}</span>
                        <span className="text-yellow-400/70 text-xs">XP</span>
                        <span className="ml-auto text-[9px] text-slate-600 uppercase font-black tracking-widest">Total</span>
                    </div>
                </div>
            </div>

            {/* ─── CTA: Check-in pendente ───────────────────────────────── */}
            {checkinPending && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href="/patient/checkin">
                        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-600/15 to-teal-600/10 border border-emerald-500/30 rounded-2xl group hover:border-emerald-400/50 transition-all">
                            <div className="w-11 h-11 rounded-xl bg-emerald-600/25 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="text-emerald-300" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-0.5">Missão da Semana</p>
                                <p className="text-white font-bold text-sm">Check-in pendente</p>
                                <p className="text-slate-400 text-xs">Responda em 2 min e ganhe +20 XP</p>
                            </div>
                            <ChevronRight className="text-emerald-400 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── SEÇÃO 2: Protocolo Ativo — Missões do Dia ────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                    {activeProtocol ? 'Meu Dia' : 'Protocolo'}
                </p>

                {!activeProtocol ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-white/5 border border-white/10 rounded-3xl text-center"
                    >
                        <div className="h-12 w-12 rounded-full bg-emerald-600/15 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="text-emerald-400" size={22} />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">Protocolo a caminho!</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            Sua nutricionista está preparando um plano personalizado para você.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 mt-3">
                            <Loader2 size={13} className="animate-spin" />
                            Aguardando protocolo...
                        </div>
                    </motion.div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                        {/* Protocol header */}
                        <div className="px-5 pt-5 pb-4 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                            Ativo
                                        </span>
                                        <span className="text-[10px] text-slate-500">Dia {stats.currentDay}/{stats.totalDays}</span>
                                    </div>
                                    <h2 className="text-base font-bold text-white truncate">{activeProtocol.title}</h2>
                                </div>
                                <div className="relative shrink-0 ml-3">
                                    <svg className="w-12 h-12 -rotate-90">
                                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                                        <circle cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="3.5"
                                            strokeDasharray={`${2 * Math.PI * 20}`}
                                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage / 100)}`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                                        {progressPercentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 0.9, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                        {/* Tasks list */}
                        {currentDayItems.length === 0 ? (
                            <div className="px-5 py-6 text-center">
                                <p className="text-slate-400 text-sm font-bold">Dia livre!</p>
                                <p className="text-xs text-slate-600 mt-1">Aproveite o descanso</p>
                            </div>
                        ) : (
                            <div className="px-4 py-3 space-y-2">
                                {currentDayItems.map((item, index) => {
                                    const isCompleted = progress[item.id]
                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.06 }}
                                            onClick={() => toggleCheckin(item.id, isCompleted)}
                                            className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all ${
                                                isCompleted
                                                    ? 'bg-emerald-500/8 border border-emerald-500/15'
                                                    : 'bg-white/[0.03] border border-white/8 hover:border-white/15'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                                isCompleted ? 'bg-emerald-500 shadow-lg shadow-emerald-500/25' : 'bg-white/5 border border-white/10'
                                            }`}>
                                                {isCompleted
                                                    ? <CheckCircle2 size={16} className="text-white" />
                                                    : <Circle size={16} className="text-slate-600" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-semibold ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
                                                    {item.title}
                                                </h4>
                                                {item.description && (
                                                    <p className="text-xs text-slate-600 mt-0.5 truncate">{item.description}</p>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-black shrink-0 ${isCompleted ? 'text-emerald-500' : 'text-slate-600'}`}>
                                                +{item.points || 10} XP
                                            </span>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        )}
                        {completedCount === currentDayItems.length && currentDayItems.length > 0 && (
                            <div className="px-5 pb-5">
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                                    <Award className="text-emerald-400 shrink-0" size={16} />
                                    <p className="text-emerald-300 text-xs font-bold">Todas as missões concluídas!</p>
                                    <span className="ml-auto text-xs text-emerald-400 font-black">+{currentDayItems.reduce((s, i) => s + (i.points || 10), 0)} XP</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── SEÇÃO 3: Metas Rápidas ───────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Registrar agora</p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { key: 'water', label: '+500ml Água', icon: Droplet, color: 'text-sky-400', bg: 'bg-sky-500/8 border-sky-500/15', activeBg: 'bg-sky-500/20 border-sky-400/35', xp: '+10 XP' },
                        { key: 'meal', label: 'Refeição', icon: UtensilsCrossed, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15', activeBg: 'bg-emerald-500/20 border-emerald-400/35', xp: '+15 XP' },
                        { key: 'workout', label: 'Exercício', icon: Dumbbell, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/15', activeBg: 'bg-amber-500/20 border-amber-400/35', xp: '+20 XP' },
                    ].map(({ key, label, icon: Icon, color, bg, activeBg, xp }) => {
                        const done = quickTaps[key as keyof typeof quickTaps]
                        return (
                            <motion.button
                                key={key}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setQuickTaps(prev => ({ ...prev, [key]: !prev[key as keyof typeof quickTaps] }))}
                                className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all ${done ? activeBg : bg}`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${done ? 'bg-white/10' : 'bg-white/5'}`}>
                                    <Icon size={20} className={color} />
                                </div>
                                <span className="text-white text-[11px] font-bold leading-tight text-center">{label}</span>
                                <span className={`text-[9px] font-black ${done ? color : 'text-slate-600'}`}>
                                    {done ? '✓ feito' : xp}
                                </span>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* ─── Próximo Prêmio ───────────────────────────────────────── */}
            {nextReward && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href="/patient/store">
                        <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-amber-500/25 transition-all group">
                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-xl">
                                {nextReward.emoji || '🎁'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 mb-0.5">Próximo Prêmio</p>
                                <p className="text-white font-bold text-sm truncate">{nextReward.name}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (nutriCoins / nextReward.cost) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                                        {nutriCoins}/{nextReward.cost} 👑
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all flex-shrink-0" size={16} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── SEÇÃO 4: No Clube Agora ──────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No Clube Agora</p>
                    <Link href="/patient/feed" className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition">
                        Ver tudo →
                    </Link>
                </div>
                <Link href="/patient/feed">
                    <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-emerald-500/20 transition-all group">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden">
                                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=club${i}`} alt="" className="w-full h-full" />
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">Comunidade ativa</p>
                            <p className="text-slate-500 text-xs">Veja as conquistas de hoje no clube</p>
                        </div>
                        <ChevronRight className="text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0" size={16} />
                    </div>
                </Link>
            </div>

        </div>
        </>
    )
}
