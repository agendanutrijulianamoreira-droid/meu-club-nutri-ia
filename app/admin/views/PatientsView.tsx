"use client"

import { useState, useEffect } from "react"
import {
    Search,
    Bell,
    Gift,
    Zap,
    TrendingUp,
    AlertTriangle,
    MessageCircle,
    Shield,
    MoreVertical,
    Smartphone,
    Lock,
    Activity,
    Calendar,
    Star,
    Crown,
    Trophy,
    Flame,
    CheckCircle,
    XCircle,
    ExternalLink,
    Mail,
    Phone,
    MapPin,
    Clock,
    Target,
    Award,
    ChevronRight,
    Loader2,
    Sparkles,
    Send,
    Heart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { usePatients } from "@/lib/hooks/useDatabase"

interface Patient {
    id: number
    name: string
    email: string
    phone: string
    plan: string
    avatar: string
    status: 'risk' | 'active' | 'star'
    engagement: number
    lastLogin: string
    startDate: string
    aiSummary: string
    badges: string[]
    xp: number
    level: number
    streak: number
    phase: number
    weight: { current: number; goal: number; start: number }
    birthday?: string
    pushSettings: {
        reminders: boolean
        marketing: boolean
        challenges: boolean
    }
}

// MOCK_PATIENTS removed in favor of usePatients hook

export function PatientsView({ setView }: { setView: (v: any) => void }) {
    const { patients: dbPatients, loading, refresh } = usePatients()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'history'>('overview')
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<'all' | 'risk' | 'star' | 'active'>('all')
    const [sendingMessage, setSendingMessage] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [registering, setRegistering] = useState(false)
    const [newPatient, setNewPatient] = useState({
        name: '',
        email: '',
        phone: '',
        password: 'ChangeMe123!',
        plan: 'tech_diet'
    })
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    // Clear notification after 5s
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [notification])

    // Map DB patients to the View's interface
    const patients = dbPatients.map(p => ({
        id: p.id,
        name: p.full_name || p.name || 'Sem nome',
        email: p.email || '',
        phone: p.phone || '',
        plan: p.current_plan || 'Nenhum',
        avatar: (p.full_name || p.name || '?').substring(0, 2).toUpperCase(),
        status: (p.current_streak > 3 ? 'star' : 'active') as any, // Simple logic for now
        engagement: Math.min(100, Math.floor(Math.random() * 40 + 60)), // Mock engagement for now
        lastLogin: p.last_checkin_date ? new Date(p.last_checkin_date).toLocaleDateString() : 'Nunca',
        startDate: new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        aiSummary: 'Análise automática indisponível no momento.',
        badges: [],
        xp: p.total_points || 0,
        level: p.current_level || 1,
        streak: p.current_streak || 0,
        phase: 1,
        weight: { current: 0, goal: 0, start: 0 }
    }))

    useEffect(() => {
        if (patients.length > 0 && !selectedId) {
            setSelectedId(patients[0].id)
        }
    }, [patients])

    // Sort patients: risk first, then stars, then active
    const sortedPatients = [...patients]
        .filter(p => {
            if (filterStatus !== 'all' && p.status !== filterStatus) return false
            if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !p.email.toLowerCase().includes(searchQuery.toLowerCase())) return false
            return true
        })
        .sort((a, b) => {
            const order = { risk: 0, star: 1, active: 2 }
            return order[a.status as keyof typeof order] - order[b.status as keyof typeof order]
        })

    const activePatient = patients.find(p => p.id === selectedId)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'risk': return 'bg-red-900/50 text-red-400 border-red-900'
            case 'star': return 'bg-yellow-900/50 text-yellow-400 border-yellow-900'
            default: return 'bg-gray-700 text-gray-300 border-gray-600'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'risk': return <AlertTriangle size={14} className="text-red-500" />
            case 'star': return <Star size={14} className="text-yellow-500 fill-yellow-500" />
            default: return null
        }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setRegistering(true)
        try {
            const res = await fetch('/api/admin/create-patient', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPatient)
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')

            setNotification({ type: 'success', message: 'Rainha cadastrada com sucesso! Dados de acesso enviados.' })
            setShowAddModal(false)
            refresh()
        } catch (err: any) {
            setNotification({ type: 'error', message: err.message })
        } finally {
            setRegistering(false)
        }
    }

    const riskCount = patients.filter(p => p.status === 'risk').length
    const starCount = patients.filter(p => p.status === 'star').length

    return (
        <div className="flex h-[calc(100vh-80px)] bg-[#0a0a16] text-white overflow-hidden -m-8 relative">
            {/* Global Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 20 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full border shadow-2xl font-bold text-sm ${
                            notification.type === 'success' 
                                ? 'bg-green-600/20 border-green-500/50 text-green-400' 
                                : 'bg-red-600/20 border-red-500/50 text-red-400'
                        }`}
                    >
                        {notification.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== LEFT COLUMN: SMART LIST ===== */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-[#0f0f1a]">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Crown className="text-queen-pink" size={20} />
                            Minhas Rainhas
                            <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400">
                                {patients.length}
                            </span>
                        </h2>
                        <Button 
                            onClick={() => setShowAddModal(true)}
                            className="bg-purple-600 hover:bg-purple-500 rounded-full w-8 h-8 p-0"
                        >
                            +
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 text-sm focus:border-purple-500 outline-none transition"
                            placeholder="Buscar por nome ou email..."
                        />
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="flex gap-2 px-6 mb-4 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-full border transition ${filterStatus === 'all'
                            ? 'bg-purple-600/20 text-purple-400 border-purple-600/30'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('risk')}
                        className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-full border transition flex items-center gap-1 ${filterStatus === 'risk'
                            ? 'bg-red-600/20 text-red-400 border-red-600/30'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                            }`}
                    >
                        <AlertTriangle size={12} />
                        Atenção ({riskCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('star')}
                        className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-full border transition flex items-center gap-1 ${filterStatus === 'star'
                            ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                            }`}
                    >
                        <Star size={12} />
                        Exemplares ({starCount})
                    </button>
                </div>

                {/* Patient List */}
                <div className="flex-1 overflow-y-auto">
                    {sortedPatients.map((patient) => (
                        <motion.div
                            key={patient.id}
                            onClick={() => setSelectedId(patient.id)}
                            whileHover={{ x: 4 }}
                            className={`p-4 border-b border-white/5 cursor-pointer transition flex items-center gap-3 ${selectedId === patient.id
                                ? 'bg-purple-500/10 border-l-4 border-l-purple-500'
                                : 'hover:bg-white/5'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${getStatusColor(patient.status)}`}>
                                {patient.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-sm truncate">{patient.name}</h4>
                                    {getStatusIcon(patient.status)}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{patient.plan}</p>
                            </div>
                            {patient.streak > 0 && (
                                <div className="text-xs text-orange-400 flex items-center gap-1">
                                    <Flame size={12} />
                                    {patient.streak}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* ===== RIGHT COLUMN: PATIENT DOSSIER ===== */}
            {activePatient && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">

                    {/* Profile Header */}
                    <div className="p-8 border-b border-white/5 bg-[#131320]">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-5">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 p-[2px]">
                                    <div className="w-full h-full bg-gray-900 rounded-full flex items-center justify-center text-2xl font-bold">
                                        {activePatient.avatar}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-2xl font-bold">{activePatient.name}</h1>
                                        {activePatient.status === 'star' && (
                                            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                <Star size={12} className="fill-yellow-400" /> Exemplar
                                            </span>
                                        )}
                                        {activePatient.status === 'risk' && (
                                            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                <AlertTriangle size={12} /> Atenção
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-400 mt-2 text-sm">
                                        <span className="flex items-center gap-1">
                                            <Shield size={14} /> {activePatient.plan}
                                        </span>
                                        <span>• Desde {activePatient.startDate}</span>
                                    </div>
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        {activePatient.badges.map(b => (
                                            <span key={b} className="text-[10px] uppercase font-bold bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/10">
                                                {b}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    className="bg-green-600 hover:bg-green-500 font-bold"
                                    onClick={() => window.open(`https://wa.me/55${activePatient.phone.replace(/\D/g, '')}`, '_blank')}
                                >
                                    <MessageCircle size={18} className="mr-2" />
                                    WhatsApp
                                </Button>
                                <Button variant="ghost" className="border border-white/10">
                                    <MoreVertical size={20} />
                                </Button>
                            </div>
                        </div>

                        {/* Internal Navigation */}
                        <div className="flex gap-8 mt-8">
                            {[
                                { id: 'overview', label: 'Visão Geral & IA', icon: Sparkles },
                                { id: 'settings', label: 'Permissões & Push', icon: Bell },
                                { id: 'history', label: 'Histórico & Metas', icon: Target }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === tab.id
                                        ? 'text-white border-purple-500'
                                        : 'text-gray-500 border-transparent hover:text-gray-300'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a16]">

                        {/* TAB 1: OVERVIEW & AI */}
                        {activeTab === 'overview' && (
                            <div className="max-w-4xl space-y-6">

                                {/* AI Assistant Card */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-2xl p-6 border ${activePatient.status === 'risk'
                                        ? 'bg-gradient-to-r from-red-900/20 to-orange-900/10 border-red-500/30'
                                        : activePatient.status === 'star'
                                            ? 'bg-gradient-to-r from-yellow-900/20 to-amber-900/10 border-yellow-500/30'
                                            : 'bg-gradient-to-r from-purple-900/20 to-blue-900/10 border-purple-500/30'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl shadow-lg ${activePatient.status === 'risk'
                                            ? 'bg-red-600 shadow-red-900/50'
                                            : activePatient.status === 'star'
                                                ? 'bg-yellow-600 shadow-yellow-900/50'
                                                : 'bg-purple-600 shadow-purple-900/50'
                                            }`}>
                                            <Zap className="text-white" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-white mb-2">
                                                Análise da Assistente IA
                                            </h3>
                                            <p className="text-gray-300 leading-relaxed">
                                                "{activePatient.aiSummary}"
                                            </p>

                                            <div className="mt-4 flex gap-3">
                                                {activePatient.status === 'risk' && (
                                                    <>
                                                        <Button
                                                            onClick={handleSendRescueMessage}
                                                            disabled={sendingMessage}
                                                            className="bg-red-600/20 border border-red-500/50 text-red-300 hover:bg-red-600 hover:text-white"
                                                        >
                                                            {sendingMessage ? (
                                                                <Loader2 size={16} className="animate-spin mr-2" />
                                                            ) : (
                                                                <Heart size={16} className="mr-2" />
                                                            )}
                                                            Enviar Mensagem de Resgate
                                                        </Button>
                                                        <Button variant="ghost" className="border border-white/10">
                                                            Ver Último Check-in
                                                        </Button>
                                                    </>
                                                )}
                                                {activePatient.status === 'star' && (
                                                    <>
                                                        <Button className="bg-yellow-600/20 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-600 hover:text-black">
                                                            <Trophy size={16} className="mr-2" />
                                                            Enviar Parabéns
                                                        </Button>
                                                        <Button variant="ghost" className="border border-white/10">
                                                            Solicitar Depoimento
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="glass-panel p-5 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Aderência</span>
                                            <Activity size={16} className={activePatient.engagement < 50 ? 'text-red-500' : 'text-green-500'} />
                                        </div>
                                        <div className="text-3xl font-bold mb-2">{activePatient.engagement}%</div>
                                        <div className="w-full bg-white/5 h-1.5 rounded-full">
                                            <div
                                                className={`h-full rounded-full transition-all ${activePatient.engagement < 50 ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: `${activePatient.engagement}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Média: 68%</p>
                                    </div>

                                    <div className="glass-panel p-5 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-gray-500 text-xs font-bold uppercase">XP Total</span>
                                            <Sparkles size={16} className="text-purple-400" />
                                        </div>
                                        <div className="text-3xl font-bold text-purple-400">{activePatient.xp.toLocaleString()}</div>
                                        <p className="text-xs text-gray-500 mt-2">Nível {activePatient.level}</p>
                                    </div>

                                    <div className="glass-panel p-5 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Streak</span>
                                            <Flame size={16} className={activePatient.streak > 0 ? 'text-orange-400' : 'text-gray-600'} />
                                        </div>
                                        <div className="text-3xl font-bold text-orange-400">
                                            {activePatient.streak}
                                            <span className="text-lg text-gray-500 ml-1">dias</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Recorde: 45 dias</p>
                                    </div>

                                    <div className="glass-panel p-5 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Fase</span>
                                            <Lock size={16} className="text-yellow-500" />
                                        </div>
                                        <div className="text-3xl font-bold">{activePatient.phase}</div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Próxima: Fase {activePatient.phase + 1}
                                        </p>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="glass-panel p-6 rounded-xl border border-white/5">
                                    <h4 className="font-bold mb-4 text-gray-400 text-sm uppercase tracking-wider">Informações de Contato</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="flex items-center gap-3">
                                            <Mail size={18} className="text-gray-500" />
                                            <span className="text-sm">{activePatient.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Phone size={18} className="text-gray-500" />
                                            <span className="text-sm">{activePatient.phone}</span>
                                        </div>
                                        {activePatient.birthday && (
                                            <div className="flex items-center gap-3">
                                                <Gift size={18} className="text-pink-500" />
                                                <span className="text-sm">Aniversário: {activePatient.birthday}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: SETTINGS & PUSH */}
                        {activeTab === 'settings' && (
                            <div className="max-w-2xl space-y-8">

                                {/* Push Notifications */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Bell className="text-yellow-500" size={20} />
                                        Controle de Notificações (Push)
                                    </h3>
                                    <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
                                        {[
                                            { key: 'reminders', title: 'Lembretes de Rotina', desc: 'Água, Check-in, Refeições', default: activePatient.pushSettings.reminders },
                                            { key: 'marketing', title: 'Propagandas & Ofertas', desc: 'Upsell de consultas e novos produtos', default: activePatient.pushSettings.marketing },
                                            { key: 'challenges', title: 'Desafios da Comunidade', desc: 'Avisos sobre rankings e missões', default: activePatient.pushSettings.challenges }
                                        ].map((item, idx) => (
                                            <div
                                                key={item.key}
                                                className={`p-4 flex justify-between items-center ${idx < 2 ? 'border-b border-white/5' : ''}`}
                                            >
                                                <div>
                                                    <h4 className="font-bold">{item.title}</h4>
                                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" defaultChecked={item.default} />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Celebration Automation */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Gift className="text-pink-500" size={20} />
                                        Automação de Celebração
                                    </h3>
                                    <div className="glass-panel rounded-xl border border-white/5 p-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-pink-900/30 p-2 rounded-lg text-pink-400">
                                                    <Calendar size={18} />
                                                </div>
                                                <span className="font-bold">
                                                    Aniversário ({activePatient.birthday || 'Não informado'})
                                                </span>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${activePatient.birthday
                                                ? 'text-green-400 bg-green-900/20'
                                                : 'text-gray-400 bg-white/5'
                                                }`}>
                                                {activePatient.birthday ? 'Agendado' : 'Sem data'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-yellow-900/30 p-2 rounded-lg text-yellow-400">
                                                    <TrendingUp size={18} />
                                                </div>
                                                <span className="font-bold">Bater Meta de Peso</span>
                                            </div>
                                            <span className="text-xs font-bold text-purple-400 bg-purple-900/20 px-2 py-1 rounded">
                                                Automático (IA)
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-900/30 p-2 rounded-lg text-orange-400">
                                                    <Flame size={18} />
                                                </div>
                                                <span className="font-bold">Streak de 30 Dias</span>
                                            </div>
                                            <span className="text-xs font-bold text-purple-400 bg-purple-900/20 px-2 py-1 rounded">
                                                Automático (IA)
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-500 pt-4 border-t border-white/5">
                                            * O sistema enviará um cartão virtual e uma notificação push personalizada quando esses eventos ocorrerem.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: HISTORY & GOALS */}
                        {activeTab === 'history' && (
                            <div className="max-w-3xl space-y-6">

                                {/* Weight Progress */}
                                <div className="glass-panel p-6 rounded-xl border border-white/5">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <TrendingUp className="text-green-400" size={20} />
                                        Progresso de Peso
                                    </h3>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Início</p>
                                            <p className="text-2xl font-bold">{activePatient.weight.start}kg</p>
                                        </div>
                                        <div className="flex-1 mx-8">
                                            <div className="relative h-2 bg-white/5 rounded-full">
                                                <div
                                                    className="absolute h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                                    style={{
                                                        width: `${Math.min(100, ((activePatient.weight.start - activePatient.weight.current) / (activePatient.weight.start - activePatient.weight.goal)) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Meta</p>
                                            <p className="text-2xl font-bold text-green-400">{activePatient.weight.goal}kg</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-400">
                                            Peso Atual: <span className="font-bold text-white">{activePatient.weight.current}kg</span>
                                            {activePatient.weight.current <= activePatient.weight.goal && (
                                                <span className="text-green-400 ml-2">🎉 Meta atingida!</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Activity Timeline */}
                                <div className="glass-panel p-6 rounded-xl border border-white/5">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Clock className="text-blue-400" size={20} />
                                        Atividade Recente
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { time: 'Hoje, 09:00', action: 'Check-in do café da manhã', type: 'checkin' },
                                            { time: 'Ontem, 18:30', action: 'Completou missão "Beber 2L água"', type: 'mission' },
                                            { time: 'Ontem, 12:15', action: 'Enviou foto do almoço', type: 'photo' },
                                            { time: '2 dias atrás', action: 'Desbloqueou badge "Hidratação Master"', type: 'badge' },
                                            { time: '3 dias atrás', action: 'Atingiu 1000 XP', type: 'xp' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type === 'checkin' ? 'bg-green-900/30 text-green-400' :
                                                    item.type === 'mission' ? 'bg-purple-900/30 text-purple-400' :
                                                        item.type === 'photo' ? 'bg-blue-900/30 text-blue-400' :
                                                            item.type === 'badge' ? 'bg-yellow-900/30 text-yellow-400' :
                                                                'bg-pink-900/30 text-pink-400'
                                                    }`}>
                                                    {item.type === 'checkin' && <CheckCircle size={16} />}
                                                    {item.type === 'mission' && <Target size={16} />}
                                                    {item.type === 'photo' && <Smartphone size={16} />}
                                                    {item.type === 'badge' && <Award size={16} />}
                                                    {item.type === 'xp' && <Sparkles size={16} />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{item.action}</p>
                                                    <p className="text-xs text-gray-500">{item.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ===== MODAL: CADASTRAR RAINHA ===== */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#131320] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
                                Cadastrar Nova Rainha
                            </h2>
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                                    <input 
                                        required
                                        value={newPatient.name}
                                        onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500"
                                        placeholder="Ex: Ana Souza"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">E-mail de Acesso</label>
                                    <input 
                                        required
                                        type="email"
                                        value={newPatient.email}
                                        onChange={e => setNewPatient({...newPatient, email: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500"
                                        placeholder="ana@exemplo.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">WhatsApp</label>
                                    <input 
                                        required
                                        value={newPatient.phone}
                                        onChange={e => setNewPatient({...newPatient, phone: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500"
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Senha Provisória</label>
                                    <input 
                                        required
                                        value={newPatient.password}
                                        onChange={e => setNewPatient({...newPatient, password: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500"
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        className="flex-1"
                                        onClick={() => setShowAddModal(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button 
                                        type="submit"
                                        disabled={registering}
                                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 font-bold"
                                    >
                                        {registering ? <Loader2 className="animate-spin" /> : 'Finalizar Cadastro'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading && patients.length === 0 && (
                <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center">
                    <Loader2 className="animate-spin text-purple-500" size={40} />
                </div>
            )}
        </div>
    )
}
