"use client"

import { MeusProtocolos } from "@/components/protocolos/MeusProtocolos"
import { Home, Apple, Trophy, User, Camera } from "lucide-react"
import Link from "next/link"

export default function ProtocolosPage() {
    return (
        <div className="min-h-screen bg-[#0a0a16] text-white pb-36">
            <div className="max-w-2xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-10 pt-4">
                    <h1 className="text-3xl font-black italic mb-2">Seu Protocolo 📋</h1>
                    <p className="text-gray-400 text-sm">Siga o método bio-individual desenhado pela sua Nutri.</p>
                </div>

                {/* Componente de Protocolos */}
                <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 bg-white/[0.02] p-2">
                    <MeusProtocolos />
                </div>
            </div>

            {/* Bottom Nav Bar */}
            <div className="fixed bottom-6 left-6 right-6 z-50">
                <div className="glass-panel p-2 rounded-[2rem] border border-white/10 bg-[#131320]/90 backdrop-blur-xl shadow-2xl flex justify-around items-center">
                    <Link href="/" className="p-4 rounded-full text-gray-600">
                        <Home size={22} />
                    </Link>
                    <Link href="/protocolo" className="p-4 rounded-full bg-purple-600/20 text-purple-400">
                        <Apple size={22} fill="currentColor" />
                    </Link>

                    <div className="relative -top-8">
                        <button className="relative bg-gradient-to-tr from-purple-600 to-pink-600 w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-purple-900/50 border-4 border-[#131320]">
                            <Camera className="text-white" size={28} />
                        </button>
                    </div>

                    <Link href="/ranking" className="p-4 rounded-full text-gray-600">
                        <Trophy size={22} />
                    </Link>
                    <Link href="/perfil" className="p-4 rounded-full text-gray-600">
                        <User size={22} />
                    </Link>
                </div>
            </div>
        </div>
    )
}
