"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    Sparkles,
    Plus,
    FileText,
    Trophy,
    CreditCard,
    BarChart3,
    Menu,
    X,
    ChevronRight,
    Crown,
    MessageCircle,
    Globe,
    Brain,
    BookOpen,
    ShieldCheck
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Sub-components
import { DashboardView } from "./views/DashboardView"
import { StrategicPlannerView } from "./views/StrategicPlannerView"
import { ProtocolsView } from "./views/ProtocolsView"
import { ChallengesView } from "./views/ChallengesView"
import { PatientsView } from "./views/PatientsView"
import { RewardsView } from "./views/RewardsView"
import { CheckinsView } from "./views/CheckinsView"
import { SalesPageGenerator } from "./views/SalesPageGenerator"
import { LibraryView } from "./views/LibraryView"
import { AISettingsView } from "./views/AISettingsView"
import { SettingsView } from "./views/SettingsView"
import { NutritionistsView } from "./views/NutritionistsView"
import { TeamView } from "./views/TeamView"

type ViewType = 'dashboard' | 'planner' | 'protocols' | 'challenges' | 'patients' | 'nutritionists' | 'team' | 'rewards' | 'checkins' | 'sales-page' | 'ai-brain' | 'library' | 'settings'

const navItems = [
    { id: 'dashboard' as ViewType, label: 'Painel Central', icon: LayoutDashboard },
    { id: 'planner' as ViewType, label: 'Estratégia', icon: Calendar },
    { id: 'protocols' as ViewType, label: 'Bio-Protocolos', icon: FileText },
    { id: 'challenges' as ViewType, label: 'Jornadas', icon: Trophy },
    { id: 'patients' as ViewType, label: 'Rainhas', icon: Users },
    { id: 'nutritionists' as ViewType, label: 'Nutricionistas', icon: ShieldCheck },
    { id: 'team' as ViewType, label: 'Equipe & Parceiros', icon: Users },
    { id: 'rewards' as ViewType, label: 'Recompensas', icon: Crown },
    { id: 'checkins' as ViewType, label: 'Check-ins IA', icon: MessageCircle },
    { id: 'library' as ViewType, label: 'Cérebro Técnico', icon: BookOpen },
    { id: 'sales-page' as ViewType, label: 'Bio-Page', icon: Globe },
    { id: 'ai-brain' as ViewType, label: 'Config. IA', icon: Brain },
    { id: 'settings' as ViewType, label: 'Sistema', icon: Settings },
]

export default function AdminDashboard() {
    const [activeView, setActiveView] = useState<ViewType>('dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const renderView = () => {
        const props = { setView: setActiveView }
        switch (activeView) {
            case 'dashboard': return <DashboardView {...props} />
            case 'planner': return <StrategicPlannerView {...props} />
            case 'protocols': return <ProtocolsView {...props} />
            case 'challenges': return <ChallengesView {...props} />
            case 'patients': return <PatientsView {...props} />
            case 'nutritionists': return <NutritionistsView {...props} />
            case 'team': return <TeamView />
            case 'rewards': return <RewardsView {...props} />
            case 'checkins': return <CheckinsView {...props} />
            case 'library': return <LibraryView {...props} />
            case 'sales-page': return <SalesPageGenerator {...props} />
            case 'ai-brain': return <AISettingsView {...props} />
            case 'settings': return <SettingsView {...props} />
            default: return <DashboardView {...props} />
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex overflow-hidden">
            {/* --- BACKGROUND BLOBS --- */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] -z-10" />
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full -z-10" />

            {/* Sidebar Clinical */}
            <aside className={`${sidebarOpen ? 'w-80' : 'w-24'} border-r border-white/10 flex flex-col fixed h-full bg-[#020617]/40 backdrop-blur-3xl transition-all duration-500 z-50 ease-in-out shadow-2xl`}>
                {/* Logo & Toggle */}
                <div className="p-8 flex items-center justify-between border-b border-white/5 h-28">
                    <div className={`flex items-center gap-4 ${!sidebarOpen && 'justify-center w-full'}`}>
                        <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-900/40 relative">
                            <Brain size={28} className="text-indigo-400" />
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-indigo-500 rounded-full border-2 border-slate-900 shadow-sm" />
                        </div>
                        {sidebarOpen && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                <h1 className="font-black text-lg text-white tracking-tight uppercase tracking-[0.05em]">Meu Club <span className="text-indigo-400 font-light">Nutri.AI</span></h1>
                                <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Admin Clinical</p>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Navigation Scrollable */}
                <nav className="flex-1 p-6 space-y-2 overflow-y-auto no-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeView === item.id
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group relative
                                    ${isActive
                                        ? 'bg-indigo-600/10 text-white border border-indigo-500/30 shadow-inner'
                                        : 'text-slate-500 hover:bg-white/[0.03] hover:text-white border border-transparent'
                                    }`}
                            >
                                <Icon size={20} className={`${isActive ? 'text-indigo-400' : 'group-hover:text-indigo-400 transition-colors'} ${!sidebarOpen && 'mx-auto'}`} />
                                {sidebarOpen && (
                                    <>
                                        <span className={`flex-1 text-left text-xs font-black uppercase tracking-widest ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
                                    </>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-full"
                                    />
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Action Footer */}
                <div className="p-8 border-t border-white/5 space-y-6 bg-slate-950/20">
                    {sidebarOpen ? (
                        <div className="space-y-4">
                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-500 border-none h-16 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-900/40 gap-3"
                                onClick={() => setActiveView('protocols')}
                            >
                                <Sparkles size={18} />
                                Ativar IA Hub
                            </Button>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                            >
                                <X size={12} /> Recolher Menu
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="w-full flex justify-center text-slate-500 hover:text-indigo-400 transition-all"
                        >
                            <Menu size={24} />
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={`flex-1 ${sidebarOpen ? 'ml-80' : 'ml-24'} transition-all duration-500 ease-in-out`}>
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
                        <div className="flex items-center gap-4 group cursor-pointer">
                            <div className="text-right">
                                <p className="text-xs font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">Dr. Lucas</p>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Master Admin</p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl border border-white/10 p-0.5 group-hover:border-indigo-500/40 transition-all">
                                <img src="https://api.dicebear.com/9.x/micah/svg?seed=AdminBoss" className="w-full h-full rounded-xl bg-slate-900" alt="admin" />
                            </div>
                        </div>
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
