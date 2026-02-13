"use client"

import { useState, useRef, useEffect } from "react"
import {
    ArrowLeft,
    Send,
    Sparkles,
    Brain,
    Loader2,
    Mic,
    Image as ImageIcon,
    History,
    MoreVertical,
    Zap,
    Scale,
    Apple,
    ShieldCheck,
    Dna
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

interface Message {
    id: string
    content: string
    sender: 'user' | 'ai'
    timestamp: Date
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            content: "Olá, Bem-vinda ao seu Centro de Bio-individualidade. 🧬 Sou sua assistente dedicada. Com base no seu protocolo NutriGenética 360º, estou pronta para monitorar seus biomarcadores e sugerir ajustes estratégicos. Como posso otimizar sua performance hoje?",
            sender: 'ai',
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            sender: 'user',
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsTyping(true)

        // Simulate AI response based on "Ciência Elegante" context
        setTimeout(() => {
            const responses = [
                "Análise concluída. Para sua fase atual de Otimização Metabólica, substituir carboidratos simples por tubérculos de baixo índice glicêmico é essencial. Isso ajudará a manter sua insulina estável. Deseja uma sugestão de substituto para o jantar? 🥗",
                "Detectado. Esse padrão de cansaço vespertino pode indicar uma necessidade de magnésio treonato ou um ajuste no seu ciclo circadiano. Recomendo 15 minutos de exposição solar e um mix de oleaginosas agora. Funcionará como um 'reset' biológico. ⚡",
                "Constância validada! De acordo com seu sequenciamento de protocolos, o shot matinal hoje deve focar em desinflamação hepática. Sua adesão está em 95%. Continue com foco total! 💎",
                "Sinal biológico interpretado. Sentir fome entre as refeições sugere que precisamos aumentar o aporte proteico no desjejum. Vamos ajustar seu ovo mexido amanhã com mais 2 claras? Isso trará saciedade plena. 🥚"
            ]

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: responses[Math.floor(Math.random() * responses.length)],
                sender: 'ai',
                timestamp: new Date()
            }

            setMessages(prev => [...prev, aiMessage])
            setIsTyping(false)
        }, 2200)
    }

    const suggestActions = [
        { label: "Bio-Substituição", icon: <Apple size={14} />, text: "Sugira substitutos para o glúten" },
        { label: "Análise Genética", icon: <Dna size={14} />, text: "Como meus genes afetam meu cansaço?" },
        { label: "Performance", icon: <Zap size={14} />, text: "Como acelerar meus resultados esta semana?" }
    ]

    return (
        <div className="min-h-screen flex flex-col bg-[#020617] text-slate-200 overflow-hidden">
            {/* --- PREMIUM BACKGROUND --- */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />

            {/* Header Concierge Premium */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-2xl border-b border-white/10 py-6 px-6">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <Link href="/">
                            <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-indigo-600/20 transition-all hover:border-indigo-500/30">
                                <ArrowLeft size={22} className="text-slate-400" />
                            </div>
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="h-14 w-14 rounded-[1.25rem] bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                                    <Brain size={28} className="text-indigo-400" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-[3px] border-[#020617] shadow-lg shadow-emerald-500/20" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                                    IA Concierge <ShieldCheck size={16} className="text-indigo-400" />
                                </h1>
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mt-0.5">Sincronizada com seu DNA</p>
                            </div>
                        </div>
                    </div>
                    <button className="text-slate-600 hover:text-white transition-colors">
                        <MoreVertical size={24} />
                    </button>
                </div>
            </header>

            {/* Chat Content Refined */}
            <div className="flex-1 pt-36 pb-52 px-6 overflow-y-auto max-w-md mx-auto w-full no-scrollbar">
                <div className="space-y-8">
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, scale: 0.98, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`relative max-w-[88%] p-6 rounded-[2rem] shadow-2xl ${message.sender === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-sm border border-indigo-400/30'
                                : 'bg-white/[0.04] border border-white/10 text-slate-200 rounded-tl-sm backdrop-blur-md'
                                }`}>
                                <p className="text-[15px] leading-relaxed font-light">{message.content}</p>
                                <div className={`text-[9px] mt-4 font-black uppercase tracking-widest ${message.sender === 'user' ? 'text-white/50' : 'text-slate-600'
                                    }`}>
                                    {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                        >
                            <div className="bg-white/[0.04] border border-white/10 p-5 rounded-[2rem] rounded-tl-sm flex items-center gap-4 backdrop-blur-md">
                                <div className="flex gap-1.5">
                                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="h-2 w-2 bg-indigo-500 rounded-full" />
                                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="h-2 w-2 bg-indigo-500 rounded-full" />
                                    <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="h-2 w-2 bg-indigo-500 rounded-full" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Consultando seu Reino Clínica...</span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Quick Suggestions Floating Premium */}
            <div className="fixed bottom-28 left-0 right-0 z-40 px-6">
                <div className="max-w-md mx-auto flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                    {suggestActions.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => setInput(action.text)}
                            className="flex items-center gap-3 whitespace-nowrap px-6 py-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all shadow-xl"
                        >
                            <span className="text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]">{action.icon}</span>
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input Bar Premium */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent pt-12 pb-8 px-6">
                <div className="max-w-md mx-auto flex items-center gap-4">
                    <div className="flex-1 relative group">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Interagir com IA Concierge..."
                            className="w-full h-16 bg-white/5 border border-white/10 rounded-[1.5rem] pl-6 pr-14 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner font-medium"
                        />
                        <button className="absolute right-4 top-4 h-8 w-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-white transition-colors">
                            <ImageIcon size={20} />
                        </button>
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-900/40 disabled:opacity-30 active:scale-95 transition-all"
                    >
                        <Send size={24} className="text-white" />
                    </button>
                </div>
            </div>

        </div>
    )
}
