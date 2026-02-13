"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Utensils, Trophy, User } from "lucide-react"

export default function PatientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()

    const navItems = [
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
