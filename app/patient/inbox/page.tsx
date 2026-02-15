"use client"

import { useState, useEffect } from "react"
import {
    Bell,
    MessageSquare,
    ChevronLeft,
    Inbox as InboxIcon,
    Clock,
    CheckCircle2,
    ArrowRight,
    Loader2,
    Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

interface Notification {
    id: string
    title: string
    body: string
    cta_label: string | null
    cta_url: string | null
    status: 'unread' | 'read'
    created_at: string
}

export default function PatientInboxPage() {
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [showSettings, setShowSettings] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        try {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])

            // Marcar como lidas ao abrir (opcional, ou por clique)
        } catch (err) {
            console.error("Error loading notifications:", err)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ status: 'read', read_at: new Date().toISOString() })
                .eq('id', id)

            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n))
        } catch (err) {
            console.error("Error marking as read:", err)
        }
    }

    const unreadCount = notifications.filter(n => n.status === 'unread').length

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
                        {unreadCount > 0 && <p className="text-xs text-indigo-400 font-medium">Você tem {unreadCount} mensagens novas</p>}
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
                            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 bg-indigo-500/5">
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
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 space-y-6">
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-700">
                            <InboxIcon size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Tudo em dia!</h3>
                            <p className="text-sm text-slate-500 leading-relaxed px-12">Sua nutri enviará avisos importantes aqui sobre suas metas e conquistas.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notifications.map((notif) => (
                            <motion.div
                                key={notif.id}
                                layout
                                onClick={() => markAsRead(notif.id)}
                                className={`glass-panel p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden group ${notif.status === 'unread'
                                        ? 'border-indigo-500/30 bg-indigo-500/5'
                                        : 'border-white/5 opacity-80'
                                    }`}
                            >
                                {notif.status === 'unread' && (
                                    <div className="absolute top-6 right-6 h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${notif.status === 'unread' ? 'bg-indigo-600' : 'bg-white/5'
                                        }`}>
                                        <Bell size={20} className={notif.status === 'unread' ? 'text-white' : 'text-slate-500'} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-sm font-bold ${notif.status === 'unread' ? 'text-white' : 'text-slate-300'}`}>
                                                {notif.title}
                                            </h4>
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                                <Clock size={10} />
                                                {new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {notif.body}
                                        </p>

                                        {notif.cta_label && (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                className="mt-4 rounded-xl h-10 gap-2 w-full sm:w-auto"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (notif.cta_url) router.push(notif.cta_url)
                                                }}
                                            >
                                                {notif.cta_label}
                                                <ArrowRight size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
