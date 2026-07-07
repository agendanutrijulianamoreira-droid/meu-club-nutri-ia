"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-browser"
import { motion, AnimatePresence } from "framer-motion"
import {
    Calendar, Clock, Video, MapPin, ChevronLeft,
    CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink, Phone
} from "lucide-react"
import Link from "next/link"

interface Appointment {
    id: string
    scheduled_at: string
    duration_minutes: number
    appointment_type: string
    is_virtual: boolean
    meeting_link?: string
    location_address?: string
    status: string
    notes?: string
    nutritionist?: { name: string; avatar_url?: string }
}

const TYPE_LABELS: Record<string, string> = {
    consultation: 'Consulta',
    followup: 'Retorno',
    initial_assessment: 'Avaliação inicial',
    group_session: 'Sessão em grupo',
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
    scheduled: { label: 'Agendada', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    confirmed: { label: 'Confirmada', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    completed: { label: 'Realizada', icon: CheckCircle2, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
    cancelled: { label: 'Cancelada', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    no_show: { label: 'Não realizada', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

export default function PatientAppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const now = new Date().toISOString()
            let query = supabase
                .from('appointments')
                .select(`
                    id, scheduled_at, duration_minutes, appointment_type,
                    is_virtual, meeting_link, location_address, status, notes,
                    nutritionist:nutritionists!nutritionist_id(name, avatar_url)
                `)
                .eq('patient_id', user.id)

            if (filter === 'upcoming') {
                query = query.gte('scheduled_at', now).in('status', ['scheduled', 'confirmed'])
            } else {
                query = query.or(`scheduled_at.lt.${now},status.in.(completed,cancelled,no_show)`)
            }

            query = query.order('scheduled_at', { ascending: filter === 'upcoming' })

            const { data } = await query
            setAppointments((data as any) || [])
            setLoading(false)
        }
        load()
    }, [filter])

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return {
            weekday: d.toLocaleDateString('pt-BR', { weekday: 'long' }),
            date: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }),
            time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        }
    }

    const upcoming = appointments.filter(a => new Date(a.scheduled_at) > new Date() && ['scheduled', 'confirmed'].includes(a.status))
    const nextAppt = upcoming[0]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1f14] pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Link href="/patient/home" className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <ChevronLeft size={18} className="text-white" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black text-white">Minhas Consultas</h1>
                        <p className="text-xs text-slate-500">Agendamentos com sua nutricionista</p>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
                {/* Next appointment highlight */}
                {nextAppt && (() => {
                    const { weekday, date, time } = formatDate(nextAppt.scheduled_at)
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/25 rounded-3xl p-5"
                        >
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Próxima consulta</p>
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex flex-col items-center justify-center flex-shrink-0">
                                    <Calendar size={20} className="text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold capitalize">{weekday}, {date}</p>
                                    <p className="text-emerald-400 font-black text-lg">{time}</p>
                                    <p className="text-slate-400 text-sm mt-0.5">
                                        {TYPE_LABELS[nextAppt.appointment_type] || 'Consulta'} ·{' '}
                                        {nextAppt.duration_minutes} min
                                    </p>
                                    {nextAppt.nutritionist?.name && (
                                        <p className="text-slate-500 text-xs mt-1">com {nextAppt.nutritionist.name}</p>
                                    )}
                                </div>
                            </div>

                            {nextAppt.notes && (
                                <div className="mt-3 p-3 bg-white/5 rounded-2xl">
                                    <p className="text-slate-400 text-xs">{nextAppt.notes}</p>
                                </div>
                            )}

                            {nextAppt.is_virtual && nextAppt.meeting_link && (
                                <a href={nextAppt.meeting_link} target="_blank" rel="noopener noreferrer"
                                    className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-2xl transition-all">
                                    <Video size={15} /> Entrar na consulta
                                </a>
                            )}

                            {!nextAppt.is_virtual && nextAppt.location_address && (
                                <div className="mt-3 flex items-center gap-2 p-3 bg-white/5 rounded-2xl">
                                    <MapPin size={14} className="text-slate-500 flex-shrink-0" />
                                    <p className="text-slate-400 text-xs">{nextAppt.location_address}</p>
                                </div>
                            )}
                        </motion.div>
                    )
                })()}

                {/* Filter tabs */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-2xl">
                    {([['upcoming', 'Próximas'], ['past', 'Histórico']] as const).map(([f, label]) => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={28} className="animate-spin text-emerald-400" />
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-12">
                        <Calendar size={44} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 text-sm">
                            {filter === 'upcoming' ? 'Nenhuma consulta agendada ainda.' : 'Sem histórico de consultas.'}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">Sua nutricionista vai agendar em breve.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {appointments.map((appt, i) => {
                                const { weekday, date, time } = formatDate(appt.scheduled_at)
                                const meta = STATUS_META[appt.status] || STATUS_META.scheduled
                                const Icon = meta.icon

                                return (
                                    <motion.div
                                        key={appt.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="bg-white/[0.03] border border-white/8 rounded-3xl p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="text-white text-sm font-bold">
                                                        {TYPE_LABELS[appt.appointment_type] || 'Consulta'}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <p className="text-slate-400 text-sm capitalize">{weekday}, {date}</p>
                                                <p className="text-slate-300 font-bold">{time} · {appt.duration_minutes} min</p>
                                                {appt.nutritionist?.name && (
                                                    <p className="text-slate-600 text-xs mt-1">com {appt.nutritionist.name}</p>
                                                )}
                                                {appt.notes && (
                                                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{appt.notes}</p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {appt.is_virtual ? (
                                                    <div className="p-2 rounded-xl bg-blue-500/10">
                                                        <Video size={14} className="text-blue-400" />
                                                    </div>
                                                ) : (
                                                    <div className="p-2 rounded-xl bg-slate-500/10">
                                                        <MapPin size={14} className="text-slate-400" />
                                                    </div>
                                                )}
                                                {appt.is_virtual && appt.meeting_link && ['scheduled', 'confirmed'].includes(appt.status) && (
                                                    <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer"
                                                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                                                        <ExternalLink size={14} className="text-emerald-400" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
