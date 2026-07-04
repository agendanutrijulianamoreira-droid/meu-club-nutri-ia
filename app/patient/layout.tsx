"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Fraunces, Manrope } from "next/font/google"
import {
    Home, Users, Activity, BookOpen, BarChart2, Utensils, Grid2x2, X,
    MessageCircle, ChefHat, ScanLine, ShoppingBag, Ruler, Bell,
    Inbox as InboxIcon, ClipboardList, CalendarDays,
} from "lucide-react"
import { supabase } from "@/lib/supabase-browser"
import { useOneSignal } from "@/lib/hooks/useOneSignal"

// Identidade visual do Clube da Paciente: serifada elegante (títulos) + sans
// limpa (texto/números) — ver seção "Identidade Visual" do redesign
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" })
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body", display: "swap" })

// Antes só 5 telas tinham entrada na navegação e o resto (Receitas, Scanner,
// Dieta/Cardápio, Chat, Loja, Medidas, Alarmes, Inbox, Questionários,
// Consultas) só era alcançável digitando a URL ou por um card condicional na
// Home — ver auditoria de sistema Jul/2026. "Mais" reúne tudo isso num único
// lugar sempre acessível.
const MORE_ITEMS = [
    { href: "/patient/diet",          label: "Cardápio e Dieta",   desc: "Protocolo, plano da nutri e plano gerado por IA", icon: Utensils },
    { href: "/patient/chat",          label: "Chat com a IA",      desc: "Tire dúvidas com a assistente nutricional",       icon: MessageCircle },
    { href: "/patient/recipes",       label: "Receitas",           desc: "Catálogo de receitas do clube",                   icon: ChefHat },
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

    // Hábitos migrou para dentro da Home (checklist diário já vive lá); no
    // lugar dela entra Dieta, feature mais central. Diário Alimentar segue
    // no topo de "Mais" por ser uso diário, mas não brigando por espaço na
    // barra com Dieta/Progresso/Tribo.
    const navItems = [
        { href: "/patient/home",      label: "Início",    icon: Home },
        { href: "/patient/diet",      label: "Dieta",     icon: Utensils },
        { href: "/patient/progresso", label: "Progresso", icon: BarChart2 },
        { href: "/patient/feed",      label: "Tribo",     icon: Users },
    ]

    const moreItemsWithDiario = [
        { href: "/patient/diario", label: "Diário Alimentar", desc: "Registre o que você comeu hoje", icon: BookOpen },
        { href: "/patient/habits", label: "Hábitos",          desc: "Checklist diário de hábitos",     icon: Activity },
        ...MORE_ITEMS,
    ]
    const moreHasUnread = pathname !== '/patient/inbox' && unreadInbox > 0

    return (
        <div className={`${fraunces.variable} ${manrope.variable} font-body min-h-screen bg-sand-50 pb-20`}>
            {/* Main Content */}
            <main className="relative z-0">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-sage-900/[0.06] z-50 safe-area-bottom shadow-[0_-8px_30px_-15px_rgba(52,63,42,0.15)]">
                <div className="max-w-md mx-auto flex items-center justify-around px-2 py-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all relative ${isActive
                                    ? "bg-sage-500/10 text-sage-700"
                                    : "text-stone-400 hover:text-stone-600"
                                    }`}
                            >
                                <div className="relative">
                                    <Icon size={20} className={isActive ? "text-sage-600" : ""} />
                                </div>
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? "text-sage-700" : ""
                                    }`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-sage-500" />
                                )}
                            </Link>
                        )
                    })}

                    {/* "Mais" — dá acesso a tudo que não cabe na barra: Dieta já tem
                        aba própria, o resto (Chat, Receitas, Scanner, Loja, Medidas,
                        Alarmes, Inbox, Questionários, Consultas) vive aqui */}
                    <button
                        onClick={() => setShowMore(true)}
                        className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all relative text-stone-400 hover:text-stone-600"
                    >
                        <div className="relative">
                            <Grid2x2 size={20} />
                            {moreHasUnread && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-clay-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                    {unreadInbox > 9 ? '9+' : unreadInbox}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Mais</span>
                    </button>
                </div>
            </nav>

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
                            className="fixed bottom-0 left-0 right-0 z-[70] bg-white border-t border-sage-900/[0.06] rounded-t-[2rem] max-h-[80vh] overflow-y-auto safe-area-bottom"
                        >
                            <div className="max-w-md mx-auto px-4 pt-4 pb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-display text-stone-800 font-semibold text-lg">Mais opções</h2>
                                    <button
                                        onClick={() => setShowMore(false)}
                                        className="w-9 h-9 flex items-center justify-center rounded-2xl bg-sand-100 text-stone-500 hover:text-stone-700 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {moreItemsWithDiario.map(item => {
                                        const Icon = item.icon
                                        const showBadge = item.href === '/patient/inbox' && unreadInbox > 0
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setShowMore(false)}
                                                className="flex items-center gap-3 bg-sand-50 border border-sage-900/[0.06] hover:border-sage-400/40 rounded-2xl px-4 py-3 transition-all"
                                            >
                                                <div className="relative w-10 h-10 rounded-xl bg-sage-500/10 flex items-center justify-center shrink-0">
                                                    <Icon size={18} className="text-sage-600" />
                                                    {showBadge && (
                                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-clay-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                                            {unreadInbox > 9 ? '9+' : unreadInbox}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-stone-800 text-sm font-medium">{item.label}</p>
                                                    <p className="text-stone-500 text-xs truncate">{item.desc}</p>
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
