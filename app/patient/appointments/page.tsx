"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase-browser"
import { AnimatePresence, motion } from "framer-motion"
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    Clock,
    ExternalLink,
    Loader2,
    MapPin,
    Video,
    XCircle,
} from "lucide-react"
import Link from "next/link"

interface Appointment {
    id: string
    scheduled_at: string
    duration_minutes: number
    is_virtual: boolean
    meeting_link?: string
    location_address?: string
    status: string
    notes?: string
    appointment_type?: { name: string; code: string } | null
    nutritionist?: { name: string; avatar_url?: string } | null
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
    scheduled: { label: 'Agendada', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    confirmed: { label: 'Confirmada', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    in_progress: { label: 'Em andamento', icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    completed: { label: 'Realizada', icon: CheckCircle2, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
    cancelled: { label: 'Cancelada', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    no_show: { label: 'Não realizada', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

export default function PatientAppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
    const [timezone, setTimezone] = useState('America/Sao_Paulo')

    useEffect(() => {
        let active = true

        const load = async () => {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (active) setLoading(false)
                return
            }

            const [{ data: settings }, { data }] = await Promise.all([
                supabase.from('tenant_appointment_settings').select('timezone').maybeSingle(),
                supabase
                    .from('appointments')
                    .select(`
                        id, scheduled_at, duration_minutes, is_virtual,
                        meeting_link, location_address, status, notes,
                        appointment_type:appointment_types!appointment_type_id(name, code),
                        nutritionist:nutritionists!nutritionist_id(name, avatar_url)
                    `)
                    .eq('patient_id', user.id)
                    .order('scheduled_at', { ascending: true }),
            ])

            if (active) {
                if (settings?.timezone) setTimezone(settings.timezone)
                setAppointments((data as any) || [])
                setLoading(false)
            }
        }

        load()
        return () => { active = false }
    }, [])

    const visible = useMemo(() => {
        const now = Date.now()
        return appointments
            .filter((appointment) => {
                const scheduled = new Date(appointment.scheduled_at).getTime()
                if (filter === 'upcoming') {
                    return appointment.status === 'in_progress'
                        || (['scheduled', 'confirmed'].includes(appointment.status) && scheduled >= now)
                }
                return ['completed', 'cancelled', 'no_show'].includes(appointment.status)
                    || (['scheduled', 'confirmed'].includes(appointment.status) && scheduled < now)
            })
            .sort((a, b) => {
                const left = new Date(a.scheduled_at).getTime()
                const right = new Date(b.scheduled_at).getTime()
                return filter === 'upcoming' ? left - right : right - left
            })
    }, [appointments, filter])

    const nextAppt = filter === 'upcoming' ? visible[0] : undefined

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return {
            weekday: date.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: timezone }),
            date: date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: timezone }),
            time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }),
        }
    }

    const typeName = (appointment: Appointment) => appointment.appointment_type?.name || 'Consulta'

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1f14] pb-24">
            <div className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/90 px-4 pb-4 pt-12 backdrop-blur-xl">
                <div className="mx-auto flex max-w-md items-center gap-3">
                    <Link href="/patient/home" className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10">
                        <ChevronLeft size={18} className="text-white" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black text-white">Minhas Consultas</h1>
                        <p className="text-xs text-slate-500">Agendamentos com sua nutricionista</p>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-md space-y-5 px-4 pt-6">
                {nextAppt && (() => {
                    const { weekday, date, time } = formatDate(nextAppt.scheduled_at)
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-900/40 to-teal-900/20 p-5"
                        >
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                {nextAppt.status === 'in_progress' ? 'Consulta em andamento' : 'Próxima consulta'}
                            </p>
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/15">
                                    <Calendar size={20} className="text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold capitalize text-white">{weekday}, {date}</p>
                                    <p className="text-lg font-black text-emerald-400">{time}</p>
                                    <p className="mt-0.5 text-sm text-slate-400">{typeName(nextAppt)} · {nextAppt.duration_minutes} min</p>
                                    {nextAppt.nutritionist?.name && (
                                        <p className="mt-1 text-xs text-slate-500">com {nextAppt.nutritionist.name}</p>
                                    )}
                                </div>
                            </div>

                            {nextAppt.notes && (
                                <div className="mt-3 rounded-2xl bg-white/5 p-3 text-xs text-slate-400">{nextAppt.notes}</div>
                            )}

                            {nextAppt.is_virtual && nextAppt.meeting_link && (
                                <a
                                    href={nextAppt.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                                >
                                    <Video size={15} />Entrar na consulta
                                </a>
                            )}

                            {!nextAppt.is_virtual && nextAppt.location_address && (
                                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/5 p-3">
                                    <MapPin size={14} className="flex-shrink-0 text-slate-500" />
                                    <p className="text-xs text-slate-400">{nextAppt.location_address}</p>
                                </div>
                            )}
                        </motion.div>
                    )
                })()}

                <div className="flex gap-1 rounded-2xl bg-white/5 p-1">
                    {([['upcoming', 'Próximas'], ['past', 'Histórico']] as const).map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() => setFilter(value)}
                            className={`flex-1 rounded-xl py-2 text-sm font-bold ${filter === value ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={28} className="animate-spin text-emerald-400" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="py-12 text-center">
                        <Calendar size={44} className="mx-auto mb-3 text-slate-700" />
                        <p className="text-sm text-slate-500">{filter === 'upcoming' ? 'Nenhuma consulta agendada ainda.' : 'Sem histórico de consultas.'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {visible.map((appointment, index) => {
                                const { weekday, date, time } = formatDate(appointment.scheduled_at)
                                const meta = STATUS_META[appointment.status] || STATUS_META.scheduled
                                return (
                                    <motion.div
                                        key={appointment.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-bold text-white">{typeName(appointment)}</span>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                                </div>
                                                <p className="text-sm capitalize text-slate-400">{weekday}, {date}</p>
                                                <p className="font-bold text-slate-300">{time} · {appointment.duration_minutes} min</p>
                                                {appointment.nutritionist?.name && (
                                                    <p className="mt-1 text-xs text-slate-600">com {appointment.nutritionist.name}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {appointment.is_virtual ? (
                                                    <div className="rounded-xl bg-blue-500/10 p-2"><Video size={14} className="text-blue-400" /></div>
                                                ) : (
                                                    <div className="rounded-xl bg-slate-500/10 p-2"><MapPin size={14} className="text-slate-400" /></div>
                                                )}
                                                {appointment.is_virtual && appointment.meeting_link && ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status) && (
                                                    <a
                                                        href={appointment.meeting_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="rounded-xl bg-emerald-500/10 p-2 hover:bg-emerald-500/20"
                                                    >
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

                <p className="text-center text-[10px] text-slate-700">Horários exibidos em {timezone}</p>
            </div>
        </div>
    )
}
