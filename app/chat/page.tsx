"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
    ArrowLeft, Send, Brain, Sparkles,
    Apple, Zap, Dna, RefreshCw, MessageCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"

interface Message {
    id: string
    content: string
    sender: "user" | "ai"
    timestamp: Date
    streaming?: boolean
}

const SUGGESTIONS = [
    { label: "Substituição", icon: Apple, text: "Preciso de substitutos saudáveis para o açúcar" },
    { label: "Motivação", icon: Zap, text: "Estou desmotivada, me ajuda a continuar?" },
    { label: "Protocolo", icon: Dna, text: "Me explica o meu protocolo atual" },
]

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isStreaming, setIsStreaming] = useState(false)
    const [patientName, setPatientName] = useState("Rainha")
    const [brandName, setBrandName] = useState("NutriClub IA")
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("name, tenant_id")
                .eq("user_id", user.id)
                .single()

            const firstName = profile?.name?.split(" ")[0] || "Rainha"
            setPatientName(firstName)

            if (profile?.tenant_id) {
                const { data: tenant } = await supabase
                    .from("tenants")
                    .select("brand_name")
                    .eq("id", profile.tenant_id)
                    .single()
                if (tenant?.brand_name) setBrandName(`${tenant.brand_name} IA`)
            }

            setMessages([{
                id: "welcome",
                content: `Olá, ${firstName}! 👑 Estou aqui para te ajudar com nutrição, seu protocolo e tudo que precisar na sua jornada. Como posso te ajudar hoje?`,
                sender: "ai",
                timestamp: new Date(),
            }])
        }
        init()
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const sendMessage = useCallback(async (text?: string) => {
        const content = (text || input).trim()
        if (!content || isStreaming) return

        setInput("")
        const userMsg: Message = {
            id: Date.now().toString(),
            content,
            sender: "user",
            timestamp: new Date(),
        }

        const historyToSend = messages
            .filter((m) => m.id !== "welcome")
            .slice(-10)
            .map((m) => ({ sender: m.sender, content: m.content }))

        setMessages((prev) => [...prev, userMsg])
        setIsStreaming(true)

        const aiId = (Date.now() + 1).toString()
        setMessages((prev) => [...prev, {
            id: aiId, content: "", sender: "ai", timestamp: new Date(), streaming: true
        }])

        try {
            abortRef.current = new AbortController()
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: content, history: historyToSend }),
                signal: abortRef.current.signal,
            })

            if (!res.ok || !res.body) throw new Error("Erro na API")

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let accumulated = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                accumulated += decoder.decode(value, { stream: true })
                const snapshot = accumulated
                setMessages((prev) => prev.map((m) =>
                    m.id === aiId ? { ...m, content: snapshot } : m
                ))
            }
            setMessages((prev) => prev.map((m) =>
                m.id === aiId ? { ...m, streaming: false } : m
            ))
        } catch (err: any) {
            if (err.name === "AbortError") return
            setMessages((prev) => prev.map((m) =>
                m.id === aiId ? {
                    ...m,
                    content: "Ops! Tive um probleminha. Tente novamente 💫",
                    streaming: false
                } : m
            ))
        } finally {
            setIsStreaming(false)
            inputRef.current?.focus()
        }
    }, [input, isStreaming, messages])

    return (
        <div className="min-h-screen flex flex-col bg-[#020617] text-slate-200">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/90 backdrop-blur-2xl border-b border-white/10">
                <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link href="/patient/home">
                            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                <ArrowLeft size={20} className="text-slate-400" />
                            </div>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="h-11 w-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                                    <Brain size={22} className="text-indigo-400" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-[#020617]" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white">{brandName}</h1>
                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Online agora</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setMessages([{
                            id: "welcome-" + Date.now(),
                            content: `Olá, ${patientName}! 👑 Nova conversa iniciada. Como posso te ajudar?`,
                            sender: "ai",
                            timestamp: new Date(),
                        }])}
                        className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                    >
                        <RefreshCw size={16} className="text-slate-400" />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 pt-20 pb-44 px-4 overflow-y-auto max-w-md mx-auto w-full">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20">
                        <div className="h-16 w-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-3">
                            <MessageCircle size={32} className="text-indigo-400" />
                        </div>
                        <p className="text-slate-500 text-sm">Iniciando conversa...</p>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <AnimatePresence initial={false}>
                            {messages.map((message) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {message.sender === "ai" && (
                                        <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                                            <Sparkles size={14} className="text-indigo-400" />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                                        message.sender === "user"
                                            ? "bg-indigo-600 text-white rounded-tr-sm"
                                            : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm"
                                    }`}>
                                        {message.content ? (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {message.content}
                                                {message.streaming && (
                                                    <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                                                )}
                                            </p>
                                        ) : (
                                            <div className="flex items-center gap-1.5 py-0.5">
                                                {[0, 0.2, 0.4].map((delay, i) => (
                                                    <motion.div
                                                        key={i}
                                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                                        transition={{ repeat: Infinity, duration: 1.2, delay }}
                                                        className="h-2 w-2 bg-indigo-500 rounded-full"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <p className={`text-[10px] mt-1.5 ${message.sender === "user" ? "text-indigo-200/60" : "text-slate-600"}`}>
                                            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Suggestions */}
            <div className="fixed bottom-24 left-0 right-0 z-40 px-4">
                <div className="max-w-md mx-auto flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(s.text)}
                            disabled={isStreaming}
                            className="flex items-center gap-2 whitespace-nowrap px-4 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all disabled:opacity-40"
                        >
                            <s.icon size={12} className="text-indigo-500" />
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#020617] via-[#020617]/95 to-transparent pt-8 pb-6 px-4">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                        placeholder="Pergunte algo..."
                        disabled={isStreaming}
                        className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all disabled:opacity-60"
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isStreaming}
                        className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all hover:bg-indigo-500"
                    >
                        <Send size={20} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    )
}
