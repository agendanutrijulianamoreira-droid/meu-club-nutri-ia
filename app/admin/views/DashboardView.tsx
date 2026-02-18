"use client"

import { useState, useEffect } from "react"
import {
    TrendingUp,
    Users,
    AlertCircle,
    MessageCircle,
    CheckCircle,
    ChevronRight,
    Lock,
    Crown,
    DollarSign,
    ArrowUpRight,
    Zap,
    Calendar,
    Mic,
    Trophy,
    Send,
    Instagram,
    Sparkles,
    Brain,
    Activity
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface InboxItem {
    id: number
    name: string
    status: 'risk' | 'question' | 'win'
    msg: string
    time: string
    initials: string
}

interface TopQueen {
    id: number
    name: string
    initials: string
    xp: number
    progress: number
    rank: 1 | 2 | 3
}

export function DashboardView({ setView, userName = '', tenantName = '', tenantId = '' }: { setView: (v: any) => void, userName?: string, tenantName?: string, tenantId?: string }) {
    const [methodName, setMethodName] = useState<string>("")
    const [activeProtocol, setActiveProtocol] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [greeting, setGreeting] = useState("")
    const [stats, setStats] = useState({
        revenue: "0,00",
        activeQueens: 0,
        upsellReady: 12,
        protocolAdhesion: 82,
        protocolDay: 3,
        protocolTotal: 21
    })

    // Mock Data - Inbox (convert to real data later)
    const [inboxItems] = useState<InboxItem[]>([
        { id: 1, name: 'Maria Silva', initials: 'MS', status: 'risk', msg: 'Não fez check-in há 3 dias', time: '2h' },
        { id: 2, name: 'Ana Souza', initials: 'AS', status: 'question', msg: 'Dúvida sobre suplemento', time: '5h' },
        { id: 3, name: 'Carla Dias', initials: 'CD', status: 'win', msg: 'Bateu a meta de água!', time: '10m' },
    ])

    // Mock Data - Top Rainhas
    const [topQueens] = useState<TopQueen[]>([
        { id: 1, name: 'Júlia Dias', initials: 'JD', xp: 980, progress: 98, rank: 1 },
        { id: 2, name: 'Ana Maria', initials: 'AM', xp: 850, progress: 85, rank: 2 },
        { id: 3, name: 'Beatriz Lopes', initials: 'BL', xp: 720, progress: 72, rank: 3 },
    ])

    useEffect(() => {
        loadData()
        updateGreeting()
    }, [])

    const updateGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting("Bom dia")
        else if (hour < 18) setGreeting("Boa tarde")
        else setGreeting("Boa noite")
    }

    const loadData = async () => {
        try {
            // Load Tenant Method (uses tenantId from props — no limit(1)!)
            if (tenantId) {
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('method_name')
                    .eq('id', tenantId)
                    .single()
                if (tenant?.method_name) setMethodName(tenant.method_name)
            }

            // Load Active Protocol
            const today = new Date().toISOString().split('T')[0]
            const { data: protocol } = await supabase
                .from('protocols')
                .select('*')
                .eq('scheduled_status', 'active')
                .limit(1)
                .single()

            if (protocol) {
                setActiveProtocol(protocol)
            }

            // Load Annual Plan (Next 3 protocols)
            const { data: annualPlan } = await supabase
                .from('protocols')
                .select('title, start_date')
                .eq('scheduled_status', 'scheduled')
                .order('start_date', { ascending: true })
                .limit(3)

            // Stats (Mock for now but could be calculated)
            setStats(prev => ({
                ...prev,
                revenue: "4.250,00", // Using mock numbers for visual pop
                activeQueens: 127
            }))

        } catch (error) {
            console.error("Erro ao carregar dados:", error)
        } finally {
            setLoading(false)
        }
    }

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1: return 'border-yellow-400 text-yellow-400'
            case 2: return 'border-gray-400 text-gray-400'
            case 3: return 'border-amber-600 text-amber-600'
            default: return 'border-gray-600 text-gray-600'
        }
    }

    const getRankBg = (rank: number) => {
        switch (rank) {
            case 1: return 'bg-yellow-400'
            case 2: return 'bg-gray-400'
            case 3: return 'bg-amber-600'
            default: return 'bg-gray-600'
        }
    }

    return (
        <div className="min-h-screen pt-4 pb-20">
            {/* --- HEADER PREMIUM --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-white/10 pb-6 gap-4">
                <div className="space-y-1">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 mb-2"
                    >
                        <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
                            <Brain className="text-indigo-400" size={20} />
                        </div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                            Meu Club Nutri.AI
                        </h2>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-light text-white"
                    >
                        {greeting}, <span className="font-bold">{userName?.split(' ')[0]}</span>
                    </motion.h1>
                    <p className="text-slate-400 text-sm font-medium">{tenantName}{methodName ? ` • Método ${methodName}` : ''} • Centro de Comando Inteligente</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => setView('planner')}
                        variant="outline"
                        className="h-12 border-white/5 bg-white/5 hover:bg-white/10 text-slate-300 backdrop-blur-md rounded-xl"
                    >
                        <Calendar size={18} className="mr-2" />
                        Ver Agenda
                    </Button>
                    <Button
                        onClick={() => alert('Entrando na Central de Ação IA... ⚡')}
                        className="h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/30"
                    >
                        <Zap size={18} className="mr-2" />
                        Central de Ação
                    </Button>
                </div>
            </div>

            {/* --- CTA: PLANO DO CLUBE --- */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8 rounded-[2rem] p-6 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20 hover:border-violet-500/40 transition-all cursor-pointer group"
                onClick={() => setView('club-plan')}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-violet-500/20 p-3 rounded-2xl border border-violet-500/30">
                            <Sparkles size={24} className="text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Gerar Plano do Clube com IA</h3>
                            <p className="text-sm text-slate-400">Crie um plano semestral ou anual em 1 clique</p>
                        </div>
                    </div>
                    <ChevronRight size={24} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
                </div>
            </motion.div>

            {/* --- GRID PRINCIPAL --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUNA ESQUERDA (60%) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* HERO CARD: Protocolo Ativo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl group"
                    >
                        {/* Background Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-50" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full" />

                        <div className="relative z-10">
                            <div className="flex flex-wrap justify-between items-start mb-8 gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border border-indigo-500/30 flex items-center gap-2">
                                        <Sparkles size={14} /> Protocolo Ativo
                                    </span>
                                    <span className="text-slate-400 text-sm font-medium">Dia {stats.protocolDay} de {stats.protocolTotal}</span>
                                </div>
                                <span className="text-emerald-400 flex items-center gap-1.5 text-xs font-bold bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-800/50 backdrop-blur-md">
                                    <ArrowUpRight size={16} /> Alta Adesão no Reino
                                </span>
                            </div>

                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 italic tracking-tight">
                                {activeProtocol?.title || "Folia & Hidratação 💧"}
                            </h2>
                            <p className="text-slate-300 mb-10 max-w-xl text-lg font-light leading-relaxed">
                                {activeProtocol?.description || "A estratégia de pré-carnaval está rodando. O foco atual é adesão aos shots matinais e registro de água."}
                            </p>

                            {/* Barra de Progresso Clinical Style */}
                            <div className="mb-10 bg-black/20 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black block mb-1">Status Clinical</span>
                                        <span className="text-white text-3xl font-bold">{stats.protocolAdhesion}%</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-indigo-400 text-xs font-bold block">127 Pacientes</span>
                                        <span className="text-slate-500 text-[10px]">Monitoramento em tempo real</span>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-800/50 h-3 rounded-full overflow-hidden p-[2px]">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stats.protocolAdhesion}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 h-full rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] relative"
                                    >
                                        <div className="absolute right-0 top-0 h-full w-1 bg-white/40 blur-[2px]" />
                                    </motion.div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <Button
                                    onClick={() => setView('checkins')}
                                    className="h-14 bg-white text-indigo-950 font-black px-10 rounded-2xl hover:bg-slate-100 transition shadow-2xl"
                                >
                                    <MessageCircle size={20} className="mr-2" /> Incentivar Tribo
                                </Button>
                                <Button
                                    onClick={() => alert('Gerando Relatórios de Genética NutriGen... 🧬')}
                                    variant="outline"
                                    className="h-14 border-white/20 text-slate-200 px-10 rounded-2xl hover:bg-white/5 transition backdrop-blur-md"
                                >
                                    Relatório de Genética
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* PRIORIDADES CLÍNICAS (Inbox) */}
                    <div className="rounded-[2.5rem] p-8 bg-white/5 backdrop-blur-md border border-white/10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                Prioridades Clínicas
                                <span className="text-slate-500 text-sm font-normal tracking-wide">/ Inbox Realtime</span>
                            </h3>
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={14} /> {inboxItems.length} Alertas
                            </span>
                        </div>

                        <div className="space-y-4">
                            {inboxItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] hover:bg-white/[0.06] transition-all border border-white/5 hover:border-white/10 group cursor-pointer"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-white/10 group-hover:border-indigo-500/50 transition-colors">
                                                {item.initials}
                                            </div>
                                            <div className={`absolute -bottom-1 -right-1 p-2 rounded-xl border-2 border-[#0f172a] ${item.status === 'risk' ? 'bg-rose-500' :
                                                item.status === 'question' ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}>
                                                {item.status === 'risk' ? <AlertCircle size={12} className="text-white" /> :
                                                    item.status === 'question' ? <MessageCircle size={12} className="text-white" /> :
                                                        <CheckCircle size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-white text-lg">{item.name}</h4>
                                            <p className={`text-sm tracking-tight ${item.status === 'risk' ? 'text-rose-300 font-semibold' : 'text-slate-400'}`}>
                                                {item.msg}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-5">
                                        <span className="text-xs text-slate-500 font-bold uppercase">{item.time}</span>
                                        <button
                                            onClick={() => setView('checkins')}
                                            className="bg-white/5 hover:bg-indigo-600 text-white p-3 rounded-2xl transition-all border border-white/5 group-hover:scale-110"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA (40%) */}
                <div className="space-y-8">

                    {/* COFRE REAL (Financeiro) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[2.5rem] p-8 bg-gradient-to-br from-indigo-900/20 to-teal-900/10 backdrop-blur-xl border border-indigo-500/20 relative overflow-hidden group shadow-2xl"
                    >
                        <div className="absolute -right-10 -top-10 text-indigo-500/5 rotate-12 transition-transform group-hover:rotate-0 duration-700">
                            <DollarSign size={160} />
                        </div>

                        <h3 className="text-[10px] text-indigo-300 uppercase tracking-[0.2em] font-black mb-3 flex items-center gap-2">
                            <Activity size={16} /> Faturamento Mensal
                        </h3>
                        <div className="flex items-end gap-3 mb-10 relative z-10">
                            <span className="text-5xl font-light text-white tracking-tighter">R$ {stats.revenue}</span>
                            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-black border border-emerald-500/30 mb-2">+12%</span>
                        </div>

                        {/* Upsell Opportunity */}
                        <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/20 border border-amber-500/20 rounded-3xl p-6 relative z-10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="bg-amber-500/20 p-3.5 rounded-2xl border border-amber-500/30">
                                    <Crown size={24} className="text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-100 text-lg mb-1">Oportunidade Premium</h4>
                                    <p className="text-sm text-amber-100/70 leading-relaxed font-medium">
                                        <strong className="text-white">{stats.upsellReady} Rainhas</strong> prontas para o upgrade de tiquete. Oferte o <strong className="text-amber-400">Teste Genético NutriGen ✨</strong>
                                    </p>
                                    <Button
                                        onClick={() => alert('Convite VIP Vitalício disparado para as Rainhas qualificadas! 🚀')}
                                        className="mt-5 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm py-4 rounded-2xl transition shadow-xl shadow-amber-900/40"
                                    >
                                        Disparar Convite VIP
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* DESTAQUES & GAMIFICAÇÃO */}
                    <div className="rounded-[2.5rem] p-8 bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
                        <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-8 flex items-center justify-between">
                            Ranking de Engajamento
                            <Trophy size={16} className="text-indigo-400" />
                        </h3>

                        <div className="space-y-6">
                            {topQueens.slice(0, 3).map((queen) => (
                                <div key={queen.id} className={`flex items-center gap-4 p-4 rounded-3xl transition-all ${queen.rank === 1 ? 'bg-indigo-500/10 border border-indigo-500/20' : ''}`}>
                                    <div className="relative">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm border ${queen.rank === 1 ? 'bg-gradient-to-tr from-indigo-400 to-violet-600 border-indigo-500 text-white' :
                                            'bg-slate-800 border-white/5 text-slate-400'
                                            }`}>
                                            {queen.initials}
                                        </div>
                                        {queen.rank === 1 && (
                                            <div className="absolute -top-3 -right-3 bg-gradient-to-tr from-yellow-400 to-amber-600 text-white w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-lg border-2 border-[#131320]">
                                                #1
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-base font-bold text-white">{queen.name}</h4>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${queen.progress}%` }}
                                                className={`h-full rounded-full ${queen.rank === 1 ? 'bg-indigo-400' : 'bg-slate-600'}`}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-black block ${queen.rank === 1 ? 'text-indigo-300' : 'text-slate-500'}`}>
                                            {queen.xp}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-600 uppercase">XP</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            onClick={() => alert('Card de Ranking gerado ✨')}
                            variant="outline"
                            className="w-full mt-8 py-4 border-white/10 text-indigo-400 hover:bg-indigo-500/5 rounded-2xl font-bold flex items-center justify-center gap-2"
                        >
                            Postar Ranking no Stories 📸
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
