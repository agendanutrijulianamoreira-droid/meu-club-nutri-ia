"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Utensils, Trophy, User } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"
import { useFCMToken } from "@/lib/hooks/useFCMToken"
import { useOneSignal } from "@/lib/hooks/useOneSignal"

export default function PatientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [discretionMode, setDiscretionMode] = useState(false)

    // Ativar captura de Token FCM para Push (Desativado para MVP - Foco Inbox)
    // useFCMToken()

    // OneSignal Web Push - inicializa SDK e registra external_user_id
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
                .select('role, onboarding_completed, discretion_mode')
                .eq('user_id', user.id)
                .single()

            if (!profile) return

            // Load discretion mode
            if (profile.discretion_mode) {
                setDiscretionMode(true)
                document.title = 'My Wellness'
                // Add noindex meta tag for discretion
                const existingMeta = document.querySelector('meta[name="robots"]')
                if (!existingMeta) {
                    const meta = document.createElement('meta')
                    meta.name = 'robots'
                    meta.content = 'noindex'
                    document.head.appendChild(meta)
                }
            }

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

    const navItems = discretionMode
        ? [
            { href: "/patient/home", label: "Home", icon: Home },
            { href: "/patient/diet", label: "Planner", icon: Utensils },
            { href: "/patient/ranking", label: "Goals", icon: Trophy },
            { href: "/patient/profile", label: "Me", icon: User },
        ]
        : [
            { href: "/patient/home", label: "Início", icon: Home },
            { href: "/patient/diet", label: "Meu Plano", icon: Utensils },
            { href: "/patient/ranking", label: "Ranking", icon: Trophy },
            { href: "/patient/profile", label: "Perfil", icon: User },
        ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0f172a] to-[#1e1b4b] pb-20">
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
                                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${isActive
                                    ? "bg-indigo-600/20 text-indigo-400"
                                    : "text-slate-500 hover:text-white"
                                    }`}
                            >
                                <Icon size={20} className={isActive ? "text-indigo-400" : ""} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-indigo-400" : ""
                                    }`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-400" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Ambient Glow Effect */}
            <div className="fixed top-0 right-0 w-72 h-72 bg-indigo-600/5 blur-[120px] pointer-events-none -z-10" />
        </div>
    )
}
