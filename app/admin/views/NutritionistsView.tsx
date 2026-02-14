"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
    UserPlus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    DollarSign,
    Calendar,
    Shield,
    CheckCircle,
    XCircle,
    TrendingUp,
    Users,
    Award,
    Copy,
    ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/glass-card"

interface Nutritionist {
    id: string
    name: string
    email: string
    avatar_url: string | null
    crn: string | null
    specialties: string[]
    commission_enabled: boolean
    commission_rate: number
    referral_code: string | null
    is_moderator: boolean
    calendar_enabled: boolean
    is_active: boolean
    // Stats (joined from views)
    total_referrals?: number
    converted_referrals?: number
    total_earned?: number
    upcoming_appointments?: number
}

export function NutritionistsView({ setView }: { setView: (view: any) => void }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")
    const [showAddModal, setShowAddModal] = useState(false)

    // Mock data - substituir por dados reais do Supabase
    const nutritionists: Nutritionist[] = [
        {
            id: "1",
            name: "Dra. Ana Paula Silva",
            email: "ana.silva@example.com",
            avatar_url: "https://api.dicebear.com/9.x/micah/svg?seed=ana",
            crn: "CRN-3 12345",
            specialties: ["Esportiva", "Clínica"],
            commission_enabled: true,
            commission_rate: 10,
            referral_code: "ANA1234",
            is_moderator: true,
            calendar_enabled: true,
            is_active: true,
            total_referrals: 23,
            converted_referrals: 15,
            total_earned: 1450.00,
            upcoming_appointments: 8
        },
        {
            id: "2",
            name: "Dr. Carlos Mendes",
            email: "carlos.mendes@example.com",
            avatar_url: "https://api.dicebear.com/9.x/micah/svg?seed=carlos",
            crn: "CRN-3 54321",
            specialties: ["Estética", "Anti-aging"],
            commission_enabled: true,
            commission_rate: 15,
            referral_code: "CAR5678",
            is_moderator: false,
            calendar_enabled: true,
            is_active: true,
            total_referrals: 45,
            converted_referrals: 32,
            total_earned: 3890.50,
            upcoming_appointments: 12
        },
        {
            id: "3",
            name: "Dra. Mariana Costa",
            email: "mariana.costa@example.com",
            avatar_url: "https://api.dicebear.com/9.x/micah/svg?seed=mariana",
            crn: "CRN-3 98765",
            specialties: ["Pediátrica", "Gestante"],
            commission_enabled: false,
            commission_rate: 0,
            referral_code: null,
            is_moderator: false,
            calendar_enabled: false,
            is_active: true,
            total_referrals: 0,
            converted_referrals: 0,
            total_earned: 0,
            upcoming_appointments: 0
        }
    ]

    const filteredNutritionists = nutritionists.filter(n => {
        const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.email.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = filterStatus === "all" ||
            (filterStatus === "active" && n.is_active) ||
            (filterStatus === "inactive" && !n.is_active)
        return matchesSearch && matchesFilter
    })

    const stats = {
        total: nutritionists.length,
        active: nutritionists.filter(n => n.is_active).length,
        withCommission: nutritionists.filter(n => n.commission_enabled).length,
        withCalendar: nutritionists.filter(n => n.calendar_enabled).length,
        moderators: nutritionists.filter(n => n.is_moderator).length
    }

    const copyReferralCode = (code: string) => {
        navigator.clipboard.writeText(code)
        // TODO: mostrar toast de sucesso
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                        Nutricionistas
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Gerencie sua equipe, comissões e agendas
                    </p>
                </div>
                <Button
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 border-none h-14 px-8 font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl shadow-indigo-900/40 gap-3"
                >
                    <UserPlus size={20} />
                    Adicionar Nutricionista
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-6">
                <GlassCard className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Total
                            </p>
                            <p className="text-3xl font-black text-white mt-2">{stats.total}</p>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                            <Users size={24} className="text-indigo-400" />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Ativos
                            </p>
                            <p className="text-3xl font-black text-emerald-400 mt-2">{stats.active}</p>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                            <CheckCircle size={24} className="text-emerald-400" />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Com Comissão
                            </p>
                            <p className="text-3xl font-black text-amber-400 mt-2">{stats.withCommission}</p>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-amber-600/20 flex items-center justify-center">
                            <DollarSign size={24} className="text-amber-400" />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Com Agenda
                            </p>
                            <p className="text-3xl font-black text-violet-400 mt-2">{stats.withCalendar}</p>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-violet-600/20 flex items-center justify-center">
                            <Calendar size={24} className="text-violet-400" />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Moderadores
                            </p>
                            <p className="text-3xl font-black text-pink-400 mt-2">{stats.moderators}</p>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-pink-600/20 flex items-center justify-center">
                            <Shield size={24} className="text-pink-400" />
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Search & Filters */}
            <GlassCard className="p-6">
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterStatus("all")}
                            className={`h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterStatus === "all"
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-950/50 text-slate-500 hover:text-white border border-white/10"
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterStatus("active")}
                            className={`h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterStatus === "active"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-950/50 text-slate-500 hover:text-white border border-white/10"
                                }`}
                        >
                            Ativos
                        </button>
                        <button
                            onClick={() => setFilterStatus("inactive")}
                            className={`h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${filterStatus === "inactive"
                                ? "bg-slate-600 text-white"
                                : "bg-slate-950/50 text-slate-500 hover:text-white border border-white/10"
                                }`}
                        >
                            Inativos
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Nutritionists List */}
            <div className="grid gap-6">
                {filteredNutritionists.map((nutritionist) => (
                    <motion.div
                        key={nutritionist.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <GlassCard className="p-6 hover:border-indigo-500/30 transition-all">
                            <div className="flex items-start justify-between">
                                {/* Left: Info */}
                                <div className="flex items-start gap-6 flex-1">
                                    {/* Avatar */}
                                    <div className="h-20 w-20 rounded-2xl border-2 border-white/10 overflow-hidden bg-slate-900">
                                        {nutritionist.avatar_url ? (
                                            <img
                                                src={nutritionist.avatar_url}
                                                alt={nutritionist.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                <Users size={32} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-white">{nutritionist.name}</h3>
                                            {!nutritionist.is_active && (
                                                <span className="px-3 py-1 rounded-full bg-slate-600/20 border border-slate-500/30 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Inativo
                                                </span>
                                            )}
                                            {nutritionist.is_moderator && (
                                                <span className="px-3 py-1 rounded-full bg-pink-600/20 border border-pink-500/30 text-[10px] font-black uppercase tracking-widest text-pink-400 flex items-center gap-1">
                                                    <Shield size={12} />
                                                    Moderador
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-6 text-sm text-slate-400">
                                            <span>{nutritionist.email}</span>
                                            {nutritionist.crn && (
                                                <>
                                                    <span className="text-slate-600">•</span>
                                                    <span>{nutritionist.crn}</span>
                                                </>
                                            )}
                                        </div>

                                        {nutritionist.specialties.length > 0 && (
                                            <div className="flex items-center gap-2 mt-3">
                                                {nutritionist.specialties.map((spec) => (
                                                    <span
                                                        key={spec}
                                                        className="px-3 py-1 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-400"
                                                    >
                                                        {spec}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Stats mini */}
                                        <div className="flex items-center gap-6 mt-4">
                                            {nutritionist.commission_enabled && (
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={14} className="text-amber-400" />
                                                    <span className="text-xs text-slate-400">
                                                        {nutritionist.commission_rate}% comissão • R$ {nutritionist.total_earned?.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {nutritionist.calendar_enabled && (
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-violet-400" />
                                                    <span className="text-xs text-slate-400">
                                                        {nutritionist.upcoming_appointments} consultas
                                                    </span>
                                                </div>
                                            )}
                                            {nutritionist.total_referrals && nutritionist.total_referrals > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp size={14} className="text-emerald-400" />
                                                    <span className="text-xs text-slate-400">
                                                        {nutritionist.converted_referrals}/{nutritionist.total_referrals} conversões
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Referral Code */}
                                        {nutritionist.referral_code && (
                                            <div className="mt-4 flex items-center gap-2">
                                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-950/50 border border-white/10">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        Código:
                                                    </span>
                                                    <span className="text-sm font-bold text-white">
                                                        {nutritionist.referral_code}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => copyReferralCode(nutritionist.referral_code!)}
                                                    className="h-10 w-10 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 transition-all"
                                                    title="Copiar código"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 w-10 rounded-xl bg-slate-950/50 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400"
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 w-10 rounded-xl bg-slate-950/50 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400"
                                        title="Remover"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </div>

            {filteredNutritionists.length === 0 && (
                <GlassCard className="p-12 text-center">
                    <Users size={48} className="mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400 text-lg">
                        Nenhum nutricionista encontrado
                    </p>
                </GlassCard>
            )}

            {/* TODO: Add Modal for creating/editing nutritionist */}
        </div>
    )
}
