"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Trophy, Users, User, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function MobileNav() {
    const pathname = usePathname()

    // Não exibir na tela de login
    if (pathname === '/login') return null;

    const navItems = [
        { href: "/", label: "Reino", icon: Home },
        { href: "/desafios", label: "Desafios", icon: Zap },
        { href: "/ranking", label: "Ranking", icon: Trophy },
        { href: "/comunidade", label: "Tribo", icon: Users },
        { href: "/perfil", label: "Perfil", icon: User },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-0">
            <nav className="glass-panel mx-auto flex h-16 max-w-md items-center justify-around rounded-2xl border-white/10 px-2 shadow-2xl backdrop-blur-xl">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 transition-all",
                                isActive ? "text-queen-pink" : "text-gray-400 hover:text-white"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute inset-0 -z-10 rounded-xl bg-white/10"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{label}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
