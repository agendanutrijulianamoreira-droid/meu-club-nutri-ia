"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    User, Mail, Award, TrendingUp, Target, LogOut,
    ChevronRight, Scale, Activity, Flame, Calendar,
    Pencil, Check, X, ChevronDown, Loader2, Sparkles,
    Droplets, Heart, Apple, Dumbbell, Bell
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

// ─── Opções de configuração ───────────────────────────────────────────────────

const GOAL_OPTIONS = [
    { value: "emagrecimento",        label: "Emagrecer",               emoji: "⚖️" },
    { value: "anti-inflamatório",    label: "Reduzir inflamação",      emoji: "🌿" },
    { value: "intestinal",           label: "Regular o intestino",     emoji: "🦠" },
    { value: "hormonal",             label: "Equilíbrio hormonal",     emoji: "💜" },
    { value: "energia",              label: "Mais energia e disposição", emoji: "⚡" },
    { value: "hipertrofia",          label: "Ganhar massa muscular",   emoji: "💪" },
    { value: "manutenção",           label: "Manter o peso atual",     emoji: "🎯" },
    { value: "detox",                label: "Desintoxicar o organismo",emoji: "✨" },
]

const RESTRICTION_OPTIONS = [
    { value: "lactose",       label: "Sem lactose",      emoji: "🥛" },
    { value: "gluten",        label: "Sem glúten",       emoji: "🌾" },
    { value: "vegetariana",   label: "Vegetariana",      emoji: "🌿" },
    { value: "vegana",        label: "Vegana",           emoji: "🫘" },
    { value: "frutos_do_mar", label: "Sem frutos do mar",emoji: "🦐" },
    { value: "amendoim",      label: "Alergia a amendoim",emoji: "🥜" },
    { value: "ovo",           label: "Sem ovos",         emoji: "🥚" },
    { value: "soja",          label: "Sem soja",         emoji: "🌱" },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PatientProfilePage() {
    const router = useRouter()
    const [user, setUser]       = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving]   = useState(false)
    const [toast, setToast]     = useState<string | null>(null)

    // Modo edição
    const [editing, setEditing] = useState(false)

    // Campos editáveis
    const [editName,         setEditName]         = useState("")
    const [editWeight,       setEditWeight]       = useState("")
    const [editGoal,         setEditGoal]         = useState("")
    const [editRestrictions, setEditRestrictions] = useState<string[]>([])

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push("/login"); return }
            setUser(user)
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .single()
            setProfile(data)
            setLoading(false)
        }
        load()
    }, [])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 2500)
    }

    const openEdit = () => {
        setEditName(profile?.name || "")
        setEditWeight(profile?.current_weight?.toString() || "")
        setEditGoal(profile?.primary_goal || "")
        setEditRestrictions(profile?.dietary_restrictions || [])
        setEditing(true)
    }

    const cancelEdit = () => setEditing(false)

    const saveEdit = async () => {
        setSaving(true)
        const updates: any = {
            name:                 editName.trim() || profile?.name,
            primary_goal:         editGoal || null,
            dietary_restrictions: editRestrictions,
        }
        const w = parseFloat(editWeight)
        if (!isNaN(w) && w > 0) {
            updates.current_weight = w
            // Se não tem peso inicial registrado, define agora
            if (!profile?.initial_weight) updates.initial_weight = w
        }

        const { data, error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", user.id)
            .select()
            .single()

        setSaving(false)
        if (!error) {
            setProfile(data)
            setEditing(false)
            showToast("Perfil atualizado ✓")
        } else {
            showToast("Erro ao salvar — tente novamente")
        }
    }

    const toggleRestriction = (val: string) =>
        setEditRestrictions(prev =>
            prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]
        )

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    // ── Cálculo de dias no clube ──────────────────────────────────────────────
    const daysInClub = profile?.created_at
        ? Math.max(1, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000))
        : 0

    // ── Peso perdido ──────────────────────────────────────────────────────────
    const weightLost = profile?.initial_weight && profile?.current_weight
        ? Math.max(0, parseFloat((profile.initial_weight - profile.current_weight).toFixed(1)))
        : null

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="text-indigo-400 animate-spin" size={32} />
            </div>
        )
    }

    const goalMeta = GOAL_OPTIONS.find(g => g.value === profile?.primary_goal)
    const restrictions: string[] = profile?.dietary_restrictions || []

    return (
        <div className="min-h-screen px-4 pt-6 pb-28">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="fixed top-4 left-4 right-4 z-50 bg-emerald-500/90 text-white text-sm font-semibold px-4 py-3 rounded-xl text-center shadow-lg"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Avatar + nome ─────────────────────────────────────────────── */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 mb-4 text-3xl font-bold text-white shadow-lg shadow-indigo-500/30">
                    {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "R"}
                </div>
                <h1 className="text-2xl font-bold text-white mb-0.5">
                    {profile?.name || "Rainha do Reino"}
                </h1>
                <p className="text-sm text-slate-400">{user?.email}</p>

                {goalMeta && (
                    <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-full">
                        <span>{goalMeta.emoji}</span>{goalMeta.label}
                    </span>
                )}
            </div>

            {/* ── Stats ─────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                    { label: "Dias no Clube",    value: daysInClub,                         icon: Calendar,  bg: "bg-indigo-600/20",  text: "text-indigo-400",  suffix: "d" },
                    { label: "XP Total",          value: profile?.total_xp || 0,             icon: Award,     bg: "bg-violet-600/20",  text: "text-violet-400",  suffix: "" },
                    { label: "Sequência Atual",   value: profile?.current_streak || 0,       icon: Flame,     bg: "bg-orange-600/20",  text: "text-orange-400",  suffix: "d" },
                    { label: "Melhor Sequência",  value: profile?.longest_streak || 0,       icon: TrendingUp,bg: "bg-emerald-600/20", text: "text-emerald-400", suffix: "d" },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                        <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-2`}>
                            <stat.icon className={stat.text} size={18} />
                        </div>
                        <p className="text-2xl font-bold text-white">{stat.value}<span className="text-base font-normal text-slate-500 ml-0.5">{stat.suffix}</span></p>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Peso (se disponível) ──────────────────────────────────────── */}
            {profile?.current_weight && (
                <div className="mb-5 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Scale className="text-rose-400" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium mb-0.5">Peso atual</p>
                        <p className="text-white font-bold text-lg">{profile.current_weight} kg</p>
                    </div>
                    {weightLost !== null && weightLost > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Perdeu</p>
                            <p className="text-emerald-400 font-bold">−{weightLost} kg</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Restrições alimentares ────────────────────────────────────── */}
            {restrictions.length > 0 && (
                <div className="mb-5">
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Restrições alimentares</p>
                    <div className="flex gap-2 flex-wrap">
                        {restrictions.map(r => {
                            const opt = RESTRICTION_OPTIONS.find(o => o.value === r)
                            return (
                                <span key={r} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                                    {opt?.emoji} {opt?.label || r}
                                </span>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Ações ─────────────────────────────────────────────────────── */}
            <div className="space-y-2 mb-6">
                <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Configurações</h2>

                <button onClick={openEdit} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                        <Pencil className="text-slate-400" size={18} />
                        <span className="text-sm font-bold text-white">Editar perfil e objetivo</span>
                    </div>
                    <ChevronRight className="text-slate-500" size={18} />
                </button>
            </div>

            {/* ── Lembretes ─────────────────────────────────────────────────── */}
            <Link href="/patient/alarms"
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 h-14 rounded-2xl font-semibold flex items-center justify-between px-5 transition-colors text-white">
                <div className="flex items-center gap-3">
                    <Bell size={18} className="text-indigo-400"/>
                    <span className="text-sm">Meus Lembretes</span>
                </div>
                <ChevronRight size={16} className="text-slate-500"/>
            </Link>

            {/* ── Sair ──────────────────────────────────────────────────────── */}
            <button
                onClick={handleSignOut}
                className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 h-14 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
                <LogOut size={18} />Sair do Clube
            </button>

            <p className="text-center text-xs text-slate-700 mt-6">VitaClub v1.0</p>

            {/* ── Sheet de edição ───────────────────────────────────────────── */}
            <AnimatePresence>
                {editing && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={cancelEdit}
                            className="fixed inset-0 bg-black/60 z-40"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Handle */}
                            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-white">Editar perfil</h2>
                                <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-white/10">
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Nome */}
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Seu nome</label>
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                                        placeholder="Como quer ser chamada?"
                                    />
                                </div>

                                {/* Peso */}
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Peso atual (kg)</label>
                                    <input
                                        value={editWeight}
                                        onChange={e => setEditWeight(e.target.value)}
                                        type="number"
                                        step="0.1"
                                        min="30"
                                        max="250"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                                        placeholder="Ex: 68.5"
                                    />
                                    <p className="text-xs text-slate-600 mt-1.5">Usado pela IA para personalizar seu cardápio e acompanhar seu progresso.</p>
                                </div>

                                {/* Objetivo */}
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Meu objetivo principal</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {GOAL_OPTIONS.map(g => (
                                            <button
                                                key={g.value}
                                                onClick={() => setEditGoal(g.value)}
                                                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                                                    editGoal === g.value
                                                        ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                                                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                }`}
                                            >
                                                <span className="text-base">{g.emoji}</span>
                                                <span className="leading-tight">{g.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Restrições */}
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">Restrições alimentares</label>
                                    <div className="flex flex-wrap gap-2">
                                        {RESTRICTION_OPTIONS.map(r => (
                                            <button
                                                key={r.value}
                                                onClick={() => toggleRestriction(r.value)}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                                                    editRestrictions.includes(r.value)
                                                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                }`}
                                            >
                                                <span>{r.emoji}</span>{r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Salvar */}
                                <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    {saving
                                        ? <><Loader2 size={18} className="animate-spin" />Salvando...</>
                                        : <><Check size={18} />Salvar alterações</>
                                    }
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
