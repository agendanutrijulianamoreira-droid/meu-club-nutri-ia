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
import { ProgressRing } from "@/components/patient/ProgressRing"

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
    const [dietaHoje, setDietaHoje] = useState<{ consumidas: number; meta: number } | null>(null)

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

            // Resumo calórico de hoje (dieta), pra teaser na Home
            const dietaRes = await fetch('/api/patient/diario/meta').catch(() => null)
            const dietaData = dietaRes && dietaRes.ok ? await dietaRes.json().catch(() => ({})) : {}
            if (dietaData?.resumo) {
                setDietaHoje({ consumidas: dietaData.resumo.calorias_consumidas, meta: dietaData.resumo.calorias_meta })
            }

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
                    { emoji: '🍽️', title: 'Cardápio interativo', desc: 'Veja seu plano alimentar na aba Dieta', href: '/patient/diet' },
                    { emoji: '🏆', title: 'Missões e Desafios', desc: 'Complete missões diárias e ganhe XP', href: null },
                    { emoji: '💧', title: 'Lembretes inteligentes', desc: 'Configure alertas de água e refeições', href: null },
                    { emoji: '💬', title: 'Chat com a nutricionista', desc: 'Tire dúvidas a qualquer hora', href: '/patient/chat' },
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

                {/* Level progress bar — mesma fórmula de calculate_level() no banco */}
                {(() => {
                    const xp = stats.totalPoints
                    const level = levelFromXp(xp)
                    const minCurrent = minXpForLevel(level)
                    const minNext = minXpForLevel(level + 1)
                    const pct = Math.round(xpProgressInLevel(xp) * 100)
                    return (
                        <div className="mt-3 flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">Nv {level}</span>
                            <div className="flex-1 relative">
                                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-yellow-400 whitespace-nowrap">Nv {level + 1}</span>
                            <span className="text-[9px] text-slate-600 whitespace-nowrap">{xp - minCurrent}/{minNext - minCurrent} XP</span>
                        </div>
                    )
                })()}
            </div>

            {/* ─── Timeline de Streak (7 dias) ────────────────────────── */}
            <div className="mb-7">
                <StreakTimeline userId={userId ?? undefined} />
            </div>

            {/* ─── CTAs prioritários ───────────────────────────────────────
                Antes, trial + check-in semanal + check-in diário + consulta +
                questionário podiam aparecer como 5 faixas coloridas empilhadas
                ao mesmo tempo, todas com o mesmo peso visual de urgência (ver
                auditoria de produto). Agora só a de maior prioridade vira
                banner cheio; as demais viram atalhos compactos numa única
                fileira, sem competir por atenção nem desaparecer. */}
            {(() => {
                type BannerKey = 'trial-urgent' | 'daily-checkin' | 'weekly-checkin' | 'appointment' | 'questionnaire' | 'trial-soft'

                const candidates: { key: BannerKey; priority: number }[] = []
                if (currentPlan === 'community' && trialDaysLeft !== null && trialDaysLeft <= 3) candidates.push({ key: 'trial-urgent', priority: 1 })
                if (dailyCheckinPending) candidates.push({ key: 'daily-checkin', priority: 2 })
                if (checkinPending) candidates.push({ key: 'weekly-checkin', priority: 3 })
                if (nextAppointment) candidates.push({ key: 'appointment', priority: 4 })
                if (pendingQuestionnaires.length > 0) candidates.push({ key: 'questionnaire', priority: 5 })
                if (currentPlan === 'community' && trialDaysLeft !== null && trialDaysLeft > 3) candidates.push({ key: 'trial-soft', priority: 6 })

                if (candidates.length === 0) return null
                candidates.sort((a, b) => a.priority - b.priority)
                const primary = candidates[0].key
                const secondary = candidates.slice(1)

                const questionnaireHref = pendingQuestionnaires.length === 1
                    ? `/patient/questionnaire/${pendingQuestionnaires[0].id}`
                    : '/patient/questionnaires'

                const PILL_META: Record<BannerKey, { icon: any; label: string; href: string; color: string }> = {
                    'trial-urgent':   { icon: Flame,          label: 'Teste expirando',  href: '/patient/upgrade',        color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                    'trial-soft':     { icon: Crown,          label: 'Ver planos',       href: '/patient/upgrade',        color: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/20' },
                    'daily-checkin':  { icon: HeartPulse,     label: 'Diário de hoje',   href: '/patient/progresso/checkin', color: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/20' },
                    'weekly-checkin': { icon: ClipboardCheck, label: 'Check-in semanal', href: '/patient/checkin',        color: 'text-emerald-400 bg-emerald-600/10 border-emerald-500/20' },
                    'appointment':    { icon: Calendar,       label: 'Próxima consulta', href: '/patient/appointments',   color: 'text-teal-400 bg-teal-600/10 border-teal-500/20' },
                    'questionnaire':  { icon: ClipboardList,  label: 'Questionário',     href: questionnaireHref,         color: 'text-violet-400 bg-violet-600/10 border-violet-500/20' },
                }

                return (
                    <>
                        {(primary === 'trial-urgent' || primary === 'trial-soft') && trialDaysLeft !== null && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                                <Link href="/patient/upgrade">
                                    <div className={`flex items-center gap-3 p-4 rounded-2xl border group transition-all ${
                                        trialDaysLeft <= 3
                                            ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-400/50'
                                            : trialDaysLeft <= 7
                                                ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/50'
                                                : 'bg-indigo-600/10 border-indigo-500/20 hover:border-indigo-500/40'
                                    }`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            trialDaysLeft <= 3 ? 'bg-rose-500/20' : trialDaysLeft <= 7 ? 'bg-amber-500/20' : 'bg-indigo-600/20'
                                        }`}>
                                            {trialDaysLeft <= 7 ? (
                                                <Flame size={18} className={trialDaysLeft <= 3 ? 'text-rose-400' : 'text-amber-400'} />
                                            ) : (
                                                <Crown size={18} className="text-indigo-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {trialDaysLeft === 0 ? (
                                                <>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-rose-400 mb-0.5">Teste expirado</p>
                                                    <p className="text-white font-bold text-sm">Continue no Clube</p>
                                                    <p className="text-slate-400 text-xs">A partir de R$47/ano</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-indigo-400 mb-0.5">Teste gratuito</p>
                                                    <p className="text-white font-bold text-sm">
                                                        {trialDaysLeft} dia{trialDaysLeft > 1 ? 's' : ''} restante{trialDaysLeft > 1 ? 's' : ''}
                                                    </p>
                                                    <p className="text-slate-400 text-xs">Ver planos · a partir de R$47/ano</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] font-black text-indigo-400 hidden group-hover:block">Ver planos</span>
                                            <ChevronRight size={16} className={`group-hover:translate-x-1 transition-transform ${
                                                trialDaysLeft <= 3 ? 'text-rose-400' : trialDaysLeft <= 7 ? 'text-amber-400' : 'text-indigo-400'
                                            }`} />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        )}

                        {primary === 'daily-checkin' && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                                <Link href="/patient/progresso/checkin">
                                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-600/15 to-purple-600/10 border border-indigo-500/30 rounded-2xl group hover:border-indigo-400/50 transition-all">
                                        <div className="w-11 h-11 rounded-xl bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                                            <HeartPulse className="text-indigo-300" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-0.5">Diário de Hoje</p>
                                            <p className="text-white font-bold text-sm">Como você está hoje?</p>
                                            <p className="text-slate-400 text-xs">Registre energia, humor e sintomas — leva menos de 3 min</p>
                                        </div>
                                        <ChevronRight className="text-indigo-400 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                                    </div>
                                </Link>
                            </motion.div>
                        )}

                        {primary === 'weekly-checkin' && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
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

                        {primary === 'appointment' && nextAppointment && (() => {
                            const d = new Date(nextAppointment.scheduled_at)
                            const typeLabel: Record<string, string> = { consultation: 'Consulta', followup: 'Retorno', initial_assessment: 'Avaliação', group_session: 'Grupo' }
                            const date = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
                            const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                            return (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                                    <Link href="/patient/appointments">
                                        <div className="flex items-center gap-4 p-4 bg-teal-600/10 border border-teal-500/25 rounded-2xl group hover:border-teal-400/40 transition-all">
                                            <div className="w-11 h-11 rounded-xl bg-teal-600/20 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
                                                {nextAppointment.is_virtual ? <Video className="text-teal-300" size={18} /> : <MapPin className="text-teal-300" size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400 mb-0.5">Próxima Consulta</p>
                                                <p className="text-white font-bold text-sm">{typeLabel[nextAppointment.appointment_type] || 'Consulta'}</p>
                                                <p className="text-slate-400 text-xs capitalize">{date} · {time}</p>
                                            </div>
                                            <ChevronRight className="text-teal-400 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                                        </div>
                                    </Link>
                                </motion.div>
                            )
                        })()}

                        {primary === 'questionnaire' && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                                <Link href={questionnaireHref}>
                                    <div className="flex items-center gap-4 p-4 bg-violet-600/10 border border-violet-500/25 rounded-2xl group hover:border-violet-400/40 transition-all">
                                        <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                                            <ClipboardList className="text-violet-300" size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400 mb-0.5">Questionário Pendente</p>
                                            <p className="text-white font-bold text-sm truncate">
                                                {pendingQuestionnaires.length === 1
                                                    ? pendingQuestionnaires[0].name
                                                    : `${pendingQuestionnaires.length} questionários para responder`}
                                            </p>
                                            <p className="text-slate-400 text-xs">Ajude sua nutri a te conhecer melhor</p>
                                        </div>
                                        <ChevronRight className="text-violet-400 group-hover:translate-x-1 transition-transform flex-shrink-0" size={18} />
                                    </div>
                                </Link>
                            </motion.div>
                        )}

                        {secondary.length > 0 && (
                            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
                                {secondary.map(({ key }) => {
                                    const meta = PILL_META[key]
                                    const Icon = meta.icon
                                    return (
                                        <Link key={key} href={meta.href}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap transition-all hover:brightness-110 ${meta.color}`}>
                                            <Icon size={12} />
                                            {meta.label}
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )
            })()}

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

            {/* ─── Dieta de hoje ────────────────────────────────────────── */}
            {dietaHoje && dietaHoje.meta > 0 && (
                <Link href="/patient/diario" className="mb-5 block">
                    <div className="flex items-center gap-4 bg-gradient-to-br from-white/[0.06] to-white/[0.015] border border-white/10 hover:border-indigo-500/30 rounded-2xl p-4 transition-all">
                        <ProgressRing
                            value={dietaHoje.consumidas}
                            max={dietaHoje.meta}
                            size={56}
                            strokeWidth={5}
                            color={dietaHoje.consumidas > dietaHoje.meta ? '#fb7185' : '#818cf8'}
                        >
                            <Flame size={13} className="text-orange-400" />
                        </ProgressRing>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">
                                {Math.round(dietaHoje.consumidas)} <span className="text-slate-500 font-normal">/ {Math.round(dietaHoje.meta)} kcal hoje</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Toque para ver seu diário alimentar</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
                    </div>
                </Link>
            )}

            {/* ─── SEÇÃO 3: Metas Rápidas ───────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Registrar agora</p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { key: 'water', label: 'Água', icon: Droplet, color: 'text-sky-400', bg: 'bg-sky-500/8 border-sky-500/15', activeBg: 'bg-sky-500/20 border-sky-400/35', xp: `+${DAILY_LOG_XP.water_check} XP` },
                        { key: 'meal', label: 'Refeição', icon: UtensilsCrossed, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15', activeBg: 'bg-emerald-500/20 border-emerald-400/35', xp: `+${DAILY_LOG_XP.meal_plan_check} XP` },
                        { key: 'workout', label: 'Exercício', icon: Dumbbell, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/15', activeBg: 'bg-amber-500/20 border-amber-400/35', xp: `+${DAILY_LOG_XP.workout_check} XP` },
                    ].map(({ key, label, icon: Icon, color, bg, activeBg, xp }) => {
                        const done = quickTaps[key as keyof typeof quickTaps]
                        return (
                            <motion.button
                                key={key}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => key === 'water' ? router.push('/patient/hidratacao') : handleQuickTap(key as 'meal' | 'workout')}
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

            {/* ─── Vitória do Dia ──────────────────────────────────────── */}
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Vitória do Dia ✨</p>
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                    {savedVictory ? (
                        <div className="space-y-2">
                            <p className="text-sm text-white italic">"{savedVictory}"</p>
                            <button onClick={() => setSavedVictory('')}
                                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
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
                                className="w-full bg-transparent text-sm text-white placeholder-slate-600 resize-none outline-none leading-relaxed"
                            />
                            {dailyVictory.trim() && dailyVictory !== savedVictory && (
                                <button onClick={saveVictory} disabled={savingVictory}
                                    className="flex items-center gap-1 text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors">
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
