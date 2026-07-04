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
    Crown,
    Zap,
    Calendar,
    Video,
    MapPin,
    ClipboardList,
    HeartPulse,
} from "lucide-react"
import { usePatientEngine } from "@/lib/hooks/usePatientEngine"
import { levelFromXp, minXpForLevel, xpProgressInLevel, DAILY_LOG_XP } from "@/lib/gamification"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"
import { ReminderSettings } from "@/components/patient/ReminderSettings"
import { StreakTimeline } from "@/components/patient/StreakTimeline"

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
    const [checkinPending, setCheckinPending] = useState(false)
    const [dailyCheckinPending, setDailyCheckinPending] = useState(false)
    const [quickTaps, setQuickTaps] = useState<{ water: boolean; meal: boolean; workout: boolean }>({ water: false, meal: false, workout: false })
    const [dailyVictory, setDailyVictory] = useState('')
    const [savedVictory, setSavedVictory] = useState('')
    const [savingVictory, setSavingVictory] = useState(false)
    const [nextReward, setNextReward] = useState<{ name: string; cost: number; emoji: string } | null>(null)
    const [nutriCoins, setNutriCoins] = useState(0)
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
    const [currentPlan, setCurrentPlan] = useState<string>("community")
    const [nextAppointment, setNextAppointment] = useState<{ scheduled_at: string; is_virtual: boolean; meeting_link?: string; appointment_type: string } | null>(null)
    const [pendingQuestionnaires, setPendingQuestionnaires] = useState<{ id: string; name: string }[]>([])
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            setUserId(session.user.id)

            // Load profile name + check if new member
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, created_at, current_plan, plan_started_at, plan_expires_at')
                .eq('user_id', session.user.id)
                .single()

            if (profile?.name) {
                setFirstName(profile.name.split(' ')[0])
            }
            if (profile?.current_plan) {
                setCurrentPlan(profile.current_plan)
            }
            // Calculate trial days remaining for community plan users
            if (profile?.current_plan === 'community') {
                const ref = profile.plan_expires_at
                    ? new Date(profile.plan_expires_at)
                    : profile.plan_started_at
                        ? new Date(new Date(profile.plan_started_at).getTime() + 15 * 24 * 60 * 60 * 1000)
                        : profile.created_at
                            ? new Date(new Date(profile.created_at).getTime() + 15 * 24 * 60 * 60 * 1000)
                            : null
                if (ref) {
                    const diff = Math.ceil((ref.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    setTrialDaysLeft(Math.max(0, diff))
                }
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

            // Check if today's daily check-in (sintomas) is pending — antes só o
            // semanal tinha CTA na Home, o diário só era alcançável entrando em
            // Progresso primeiro (ver auditoria de sistema Jul/2026)
            const nowLocal = new Date()
            const todayLocal = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`
            const dailyRes = await fetch(`/api/patient/checkin-diario?data=${todayLocal}`)
            const dailyData = await dailyRes.json().catch(() => ({}))
            setDailyCheckinPending(!dailyData.registro)

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

            // Next upcoming appointment
            const { data: appts } = await supabase
                .from('appointments')
                .select('scheduled_at, is_virtual, meeting_link, appointment_type')
                .eq('patient_id', session.user.id)
                .in('status', ['scheduled', 'confirmed'])
                .gte('scheduled_at', new Date().toISOString())
                .order('scheduled_at', { ascending: true })
                .limit(1)
            if (appts && appts.length > 0) setNextAppointment(appts[0])

            // Pending questionnaires (active ones not yet answered by this patient)
            const { data: profileForTenant } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', session.user.id)
                .single()
            if (profileForTenant?.tenant_id) {
                const { data: activeQs } = await supabase
                    .from('questionnaires')
                    .select('id, name')
                    .eq('tenant_id', profileForTenant.tenant_id)
                    .eq('is_active', true)
                const { data: answered } = await supabase
                    .from('questionnaire_responses')
                    .select('questionnaire_id')
                    .eq('patient_id', session.user.id)
                const answeredIds = new Set((answered || []).map((r: any) => r.questionnaire_id))
                const pending = (activeQs || []).filter((q: any) => !answeredIds.has(q.id))
                setPendingQuestionnaires(pending)
            }

            // Load today's daily log to restore quick taps state and daily victory
            const today = new Date()
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
            const { data: todayLog } = await supabase
                .from('daily_logs')
                .select('water_check, meal_plan_check, workout_check, daily_victory')
                .eq('user_id', session.user.id)
                .eq('log_date', todayStr)
                .single()
            if (todayLog) {
                setQuickTaps({
                    water: todayLog.water_check || false,
                    meal: todayLog.meal_plan_check || false,
                    workout: todayLog.workout_check || false,
                })
                if (todayLog.daily_victory) {
                    setSavedVictory(todayLog.daily_victory)
                    setDailyVictory(todayLog.daily_victory)
                }
            }
        }
        init()
    }, [])

    const saveVictory = async () => {
        if (!dailyVictory.trim() || dailyVictory === savedVictory) return
        setSavingVictory(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            const today = new Date()
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
            await supabase.from('daily_logs').upsert({
                user_id: session.user.id,
                log_date: todayStr,
                daily_victory: dailyVictory.trim(),
            }, { onConflict: 'user_id,log_date' })
            setSavedVictory(dailyVictory.trim())
        }
        setSavingVictory(false)
    }

    const handleQuickTap = async (key: 'water' | 'meal' | 'workout') => {
        const newValue = !quickTaps[key]
        setQuickTaps(prev => ({ ...prev, [key]: newValue }))

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
        const colMap: Record<string, string> = { water: 'water_check', meal: 'meal_plan_check', workout: 'workout_check' }

        await supabase.from('daily_logs').upsert({
            user_id: session.user.id,
            log_date: todayStr,
            [colMap[key]]: newValue,
        }, { onConflict: 'user_id,log_date' })
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="text-sage-600 animate-spin" size={32} />
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
              className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-end justify-center p-4 px-4"
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                className="w-full max-w-[430px] bg-white border border-sage-900/[0.06] shadow-xl shadow-stone-900/10 rounded-[2rem] p-6 mb-4 space-y-5"
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">🌿</div>
                  <h2 className="font-display text-xl font-semibold text-stone-800">Bem-vinda ao Clube, {firstName}</h2>
                  <p className="text-stone-500 text-sm mt-1">Aqui está tudo que você pode acessar</p>
                </div>
                <div className="space-y-3">
                  {[
                    { emoji: '🍽️', title: 'Cardápio interativo', desc: 'Veja seu plano alimentar na aba Dieta', href: '/patient/diet' },
                    { emoji: '🏆', title: 'Missões e Desafios', desc: 'Complete missões diárias e ganhe XP', href: null },
                    { emoji: '💧', title: 'Lembretes inteligentes', desc: 'Configure alertas de água e refeições', href: null },
                    { emoji: '💬', title: 'Chat com a nutricionista', desc: 'Tire dúvidas a qualquer hora', href: '/patient/chat' },
                    { emoji: '🌟', title: 'Comunidade e Ranking', desc: 'Conecte-se com outras mulheres', href: '/patient/feed' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-sand-50 border border-sage-900/[0.05] rounded-2xl px-4 py-3">
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-800 text-sm font-semibold">{item.title}</p>
                        <p className="text-stone-500 text-xs">{item.desc}</p>
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
                  className="w-full bg-sage-600 hover:bg-sage-700 text-white font-semibold py-4 rounded-2xl transition-all"
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
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage-600 mb-1">
                            {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}
                        </p>
                        <h1 className="font-display text-2xl font-semibold text-stone-800 leading-tight">{firstName}</h1>
                        {activeProtocol && (
                            <p className="text-stone-500 text-xs mt-0.5">
                                Dia {stats.currentDay} de {stats.totalDays} no protocolo
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowReminders(true)}
                            className="h-10 w-10 rounded-2xl bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 flex items-center justify-center"
                        >
                            <Bell className="text-stone-400" size={18} />
                        </button>
                        <Link href="/patient/inbox" className="relative">
                            <div className="h-10 w-10 rounded-2xl bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 flex items-center justify-center">
                                <Sparkles className="text-stone-400" size={18} />
                            </div>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-sage-600 border border-sand-50 rounded-full flex items-center justify-center text-[9px] font-black text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>

                {/* Streak + XP row */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-clay-50 border border-clay-200/60 px-4 py-2.5 rounded-2xl flex-1">
                        <Flame className="text-clay-500 shrink-0" size={18} />
                        <span className="font-bold text-stone-800 text-lg leading-none">{stats.currentStreak}</span>
                        <span className="text-clay-600/70 text-xs">dias</span>
                        <span className="ml-auto text-[9px] text-stone-400 uppercase font-bold tracking-widest">Streak</span>
                    </div>
                    <div className="flex items-center gap-2 bg-sage-50 border border-sage-200/60 px-4 py-2.5 rounded-2xl flex-1">
                        <Sparkles className="text-sage-600 shrink-0" size={16} />
                        <span className="font-bold text-stone-800 text-lg leading-none">{stats.totalPoints}</span>
                        <span className="text-sage-600/70 text-xs">XP</span>
                        <span className="ml-auto text-[9px] text-stone-400 uppercase font-bold tracking-widest">Total</span>
                    </div>
                </div>

                {/* Level progress bar — mesma fórmula de calculate_level() no banco */}
                {(() => {
                    const xp = stats.totalPoints
                    const level = levelFromXp(xp)
                    const minCurrent = minXpForLevel(level)
                    const minNext = minXpForLevel(level + 1)
                    const pct = Math.round(xpProgressInLevel(xp) * 100)
                    return (
                        <div className="mt-3 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-stone-400 whitespace-nowrap">Nv {level}</span>
                            <div className="flex-1 relative">
                                <div className="h-1.5 bg-sage-900/[0.06] rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-clay-400 to-clay-500 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-clay-500 whitespace-nowrap">Nv {level + 1}</span>
                            <span className="text-[9px] text-stone-400 whitespace-nowrap">{xp - minCurrent}/{minNext - minCurrent} XP</span>
                        </div>
                    )
                })()}
            </div>

            {/* ─── Timeline de Streak (7 dias) ────────────────────────── */}
            <div className="mb-7">
                <StreakTimeline userId={userId ?? undefined} />
            </div>

            {/* ─── Banner de Trial (Clube) ──────────────────────────────── */}
            {currentPlan === 'community' && trialDaysLeft !== null && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5"
                >
                    <Link href="/patient/upgrade">
                        <div className={`flex items-center gap-3 p-4 rounded-2xl border group transition-all bg-white shadow-sm shadow-stone-900/5 ${
                            trialDaysLeft <= 3
                                ? 'border-rose-300/60 hover:border-rose-400/70'
                                : trialDaysLeft <= 7
                                    ? 'border-amber-300/60 hover:border-amber-400/70'
                                    : 'border-clay-200/70 hover:border-clay-300/80'
                        }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                trialDaysLeft <= 3 ? 'bg-rose-50' : trialDaysLeft <= 7 ? 'bg-amber-50' : 'bg-clay-50'
                            }`}>
                                {trialDaysLeft <= 7 ? (
                                    <Flame size={18} className={trialDaysLeft <= 3 ? 'text-rose-500' : 'text-amber-500'} />
                                ) : (
                                    <Crown size={18} className="text-clay-500" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                {trialDaysLeft === 0 ? (
                                    <>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-rose-500 mb-0.5">Teste expirado</p>
                                        <p className="text-stone-800 font-semibold text-sm">Continue no Clube</p>
                                        <p className="text-stone-500 text-xs">A partir de R$47/ano</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-clay-600 mb-0.5">Teste gratuito</p>
                                        <p className="text-stone-800 font-semibold text-sm">
                                            {trialDaysLeft} dia{trialDaysLeft > 1 ? 's' : ''} restante{trialDaysLeft > 1 ? 's' : ''}
                                        </p>
                                        <p className="text-stone-500 text-xs">Ver planos · a partir de R$47/ano</p>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-clay-600 hidden group-hover:block">Ver planos</span>
                                <ChevronRight size={16} className={`group-hover:translate-x-1 transition-transform ${
                                    trialDaysLeft <= 3 ? 'text-rose-500' : trialDaysLeft <= 7 ? 'text-amber-500' : 'text-clay-500'
                                }`} />
                            </div>
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── CTA: Check-in pendente ───────────────────────────────── */}
            {checkinPending && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href="/patient/checkin">
                        <div className="flex items-center gap-4 p-4 bg-sage-50 border border-sage-200/70 rounded-2xl group hover:border-sage-400/60 transition-all">
                            <div className="w-11 h-11 rounded-xl bg-white border border-sage-200/70 flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="text-sage-600" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sage-600 mb-0.5">Missão da Semana</p>
                                <p className="text-stone-800 font-semibold text-sm">Check-in pendente</p>
                                <p className="text-stone-500 text-xs">Responda em 2 min e ganhe +20 XP</p>
                            </div>
                            <ChevronRight className="text-sage-500 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── CTA: Check-in diário de sintomas pendente ──────────────
                Antes só o semanal tinha atalho aqui; o diário (energia, humor,
                sono, inchaço...) só era alcançável entrando em Progresso primeiro */}
            {dailyCheckinPending && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href="/patient/progresso/checkin">
                        <div className="flex items-center gap-4 p-4 bg-clay-50 border border-clay-200/70 rounded-2xl group hover:border-clay-400/60 transition-all">
                            <div className="w-11 h-11 rounded-xl bg-white border border-clay-200/70 flex items-center justify-center flex-shrink-0">
                                <HeartPulse className="text-clay-500" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-clay-600 mb-0.5">Diário de Hoje</p>
                                <p className="text-stone-800 font-semibold text-sm">Como você está hoje?</p>
                                <p className="text-stone-500 text-xs">Registre energia, humor e sintomas em 1 min</p>
                            </div>
                            <ChevronRight className="text-clay-500 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── Widget: Próxima Consulta ────────────────────────────── */}
            {nextAppointment && (() => {
                const d = new Date(nextAppointment.scheduled_at)
                const typeLabel: Record<string, string> = { consultation: 'Consulta', followup: 'Retorno', initial_assessment: 'Avaliação', group_session: 'Grupo' }
                const date = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
                const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                return (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                        <Link href="/patient/appointments">
                            <div className="flex items-center gap-4 p-4 bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-2xl group hover:border-sage-300/60 transition-all">
                                <div className="w-11 h-11 rounded-xl bg-sage-50 border border-sage-200/60 flex items-center justify-center flex-shrink-0">
                                    {nextAppointment.is_virtual ? <Video className="text-sage-600" size={18} /> : <MapPin className="text-sage-600" size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sage-600 mb-0.5">Próxima Consulta</p>
                                    <p className="text-stone-800 font-semibold text-sm">{typeLabel[nextAppointment.appointment_type] || 'Consulta'}</p>
                                    <p className="text-stone-500 text-xs capitalize">{date} · {time}</p>
                                </div>
                                <ChevronRight className="text-sage-500 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                            </div>
                        </Link>
                    </motion.div>
                )
            })()}

            {/* ─── Widget: Questionários Pendentes ─────────────────────── */}
            {pendingQuestionnaires.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href={pendingQuestionnaires.length === 1 ? `/patient/questionnaire/${pendingQuestionnaires[0].id}` : '/patient/questionnaires'}>
                        <div className="flex items-center gap-4 p-4 bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-2xl group hover:border-clay-300/60 transition-all">
                            <div className="w-11 h-11 rounded-xl bg-clay-50 border border-clay-200/60 flex items-center justify-center flex-shrink-0">
                                <ClipboardList className="text-clay-500" size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-clay-600 mb-0.5">Questionário Pendente</p>
                                <p className="text-stone-800 font-semibold text-sm truncate">
                                    {pendingQuestionnaires.length === 1
                                        ? pendingQuestionnaires[0].name
                                        : `${pendingQuestionnaires.length} questionários para responder`}
                                </p>
                                <p className="text-stone-500 text-xs">Ajude sua nutri a te conhecer melhor</p>
                            </div>
                            <ChevronRight className="text-clay-500 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── SEÇÃO 2: Protocolo Ativo — Missões do Dia ────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">
                    {activeProtocol ? 'Meu Dia' : 'Protocolo'}
                </p>

                {!activeProtocol ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-[2rem] text-center"
                    >
                        <div className="h-12 w-12 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="text-sage-600" size={22} />
                        </div>
                        <h3 className="font-display text-base font-semibold text-stone-800 mb-1">Protocolo a caminho</h3>
                        <p className="text-sm text-stone-500 max-w-xs mx-auto">
                            Sua nutricionista está preparando um plano personalizado para você.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-sage-600 mt-3">
                            <Loader2 size={13} className="animate-spin" />
                            Aguardando protocolo...
                        </div>
                    </motion.div>
                ) : (
                    <div className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-[2rem] overflow-hidden">
                        {/* Protocol header */}
                        <div className="px-5 pt-5 pb-4 border-b border-sage-900/[0.05]">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-sage-600 px-2 py-0.5 bg-sage-50 border border-sage-200/60 rounded-full">
                                            Ativo
                                        </span>
                                        <span className="text-[10px] text-stone-400">Dia {stats.currentDay}/{stats.totalDays}</span>
                                    </div>
                                    <h2 className="font-display text-base font-semibold text-stone-800 truncate">{activeProtocol.title}</h2>
                                </div>
                                <div className="relative shrink-0 ml-3">
                                    <svg className="w-12 h-12 -rotate-90">
                                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(52,63,42,0.08)" strokeWidth="3.5" />
                                        <circle cx="24" cy="24" r="20" fill="none" stroke="#79915d" strokeWidth="3.5"
                                            strokeDasharray={`${2 * Math.PI * 20}`}
                                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage / 100)}`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-stone-800">
                                        {progressPercentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 h-1.5 bg-sage-900/[0.06] rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-sage-500 to-sage-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 0.9, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                        {/* Tasks list */}
                        {currentDayItems.length === 0 ? (
                            <div className="px-5 py-6 text-center">
                                <p className="text-stone-500 text-sm font-semibold">Dia livre!</p>
                                <p className="text-xs text-stone-400 mt-1">Aproveite o descanso</p>
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
                                                    ? 'bg-sage-50 border border-sage-200/60'
                                                    : 'bg-sand-50 border border-sage-900/[0.05] hover:border-sage-300/50'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                                isCompleted ? 'bg-sage-500' : 'bg-white border border-sage-900/[0.08]'
                                            }`}>
                                                {isCompleted
                                                    ? <CheckCircle2 size={16} className="text-white" />
                                                    : <Circle size={16} className="text-stone-300" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-medium ${isCompleted ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                                                    {item.title}
                                                </h4>
                                                {item.description && (
                                                    <p className="text-xs text-stone-400 mt-0.5 truncate">{item.description}</p>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold shrink-0 ${isCompleted ? 'text-sage-600' : 'text-stone-400'}`}>
                                                +{item.points || 10} XP
                                            </span>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        )}
                        {completedCount === currentDayItems.length && currentDayItems.length > 0 && (
                            <div className="px-5 pb-5">
                                <div className="flex items-center gap-2 bg-sage-50 border border-sage-200/60 rounded-2xl px-4 py-3">
                                    <Award className="text-sage-600 shrink-0" size={16} />
                                    <p className="text-sage-700 text-xs font-semibold">Todas as missões concluídas!</p>
                                    <span className="ml-auto text-xs text-sage-600 font-bold">+{currentDayItems.reduce((s, i) => s + (i.points || 10), 0)} XP</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── SEÇÃO 3: Metas Rápidas ───────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">Registrar agora</p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { key: 'water', label: 'Água', icon: Droplet, color: 'text-sky-500', bg: 'bg-white border-sage-900/[0.06]', activeBg: 'bg-sky-50 border-sky-300/60', xp: `+${DAILY_LOG_XP.water_check} XP` },
                        { key: 'meal', label: 'Refeição', icon: UtensilsCrossed, color: 'text-sage-600', bg: 'bg-white border-sage-900/[0.06]', activeBg: 'bg-sage-50 border-sage-300/60', xp: `+${DAILY_LOG_XP.meal_plan_check} XP` },
                        { key: 'workout', label: 'Exercício', icon: Dumbbell, color: 'text-clay-500', bg: 'bg-white border-sage-900/[0.06]', activeBg: 'bg-clay-50 border-clay-300/60', xp: `+${DAILY_LOG_XP.workout_check} XP` },
                    ].map(({ key, label, icon: Icon, color, bg, activeBg, xp }) => {
                        const done = quickTaps[key as keyof typeof quickTaps]
                        return (
                            <motion.button
                                key={key}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => key === 'water' ? router.push('/patient/hidratacao') : handleQuickTap(key as 'meal' | 'workout')}
                                className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border shadow-sm shadow-stone-900/5 transition-all ${done ? activeBg : bg}`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${done ? 'bg-white' : 'bg-sand-50'}`}>
                                    <Icon size={20} className={color} />
                                </div>
                                <span className="text-stone-800 text-[11px] font-semibold leading-tight text-center">{label}</span>
                                <span className={`text-[9px] font-bold ${done ? color : 'text-stone-400'}`}>
                                    {done ? '✓ feito' : xp}
                                </span>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* ─── Vitória do Dia ──────────────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">Vitória do Dia ✨</p>
                <div className="bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-2xl p-4">
                    {savedVictory ? (
                        <div className="space-y-2">
                            <p className="text-sm text-stone-700 italic">"{savedVictory}"</p>
                            <button onClick={() => setSavedVictory('')}
                                className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">
                                editar
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={dailyVictory}
                                onChange={e => setDailyVictory(e.target.value)}
                                onBlur={saveVictory}
                                rows={2}
                                placeholder="Qual foi sua maior conquista hoje? Pode ser pequena..."
                                className="w-full bg-transparent text-sm text-stone-800 placeholder-stone-400 resize-none outline-none leading-relaxed"
                            />
                            {dailyVictory.trim() && dailyVictory !== savedVictory && (
                                <button onClick={saveVictory} disabled={savingVictory}
                                    className="flex items-center gap-1 text-[10px] font-bold text-sage-600 hover:text-sage-700 transition-colors">
                                    {savingVictory ? <Loader2 size={10} className="animate-spin" /> : null}
                                    salvar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Próximo Prêmio ───────────────────────────────────────── */}
            {nextReward && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <Link href="/patient/store">
                        <div className="flex items-center gap-4 p-4 bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-2xl hover:border-clay-300/50 transition-all group">
                            <div className="w-11 h-11 rounded-xl bg-clay-50 border border-clay-200/60 flex items-center justify-center flex-shrink-0 text-xl">
                                {nextReward.emoji || '🎁'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-clay-600 mb-0.5">Próximo Prêmio</p>
                                <p className="text-stone-800 font-semibold text-sm truncate">{nextReward.name}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1 bg-sage-900/[0.06] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-clay-400 to-clay-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (nutriCoins / nextReward.cost) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-stone-400 font-bold whitespace-nowrap">
                                        {nutriCoins}/{nextReward.cost} 👑
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="text-stone-300 group-hover:text-clay-500 group-hover:translate-x-1 transition-all flex-shrink-0" size={16} />
                        </div>
                    </Link>
                </motion.div>
            )}

            {/* ─── SEÇÃO 4: No Clube Agora ──────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">No Clube Agora</p>
                    <Link href="/patient/feed" className="text-[10px] font-bold text-sage-600 hover:text-sage-700 uppercase tracking-widest transition">
                        Ver tudo →
                    </Link>
                </div>
                <Link href="/patient/feed">
                    <div className="flex items-center gap-3 p-4 bg-white border border-sage-900/[0.06] shadow-sm shadow-stone-900/5 rounded-2xl hover:border-sage-300/50 transition-all group">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-sand-100 overflow-hidden">
                                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=club${i}`} alt="" className="w-full h-full" />
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-stone-800 text-sm font-semibold">Comunidade ativa</p>
                            <p className="text-stone-500 text-xs">Veja as conquistas de hoje no clube</p>
                        </div>
                        <ChevronRight className="text-stone-300 group-hover:text-sage-500 group-hover:translate-x-1 transition-all shrink-0" size={16} />
                    </div>
                </Link>
            </div>

        </div>
        </>
    )
}
