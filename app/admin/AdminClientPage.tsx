"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
    Inbox,
    ChevronDown,
    LogOut,
    User as UserIcon,
    Building2,
    Palette,
    Package,
    ChefHat,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Views
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
import { ProductsView } from "./views/ProductsView"
import { ApprovalsView } from "./views/ApprovalsView"
import { RecipesView } from "./views/RecipesView"
import { ManagerLearningView } from "./views/ManagerLearningView"
import { HabitsView } from "./views/HabitsView"
import { VipSettingsView } from "./views/VipSettingsView"
import { EmailMarketingView } from "./views/EmailMarketingView"
import { QuestionnairesView } from "./views/QuestionnairesView"
import { CommunityView } from "./views/CommunityView"
import { BillingView } from "./views/BillingView"

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewType =
    | 'dashboard' | 'communication' | 'protocols' | 'challenges' | 'patients'
    | 'rewards' | 'checkins' | 'sales-page' | 'ai-brain' | 'ai-credits'
    | 'library' | 'settings' | 'settings-login' | 'club-plan' | 'agents-dashboard'
    | 'agent-approvals' | 'agent-queue' | 'meal-plans' | 'meal-plans-premium'
    | 'appointments' | 'professionals' | 'product-gateway' | 'annual-planner'
    | 'strategic-planner' | 'content-planner' | 'analytics' | 'patient-journey'
    | 'products' | 'approvals' | 'recipes' | 'manager-learning' | 'habits' | 'vip-settings' | 'email-marketing'
    | 'questionnaires' | 'community' | 'billing'

interface NavItem {
    id: ViewType
    label: string
    badge?: boolean
}

interface NavGroup {
    id: string
    groupIcon: any
    label: string
    items: NavItem[]
}

// ─── Nav data (one icon per group → flyout with sub-items) ───────────────────

const navGroups: NavGroup[] = [
    {
        id: 'overview',
        groupIcon: LayoutDashboard,
        label: 'Início',
        items: [
            { id: 'dashboard', label: 'Painel' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'communication', label: 'Comunicação' },
            { id: 'email-marketing', label: 'Email Marketing' },
        ],
    },
    {
        id: 'clinic',
        groupIcon: Users,
        label: 'Pacientes',
        items: [
            { id: 'patients', label: 'Minhas Pacientes' },
            { id: 'checkins', label: 'Check-ins IA' },
            { id: 'patient-journey', label: 'Jornada das Pacientes' },
            { id: 'appointments', label: 'Agenda' },
        ],
    },
    {
        id: 'programs',
        groupIcon: FileText,
        label: 'Programas',
        items: [
            { id: 'protocols', label: 'Protocolos' },
            { id: 'challenges', label: 'Desafios' },
            { id: 'habits', label: 'Hábitos' },
            { id: 'meal-plans', label: 'Cardápios' },
            { id: 'recipes', label: 'Receitas' },
            { id: 'library', label: 'Biblioteca' },
            { id: 'rewards', label: 'Recompensas' },
            { id: 'questionnaires', label: 'Questionários' },
        ],
    },
    {
        id: 'club',
        groupIcon: Crown,
        label: 'Clube',
        items: [
            { id: 'billing', label: 'Faturamento' },
            { id: 'club-plan', label: 'Plano do Clube' },
            { id: 'vip-settings', label: 'Área VIP' },
            { id: 'community', label: 'Comunidade' },
            { id: 'sales-page', label: 'Página de Vendas' },
            { id: 'product-gateway', label: 'Catálogo de Produtos' },
            { id: 'products', label: 'Produtos' },
            { id: 'annual-planner', label: 'Planejador Anual' },
            { id: 'content-planner', label: 'Conteúdo' },
            { id: 'professionals', label: 'Profissionais' },
        ],
    },
    {
        id: 'ai',
        groupIcon: Bot,
        label: 'Inteligência',
        items: [
            { id: 'ai-brain', label: 'Laboratório IA' },
            { id: 'agents-dashboard', label: 'Agentes IA' },
            { id: 'agent-approvals', label: 'Aprovações', badge: true },
            { id: 'approvals', label: 'Fila de Aprovação', badge: true },
            { id: 'agent-queue', label: 'Fila de Agentes' },
            { id: 'meal-plans-premium', label: 'Planos Avançados' },
            { id: 'ai-credits', label: 'Créditos IA' },
            { id: 'strategic-planner', label: 'Planejamento' },
            { id: 'manager-learning', label: 'Gerente IA' },
            { id: 'settings', label: 'Configurações' },
            { id: 'settings-login', label: 'Login Designer' },
        ],
    },
]

// Sidebar width constant (keep in sync with ml- on main)
const SIDEBAR_W = 60

// ─── Main component ───────────────────────────────────────────────────────────

interface AdminDashboardProps {
    userName?: string
    tenantName?: string
    role?: string
    tenantId?: string
    needsRepair?: boolean
}

export default function AdminDashboard({
    userName = 'Admin',
    tenantName = '',
    role = 'admin',
    tenantId = '',
    needsRepair = false,
}: AdminDashboardProps) {
    const router = useRouter()
    const [activeView, setActiveView] = useState<ViewType>('dashboard')
    const [openGroupId, setOpenGroupId] = useState<string | null>(null)
    const [pendingApprovals, setPendingApprovals] = useState(0)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { openOverlay } = useOverlays()

    const scheduleClose = useCallback(() => {
        closeTimer.current = setTimeout(() => setOpenGroupId(null), 120)
    }, [])

    const cancelClose = useCallback(() => {
        if (closeTimer.current) clearTimeout(closeTimer.current)
    }, [])

    useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

    // Poll pending approvals every 60s
    useEffect(() => {
        const load = () =>
            fetch('/api/admin/agent-approvals?status=pending')
                .then(r => r.json())
                .then(d => setPendingApprovals(Array.isArray(d) ? d.length : 0))
                .catch(() => {})
        load()
        const t = setInterval(load, 60_000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        if (needsRepair) {
            repairProfile().then(r => { if (r.repaired) router.refresh() }).catch(console.error)
        }
    }, [needsRepair, router])

    // Detect which group the active view belongs to
    const activeGroupId = navGroups.find(g => g.items.some(i => i.id === activeView))?.id ?? null

    const navigate = (id: ViewType) => {
        setActiveView(id)
        setOpenGroupId(null)
    }

    const renderView = () => {
        const props = { setView: setActiveView, userName, tenantName, tenantId }
        switch (activeView) {
            case 'dashboard':          return <DashboardView {...props} />
            case 'communication':      return <CommunicationCenterView setView={setActiveView} />
            case 'protocols':          return <ProtocolsView setView={setActiveView} tenantId={tenantId} />
            case 'challenges':         return <ChallengesView setView={setActiveView} />
            case 'patients':           return <PatientsView setView={setActiveView} />
            case 'rewards':            return <RewardsView setView={setActiveView} />
            case 'checkins':           return <CheckinsView setView={setActiveView} />
            case 'library':            return <LibraryView setView={setActiveView} />
            case 'sales-page':         return <SalesPageGenerator setView={setActiveView} tenantId={tenantId} />
            case 'ai-brain':           return <AISettingsView setView={setActiveView} tenantId={tenantId} />
            case 'ai-credits':         return <AICreditsView setView={setActiveView} tenantId={tenantId} />
            case 'agents-dashboard':   return <AgentsDashboardView setView={setActiveView} tenantId={tenantId} />
            case 'agent-approvals':    return <AgentApprovalsView setView={setActiveView} tenantId={tenantId} />
            case 'agent-queue':        return <AgentQueueView setView={setActiveView} tenantId={tenantId} />
            case 'patient-journey':    return <JourneyView setView={setActiveView} tenantId={tenantId} />
            case 'meal-plans':         return <MealPlanBuilderView setView={setActiveView} tenantId={tenantId} />
            case 'meal-plans-premium': return <MealPlansView setView={setActiveView} tenantId={tenantId} />
            case 'appointments':       return <AppointmentsView setView={setActiveView} tenantId={tenantId} />
            case 'professionals':      return <ProfessionalsView setView={setActiveView} tenantId={tenantId} />
            case 'product-gateway':    return <ProductGatewayView setView={setActiveView} tenantId={tenantId} />
            case 'annual-planner':     return <AnnualPlannerView setView={setActiveView} tenantId={tenantId} />
            case 'strategic-planner':  return <StrategicPlannerView setView={setActiveView} />
            case 'content-planner':    return <ContentPlannerView />
            case 'analytics':          return <AnalyticsView setView={setActiveView} />
            case 'products':           return <ProductsView setView={setActiveView} tenantId={tenantId} />
            case 'approvals':          return <ApprovalsView setView={setActiveView} tenantId={tenantId} />
            case 'recipes':            return <RecipesView setView={setActiveView} tenantId={tenantId} />
            case 'habits':             return <HabitsView setView={setActiveView} tenantId={tenantId} />
            case 'vip-settings':       return <VipSettingsView setView={setActiveView} tenantId={tenantId} />
            case 'billing':            return <BillingView setView={setActiveView} tenantId={tenantId} />
            case 'email-marketing':    return <EmailMarketingView setView={setActiveView} tenantId={tenantId} />
            case 'manager-learning':   return <ManagerLearningView setView={setActiveView} tenantId={tenantId} />
            case 'questionnaires':     return <QuestionnairesView setView={setActiveView} tenantId={tenantId} />
            case 'community':          return <CommunityView />
            case 'settings':           return <SettingsView {...props} />
            case 'settings-login':     return <SettingsLoginView />
            case 'club-plan':          return <ClubPlanView {...props} />
            default:                   return <DashboardView {...props} />
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full -z-10" />

            {/* ── Mini Sidebar ──────────────────────────────────────────────── */}
            <aside
                style={{ width: SIDEBAR_W }}
                className="fixed left-0 top-0 h-full z-50 flex flex-col items-center bg-[#0d0d1a] border-r border-white/[0.07] shadow-xl"
            >
                {/* Logo mark */}
                <div className="flex items-center justify-center h-16 w-full border-b border-white/[0.06]">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600/25 border border-indigo-400/30 flex items-center justify-center relative">
                        <Brain size={15} className="text-indigo-400" />
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-indigo-500 rounded-full border border-[#0d0d1a]" />
                    </div>
                </div>

                {/* Icon rail */}
                <nav className="flex-1 flex flex-col items-center py-3 gap-1 w-full overflow-y-auto no-scrollbar">
                    {navGroups.map((group) => {
                        const Icon = group.groupIcon
                        const isGroupActive = activeGroupId === group.id
                        const isOpen = openGroupId === group.id
                        const hasBadge = group.items.some(i => i.badge) && pendingApprovals > 0

                        return (
                            <button
                                key={group.id}
                                title={group.label}
                                onMouseEnter={() => { cancelClose(); setOpenGroupId(group.id) }}
                                onMouseLeave={scheduleClose}
                                className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150
                                    ${isGroupActive || isOpen
                                        ? 'bg-indigo-600/20 text-indigo-400'
                                        : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={17} />
                                {/* Active dot */}
                                {isGroupActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-indigo-400 rounded-r-full" />
                                )}
                                {/* Badge */}
                                {hasBadge && (
                                    <span className="absolute top-1 right-1 h-2 w-2 bg-rose-500 rounded-full border border-[#0d0d1a]" />
                                )}
                            </button>
                        )
                    })}
                </nav>

            </aside>

            {/* ── Flyout Submenu ────────────────────────────────────────────── */}
            <AnimatePresence>
                {openGroupId && (() => {
                    const group = navGroups.find(g => g.id === openGroupId)!
                    return (
                        <motion.div
                            key={openGroupId}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            style={{ left: SIDEBAR_W }}
                            className="fixed top-0 h-full z-40 w-52 bg-[#11111f] border-r border-white/[0.08] shadow-2xl flex flex-col"
                            onMouseEnter={cancelClose}
                            onMouseLeave={scheduleClose}
                        >
                            {/* Flyout header */}
                            <div className="px-5 pt-6 pb-4 border-b border-white/[0.06]">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {group.label}
                                </p>
                            </div>

                            {/* Sub-items */}
                            <nav className="flex-1 px-3 py-3 overflow-y-auto no-scrollbar space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = activeView === item.id
                                    const showBadge = item.badge && pendingApprovals > 0
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => navigate(item.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group
                                                ${isActive
                                                    ? 'bg-indigo-600/20 text-white'
                                                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                                                }`}
                                        >
                                            <span className={`text-[12px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                                                {item.label}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {showBadge && (
                                                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black">
                                                        {pendingApprovals > 9 ? '9+' : pendingApprovals}
                                                    </span>
                                                )}
                                                {isActive && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </nav>
                        </motion.div>
                    )
                })()}
            </AnimatePresence>

            {/* Backdrop click-away when flyout is open */}
            {openGroupId && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setOpenGroupId(null)}
                />
            )}

            {/* ── Main Content ──────────────────────────────────────────────── */}
            <main
                style={{ marginLeft: SIDEBAR_W }}
                className="flex-1 flex flex-col min-h-screen"
            >
                {/* Top header */}
                <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-slate-950/20 backdrop-blur-md flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Cenário</span>
                        <div className="flex items-center gap-2 bg-indigo-600/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                            <ShieldCheck size={12} className="text-indigo-400" />
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Alta Performance</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="flex -space-x-2.5">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-8 w-8 rounded-full border-2 border-[#020617] bg-slate-800 overflow-hidden shadow-lg">
                                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=user${i}`} alt="" />
                                </div>
                            ))}
                            <div className="h-8 w-8 rounded-full border-2 border-[#020617] bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
                                +12
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/5" />
                        <UserDropdown userName={userName} role={role} openOverlay={openOverlay} router={router} />
                    </div>
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeView}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="p-8 max-w-7xl mx-auto"
                        >
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown({ userName, role, openOverlay, router }: {
    userName: string
    role: string
    openOverlay: (o: any) => void
    router: ReturnType<typeof useRouter>
}) {
    const [isOpen, setIsOpen] = useState(false)

    const menuItems = [
        { id: 'profile', label: 'Meu Perfil', icon: UserIcon, onClick: () => openOverlay({ id: 'account', content: <AccountOverlay index={0} />, title: 'Meu Perfil' }) },
        { id: 'clinic', label: 'Minha Clínica', icon: Building2, onClick: () => openOverlay({ id: 'clinic', content: <ClinicSettingsOverlay index={0} />, title: 'Minha Clínica' }) },
        { id: 'visual', label: 'Aparência', icon: Palette, onClick: () => openOverlay({ id: 'visual', content: <VisualSettingsOverlay index={0} />, title: 'Aparência' }) },
    ]

    const handleSignOut = async () => {
        await signOutAction()
        router.push('/login')
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsOpen(o => !o)}>
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-widest leading-none">{userName}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                        <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{role === 'admin' ? 'Admin' : 'Nutricionista'}</p>
                        <ChevronDown size={9} className={`text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                <div className="h-9 w-9 rounded-xl border border-white/10 p-0.5 group-hover:border-indigo-500/40 transition-all shadow-md overflow-hidden">
                    <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${userName}`} className="w-full h-full rounded-lg bg-slate-900" alt="admin" />
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            className="absolute right-0 mt-3 w-56 bg-[#11111f] border border-white/10 rounded-2xl shadow-2xl p-2 z-50"
                        >
                            <div className="space-y-0.5">
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => { item.onClick(); setIsOpen(false) }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all group"
                                    >
                                        <item.icon size={15} className="group-hover:text-indigo-400 transition-colors" />
                                        <span className="text-[11px] font-semibold">{item.label}</span>
                                    </button>
                                ))}
                                <div className="h-px bg-white/5 my-1 mx-2" />
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all"
                                >
                                    <LogOut size={15} />
                                    <span className="text-[11px] font-semibold">Sair do Sistema</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
