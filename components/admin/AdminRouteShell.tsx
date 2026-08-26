"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard, Users, Briefcase, CalendarDays, Stethoscope,
  MessageSquareText, WalletCards, Bot, Settings, SlidersHorizontal,
  Menu, X, ChevronRight,
} from "lucide-react"

const PRIMARY = [
  { label: "Início", href: "/admin", icon: LayoutDashboard, match: (p: string) => p === "/admin" },
  { label: "Pacientes", href: "/admin?view=patients", icon: Users, match: (p: string) => p.startsWith("/admin/patient") || p.startsWith("/admin/followup") },
  { label: "CRM", href: "/admin/crm", icon: Briefcase, match: (p: string) => p.startsWith("/admin/crm") },
  { label: "Atendimento", href: "/admin?view=appointments", icon: CalendarDays, match: (p: string) => p.startsWith("/admin/appointment") || p.startsWith("/admin/appointments") },
  { label: "Planejamento clínico", href: "/admin?view=methods", icon: Stethoscope, match: (p: string) => p.startsWith("/admin/method") || p.startsWith("/admin/protocol") },
  { label: "Comunicação", href: "/admin?view=communication", icon: MessageSquareText, match: (p: string) => p.startsWith("/admin/communication") },
  { label: "Negócio", href: "/admin?view=billing", icon: WalletCards, match: (p: string) => p.startsWith("/admin/billing") || p.startsWith("/admin/product") || p.startsWith("/admin/sales") },
  { label: "Inteligência", href: "/admin?view=ai-brain", icon: Bot, match: (p: string) => p.startsWith("/admin/ai") || p.startsWith("/admin/approval") },
]

const EXCLUDED = ["/admin/clinic", "/admin/reset-password"]

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <div className="flex h-full flex-col bg-white text-[#1C2B27]">
    <div className="h-20 border-b border-[#E0E8E6] px-5 flex items-center">
      <Link href="/admin" onClick={onNavigate} className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 shrink-0 rounded-2xl bg-[#E2F3EF] border border-[#B8DED5] flex items-center justify-center font-black text-[#0D7166]">N</div>
        <div className="min-w-0"><p className="font-black text-sm truncate">NutriOS</p><p className="text-[10px] uppercase tracking-[.16em] text-[#6B7975] font-bold">Gestão clínica</p></div>
      </Link>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {PRIMARY.map(item => {
        const Icon = item.icon
        const active = item.match(pathname)
        return <Link key={item.label} href={item.href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors ${active ? "bg-[#E2F3EF] text-[#0D7166]" : "text-[#52615D] hover:bg-[#F0F4F3] hover:text-[#1C2B27]"}`}>
          <Icon size={18} strokeWidth={1.8} className="shrink-0" /><span className="flex-1">{item.label}</span>{active && <ChevronRight size={14} />}
        </Link>
      })}
    </nav>
    <div className="border-t border-[#E0E8E6] p-3 space-y-1">
      <Link href="/admin?view=settings" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#52615D] hover:bg-[#F0F4F3] hover:text-[#1C2B27]"><Settings size={17} />Configurações</Link>
      <Link href="/admin/settings/vital" onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-bold ${pathname.startsWith('/admin/settings/vital') ? 'bg-[#E2F3EF] text-[#0D7166]' : 'text-[#52615D] hover:bg-[#F0F4F3] hover:text-[#0D7166]'}`}><SlidersHorizontal size={17} />Integrações</Link>
    </div>
  </div>
}

export function AdminRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin"
  const [open, setOpen] = useState(false)

  if (pathname === "/admin" || EXCLUDED.some(p => pathname.startsWith(p))) return <>{children}</>

  return <div className="theme-admin-light min-h-screen bg-[#F4F7F6] text-[#1C2B27]">
    <aside className="hidden lg:block fixed inset-y-0 left-0 z-50 w-[248px] border-r border-[#D3DEDB] shadow-[6px_0_28px_rgba(28,43,39,0.035)]"><Nav pathname={pathname} /></aside>
    <div className="lg:ml-[248px] min-h-screen">
      <div className="lg:hidden sticky top-0 z-40 h-16 bg-white/95 backdrop-blur border-b border-[#D3DEDB] px-4 flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="h-10 w-10 rounded-xl border border-[#D3DEDB] flex items-center justify-center text-[#52615D]" aria-label="Abrir navegação"><Menu size={19} /></button>
        <Link href="/admin" className="font-black text-sm">NutriOS</Link>
        <Link href="/admin/settings/vital" className="h-10 w-10 rounded-xl border border-[#D3DEDB] flex items-center justify-center text-[#52615D]" aria-label="Integrações"><SlidersHorizontal size={18} /></Link>
      </div>
      {children}
    </div>
    {open && <div className="lg:hidden fixed inset-0 z-[90]">
      <button className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Fechar navegação" />
      <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-[300px] shadow-2xl">
        <button onClick={() => setOpen(false)} className="absolute right-3 top-5 z-10 h-9 w-9 rounded-xl bg-[#F0F4F3] text-[#52615D] flex items-center justify-center" aria-label="Fechar menu"><X size={18} /></button>
        <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
      </aside>
    </div>}
  </div>
}
