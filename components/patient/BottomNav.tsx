"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Sparkles, ClipboardList, BookOpen, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
    href: string
    label: string
    icon: LucideIcon
    highlight?: boolean
}

const NAV_ITEMS: NavItem[] = [
    { href: "/patient/home", label: "Início", icon: Home },
    { href: "/patient/diario", label: "Diário IA", icon: Sparkles, highlight: true },
    { href: "/patient/diet", label: "Meu Plano", icon: ClipboardList },
    { href: "/patient/recipes", label: "Acervo", icon: BookOpen },
    { href: "/patient/feed", label: "Comunidade", icon: Users },
]

export function BottomNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-100 safe-area-bottom">
            <div className="max-w-md mx-auto flex items-center justify-around px-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon

                    if (item.highlight) {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex flex-col items-center gap-1.5 px-4 -translate-y-3"
                            >
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                                        isActive ? "bg-sage-600" : "bg-sage-500"
                                    )}
                                    style={{ boxShadow: "0 10px 28px -8px rgb(107 129 88 / 0.45)" }}
                                >
                                    <Icon size={20} strokeWidth={1.5} className="text-white" />
                                </div>
                                <span
                                    className={cn(
                                        "text-[10px] font-semibold tracking-wide",
                                        isActive ? "text-sage-600" : "text-stone-400"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        )
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center gap-1.5 px-4 py-3"
                        >
                            <Icon
                                size={22}
                                strokeWidth={1.5}
                                className={isActive ? "text-sage-600" : "text-stone-400"}
                            />
                            <span
                                className={cn(
                                    "text-[10px] font-semibold tracking-wide",
                                    isActive ? "text-sage-600" : "text-stone-400"
                                )}
                            >
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
