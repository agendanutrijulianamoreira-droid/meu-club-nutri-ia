"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"
import { useOverlays } from "@/components/ui/OverlayStack"
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    Sparkles,
    FileText,
    Trophy,
    CreditCard,
    BarChart3,
    Crown,
    MessageCircle,
    Globe,
    Brain,
    BookOpen,
    ShieldCheck,
    Bot,
    Utensils,
    CalendarCheck,
    Stethoscope,
    ShoppingBag,
    TrendingUp,
    Inbox
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Sub-components
import { DashboardView } from "./views/DashboardView"
import { CommunicationCenterView } from "./views/CommunicationCenterView"
import { ProtocolsView } from "./views/ProtocolsView"
import { ChallengesView } from "./views/ChallengesView"
import { PatientsView } from "./views/PatientsView"
import { RewardsView } from "./views/RewardsView"
import { CheckinsView } from "./views/CheckinsView"
import { SalesPageGenerator } from "./views/SalesPageGenerator"
import { LibraryView } from "./views/LibraryView"
import { AISettingsView } from "./views/AISettingsView"
import { SettingsView } from "./views/SettingsView"
import { ClubPlanView } from "./views/ClubPlanView"
import { AICreditsView } from "./views/AICreditsView"
import { repairProfile } from "./actions/repairProfileAction"
import AccountOverlay from "./components/AccountOverlay"
import ClinicSettingsOverlay from "./components/ClinicSettingsOverlay"
import VisualSettingsOverlay from "./components/VisualSettingsOverlay"
import { signOutAction } from "./actions/authActions"
import { ChevronDown, LogOut, User as UserIcon, Building2, Palette } from "lucide-react"

import { SettingsLoginView } from "./views/SettingsLoginView"
import { AgentsDashboardView } from "./views/AgentsDashboardView"
import { AgentApprovalsView } from "./views/AgentApprovalsView"
import { AgentQueueView } from "./views/AgentQueueView"
import { MealPlanBuilderView } from "./views/MealPlanBuilderView"
import { MealPlansView } from "./views/MealPlansView"
import { AppointmentsView } from "./views/AppointmentsView"
import { ProfessionalsView } from "./views/ProfessionalsView"
import { ProductGatewayView } from "./views/ProductGatewayView"
import { AnnualPlannerView } from "./views/AnnualPlannerView"
import { StrategicPlannerView } from "./views/StrategicPlannerView"
import { ContentPlannerView } from "./views/ContentPlannerView"
import { AnalyticsView } from "./views/AnalyticsView"
import { JourneyView } from "./views/JourneyView"

type ViewType = 'dashboard' | 'communication' | 'protocols' | 'challenges' | 'patients' | 'rewards' | 'checkins' | 'sales-page' | 'ai-brain' | 'ai-credits' | 'library' | 'settings' | 'settings-login' | 'club-plan' | 'agents-dashboard' | 'agent-approvals' | 'agent-queue' | 'meal-plans' | 'meal-plans-premium' | 'appointments' | 'professionals' | 'product-gateway' | 'annual-planner' | 'strategic-planner' | 'content-planner' | 'analytics' | 'patient-journey'

const navGroups: { label?: string; items: { id: ViewType; label: string; icon: any; badge?: boolean }[] }[] = [
    {
        items: [
            { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
            { id: 'communication', label: 'Comunicação', icon: MessageCircle },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        ],
    },
    {
        label: 'Clínica',
        items: [
            { id: 'patients', label: 'Rainhas', icon: Users },
            { id: 'checkins', label: 'Check-ins IA', icon: ShieldCheck },
            { id: 'appointments', label: 'Agenda', icon: CalendarCheck },
            { id: 'professionals', label: 'Profissionais', icon: Stethoscope },
        ],
    },
    {
        label: 'Programas',
        items: [
            { id: 'protocols', label: 'Protocolos', icon: FileText },
            { id: 'meal-plans', label: 'Cardápios', icon: Utensils },
            { id: 'challenges', label: 'Jornadas', icon: Trophy },
            { id: 'library', label: 'Biblioteca', icon: BookOpen },
        ],
    },
    {
        label: 'Engajamento',
        items: [
            { id: 'rewards', label: 'Recompensas', icon: Crown },
            { id: 'annual-planner', label: 'Planejador', icon: TrendingUp },
        ],
    },
    {
        label: 'Meu Clube',
        items: [
            { id: 'club-plan', label: 'Plano do Clube', icon: Calendar },
            { id: 'sales-page', label: 'Página de Vendas', icon: Globe },
            { id: 'product-gateway', label: 'Produtos', icon: ShoppingBag },
        ],
    },
    {
        label: 'Inteligência IA',
        items: [
            { id: 'ai-brain', label: 'Config. da IA', icon: Brain },
            { id: 'agents-dashboard', label: 'Agentes', icon: Bot },
            { id: 'agent-approvals', label: 'Aprovações', icon: ShieldCheck, badge: true },
            { id: 'agent-queue', label: 'Fila de Agentes', icon: Inbox },
            { id: 'patient-journey', label: 'Jornada das Pacientes', icon: TrendingUp },
            { id: 'meal-plans-premium', label: 'Planos Alimentares', icon: Utensils },
            { id: 'ai-credits', label: 'Créditos', icon: CreditCard },
        ],
    },
    {
        label: 'Configurações',
        items: [
            { id: 'settings', label: 'Sistema', icon: Settings },
            { id: 'settings-login', label: 'Login Designer', icon: Palette },
        ],
    },
]

interface AdminDashboardProps {
    userName?: string
    tenantName?: string
    role?: string
    tenantId?: string
    needsRepair?: boolean
}

export default function AdminDashboard({ userName = 'Admin', tenantName = '', role = 'admin', tenantId = '', needsRepair = false }: AdminDashboardProps) {
    const router = useRouter()
    const [activeView, setActiveView] = useState<ViewType>('dashboard')
    const [pendingApprovals, setPendingApprovals] = useState(0)
    const { openOverlay } = useOverlays()

    // Poll pending approvals count every 60s
    useEffect(() => {
        const loadPending = () => {
            fetch('/api/admin/agent-approvals?status=pending')
                .then(r => r.json())
                .then(d => setPendingApprovals(Array.isArray(d) ? d.length : 0))
                .catch(() => {})
        }
        loadPending()
        const interval = setInterval(loadPending, 60_000)
        return () => clearInterval(interval)
    }, [])

    // Autocura: reparar perfil via Server Action (não durante render)
    useEffect(() => {
        if (needsRepair) {
            repairProfile().then((result) => {
                if (result.repaired) {
                    console.log('[AdminDashboard] Profile repaired via Server Action, refreshing...');
                    router.refresh();
                }
            }).catch(console.error);
        }
    }, [needsRepair, router])

    const renderView = () => {
        const props = { setView: setActiveView, userName, tenantName, tenantId }
        switch (activeView) {
            case 'dashboard': return <DashboardView {...props} />
            case 'communication': return <CommunicationCenterView setView={setActiveView} />
            case 'protocols': return <ProtocolsView setView={setActiveView} />
            case 'challenges': return <ChallengesView setView={setActiveView} />
            case 'patients': return <PatientsView setView={setActiveView} />
            case 'rewards': return <RewardsView setView={setActiveView} />
            case 'checkins': return <CheckinsView setView={setActiveView} />
            case 'library': return <LibraryView setView={setActiveView} />
            case 'sales-page': return <SalesPageGenerator setView={setActiveView} tenantId={tenantId} />
            case 'ai-brain': return <AISettingsView setView={setActiveView} tenantId={tenantId} />
            case 'ai-credits': return <AICreditsView setView={setActiveView} tenantId={tenantId} />
            case 'agents-dashboard': return <AgentsDashboardView setView={setActiveView} tenantId={tenantId} />
            case 'agent-approvals': return <AgentApprovalsView setView={setActiveView} tenantId={tenantId} />
            case 'agent-queue': return <AgentQueueView setView={setActiveView} tenantId={tenantId} />
            case 'patient-journey': return <JourneyView setView={setActiveView} tenantId={tenantId} />
            case 'meal-plans': return <MealPlanBuilderView setView={setActiveView} tenantId={tenantId} />
            case 'meal-plans-premium': return <MealPlansView setView={setActiveView} tenantId={tenantId} />
            case 'appointments': return <AppointmentsView setView={setActiveView} tenantId={tenantId} />
            case 'professionals': return <ProfessionalsView setView={setActiveView} tenantId={tenantId} />
            case 'product-gateway': return <ProductGatewayView setView={setActiveView} tenantId={tenantId} />
            case 'annual-planner': return <AnnualPlannerView setView={setActiveView} tenantId={tenantId} />
            case 'strategic-planner': return <StrategicPlannerView setView={setActiveView} />
            case 'content-planner': return <ContentPlannerView />
            case 'analytics': return <AnalyticsView setView={setActiveView} />
            case 'settings': return <SettingsView {...props} />
            case 'settings-login': return <SettingsLoginView />
            case 'club-plan': return <ClubPlanView {...props} />
            default: return <DashboardView {...props} />
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex overflow-hidden">
            {/* --- BACKGROUND BLOBS --- */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full -z-10" />

            {/* Sidebar — hover to expand */}
            <aside className="group/sidebar w-[68px] hover:w-64 border-r border-white/10 flex flex-col fixed h-full bg-[#020617]/60 backdrop-blur-3xl transition-all duration-300 z-50 ease-in-out shadow-2xl overflow-hidden">
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 h-20 border-b border-white/5 flex-shrink-0">
                    <div className="h-9 w-9 min-w-[36px] rounded-xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-900/40 relative">
                        <Brain size={18} className="text-indigo-400" />
                        <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-indigo-500 rounded-full border border-slate-900" />
                    </div>
                    <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
                        <p className="font-black text-sm text-white uppercase tracking-wide leading-none">Meu Club</p>
                        <p className="text-[9px] text-indigo-400 font-light tracking-widest">Nutri.AI</p>
                    </div>
                </div>

                {/* Navigation Scrollable */}
                <nav className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar space-y-0.5">
                    {navGroups.map((group, gi) => (
                        <div key={gi} className={gi > 0 ? 'pt-2' : ''}>
                            {group.label && (
                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 px-3 pb-1 pt-1 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                    {group.label}
                                </p>
                            )}
                            {gi > 0 && <div className="h-px bg-white/5 mx-2 mb-1.5 group-hover/sidebar:opacity-0 transition-opacity" />}
                            {group.items.map((item) => {
                                const Icon = item.icon
                                const isActive = activeView === item.id
                                const showBadge = item.badge && pendingApprovals > 0
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveView(item.id)}
                                        title={item.label}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative
                                            ${isActive
                                                ? 'bg-indigo-600/15 text-white border border-indigo-500/30'
                                                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                                            }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <Icon size={17} className={isActive ? 'text-indigo-400' : 'group-hover:text-indigo-400 transition-colors'} />
                                            {showBadge && (
                                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[7px] font-black">
                                                    {pendingApprovals > 9 ? '9+' : pendingApprovals}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 overflow-hidden ${isActive ? 'text-white' : ''}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-pill"
                                                className="absolute left-0 w-0.5 h-5 bg-indigo-400 rounded-r-full"
                                            />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                {/* Footer — IA Hub button */}
                <div className="px-2 py-3 border-t border-white/5 flex-shrink-0">
                    <button
                        onClick={() => setActiveView('agents-dashboard')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl transition-all"
                    >
                        <Sparkles size={17} className="text-indigo-400 flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                            IA Hub
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-[68px] transition-all duration-300 ease-in-out">
                {/* Header Superior Area */}
                <div className="h-28 border-b border-white/5 px-10 flex items-center justify-between bg-slate-950/10 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Cenário: </span>
                        <div className="flex items-center gap-2 bg-indigo-600/10 px-4 py-2 rounded-xl border border-indigo-500/20">
                            <ShieldCheck size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Acesso de Alta Performance</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 w-10 rounded-full border-2 border-[#020617] bg-slate-800 overflow-hidden shadow-xl">
                                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=user${i}`} alt="user" />
                                </div>
                            ))}
                            <div className="h-10 w-10 rounded-full border-2 border-[#020617] bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-xl">
                                +12
                            </div>
                        </div>
                        <div className="h-10 w-px bg-white/5" />

                        <UserDropdown
                            userName={userName}
                            role={role}
                            openOverlay={openOverlay}
                            router={router}
                        />
                    </div>
                </div>

                <div className="h-[calc(100vh-112px)] overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeView}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="p-10 max-w-7xl mx-auto"
                        >
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}

function UserDropdown({ userName, role, openOverlay, router }: any) {
    const [isOpen, setIsOpen] = useState(false)

    const menuItems = [
        { id: 'profile', label: 'Meu Perfil', icon: UserIcon, onClick: () => openOverlay({ id: "account", content: <AccountOverlay index={0} />, title: "Meu Perfil" }) },
        { id: 'clinic', label: 'Minha Clínica', icon: Building2, onClick: () => openOverlay({ id: "clinic", content: <ClinicSettingsOverlay index={0} />, title: "Minha Clínica" }) },
        { id: 'visual', label: 'Aparência', icon: Palette, onClick: () => openOverlay({ id: "visual", content: <VisualSettingsOverlay index={0} />, title: "Aparência" }) },
    ]

    const handleSignOut = async () => {
        await signOutAction()
        router.push('/login')
    }

    return (
        <div className="relative">
            <div
                className="flex items-center gap-4 group cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{userName}</p>
                    <div className="flex items-center justify-end gap-1">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{role === 'admin' ? 'Admin' : 'Nutricionista'}</p>
                        <ChevronDown size={10} className={`text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                <div className="h-12 w-12 rounded-2xl border border-white/10 p-0.5 group-hover:border-indigo-500/40 transition-all shadow-lg overflow-hidden">
                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${userName}`} className="w-full h-full rounded-xl bg-slate-900" alt="admin" />
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-4 w-64 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl p-3 z-50 overflow-hidden"
                        >
                            <div className="space-y-1">
                                {menuItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            item.onClick()
                                            setIsOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-5 py-4 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-2xl transition-all group"
                                    >
                                        <item.icon size={18} className="group-hover:text-indigo-400 transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                                    </button>
                                ))}

                                <div className="h-px bg-white/5 my-2 mx-4" />

                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-5 py-4 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-2xl transition-all group"
                                >
                                    <LogOut size={18} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Sair do Sistema</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
