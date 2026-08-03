"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Activity, BarChart2, Grid2x2, X,
    MessageCircle, ScanLine, ShoppingBag, Ruler, Bell,
    Inbox as InboxIcon, ClipboardList, CalendarDays, Target,
} from "lucide-react"
import { supabase } from "@/lib/supabase-browser"
import { useOneSignal } from "@/lib/hooks/useOneSignal"
import { BottomNav } from "@/components/patient/BottomNav"

// A bottom nav principal tem só 5 itens fixos (Início, Diário IA, Meu Plano,
// Acervo, Comunidade). O resto das telas (Hábitos, Progresso, Chat, Scanner,
// Loja, Medidas, Alarmes, Inbox, Questionários, Consultas) fica atrás do
// botão flutuante "Mais" — ver auditoria de sistema Jul/2026.
const MORE_ITEMS = [
    { href: "/patient/habits",        label: "Hábitos",            desc: "Checklist diário de hábitos",                     icon: Activity },
    { href: "/patient/goals",         label: "Metas",               desc: "Metas atribuídas pela sua nutricionista",         icon: Target },
    { href: "/patient/progresso",     label: "Progresso",          desc: "Evolução de peso, medidas e adesão",              icon: BarChart2 },
    { href: "/patient/chat",          label: "Chat com a IA",      desc: "Tire dúvidas com a assistente nutricional",       icon: MessageCircle },
    { href: "/patient/scanner",       label: "Scanner de produto", desc: "Aponte a câmera pro código de barras",            icon: ScanLine },
    { href: "/patient/store",         label: "Loja de prêmios",    desc: "Troque NutriCoins por recompensas",               icon: ShoppingBag },
    { href: "/patient/measurements",  label: "Medidas corporais",  desc: "Peso, cintura e evolução",                        icon: Ruler },
    { href: "/patient/alarms",        label: "Alarmes",            desc: "Lembretes de água, refeição e treino",            icon: Bell },
    { href: "/patient/inbox",         label: "Caixa de entrada",   desc: "Mensagens da nutri e dos agentes de IA",          icon: InboxIcon },
    { href: "/patient/questionnaires",label: "Questionários",      desc: "Formulários enviados pela nutri",                 icon: ClipboardList },
    { href: "/patient/professionals", label: "Consultas",          desc: "Agenda com a nutri e outros profissionais",       icon: CalendarDays },
]

export default function PatientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [unreadInbox, setUnreadInbox] = useState(0)
    const [showMore, setShowMore] = useState(false)

    useEffect(() => { setShowMore(false) }, [pathname])

    // Registrar token OneSignal para push notifications (lembretes e agentes)
    useOneSignal()

    // Proteção: 
    // 1. Redirecionar nutris que caírem aqui por engano
    // 2. Forçar onboarding se não completou (trava-portas)
    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, onboarding_completed')
                .eq('user_id', user.id)
                .single()

            if (!profile) return

            // Nutris → admin
            const role = profile.role || user.user_metadata?.user_type
            if (role === 'nutritionist' || role === 'admin') {
                router.push('/admin')
                return
            }

            // Trava-portas: forçar onboarding (exceto se já está na página de onboarding)
            const isOnboardingPage = pathname === '/patient/onboarding'
            if (!profile.onboarding_completed && !isOnboardingPage) {
                router.push('/patient/onboarding')
            }
        }
        checkAccess()
    }, [router, pathname])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            supabase.from('inbox_messages').select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id).eq('status', 'unread')
                .then(({ count }) => setUnreadInbox(count || 0))
        })
    }, [pathname])

    const moreHasUnread = pathname !== '/patient/inbox' && unreadInbox > 0
    // Fluxo de captura/confirmação de refeição por foto não usa o chrome padrão
    // (bottom nav, botão "Mais"): são telas de foco único, sem distração
    const isFullScreenRoute = pathname?.startsWith('/patient/diario/capturar')
        || pathname?.startsWith('/patient/diario/resultado')

    return (
        <div className={isFullScreenRoute ? "min-h-screen" : "min-h-screen bg-white pb-24"}>
            {/* Main Content */}
            <main className="relative z-0">
                {children}
            </main>

            {!isFullScreenRoute && (
                <>
                    {/* "Mais" — acesso flutuante ao resto das telas do app (Hábitos, Chat,
                        Scanner, Loja, Medidas, Alarmes, Inbox, Questionários, Consultas);
                        Início/Diário IA/Meu Plano/Acervo/Comunidade já vivem na bottom nav */}
                    <button
                        onClick={() => setShowMore(true)}
                        className="fixed top-4 right-4 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-stone-100 shadow-soft text-stone-400 hover:text-sage-600 transition-colors"
                    >
                        <Grid2x2 size={18} strokeWidth={1.5} />
                        {moreHasUnread && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-terracotta-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                {unreadInbox > 9 ? '9+' : unreadInbox}
                            </span>
                        )}
                    </button>

                    {/* Bottom Navigation */}
                    <BottomNav />
                </>
            )}

            {/* "Mais" — bottom sheet com o resto das telas do app */}
            <AnimatePresence>
                {showMore && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowMore(false)}
                            className="fixed inset-0 z-[60] bg-stone-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-[70] bg-white border-t border-stone-100 rounded-t-3xl max-h-[80vh] overflow-y-auto safe-area-bottom"
                        >
                            <div className="max-w-md mx-auto px-4 pt-4 pb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-serif text-stone-800 font-medium text-lg">Mais opções</h2>
                                    <button
                                        onClick={() => setShowMore(false)}
                                        className="w-9 h-9 flex items-center justify-center rounded-2xl bg-sand-100 text-stone-500 hover:text-stone-800 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {MORE_ITEMS.map(item => {
                                        const Icon = item.icon
                                        const showBadge = item.href === '/patient/inbox' && unreadInbox > 0
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setShowMore(false)}
                                                className="flex items-center gap-3 bg-white border border-stone-100 hover:border-sage-300 rounded-2xl px-4 py-3 transition-all"
                                            >
                                                <div className="relative w-10 h-10 rounded-xl bg-sand-100 flex items-center justify-center shrink-0">
                                                    <Icon size={18} strokeWidth={1.5} className="text-sage-600" />
                                                    {showBadge && (
                                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-terracotta-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                                            {unreadInbox > 9 ? '9+' : unreadInbox}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-stone-800 text-sm font-medium">{item.label}</p>
                                                    <p className="text-stone-400 text-xs truncate">{item.desc}</p>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
