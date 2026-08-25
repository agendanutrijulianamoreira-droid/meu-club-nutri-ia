"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useOverlays } from "@/components/ui/OverlayStack"
import {
    LayoutDashboard, Users, Settings,
    Brain, ShieldCheck, Bot, ChevronDown, ChevronRight, LogOut,
    User as UserIcon, Building2, CalendarDays, HeartPulse,
    MessageSquareText, WalletCards, SlidersHorizontal, PanelLeftClose,
    PanelLeftOpen, Stethoscope, Briefcase,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { DashboardView } from "./views/DashboardView"
import { CommunicationCenterView } from "./views/CommunicationCenterView"
import { ProtocolsView } from "./views/ProtocolsView"
import { PatientsView } from "./views/PatientsView"
import { RewardsView } from "./views/RewardsView"
import { CheckinsView } from "./views/CheckinsView"
import { SalesPageGenerator } from "./views/SalesPageGenerator"
import { ClinicalLibraryView } from "./views/ClinicalLibraryView"
import { AISettingsView } from "./views/AISettingsView"
import { SettingsView } from "./views/SettingsView"
import { ClubPlanView } from "./views/ClubPlanView"
import { AICreditsView } from "./views/AICreditsView"
import { repairProfile } from "./actions/repairProfileAction"
import AccountOverlay from "./components/AccountOverlay"
import ClinicSettingsOverlay from "./components/ClinicSettingsOverlay"
import { signOutAction } from "./actions/authActions"
import { AgentsDashboardView } from "./views/AgentsDashboardView"
import { MealPlanBuilderView } from "./views/MealPlanBuilderView"
import { AppointmentsView } from "./views/AppointmentsView"
import { ProfessionalsView } from "./views/ProfessionalsView"
import { ProductGatewayView } from "./views/ProductGatewayView"
import { StrategicPlannerView } from "./views/StrategicPlannerView"
import { AnalyticsView } from "./views/AnalyticsView"
import { JourneyView } from "./views/JourneyView"
import { ProductsView } from "./views/ProductsView"
import { BusinessPlanView } from "./views/BusinessPlanView"
import { ApprovalsView } from "./views/ApprovalsView"
import { ManagerLearningView } from "./views/ManagerLearningView"
import { HabitsView } from "./views/HabitsView"
import { VipSettingsView } from "./views/VipSettingsView"
import { QuestionnairesView } from "./views/QuestionnairesView"
import { CommunityView } from "./views/CommunityView"
import { BillingView } from "./views/BillingView"
import { MethodsView } from "./views/MethodsView"

type ViewType =
    | 'dashboard' | 'communication' | 'protocols' | 'patients'
    | 'rewards' | 'checkins' | 'sales-page' | 'ai-brain' | 'ai-credits'
    | 'clinical-library' | 'settings' | 'club-plan' | 'agents-dashboard'
    | 'meal-plans' | 'appointments' | 'professionals' | 'product-gateway'
    | 'strategic-planner' | 'analytics' | 'patient-journey'
    | 'products' | 'approvals' | 'manager-learning' | 'habits' | 'vip-settings'
    | 'questionnaires' | 'community' | 'billing' | 'methods' | 'business-plan'

type NavItem = { label: string; id?: ViewType; href?: string; badge?: boolean }
type NavGroup = { id: string; icon: any; label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
    { id: 'overview', icon: LayoutDashboard, label: 'Início', items: [
        { id: 'dashboard', label: 'Painel' }, { id: 'analytics', label: 'Indicadores' },
        { href: '/admin/attention', label: 'Quem precisa de mim hoje' }, { href: '/admin/followups', label: 'Tarefas de acompanhamento' },
    ]},
    { id: 'patients', icon: Users, label: 'Pacientes', items: [
        { id: 'patients', label: 'Minhas pacientes' }, { id: 'checkins', label: 'Check-ins' },
        { id: 'patient-journey', label: 'Jornada das pacientes' }, { id: 'questionnaires', label: 'Questionários' },
        { href: '/admin/followups/metrics', label: 'Métricas de acompanhamento' },
    ]},
    { id: 'crm', icon: Briefcase, label: 'CRM', items: [
        { href: '/admin/crm', label: 'Painel e contatos' }, { href: '/admin/crm/rescue', label: 'Fila de resgate' },
        { href: '/admin/crm/outcomes', label: 'Resultados' }, { href: '/admin/crm/metrics', label: 'Métricas' },
        { href: '/admin/crm/stages', label: 'Etapas e jornada' },
    ]},
    { id: 'attendance', icon: CalendarDays, label: 'Atendimento', items: [
        { id: 'appointments', label: 'Agenda' }, { href: '/admin/appointments/availability', label: 'Disponibilidade' },
        { href: '/admin/appointment-settings', label: 'Configurações da agenda' },
        { href: '/admin/appointments/communications', label: 'Confirmações e lembretes' }, { id: 'professionals', label: 'Profissionais' },
    ]},
    { id: 'clinical', icon: Stethoscope, label: 'Planejamento clínico', items: [
        { id: 'methods', label: 'Métodos e fases' }, { id: 'clinical-library', label: 'Biblioteca clínica' },
        { id: 'protocols', label: 'Protocolos e desafios' }, { id: 'meal-plans', label: 'Dietas e cardápios' },
        { id: 'habits', label: 'Hábitos' }, { href: '/admin/methods/phases', label: 'Critérios de avanço' },
    ]},
    { id: 'communication', icon: MessageSquareText, label: 'Comunicação', items: [
        { id: 'communication', label: 'Central de comunicação' }, { href: '/admin/appointments/communications/whatsapp', label: 'WhatsApp' },
        { href: '/admin/appointments/communications/whatsapp/go-live', label: 'Go-live do WhatsApp' },
        { id: 'community', label: 'Comunidade' }, { id: 'rewards', label: 'Recompensas' },
    ]},
    { id: 'business', icon: WalletCards, label: 'Negócio', items: [
        { id: 'billing', label: 'Financeiro e faturamento' }, { id: 'club-plan', label: 'Plano do clube' },
        { id: 'products', label: 'Produtos' }, { id: 'product-gateway', label: 'Catálogo' }, { id: 'sales-page', label: 'Página de vendas' },
        { id: 'vip-settings', label: 'Área VIP' }, { id: 'strategic-planner', label: 'Régua de eventos' }, { id: 'business-plan', label: 'Planejamento anual' },
    ]},
    { id: 'intelligence', icon: Bot, label: 'Inteligência e ajustes', items: [
        { id: 'ai-brain', label: 'Laboratório IA' }, { id: 'agents-dashboard', label: 'Agentes IA' },
        { id: 'approvals', label: 'Aprovações', badge: true }, { id: 'manager-learning', label: 'Gerente IA' },
        { id: 'ai-credits', label: 'Créditos IA' }, { href: '/admin/followup-settings', label: 'Regras do acompanhamento' },
        { id: 'settings', label: 'Configurações do clube' }, { href: '/admin/settings/vital', label: 'Chaves e integrações' },
    ]},
]

const SIDEBAR_EXPANDED = 272
const SIDEBAR_COLLAPSED = 76

interface AdminDashboardProps { userName?: string; tenantName?: string; role?: string; tenantId?: string; needsRepair?: boolean }

export default function AdminDashboard({ userName = 'Admin', tenantName = '', role = 'admin', tenantId = '', needsRepair = false }: AdminDashboardProps) {
    const router = useRouter()
    const { openOverlay } = useOverlays()
    const [activeView, setActiveView] = useState<ViewType>('dashboard')
    const [collapsed, setCollapsed] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(['overview']))
    const [pendingApprovals, setPendingApprovals] = useState(0)
    const [patientsAutoOpen, setPatientsAutoOpen] = useState(false)
    const [patientsInitialFilter, setPatientsInitialFilter] = useState<'vip' | 'tracking' | null>(null)
    const activeGroupId = navGroups.find(g => g.items.some(i => i.id === activeView))?.id || 'overview'

    useEffect(() => {
        setExpandedGroups(prev => {
            if (prev.has(activeGroupId)) return prev
            const next = new Set(prev); next.add(activeGroupId); return next
        })
    }, [activeGroupId])

    useEffect(() => {
        const load = () => fetch('/api/admin/approvals?status=pending').then(r => r.json()).then(d => setPendingApprovals(d.pending_count || 0)).catch(() => {})
        load(); const timer = setInterval(load, 60_000); return () => clearInterval(timer)
    }, [])

    useEffect(() => { if (needsRepair) repairProfile().then(r => { if (r.repaired) router.refresh() }).catch(console.error) }, [needsRepair, router])

    const toggleGroup = (id: string) => {
        if (collapsed) { setCollapsed(false); setExpandedGroups(new Set([id])); return }
        setExpandedGroups(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    }
    const navigate = (id: ViewType) => setActiveView(id)
    const goToNewPatient = useCallback(() => { setPatientsInitialFilter(null); setPatientsAutoOpen(true); setActiveView('patients') }, [])
    const goToPatientsFiltered = useCallback((filter: 'vip' | 'tracking') => { setPatientsAutoOpen(false); setPatientsInitialFilter(filter); setActiveView('patients') }, [])

    const renderView = () => {
        const props = { setView: setActiveView, userName, tenantName, tenantId }
        switch (activeView) {
            case 'dashboard': return <DashboardView {...props} onNewPatient={goToNewPatient} onGoToVipPatients={() => goToPatientsFiltered('vip')} onGoToTrackingPatients={() => goToPatientsFiltered('tracking')} />
            case 'methods': return <MethodsView setView={setActiveView} tenantId={tenantId} />
            case 'communication': return <CommunicationCenterView setView={setActiveView} />
            case 'protocols': return <ProtocolsView setView={setActiveView} tenantId={tenantId} />
            case 'patients': return <PatientsView setView={setActiveView} autoOpenRegister={patientsAutoOpen} onAutoOpenConsumed={() => setPatientsAutoOpen(false)} initialFilter={patientsInitialFilter} onInitialFilterConsumed={() => setPatientsInitialFilter(null)} />
            case 'rewards': return <RewardsView setView={setActiveView} />
            case 'checkins': return <CheckinsView setView={setActiveView} />
            case 'clinical-library': return <ClinicalLibraryView setView={setActiveView} tenantId={tenantId} />
            case 'sales-page': return <SalesPageGenerator setView={setActiveView} tenantId={tenantId} />
            case 'ai-brain': return <AISettingsView setView={setActiveView} tenantId={tenantId} />
            case 'ai-credits': return <AICreditsView setView={setActiveView} tenantId={tenantId} />
            case 'agents-dashboard': return <AgentsDashboardView setView={setActiveView} tenantId={tenantId} />
            case 'patient-journey': return <JourneyView setView={setActiveView} tenantId={tenantId} />
            case 'meal-plans': return <MealPlanBuilderView setView={setActiveView} tenantId={tenantId} />
            case 'appointments': return <AppointmentsView setView={setActiveView} tenantId={tenantId} tenantName={tenantName} />
            case 'professionals': return <ProfessionalsView setView={setActiveView} tenantId={tenantId} />
            case 'product-gateway': return <ProductGatewayView setView={setActiveView} tenantId={tenantId} />
            case 'strategic-planner': return <StrategicPlannerView setView={setActiveView} />
            case 'business-plan': return <BusinessPlanView setView={setActiveView} />
            case 'analytics': return <AnalyticsView setView={setActiveView} />
            case 'products': return <ProductsView setView={setActiveView} tenantId={tenantId} />
            case 'approvals': return <ApprovalsView setView={setActiveView} tenantId={tenantId} />
            case 'habits': return <HabitsView setView={setActiveView} tenantId={tenantId} />
            case 'vip-settings': return <VipSettingsView setView={setActiveView} tenantId={tenantId} />
            case 'billing': return <BillingView setView={setActiveView} tenantId={tenantId} />
            case 'manager-learning': return <ManagerLearningView setView={setActiveView} tenantId={tenantId} />
            case 'questionnaires': return <QuestionnairesView setView={setActiveView} tenantId={tenantId} />
            case 'community': return <CommunityView />
            case 'settings': return <SettingsView {...props} />
            case 'club-plan': return <ClubPlanView {...props} />
            default: return <DashboardView {...props} />
        }
    }

    const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
    return (
        <div className="min-h-screen bg-[#F4F7F6] text-[#1C2B27] flex">
            <aside style={{ width: sidebarWidth }} className="fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-[#D3DEDB] shadow-[6px_0_28px_rgba(28,43,39,0.04)] transition-[width] duration-200">
                <div className={`h-20 flex items-center border-b border-[#E0E8E6] ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
                    <button onClick={() => navigate('dashboard')} className="flex items-center gap-3 min-w-0" title="Ir para o painel">
                        <div className="h-10 w-10 rounded-2xl bg-[#E2F3EF] border border-[#B8DED5] flex items-center justify-center shrink-0"><Brain size={20} className="text-[#0D7166]" /></div>
                        {!collapsed && <div className="text-left min-w-0"><p className="text-[15px] font-black leading-tight text-[#1C2B27] truncate">{tenantName || 'NutriOS'}</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B7975] mt-0.5">Gestão clínica</p></div>}
                    </button>
                    {!collapsed && <button onClick={() => setCollapsed(true)} className="h-9 w-9 rounded-xl flex items-center justify-center text-[#667570] hover:text-[#0D7166] hover:bg-[#EAF5F2]" aria-label="Recolher menu"><PanelLeftClose size={18} /></button>}
                </div>
                {collapsed && <button onClick={() => setCollapsed(false)} className="mx-auto mt-3 h-9 w-9 rounded-xl flex items-center justify-center text-[#667570] hover:text-[#0D7166] hover:bg-[#EAF5F2]" aria-label="Expandir menu"><PanelLeftOpen size={18} /></button>}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-1">
                    {navGroups.map(group => {
                        const Icon = group.icon, groupActive = group.id === activeGroupId, expanded = !collapsed && expandedGroups.has(group.id), groupBadge = group.items.some(i => i.badge) && pendingApprovals > 0
                        return <div key={group.id}>
                            <button onClick={() => toggleGroup(group.id)} title={collapsed ? group.label : undefined} className={`w-full flex items-center rounded-xl transition-colors ${collapsed ? 'justify-center h-11' : 'gap-3 px-3 py-2.5'} ${groupActive ? 'bg-[#E2F3EF] text-[#0D7166]' : 'text-[#4E5E5A] hover:bg-[#F0F4F3] hover:text-[#1C2B27]'}`}>
                                <div className="relative shrink-0"><Icon size={18} strokeWidth={1.8} />{groupBadge && collapsed && <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />}</div>
                                {!collapsed && <><span className="flex-1 text-left text-[13px] font-bold">{group.label}</span>{groupBadge && <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>}<ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} /></>}
                            </button>
                            <AnimatePresence initial={false}>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="ml-6 pl-3 border-l border-[#DCE5E3] py-1 space-y-0.5">
                                {group.items.map(item => {
                                    const active = item.id ? activeView === item.id : false
                                    const cls = `w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition-colors ${active ? 'bg-[#EAF5F2] text-[#0D7166]' : 'text-[#5C6B67] hover:bg-[#F4F7F6] hover:text-[#1C2B27]'}`
                                    const content = <><span>{item.label}</span>{item.badge && pendingApprovals > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>}</>
                                    return item.href ? <Link key={item.href} href={item.href} className={cls}>{content}</Link> : <button key={item.id} onClick={() => item.id && navigate(item.id)} className={cls}>{content}</button>
                                })}
                            </div></motion.div>}</AnimatePresence>
                        </div>
                    })}
                </nav>
                {!collapsed && <div className="border-t border-[#E0E8E6] p-3"><Link href="/admin/settings/vital" className="flex items-center gap-3 rounded-xl border border-[#B8DED5] bg-[#F1F9F7] px-3 py-3 text-[#0D7166] hover:bg-[#E2F3EF] transition-colors"><SlidersHorizontal size={17} /><div className="min-w-0"><p className="text-xs font-black">Chaves e integrações</p><p className="text-[10px] text-[#5E726D] mt-0.5">Central de serviços vitais</p></div></Link></div>}
            </aside>
            <main style={{ marginLeft: sidebarWidth }} className="flex-1 flex flex-col min-h-screen transition-[margin] duration-200 min-w-0">
                <header className="h-20 px-5 md:px-8 flex items-center justify-between bg-white/92 backdrop-blur border-b border-[#D3DEDB] sticky top-0 z-30">
                    <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#6B7975]"><ShieldCheck size={13} className="text-[#118C7E]" />Operação da clínica</div><p className="mt-1 text-sm font-bold text-[#1C2B27] truncate">{navGroups.find(g => g.id === activeGroupId)?.label || 'Painel'}</p></div>
                    <div className="flex items-center gap-3"><Link href="/admin/attention" className="hidden lg:flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"><HeartPulse size={15} /> Prioridades do dia</Link><UserDropdown userName={userName} role={role} openOverlay={openOverlay} router={router} /></div>
                </header>
                <div className="flex-1 overflow-y-auto custom-scrollbar"><AnimatePresence mode="wait"><motion.div key={activeView} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="p-4 md:p-7 xl:p-8 max-w-[1500px] mx-auto">{renderView()}</motion.div></AnimatePresence></div>
            </main>
        </div>
    )
}

function UserDropdown({ userName, role, openOverlay, router }: { userName: string; role: string; openOverlay: (o: any) => void; router: ReturnType<typeof useRouter> }) {
    const [isOpen, setIsOpen] = useState(false)
    const menuItems = [
        { id: 'profile', label: 'Meu perfil', icon: UserIcon, onClick: () => openOverlay({ id: 'account', content: <AccountOverlay index={0} />, title: 'Meu Perfil' }) },
        { id: 'clinic', label: 'Contato da clínica', icon: Building2, onClick: () => openOverlay({ id: 'clinic', content: <ClinicSettingsOverlay index={0} />, title: 'Contato da Clínica' }) },
    ]
    const handleSignOut = async () => { await signOutAction(); router.push('/login') }
    return <div className="relative">
        <button className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-[#F0F4F3] transition-colors" onClick={() => setIsOpen(v => !v)}><div className="hidden sm:block text-right"><p className="text-xs font-bold text-[#1C2B27] leading-none">{userName}</p><p className="text-[10px] text-[#6B7975] font-semibold mt-1">{role === 'admin' ? 'Administradora' : 'Nutricionista'}</p></div><div className="h-9 w-9 rounded-xl border border-[#C7D4D1] overflow-hidden bg-[#EAF5F2]"><img src={`https://api.dicebear.com/9.x/micah/svg?seed=${userName}`} className="w-full h-full" alt="Perfil" /></div><ChevronDown size={13} className={`text-[#667570] transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
        <AnimatePresence>{isOpen && <><div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /><motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .98 }} className="absolute right-0 mt-2 w-60 bg-white border border-[#D3DEDB] rounded-2xl shadow-xl p-2 z-50">{menuItems.map(item => <button key={item.id} onClick={() => { item.onClick(); setIsOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 text-[#52615D] hover:text-[#1C2B27] hover:bg-[#F0F4F3] rounded-xl transition-colors"><item.icon size={16} /><span className="text-xs font-semibold">{item.label}</span></button>)}<Link href="/admin/settings/vital" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-[#52615D] hover:text-[#0D7166] hover:bg-[#EAF5F2] rounded-xl transition-colors"><Settings size={16} /><span className="text-xs font-semibold">Chaves e integrações</span></Link><div className="h-px bg-[#E0E8E6] my-1 mx-2" /><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"><LogOut size={16} /><span className="text-xs font-semibold">Sair do sistema</span></button></motion.div></>}</AnimatePresence>
    </div>
}
