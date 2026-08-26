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

const MORE_ITEMS = [
    { href: "/patient/habits",        label: "Hábitos",            desc: "Checklist diário de hábitos",                     icon: Activity },
    { href: "/patient/goals",         label: "Metas",              desc: "Metas atribuídas pela sua nutricionista",         icon: Target },
    { href: "/patient/progresso",     label: "Progresso",          desc: "Evolução de peso, medidas e adesão",              icon: BarChart2 },
    { href: "/patient/chat",          label: "Chat com a IA",      desc: "Tire dúvidas com a assistente nutricional",       icon: MessageCircle },
    { href: "/patient/scanner",       label: "Scanner de produto", desc: "Aponte a câmera para o código de barras",         icon: ScanLine },
    { href: "/patient/store",         label: "Loja de prêmios",    desc: "Troque NutriCoins por recompensas",               icon: ShoppingBag },
    { href: "/patient/measurements",  label: "Medidas corporais", desc: "Peso, cintura e evolução",                        icon: Ruler },
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
    useOneSignal()

    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase.from('profiles').select('role, onboarding_completed').eq('user_id', user.id).single()
            if (!profile) return
            const role = profile.role || user.user_metadata?.user_type
            if (role === 'nutritionist' || role === 'admin') {
                router.push('/admin')
                return
            }
            const isOnboardingPage = pathname === '/patient/onboarding'
            if (!profile.onboarding_completed && !isOnboardingPage) router.push('/patient/onboarding')
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
    const isFullScreenRoute = pathname?.startsWith('/patient/diario/capturar') || pathname?.startsWith('/patient/diario/resultado')

    return (
        <div className={isFullScreenRoute ? "min-h-screen theme-patient" : "theme-patient min-h-screen bg-[#F4EFE4] text-[#2B1A10] pb-24"}>
            <main className="relative z-0">{children}</main>

            {!isFullScreenRoute && (
                <>
                    <button
                        onClick={() => setShowMore(true)}
                        aria-label="Abrir mais opções"
                        className="fixed top-4 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#FFFDF8] border border-[#2B1A10]/10 shadow-sm text-[#6A584B] hover:text-[#9B7A16] hover:border-[#C9A435]/35 transition-colors"
                    >
                        <Grid2x2 size={19} strokeWidth={1.8} />
                        {moreHasUnread && (
                            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-[#B94048] rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                {unreadInbox > 9 ? '9+' : unreadInbox}
                            </span>
                        )}
                    </button>
                    <BottomNav />
                </>
            )}

            <AnimatePresence>
                {showMore && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMore(false)} className="fixed inset-0 z-[60] bg-[#2B1A10]/45 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#FFFDF8] border-t border-[#2B1A10]/10 rounded-t-3xl max-h-[82vh] overflow-y-auto safe-area-bottom shadow-[0_-18px_45px_rgba(43,26,16,0.14)]"
                        >
                            <div className="max-w-md mx-auto px-4 pt-4 pb-8">
                                <div className="w-12 h-1 rounded-full bg-[#2B1A10]/12 mx-auto mb-4" />
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-serif text-[#2B1A10] font-semibold text-lg">Mais opções</h2>
                                        <p className="text-xs text-[#6A584B] mt-0.5">Recursos complementares do seu acompanhamento</p>
                                    </div>
                                    <button onClick={() => setShowMore(false)} aria-label="Fechar" className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F4EFE4] text-[#6A584B] hover:text-[#2B1A10] transition-all">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {MORE_ITEMS.map(item => {
                                        const Icon = item.icon
                                        const showBadge = item.href === '/patient/inbox' && unreadInbox > 0
                                        const active = pathname === item.href || pathname?.startsWith(item.href + '/')
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setShowMore(false)}
                                                className={`flex items-center gap-3 border rounded-2xl px-4 py-3 transition-all ${active ? 'bg-[#C9A435]/10 border-[#C9A435]/35' : 'bg-white border-[#2B1A10]/10 hover:border-[#C9A435]/30 hover:bg-[#FFF9ED]'}`}
                                            >
                                                <div className="relative w-10 h-10 rounded-xl bg-[#C9A435]/10 flex items-center justify-center shrink-0">
                                                    <Icon size={18} strokeWidth={1.8} className="text-[#9B7A16]" />
                                                    {showBadge && (
                                                        <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-[#B94048] rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                                            {unreadInbox > 9 ? '9+' : unreadInbox}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[#2B1A10] text-sm font-semibold">{item.label}</p>
                                                    <p className="text-[#6A584B] text-xs truncate">{item.desc}</p>
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
