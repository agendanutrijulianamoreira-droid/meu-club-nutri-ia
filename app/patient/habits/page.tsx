"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
    Check, Camera, Image as ImageIcon, Loader2,
    Sparkles, Flame, Trophy, X, ZoomIn
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase-browser"

// ─── Types ────────────────────────────────────────────────────────────────────

type HitType = 'simple' | 'camera' | 'gallery'

interface Habit {
    id: string
    name: string
    emoji: string
    description: string | null
    category: string
    icon_color: string
}

interface HabitLog {
    id: string
    habit_id: string
    hit_type: HitType
    photo_url: string | null
    xp_awarded: number
}

// ─── Color map ────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string }> = {
    indigo:  { ring: 'ring-indigo-500/50',  bg: 'bg-indigo-500/15',  text: 'text-indigo-400' },
    emerald: { ring: 'ring-emerald-500/50', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    amber:   { ring: 'ring-amber-500/50',   bg: 'bg-amber-500/15',   text: 'text-amber-400' },
    rose:    { ring: 'ring-rose-500/50',    bg: 'bg-rose-500/15',    text: 'text-rose-400' },
    violet:  { ring: 'ring-violet-500/50',  bg: 'bg-violet-500/15',  text: 'text-violet-400' },
    sky:     { ring: 'ring-sky-500/50',     bg: 'bg-sky-500/15',     text: 'text-sky-400' },
}

const HIT_META: Record<HitType, { label: string; color: string; xp: number }> = {
    simple:  { label: 'Feito',    color: 'text-emerald-400',  xp: 10 },
    gallery: { label: 'Foto',     color: 'text-sky-400',      xp: 15 },
    camera:  { label: 'Câmera',   color: 'text-indigo-400',   xp: 20 },
}

// ─── Photo modal ──────────────────────────────────────────────────────────────

function PhotoModal({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button className="absolute top-5 right-5 text-white/60 hover:text-white">
                <X size={24} />
            </button>
            <img src={url} alt="Foto do hábito" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
        </motion.div>
    )
}

// ─── Habit Card ───────────────────────────────────────────────────────────────

function HabitCard({
    habit,
    log,
    onSimple,
    onPhoto,
    onUndo,
    uploading,
}: {
    habit: Habit
    log: HabitLog | undefined
    onSimple: (id: string) => void
    onPhoto: (id: string, type: 'camera' | 'gallery') => void
    onUndo: (id: string) => void
    uploading: string | null
}) {
    const [showPhoto, setShowPhoto] = useState(false)
    const colors = COLOR_MAP[habit.icon_color] ?? COLOR_MAP.indigo
    const isLoading = uploading === habit.id

    return (
        <>
            <AnimatePresence>
                {showPhoto && log?.photo_url && (
                    <PhotoModal url={log.photo_url} onClose={() => setShowPhoto(false)} />
                )}
            </AnimatePresence>

            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-slate-900/80 border rounded-3xl p-4 transition-all
                    ${log ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/8'}`}
            >
                <div className="flex items-center gap-3">
                    {/* Emoji badge */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0
                        ${log ? 'bg-emerald-500/20 ring-2 ring-emerald-500/30' : `${colors.bg} ring-1 ${colors.ring}`}`}>
                        {habit.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${log ? 'text-emerald-300' : 'text-white'}`}>
                            {habit.name}
                        </p>
                        {habit.description && !log && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{habit.description}</p>
                        )}
                        {log && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${HIT_META[log.hit_type].color}`}>
                                    {HIT_META[log.hit_type].label}
                                </span>
                                <span className="text-[10px] text-emerald-500 font-black">+{log.xp_awarded} XP</span>
                                {log.photo_url && (
                                    <button
                                        onClick={() => setShowPhoto(true)}
                                        className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                                    >
                                        <ZoomIn size={10} />
                                        ver foto
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {log ? (
                        <button
                            onClick={() => onUndo(habit.id)}
                            className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                        >
                            <Check size={18} className="text-white" />
                        </button>
                    ) : isLoading ? (
                        <div className="w-10 h-10 flex items-center justify-center">
                            <Loader2 size={18} className="animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="flex gap-1.5">
                            {/* Simple check */}
                            <button
                                onClick={() => onSimple(habit.id)}
                                className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-95 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/40"
                                title="Marcar como feito"
                            >
                                <Check size={16} className="text-slate-400" />
                            </button>
                            {/* Gallery photo */}
                            <button
                                onClick={() => onPhoto(habit.id, 'gallery')}
                                className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-95 transition-all hover:bg-sky-500/20 hover:border-sky-500/40"
                                title="Enviar foto da galeria (+15 XP)"
                            >
                                <ImageIcon size={16} className="text-slate-400" />
                            </button>
                            {/* Camera photo */}
                            <button
                                onClick={() => onPhoto(habit.id, 'camera')}
                                className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-95 transition-all hover:bg-indigo-500/20 hover:border-indigo-500/40"
                                title="Tirar foto agora (+20 XP)"
                            >
                                <Camera size={16} className="text-slate-400" />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([])
    const [logs, setLogs] = useState<Record<string, HabitLog>>({})
    const [orientation, setOrientation] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [xpFlash, setXpFlash] = useState<number | null>(null)
    const [streak, setStreak] = useState(0)

    const cameraRef = useRef<HTMLInputElement>(null)
    const galleryRef = useRef<HTMLInputElement>(null)
    const pendingHabitRef = useRef<{ id: string; type: 'camera' | 'gallery' } | null>(null)

    const loadData = useCallback(async () => {
        const res = await fetch('/api/patient/habits')
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setHabits(data.habits as Habit[])
        setLogs(data.logs as Record<string, HabitLog>)
        setOrientation(data.orientation)
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
        // Load streak
        supabase.auth.getUser().then((res) => {
            const user = res.data?.user
            if (!user) return
            supabase.from('profiles').select('current_streak').eq('user_id', user.id).single()
                .then(({ data }: { data: { current_streak: number } | null }) => { if (data) setStreak(data.current_streak || 0) })
        })
    }, [loadData])

    const flashXP = (xp: number) => {
        setXpFlash(xp)
        setTimeout(() => setXpFlash(null), 1800)
    }

    const handleSimple = async (habitId: string) => {
        setLogs(prev => ({ ...prev, [habitId]: { id: '', habit_id: habitId, hit_type: 'simple', photo_url: null, xp_awarded: 10 } }))
        const res = await fetch('/api/patient/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habit_id: habitId, hit_type: 'simple' }),
        })
        if (res.ok) {
            const { xp_awarded } = await res.json()
            flashXP(xp_awarded)
        } else {
            setLogs(prev => { const n = { ...prev }; delete n[habitId]; return n })
        }
    }

    const handleUndo = async (habitId: string) => {
        const prev = { ...logs }
        setLogs(l => { const n = { ...l }; delete n[habitId]; return n })
        const res = await fetch('/api/patient/habits', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habit_id: habitId }),
        })
        if (!res.ok) setLogs(prev)
    }

    const handlePhotoSelect = (habitId: string, type: 'camera' | 'gallery') => {
        pendingHabitRef.current = { id: habitId, type }
        if (type === 'camera') cameraRef.current?.click()
        else galleryRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, hitType: 'camera' | 'gallery') => {
        const file = e.target.files?.[0]
        const pending = pendingHabitRef.current
        if (!file || !pending) return

        const habitId = pending.id
        setUploading(habitId)
        e.target.value = ''

        try {
            const { data: authData } = await supabase.auth.getUser()
            const user = authData.user
            if (!user) throw new Error('no user')

            const ext = file.name.split('.').pop() ?? 'jpg'
            const path = `${user.id}/${habitId}/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage
                .from('habit-photos')
                .upload(path, file, { upsert: true })

            let photoUrl: string | null = null
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('habit-photos').getPublicUrl(path)
                photoUrl = urlData.publicUrl
            }

            const res = await fetch('/api/patient/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habit_id: habitId, hit_type: hitType, photo_url: photoUrl }),
            })
            if (res.ok) {
                const { xp_awarded } = await res.json()
                flashXP(xp_awarded)
                await loadData()
            }
        } catch (err) {
            console.error('[habits photo]', err)
        } finally {
            setUploading(null)
            pendingHabitRef.current = null
        }
    }

    const completedCount = habits.filter(h => logs[h.id]).length
    const totalXpToday = (Object.values(logs) as HabitLog[]).reduce((sum, l) => sum + (l.xp_awarded || 0), 0)
    const allDone = habits.length > 0 && completedCount === habits.length

    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

    return (
        <div className="max-w-[430px] mx-auto px-4 pt-6 pb-28">
            {/* Hidden file inputs */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFileChange(e, 'camera')}
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFileChange(e, 'gallery')}
            />

            {/* XP flash */}
            <AnimatePresence>
                {xpFlash && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8 }}
                        className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                    >
                        <Sparkles size={16} className="text-white" />
                        <span className="text-white font-black text-base">+{xpFlash} XP</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1 capitalize">{today}</p>
                <h1 className="text-2xl font-bold text-white">Meus Hábitos</h1>

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl flex-1">
                        <Flame size={15} className="text-orange-400" />
                        <span className="font-black text-white text-base leading-none">{streak}</span>
                        <span className="text-[10px] text-orange-400/70 uppercase font-black tracking-widest ml-auto">Streak</span>
                    </div>
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-xl flex-1">
                        <Sparkles size={15} className="text-yellow-400" />
                        <span className="font-black text-white text-base leading-none">{totalXpToday}</span>
                        <span className="text-[10px] text-yellow-400/70 uppercase font-black tracking-widest ml-auto">XP hoje</span>
                    </div>
                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl flex-1">
                        <Trophy size={15} className="text-indigo-400" />
                        <span className="font-black text-white text-base leading-none">{completedCount}/{habits.length}</span>
                        <span className="text-[10px] text-indigo-400/70 uppercase font-black tracking-widest ml-auto">Feitos</span>
                    </div>
                </div>

                {/* Progress bar */}
                {habits.length > 0 && (
                    <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedCount / habits.length) * 100}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                )}
            </div>

            {/* Completion celebration */}
            <AnimatePresence>
                {allDone && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="mb-5 p-4 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 rounded-3xl text-center"
                    >
                        <p className="text-2xl mb-1">🏆</p>
                        <p className="text-emerald-300 font-bold text-sm">Todos os hábitos concluídos!</p>
                        <p className="text-emerald-500/70 text-xs mt-0.5">+{totalXpToday} XP ganhos hoje</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                        <Check size={11} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-600 font-bold">+10 XP</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                        <ImageIcon size={11} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-600 font-bold">+15 XP</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                        <Camera size={11} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-600 font-bold">+20 XP</span>
                </div>
                <span className="text-[10px] text-slate-700 ml-auto">foto = mais XP</span>
            </div>

            {/* Habits list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-slate-600" />
                </div>
            ) : habits.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-4xl mb-3">🌱</p>
                    <p className="text-slate-400 font-bold">Nenhum hábito configurado ainda</p>
                    <p className="text-slate-600 text-sm mt-1">Sua nutricionista vai configurar seus hábitos em breve.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {habits.map(habit => {
                        const h = habit as Habit
                        const l = logs[h.id] as HabitLog | undefined
                        return (
                            <React.Fragment key={h.id}>
                                <HabitCard
                                    habit={h}
                                    log={l}
                                    onSimple={(id) => { handleSimple(id) }}
                                    onPhoto={handlePhotoSelect}
                                    onUndo={(id) => { handleUndo(id) }}
                                    uploading={uploading as string | null}
                                />
                            </React.Fragment>
                        )
                    })}
                </div>
            )}

            {/* Orientation */}
            {orientation && (
                <div className="mt-6 p-4 bg-white/[0.03] border border-white/8 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-2">Orientações</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{orientation}</p>
                </div>
            )}
        </div>
    )
}
