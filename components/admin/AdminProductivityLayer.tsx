"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BellRing, BookOpen, Briefcase, CalendarDays, Command, FileClock, HeartPulse,
  LayoutDashboard, MessageSquareText, Search, Settings2, Stethoscope, Users, X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

type RecentWork = { id:string; route:string; title:string; work_type:string; last_opened_at:string }
type SearchResult = { id:string; kind:string; title:string; subtitle?:string; href:string }

type TenantContext = { userId:string; tenantId:string }

const VIEW_TITLES: Record<string,string> = {
  patients: "Minhas pacientes",
  checkins: "Check-ins",
  appointments: "Agenda",
  methods: "Métodos e fases",
  "clinical-library": "Biblioteca clínica",
  protocols: "Protocolos e desafios",
  "meal-plans": "Dietas e cardápios",
  communication: "Central de comunicação",
  billing: "Financeiro",
  analytics: "Indicadores",
  community: "Comunidade",
  approvals: "Aprovações",
  settings: "Configurações",
}

const PATH_TITLES: Array<[RegExp,string]> = [
  [/^\/admin\/crm/, "CRM"],
  [/^\/admin\/attention/, "Quem precisa de mim hoje"],
  [/^\/admin\/followups/, "Acompanhamento"],
  [/^\/admin\/appointments\/communications/, "Confirmações e lembretes"],
  [/^\/admin\/appointments/, "Agenda"],
  [/^\/admin\/appointment-settings/, "Configurações da agenda"],
  [/^\/admin\/methods/, "Métodos e fases"],
]

const COMMANDS = [
  { title:"Painel inicial", subtitle:"Centro operacional do dia", href:"/admin/dashboard", icon:LayoutDashboard },
  { title:"Caixa de pendências", subtitle:"Tudo que precisa ser resolvido", href:"/admin/inbox", icon:BellRing },
  { title:"Pacientes", subtitle:"Cadastro e acompanhamento", href:"/admin?view=patients", icon:Users },
  { title:"Agenda", subtitle:"Consultas e disponibilidade", href:"/admin?view=appointments", icon:CalendarDays },
  { title:"Quem precisa de mim hoje", subtitle:"Prioridades clínicas", href:"/admin/attention", icon:HeartPulse },
  { title:"Dietas e cardápios", subtitle:"Planejamento alimentar", href:"/admin?view=meal-plans", icon:BookOpen },
  { title:"Protocolos e desafios", subtitle:"Biblioteca de protocolos", href:"/admin?view=protocols", icon:Stethoscope },
  { title:"CRM", subtitle:"Leads, pacientes e resgates", href:"/admin/crm", icon:Briefcase },
  { title:"Comunicação", subtitle:"Mensagens e campanhas", href:"/admin?view=communication", icon:MessageSquareText },
  { title:"Configurar painel", subtitle:"Widgets, atalhos e regras", href:"/admin/dashboard/settings", icon:Settings2 },
]

function relativeTime(value:string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const min = Math.floor(diff/60000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min/60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h/24)
  return `há ${d} d`
}

function routeTitle(pathname:string, view:string|null) {
  if (pathname === "/admin" && view) return VIEW_TITLES[view] || null
  for (const [pattern,title] of PATH_TITLES) if (pattern.test(pathname)) return title
  return null
}

export function AdminProductivityLayer({ children }: { children:React.ReactNode }) {
  const pathname = usePathname() || "/admin"
  const searchParams = useSearchParams()
  const router = useRouter()
  const [ctx,setCtx] = useState<TenantContext|null>(null)
  const [paletteOpen,setPaletteOpen] = useState(false)
  const [query,setQuery] = useState("")
  const [results,setResults] = useState<SearchResult[]>([])
  const [searching,setSearching] = useState(false)
  const [recent,setRecent] = useState<RecentWork[]>([])
  const [inboxCount,setInboxCount] = useState(0)

  const isDashboard = pathname === "/admin/dashboard"
  const queryString = searchParams?.toString() || ""
  const currentView = searchParams?.get("view") || null

  const loadContext = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data:profile } = await supabase.from("profiles").select("tenant_id,role").eq("user_id",user.id).maybeSingle()
    const role = String(profile?.role || "").toLowerCase()
    if (!profile?.tenant_id || !["admin","nutritionist","nutri"].includes(role)) return null
    const next = { userId:user.id, tenantId:profile.tenant_id as string }
    setCtx(next)
    return next
  },[])

  const loadProductivity = useCallback(async (context?:TenantContext|null) => {
    const c = context || ctx || await loadContext()
    if (!c) return
    const now = new Date().toISOString()
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
    const [recentRes,pendingRes,failedRes,crmRes,riskRes] = await Promise.all([
      supabase.from("admin_recent_work").select("id,route,title,work_type,last_opened_at").eq("user_id",c.userId).eq("tenant_id",c.tenantId).order("last_opened_at",{ascending:false}).limit(4),
      supabase.from("agent_pending_actions").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("status","pending"),
      supabase.from("appointment_communication_jobs").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).in("status",["failed","sending"]),
      supabase.from("crm_contacts").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("do_not_contact",false).not("next_action_at","is",null).lte("next_action_at",now),
      supabase.from("patient_risk_scores").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("calculated_date",today).in("attention_bucket",["critical","today"]),
    ])
    setRecent((recentRes.data||[]) as RecentWork[])
    setInboxCount((pendingRes.count||0)+(failedRes.count||0)+(crmRes.count||0)+(riskRes.count||0))
  },[ctx,loadContext])

  useEffect(()=>{ loadContext().then(loadProductivity) },[loadContext,loadProductivity])

  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==="k") {
        event.preventDefault(); setPaletteOpen(v=>!v)
      }
      if (event.key==="Escape") setPaletteOpen(false)
    }
    window.addEventListener("keydown",handler)
    return ()=>window.removeEventListener("keydown",handler)
  },[])

  useEffect(()=>{
    const title = routeTitle(pathname,currentView)
    if (!ctx || !title) return
    const route = queryString ? `${pathname}?${queryString}` : pathname
    const timer = window.setTimeout(async ()=>{
      await supabase.from("admin_recent_work").upsert({
        tenant_id:ctx.tenantId,
        user_id:ctx.userId,
        route,
        title,
        work_type: currentView || pathname.split("/").filter(Boolean).pop() || "admin",
        last_opened_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      },{onConflict:"user_id,tenant_id,route"})
      loadProductivity(ctx)
    },700)
    return ()=>window.clearTimeout(timer)
  },[ctx,pathname,queryString,currentView,loadProductivity])

  useEffect(()=>{
    if (!paletteOpen || !ctx) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    let cancelled=false
    const timer=window.setTimeout(async ()=>{
      setSearching(true)
      const pattern=`%${q}%`
      const [patients,crm,protocols,recipes] = await Promise.all([
        supabase.from("profiles").select("user_id,name,email").eq("tenant_id",ctx.tenantId).eq("role","patient").ilike("name",pattern).limit(5),
        supabase.from("crm_contacts").select("id,name,email").eq("tenant_id",ctx.tenantId).ilike("name",pattern).limit(5),
        supabase.from("protocols").select("id,title,category").eq("tenant_id",ctx.tenantId).ilike("title",pattern).limit(5),
        supabase.from("recipes").select("id,title,description").eq("tenant_id",ctx.tenantId).ilike("title",pattern).limit(5),
      ])
      if (cancelled) return
      const merged:SearchResult[] = [
        ...(patients.data||[]).map((p:any)=>({id:`patient-${p.user_id}`,kind:"Paciente",title:p.name||"Paciente",subtitle:p.email||"Abrir pacientes",href:`/admin?view=patients&search=${encodeURIComponent(p.name||"")}`})),
        ...(crm.data||[]).map((p:any)=>({id:`crm-${p.id}`,kind:"CRM",title:p.name||"Contato",subtitle:p.email||"Abrir CRM",href:`/admin/crm?search=${encodeURIComponent(p.name||"")}`})),
        ...(protocols.data||[]).map((p:any)=>({id:`protocol-${p.id}`,kind:"Protocolo",title:p.title,subtitle:p.category||"Planejamento clínico",href:`/admin?view=protocols&search=${encodeURIComponent(p.title||"")}`})),
        ...(recipes.data||[]).map((p:any)=>({id:`recipe-${p.id}`,kind:"Receita",title:p.title,subtitle:"Biblioteca clínica",href:`/admin?view=clinical-library&search=${encodeURIComponent(p.title||"")}`})),
      ]
      setResults(merged.slice(0,14)); setSearching(false)
    },250)
    return ()=>{cancelled=true; window.clearTimeout(timer)}
  },[paletteOpen,query,ctx])

  const visibleCommands = useMemo(()=>{
    const q=query.trim().toLowerCase()
    return q ? COMMANDS.filter(c=>`${c.title} ${c.subtitle}`.toLowerCase().includes(q)).slice(0,6) : COMMANDS.slice(0,7)
  },[query])

  const go=(href:string)=>{ setPaletteOpen(false); setQuery(""); router.push(href) }

  return <>
    {isDashboard && <div className="theme-admin-light bg-[#F4F7F6] px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl grid gap-3 lg:grid-cols-[1fr_auto]">
        <section className="rounded-2xl border border-[#DCE6E3] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#0D7166]">Continuar de onde parei</p><p className="text-xs text-[#687772]">Seus últimos contextos de trabalho</p></div><FileClock size={18} className="text-[#6A7B76]"/></div>
          <div className="flex flex-wrap gap-2">{recent.length?recent.slice(0,3).map(item=><Link key={item.id} href={item.route} className="min-w-[180px] flex-1 rounded-xl border border-[#E3EAE8] bg-[#F8FAF9] px-3 py-2.5 hover:border-[#9BCBC0] hover:bg-[#F1F8F6]"><p className="text-sm font-black text-[#24332F]">{item.title}</p><p className="mt-0.5 text-[11px] text-[#73807C]">{relativeTime(item.last_opened_at)}</p></Link>):<p className="text-sm text-[#687772]">Seu histórico aparecerá aqui conforme você usar o sistema.</p>}</div>
        </section>
        <Link href="/admin/inbox" className="rounded-2xl border border-[#CFE2DE] bg-[#EAF5F2] p-4 min-w-[220px] flex items-center gap-3 hover:bg-[#E0F1ED]"><div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center text-[#0D7166]"><BellRing size={20}/></div><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#0D7166]">Caixa de pendências</p><p className="text-2xl font-black text-[#1C2B27]">{inboxCount}</p><p className="text-[11px] text-[#687772]">itens para resolver</p></div></Link>
      </div>
    </div>}

    {children}

    <div className="fixed bottom-5 right-5 z-[70] flex gap-2">
      <Link href="/admin/inbox" className="relative h-12 w-12 rounded-2xl border border-[#D3DEDB] bg-white shadow-lg flex items-center justify-center text-[#52615D] hover:text-[#0D7166]" title="Caixa de pendências"><BellRing size={18}/>{inboxCount>0&&<span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 rounded-full bg-[#B84B4B] px-1 text-[10px] font-black text-white flex items-center justify-center">{inboxCount>99?"99+":inboxCount}</span>}</Link>
      <button onClick={()=>setPaletteOpen(true)} className="h-12 rounded-2xl bg-[#0D7166] px-4 shadow-lg text-white flex items-center gap-2 text-sm font-black hover:bg-[#0A5F56]" title="Busca universal (Ctrl+K)"><Search size={18}/><span className="hidden sm:inline">Buscar</span><span className="hidden md:inline rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">Ctrl K</span></button>
    </div>

    {paletteOpen && <div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#14211D]/35 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e)=>{if(e.currentTarget===e.target)setPaletteOpen(false)}}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#CFDBD8] bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#E2E9E7] px-5 py-4"><Search size={20} className="text-[#0D7166]"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar paciente, protocolo, receita ou comando..." className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#1C2B27] outline-none placeholder:text-[#899590]"/><button onClick={()=>setPaletteOpen(false)} className="h-9 w-9 rounded-xl bg-[#F1F5F4] flex items-center justify-center text-[#6A7975]"><X size={17}/></button></div>
        <div className="max-h-[62vh] overflow-y-auto p-3">
          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-[#84918D]">Ações rápidas</p>
          {visibleCommands.map(({title,subtitle,href,icon:Icon})=><button key={href} onClick={()=>go(href)} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#F2F8F6]"><div className="h-9 w-9 rounded-xl bg-[#EAF5F2] flex items-center justify-center text-[#0D7166]"><Icon size={17}/></div><div className="flex-1"><p className="text-sm font-black text-[#24332F]">{title}</p><p className="text-xs text-[#75827E]">{subtitle}</p></div><Command size={14} className="text-[#A3ACA9]"/></button>)}
          {(query.trim().length>=2) && <><div className="my-3 border-t border-[#E7ECEB]"/><p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-[#84918D]">Resultados</p>{searching?<p className="px-3 py-4 text-sm text-[#687772]">Buscando...</p>:results.length?results.map(r=><button key={r.id} onClick={()=>go(r.href)} className="w-full flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#F7F9F8]"><div><div className="flex items-center gap-2"><span className="rounded-full bg-[#EEF4F2] px-2 py-0.5 text-[10px] font-black text-[#5E716B]">{r.kind}</span><p className="text-sm font-black text-[#24332F]">{r.title}</p></div>{r.subtitle&&<p className="mt-1 text-xs text-[#7A8783]">{r.subtitle}</p>}</div></button>):<p className="px-3 py-4 text-sm text-[#687772]">Nenhum resultado encontrado.</p>}</>}
        </div>
      </div>
    </div>}
  </>
}
