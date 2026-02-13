"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Upload, X, Check, Camera, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function EvidencePage() {
    const router = useRouter()
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setSelectedImage(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async () => {
        if (!selectedImage) return

        setAnalyzing(true)

        // Simulate AI Analysis Delay
        await new Promise(resolve => setTimeout(resolve, 2500))

        setAnalyzing(false)
        setShowSuccess(true)

        // Auto redirect after success
        setTimeout(() => {
            router.push("/")
        }, 3000)
    }

    return (
        <div className="min-h-screen p-6 pb-24 relative">

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Enviar Evidência 📸</h1>
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <X className="text-gray-400" />
                </Button>
            </div>

            <AnimatePresence mode="wait">
                {!showSuccess ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col gap-6"
                    >
                        {/* Instruction Card */}
                        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-crown-gold">
                            <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                                <Sparkles size={16} className="text-crown-gold" />
                                Missão: Hidratação Real
                            </h3>
                            <p className="text-sm text-gray-300">
                                Tire uma foto da sua garrafa de água cheia para garantir seus pontos de hoje!
                            </p>
                        </div>

                        {/* Upload Area */}
                        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-white/5 border-2 border-dashed border-white/20 hover:border-queen-pink/50 transition-colors group">
                            {selectedImage ? (
                                <>
                                    <img
                                        src={selectedImage}
                                        alt="Preview"
                                        className="h-full w-full object-cover"
                                    />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-md"
                                    >
                                        <X size={20} />
                                    </button>

                                    {/* AI Scanning Effect Overlay */}
                                    {analyzing && (
                                        <div className="absolute inset-0 bg-queen-pink/10 z-10">
                                            <motion.div
                                                className="w-full h-1 bg-gradient-to-r from-transparent via-queen-pink to-transparent shadow-[0_0_15px_#FF1493]"
                                                animate={{ top: ["0%", "100%", "0%"] }}
                                                transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                                                style={{ position: 'absolute' }}
                                            />
                                            <div className="absolute bottom-10 left-0 right-0 text-center">
                                                <span className="inline-block bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-white font-mono animate-pulse">
                                                    LUNA AI: ANILISANDO IMAGEM...
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4">
                                    <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Camera size={32} className="text-gray-400 group-hover:text-white" />
                                    </div>
                                    <div className="text-center px-6">
                                        <span className="text-sm font-semibold text-white">Toque para adicionar foto</span>
                                        <p className="text-xs text-gray-400 mt-1">Sua câmera será aberta</p>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedImage || analyzing}
                            className={`w-full h-14 text-lg font-bold shadow-xl shadow-queen-pink/20 ${analyzing ? "opacity-80" : ""}`}
                            variant="primary"
                        >
                            {analyzing ? "Validando..." : "Enviar Evidência (+20 XP)"}
                        </Button>

                    </motion.div>
                ) : (
                    <SuccessView />
                )}
            </AnimatePresence>
        </div>
    )
}

function SuccessView() {
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center h-[60vh] text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(34,197,94,0.6)]"
            >
                <Check size={48} className="text-white" strokeWidth={4} />
            </motion.div>

            <h2 className="text-3xl font-bold text-white mb-2">Excelente! 👑</h2>
            <p className="text-gray-300 mb-8 max-w-[200px]">
                A IA validou sua foto. Você está cada vez mais perto dos seus objetivos!
            </p>

            <div className="glass-panel px-6 py-3 rounded-xl border border-crown-gold/30 bg-crown-gold/10">
                <span className="text-2xl font-black text-crown-gold">+20 Pontos</span>
            </div>
        </motion.div>
    )
}
