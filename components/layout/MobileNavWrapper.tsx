"use client"

import { usePathname } from "next/navigation"
import { MobileNav } from "./MobileNav"

export function MobileNavWrapper() {
    const pathname = usePathname()

    // Não mostrar navegação mobile no admin e no login
    if (pathname?.startsWith("/admin") || pathname === "/login") {
        return null
    }

    return <MobileNav />
}

