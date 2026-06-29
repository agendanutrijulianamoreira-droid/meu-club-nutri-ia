"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Utensils, Users, User, Activity } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"
import { useOneSignal } from "@/lib/hooks/useOneSignal"

export default function PatientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [unreadInbox, setUnreadInbox] = useState(0)

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

    const navItems = [
        { href: "/patient/home",   label: "Início",  icon: Home },
        { href: "/patient/habits", label: "Hábitos", icon: Activity },
        { href: "/patient/diet",   label: "Plano",   icon: Utensils },
        { href: "/patient/feed",   label: "Tribo",   icon: Users },
        { href: "/patient/profile",label: "Perfil",  icon: User },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1f14] pb-20">
            {/* Main Content */}
            <main className="relative z-0">
                {children}
            </main>

            {/* Bottom Navigation - Mobile Premium */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 z-50 safe-area-bottom">
                <div className="max-w-md mx-auto flex items-center justify-around px-2 py-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all relative ${isActive
                                    ? "bg-emerald-600/20 text-emerald-400"
                                    : "text-slate-500 hover:text-white"
                                    }`}
                            >
                                <div className="relative">
                                    <Icon size={20} className={isActive ? "text-emerald-400" : ""} />
                                    {item.href === '/patient/profile' && unreadInbox > 0 && (
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                            {unreadInbox > 9 ? '9+' : unreadInbox}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-emerald-400" : ""
                                    }`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Ambient Glow Effect */}
            <div className="fixed top-0 right-0 w-72 h-72 bg-emerald-600/5 blur-[120px] pointer-events-none -z-10" />
        </div>
    )
}
