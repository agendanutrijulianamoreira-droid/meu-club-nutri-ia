"use client"

import { useState, useEffect } from "react"
import {
    Bell, ChevronLeft, Inbox as InboxIcon, Clock, ArrowRight, Loader2, Settings,
    Shield, MessageSquare, Heart, Utensils, BookOpen, Users, MessageCircle, Eye, Bot
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

interface InboxMessage {
    id: string
    title: string
    body: string
    agent_name: string
    message_type: string
    priority: string
    cta_label: string | null
    cta_url: string | null
    status: 'unread' | 'read' | 'dismissed' | 'acted'
    metadata: any
    created_at: string
}

const AGENT_ICONS: Record<string, { icon: typeof Bot; color: string }> = {
    sabotage: { icon: Shield, color: 'bg-rose-500' },
    daily_checkin: { icon: MessageSquare, color: 'bg-teal-500' },
    onboarding: { icon: Users, color: 'bg-sky-500' },
    meals: { icon: Utensils, color: 'bg-amber-500' },
    retention: { icon: Heart, color: 'bg-pink-500' },
    protocol: { icon: BookOpen, color: 'bg-indigo-500' },
    community: { icon: MessageCircle, color: 'bg-emerald-500' },
    community_moderation: { icon: Eye, color: 'bg-orange-500' },
}

const PRIORITY_STYLES: Record<string, string> = {
    urgent: 'border-rose-500/40 bg-rose-500/5',
    high: 'border-amber-500/30 bg-amber-500/5',
    normal: 'border-white/5',
    low: 'border-white/5 opacity-80',
}

export default function PatientInboxPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<InboxMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [showSettings, setShowSettings] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)

    useEffect(() => {
        loadMessages()
        // Realtime subscription
        const channel = supabase
            .channel('inbox-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'inbox_messages',
            }, (payload) => {
                const msg = payload.new as InboxMessage
                setMessages(prev => [msg, ...prev])
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const loadMessages = async () => {
        try {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data, error } = await supabase
                .from('inbox_messages')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setMessages(data || [])
        } catch (err) {
            console.error("Error loading inbox:", err)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        try {
            await supabase
                .from('inbox_messages')
                .update({ status: 'read', read_at: new Date().toISOString() })
                .eq('id', id)

            setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m))
        } catch (err) {
            console.error("Error marking as read:", err)
        }
    }

    const handleCTA = async (msg: InboxMessage) => {
        // Mark as acted
        await supabase
            .from('inbox_messages')
            .update({ status: 'acted', read_at: new Date().toISOString() })
            .eq('id', msg.id)

        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'acted' } : m))

        if (msg.cta_url) router.push(msg.cta_url)
    }

    const unreadCount = messages.filter(m => m.status === 'unread').length

    const formatTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'agora'
        if (mins < 60) return `${mins}min`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h`
        const days = Math.floor(hrs / 24)
        return `${days}d`
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white pb-24">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Minhas Mensagens</h1>
                        {unreadCount > 0 && (
                            <p className="text-xs text-indigo-400 font-medium">{unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}</p>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center relative"
                >
                    <Settings size={20} className={showSettings ? 'text-indigo-400' : 'text-slate-400'} />
                </button>
            </div>

            <main className="p-6 max-w-lg mx-auto">
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-8"
                        >
                            <div className="p-6 rounded-3xl border border-white/10 space-y-4 bg-indigo-500/5">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Preferências</h3>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold">Notificações Push</p>
                                        <p className="text-[10px] text-slate-500">Receba avisos de metas e desafios no celular</p>
                                    </div>
                                    <button
                                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                        className={`w-12 h-6 rounded-full transition-all relative ${notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest">Buscando mensagens...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-20 space-y-6">
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-700">
                            <InboxIcon size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Tudo em dia!</h3>
                            <p className="text-sm text-slate-500 leading-relaxed px-12">
                                Sua nutri IA enviará mensagens personalizadas aqui — dicas, celebrações e lembretes carinhosos.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, i) => {
                            const agentMeta = AGENT_ICONS[msg.agent_name] || { icon: Bot, color: 'bg-slate-600' }
                            const AgentIcon = agentMeta.icon
                            const isUnread = msg.status === 'unread'
                            const priorityStyle = PRIORITY_STYLES[msg.priority] || PRIORITY_STYLES.normal

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    layout
                                    onClick={() => isUnread && markAsRead(msg.id)}
                                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                                        isUnread ? `${priorityStyle} border-indigo-500/30 bg-indigo-500/5` : `${priorityStyle} opacity-75`
                                    }`}
                                >
                                    {isUnread && (
                                        <div className="absolute top-5 right-5 h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                            isUnread ? agentMeta.color : 'bg-white/5'
                                        }`}>
                                            <AgentIcon size={18} className={isUnread ? 'text-white' : 'text-slate-500'} />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className={`text-sm font-bold leading-tight ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                                    {msg.title}
                                                </h4>
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium shrink-0">
                                                    <Clock size={10} />
                                                    {formatTime(msg.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                                                {msg.body}
                                            </p>

                                            {msg.priority === 'urgent' && (
                                                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold uppercase tracking-wider">
                                                    Urgente
                                                </span>
                                            )}

                                            {msg.cta_label && (
                                                <Button
                                                    size="sm"
                                                    className="mt-3 rounded-xl h-9 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCTA(msg)
                                                    }}
                                                >
                                                    {msg.cta_label}
                                                    <ArrowRight size={12} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
