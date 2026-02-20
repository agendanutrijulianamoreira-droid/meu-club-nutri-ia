"use client"

import { OverlayProvider } from "@/components/ui/OverlayStack"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <OverlayProvider>
            {children}
        </OverlayProvider>
    )
}
