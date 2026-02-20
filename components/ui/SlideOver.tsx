"use client"

import React from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { useOverlays } from "./OverlayStack"

interface SlideOverProps {
    id: string
    title?: string
    children: React.ReactNode
    index: number // Used for stacking effects
}

export default function SlideOver({ id, title, children, index }: SlideOverProps) {
    const { closeOverlay } = useOverlays()

    // WebDiet Style Stacking: 
    // The deeper the index, the more "pushed back" and dimmed it looks if it's not the top one.
    // However, our OverlayStack renders them in order, so we can just use simple transforms.

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => closeOverlay(id)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-all"
                style={{ zIndex: 0 }}
            />

            {/* Panel */}
            <motion.div
                initial={{ x: "100%" }}
                animate={{
                    x: 0,
                    scale: 1,
                    // Subtle offset if it's behind another panel (optional refined UX)
                    // marginLeft: index > 0 ? `${index * 20}px` : 0 
                }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-2xl bg-[#020617] border-l border-white/10 shadow-2xl flex flex-col"
                style={{ zIndex: 1 }}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
                    <div>
                        {title && <h2 className="text-xl font-black text-white italic">{title}</h2>}
                    </div>
                    <button
                        onClick={() => closeOverlay(id)}
                        className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                    {children}
                </div>
            </motion.div>
        </>
    )
}
