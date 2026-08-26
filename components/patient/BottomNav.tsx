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
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFDF8]/96 backdrop-blur border-t border-[#2B1A10]/10 safe-area-bottom shadow-[0_-8px_26px_rgba(43,26,16,0.06)]">
            <div className="max-w-md mx-auto flex items-center justify-around px-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    const Icon = item.icon

                    if (item.highlight) {
                        return (
                            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-3 -translate-y-3 min-w-[64px]">
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-12 h-12 rounded-full transition-all border-2 border-[#FFFDF8]",
                                        isActive ? "bg-[#9B7A16]" : "bg-[#C9A435] hover:bg-[#9B7A16]"
                                    )}
                                    style={{ boxShadow: "0 10px 26px -8px rgb(201 164 53 / 0.50)" }}
                                >
                                    <Icon size={20} strokeWidth={1.8} className="text-white" />
                                </div>
                                <span className={cn("text-[10px] font-bold tracking-wide", isActive ? "text-[#9B7A16]" : "text-[#6A584B]")}>{item.label}</span>
                            </Link>
                        )
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1 px-2 py-3 min-w-[60px] rounded-xl transition-colors",
                                isActive && "bg-[#C9A435]/10"
                            )}
                        >
                            <Icon size={21} strokeWidth={1.8} className={isActive ? "text-[#9B7A16]" : "text-[#7A6A5E]"} />
                            <span className={cn("text-[10px] font-bold tracking-wide", isActive ? "text-[#9B7A16]" : "text-[#6A584B]")}>{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
