"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ChevronLeft, Send, Sparkles, Loader2, Lock, Crown, RotateCcw
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"

interface Message {
    role: 'user' | 'assistant'
    content: string
    ts: number
}

const SUGGESTIONS = [
    "O que posso comer antes de dormir?",
    "Como aliviar o inchaço?",
    "Receita rápida para o café da manhã",
    "Estou com compulsão por doce, o que faço?",
]

export default function PatientChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [streaming, setStreaming] = useState(false)
    const [plan, setPlan] = useState<string>("community")
    const [dailyCount, setDailyCount] = useState(0)
    const [limitError, setLimitError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return
            supabase.from('profiles').select('current_plan').eq('user_id', user.id).single()
                .then(({ data }) => { if (data?.current_plan) setPlan(data.current_plan) })
            // Fetch today's chat count
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
            supabase.from('ai_generations').select('*', { count: 'exact', head: true })
                .eq('user_id', user.id).eq('task', 'chat').gte('created_at', todayStart.toISOString())
                .then(({ count }) => setDailyCount(count || 0))
        })
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streaming])

    const sendMessage = async (text?: string) => {
        const content = (text ?? input).trim()
        if (!content || streaming) return

        const userMsg: Message = { role: 'user', content, ts: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setInput("")
        setStreaming(true)
        setLimitError(null)

        try {
            const history = messages.map(m => ({ sender: m.role, content: m.content }))
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content, history }),
            })

            if (res.status === 429) {
                const data = await res.json()
                setLimitError(data.error || 'Limite diário atingido.')
                setMessages(prev => prev.slice(0, -1))
                setStreaming(false)
                return
            }

            if (!res.ok || !res.body) throw new Error('Erro na resposta da IA')

            const assistantMsg: Message = { role: 'assistant', content: '', ts: Date.now() }
            setMessages(prev => [...prev, assistantMsg])

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let accumulated = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                accumulated += decoder.decode(value, { stream: true })
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { ...assistantMsg, content: accumulated }
                    return updated
                })
            }

            setDailyCount(c => c + 1)
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Ocorreu um erro. Tente novamente.', ts: Date.now() }])
        } finally {
            setStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    }

    const DAILY_LIMIT = 5
    const remaining = Math.max(0, DAILY_LIMIT - dailyCount)
    const isLimited = plan === 'community' && remaining === 0

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1f14]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4 flex-shrink-0">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Link href="/patient/home" className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <ChevronLeft size={18} className="text-white" />
                    </Link>
                    <div className="flex items-center gap-2.5 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                            <Sparkles size={16} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-black">Nutri IA</p>
                            <p className="text-[10px] text-emerald-400">Assistente de IA · guiada pelo método da sua nutri</p>
                        </div>
                    </div>
                    {plan === 'community' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl">
                            <span className="text-[10px] font-black text-slate-400">{remaining}/{DAILY_LIMIT}</span>
                            <span className="text-[10px] text-slate-600">msgs</span>
                        </div>
                    )}
                    {messages.length > 0 && (
                        <button onClick={() => { setMessages([]); setLimitError(null) }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors" title="Limpar conversa">
                            <RotateCcw size={14} className="text-slate-500" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 max-w-md mx-auto w-full space-y-4">
                {/* Welcome state */}
                {messages.length === 0 && !limitError && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-6">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <Sparkles size={28} className="text-emerald-400" />
                        </div>
                        <h2 className="text-white font-black text-xl mb-1">Olá! Sou a Nutri IA</h2>
                        <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                            Sua assistente de IA, treinada no método da sua nutricionista. Tire dúvidas sobre alimentação, receitas, hábitos e muito mais.
                        </p>
                        <div className="space-y-2 text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">Sugestões para começar</p>
                            {SUGGESTIONS.map((s, i) => (
                                <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                                    onClick={() => sendMessage(s)}
                                    className="w-full text-left px-4 py-3 bg-white/[0.03] border border-white/8 rounded-2xl text-sm text-slate-300 hover:bg-white/8 hover:border-emerald-500/20 transition-all">
                                    {s}
                                </motion.button>
                            ))}
                        </div>
                        {plan === 'community' && (
                            <p className="text-xs text-slate-600 mt-4">{DAILY_LIMIT} mensagens grátis por dia</p>
                        )}
                    </motion.div>
                )}

                {/* Messages */}
                <AnimatePresence>
                    {messages.map((msg, i) => (
                        <motion.div key={msg.ts}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                                    <Sparkles size={13} className="text-emerald-400" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-3 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-br-lg'
                                    : 'bg-white/[0.06] border border-white/8 text-slate-200 rounded-bl-lg'
                            }`}>
                                {msg.content || (streaming && i === messages.length - 1
                                    ? <span className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                      </span>
                                    : ''
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Limit reached */}
                {(limitError || isLimited) && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 text-center">
                        <Lock size={24} className="mx-auto text-amber-400 mb-2" />
                        <p className="text-white font-bold text-sm mb-1">Limite diário atingido</p>
                        <p className="text-slate-400 text-xs mb-3">{limitError || 'Você usou as 5 mensagens gratuitas de hoje.'}</p>
                        <Link href="/patient/upgrade"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-all">
                            <Crown size={13} /> Ver plano com chat ilimitado
                        </Link>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="sticky bottom-0 pb-24 pt-3 px-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent flex-shrink-0">
                <div className="max-w-md mx-auto">
                    <div className={`flex items-end gap-2 bg-white/[0.05] border rounded-3xl px-4 py-3 transition-all ${isLimited ? 'opacity-50 pointer-events-none border-white/5' : 'border-white/10 focus-within:border-emerald-500/40'}`}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isLimited ? 'Limite diário atingido' : 'Pergunte algo sobre alimentação...'}
                            rows={1}
                            disabled={streaming || isLimited}
                            className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-600 outline-none resize-none max-h-32 leading-relaxed"
                            style={{ minHeight: '24px' }}
                        />
                        <button onClick={() => sendMessage()} disabled={!input.trim() || streaming || isLimited}
                            className="w-9 h-9 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center transition-all flex-shrink-0">
                            {streaming ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-slate-700 mt-2">Shift+Enter para nova linha · Enter para enviar</p>
                </div>
            </div>
        </div>
    )
}
