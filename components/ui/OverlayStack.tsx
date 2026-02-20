"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { AnimatePresence } from "framer-motion"

type Overlay = {
    id: string
    content: React.ReactNode
    title?: string
}

type OverlayContextType = {
    overlays: Overlay[]
    openOverlay: (overlay: Overlay) => void
    closeOverlay: (id?: string) => void
    closeAll: () => void
}

const OverlayContext = createContext<OverlayContextType | undefined>(undefined)

export function OverlayProvider({ children }: { children: React.ReactNode }) {
    const [overlays, setOverlays] = useState<Overlay[]>([])

    const openOverlay = useCallback((overlay: Overlay) => {
        setOverlays((prev) => [...prev, overlay])
    }, [])

    const closeOverlay = useCallback((id?: string) => {
        setOverlays((prev) => {
            if (id) return prev.filter((o) => o.id !== id)
            return prev.slice(0, -1) // Close the last one if no ID provided
        })
    }, [])

    const closeAll = useCallback(() => {
        setOverlays([])
    }, [])

    // Help with ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && overlays.length > 0) {
                closeOverlay()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [overlays, closeOverlay])

    return (
        <OverlayContext.Provider value={{ overlays, openOverlay, closeOverlay, closeAll }}>
            {children}
            <div id="overlay-root">
                <AnimatePresence>
                    {overlays.map((overlay, index) => (
                        <div key={overlay.id} style={{ zIndex: 100 + index }}>
                            {overlay.content}
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </OverlayContext.Provider>
    )
}

export function useOverlays() {
    const context = useContext(OverlayContext)
    if (!context) {
        throw new Error("useOverlays must be used within an OverlayProvider")
    }
    return context
}
