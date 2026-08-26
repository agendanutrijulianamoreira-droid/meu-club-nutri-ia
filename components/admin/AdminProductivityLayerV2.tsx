"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BellRing, BookOpen, Briefcase, CalendarDays, Command, FileClock, HeartPulse, LayoutDashboard, MessageSquareText, Search, Settings2, Stethoscope, Users, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Ctx={userId:string;tenantId:string}
type Recent={id:string;route:string;title:string;work_type:string;last_opened_at:string}
type Result={id:string;kind:string;title:string;subtitle?:string;href:string}

const VIEW_TITLES:Record<string,string>={patients:"Minhas pacientes",checkins:"Check-ins",appointments:"Agenda",methods:"Métodos e fases","clinical-library":"Biblioteca clínica",protocols:"Protocolos e desafios","meal-plans":"Dietas e cardápios",communication:"Central de comunicação",billing:"Financeiro",analytics:"Indicadores",community:"Comunidade",approvals:"Aprovações",settings:"Configurações"}
const PATH_TITLES:Array<[RegExp,string]>=[[/^\/admin\/crm/,"CRM"],[/^\/admin\/attention/,"Quem precisa de mim hoje"],[/^\/admin\/followups/,"Acompanhamento"],[/^\/admin\/appointments\/communications/,"Confirmações e lembretes"],[/^\/admin\/appointments/,"Agenda"],[/^\/admin\/appointment-settings/,"Configurações da agenda"],[/^\/admin\/methods/,"Métodos e fases"]]
const COMMANDS=[
 {title:"Painel inicial",subtitle:"Centro operacional do dia",href:"/admin/dashboard",icon:LayoutDashboard},
 {title:"Caixa de pendências",subtitle:"Tudo que precisa ser resolvido",href:"/admin/inbox",icon:BellRing},
 {title:"Pacientes",subtitle:"Cadastro e acompanhamento",href:"/admin?view=patients",icon:Users},
 {title:"Agenda",subtitle:"Consultas e disponibilidade",href:"/admin?view=appointments",icon:CalendarDays},
 {title:"Quem precisa de mim hoje",subtitle:"Prioridades clínicas",href:"/admin/attention",icon:HeartPulse},
 {title:"Dietas e cardápios",subtitle:"Planejamento alimentar",href:"/admin?view=meal-plans",icon:BookOpen},
 {title:"Protocolos e desafios",subtitle:"Planejamento clínico",href:"/admin?view=protocols",icon:Stethoscope},
 {title:"CRM",subtitle:"Leads, pacientes e resgates",href:"/admin/crm",icon:Briefcase},
 {title:"Comunicação",subtitle:"Mensagens e campanhas",href:"/admin?view=communication",icon:MessageSquareText},
 {title:"Configurar painel",subtitle:"Widgets, atalhos e regras",href:"/admin/dashboard/settings",icon:Settings2},
]

function recentLabel(v:string){const m=Math.floor(Math.max(0,Date.now()-new Date(v).getTime())/60000);if(m<1)return"agora";if(m<60)return`há ${m} min`;const h=Math.floor(m/60);if(h<24)return`há ${h} h`;return`há ${Math.floor(h/24)} d`}
function routeTitle(path:string,view:string|null){if(path==="/admin"&&view)return VIEW_TITLES[view]||null;for(const[p,t]of PATH_TITLES)if(p.test(path))return t;return null}

export function AdminProductivityLayerV2({children}:{children:React.ReactNode}){
 const pathname=usePathname()||"/admin";const params=useSearchParams();const router=useRouter()
 const [ctx,setCtx]=useState<Ctx|null>(null);const[open,setOpen]=useState(false);const[query,setQuery]=useState("");const[results,setResults]=useState<Result[]>([]);const[searching,setSearching]=useState(false);const[recent,setRecent]=useState<Recent[]>([]);const[inboxCount,setInboxCount]=useState(0)
 const queryString=params?.toString()||"";const view=params?.get("view")||null;const isDashboard=pathname==="/admin/dashboard"

 const resolveContext=useCallback(async()=>{const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data:p}=await supabase.from("profiles").select("tenant_id,role").eq("user_id",user.id).maybeSingle();const role=String(p?.role||"").toLowerCase();if(!p?.tenant_id||!["admin","nutritionist","nutri"].includes(role))return null;return{userId:user.id,tenantId:p.tenant_id as string}},[])
 const refresh=useCallback(async(c:Ctx)=>{const now=new Date().toISOString();const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const[a,b,d,e,f]=await Promise.all([
  supabase.from("admin_recent_work").select("id,route,title,work_type,last_opened_at").eq("user_id",c.userId).eq("tenant_id",c.tenantId).order("last_opened_at",{ascending:false}).limit(4),
  supabase.from("agent_pending_actions").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("status","pending"),
  supabase.from("appointment_communication_jobs").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).in("status",["failed","sending"]),
  supabase.from("crm_contacts").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("do_not_contact",false).not("next_action_at","is",null).lte("next_action_at",now),
  supabase.from("patient_risk_scores").select("id",{count:"exact",head:true}).eq("tenant_id",c.tenantId).eq("calculated_date",today).in("attention_bucket",["critical","today"]),
 ]);setRecent((a.data||[])as Recent[]);setInboxCount((b.count||0)+(d.count||0)+(e.count||0)+(f.count||0))},[])

 useEffect(()=>{let alive=true;resolveContext().then(c=>{if(!alive||!c)return;setCtx(c);refresh(c)});return()=>{alive=false}},[resolveContext,refresh])
 useEffect(()=>{const h=(ev:KeyboardEvent)=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==="k"){ev.preventDefault();setOpen(v=>!v)}if(ev.key==="Escape")setOpen(false)};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[])
 useEffect(()=>{const title=routeTitle(pathname,view);if(!ctx||!title)return;const route=queryString?`${pathname}?${queryString}`:pathname;const timer=window.setTimeout(async()=>{await supabase.from("admin_recent_work").upsert({tenant_id:ctx.tenantId,user_id:ctx.userId,route,title,work_type:view||pathname.split("/").filter(Boolean).pop()||"admin",last_opened_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,tenant_id,route"});refresh(ctx)},650);return()=>window.clearTimeout(timer)},[ctx,pathname,queryString,view,refresh])
 useEffect(()=>{if(!open||!ctx)return;const q=query.trim();if(q.length<2){setResults([]);setSearching(false);return}let alive=true;const timer=window.setTimeout(async()=>{setSearching(true);const pattern=`%${q}%`;const[p,c,pr,r]=await Promise.all([
  supabase.from("profiles").select("user_id,name,email").eq("tenant_id",ctx.tenantId).eq("role","patient").ilike("name",pattern).limit(5),
  supabase.from("crm_contacts").select("id,name,email").eq("tenant_id",ctx.tenantId).ilike("name",pattern).limit(5),
  supabase.from("protocols").select("id,title,category").eq("tenant_id",ctx.tenantId).ilike("title",pattern).limit(5),
  supabase.from("recipes").select("id,title").eq("tenant_id",ctx.tenantId).ilike("title",pattern).limit(5),
 ]);if(!alive)return;setResults([...(p.data||[]).map((x:any)=>({id:`p-${x.user_id}`,kind:"Paciente",title:x.name||"Paciente",subtitle:x.email||"",href:`/admin?view=patients&search=${encodeURIComponent(x.name||"")}`})),...(c.data||[]).map((x:any)=>({id:`c-${x.id}`,kind:"CRM",title:x.name||"Contato",subtitle:x.email||"",href:`/admin/crm?search=${encodeURIComponent(x.name||"")}`})),...(pr.data||[]).map((x:any)=>({id:`pr-${x.id}`,kind:"Protocolo",title:x.title,subtitle:x.category||"",href:`/admin?view=protocols&search=${encodeURIComponent(x.title||"")}`})),...(r.data||[]).map((x:any)=>({id:`r-${x.id}`,kind:"Receita",title:x.title,subtitle:"Biblioteca clínica",href:`/admin?view=clinical-library&search=${encodeURIComponent(x.title||"")}`}))].slice(0,14));setSearching(false)},250);return()=>{alive=false;window.clearTimeout(timer)}},[open,query,ctx])
 const commands=useMemo(()=>{const q=query.trim().toLowerCase();return(q?COMMANDS.filter(x=>`${x.title} ${x.subtitle}`.toLowerCase().includes(q)):COMMANDS).slice(0,7)},[query])
 const go=(href:string)=>{setOpen(false);setQuery("");router.push(href)}

 return<>
  {isDashboard&&<div className="theme-admin-light bg-[#F4F7F6] px-4 pt-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl grid gap-3 lg:grid-cols-[1fr_auto]">
   <section className="rounded-2xl border border-[#DCE6E3] bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#0D7166]">Continuar de onde parei</p><p className="text-xs text-[#687772]">Seus últimos contextos de trabalho</p></div><FileClock size={18} className="text-[#6A7B76]"/></div><div className="flex flex-wrap gap-2">{recent.length?recent.slice(0,3).map(x=><Link key={x.id} href={x.route} className="min-w-[180px] flex-1 rounded-xl border border-[#E3EAE8] bg-[#F8FAF9] px-3 py-2.5 hover:border-[#9BCBC0] hover:bg-[#F1F8F6]"><p className="text-sm font-black text-[#24332F]">{x.title}</p><p className="mt-0.5 text-[11px] text-[#73807C]">{recentLabel(x.last_opened_at)}</p></Link>):<p className="text-sm text-[#687772]">Seu histórico aparecerá aqui conforme você usar o sistema.</p>}</div></section>
   <Link href="/admin/inbox" className="rounded-2xl border border-[#CFE2DE] bg-[#EAF5F2] p-4 min-w-[220px] flex items-center gap-3 hover:bg-[#E0F1ED]"><div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center text-[#0D7166]"><BellRing size={20}/></div><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#0D7166]">Caixa de pendências</p><p className="text-2xl font-black text-[#1C2B27]">{inboxCount}</p><p className="text-[11px] text-[#687772]">itens para resolver</p></div></Link>
  </div></div>}
  {children}
  <div className="fixed bottom-5 right-5 z-[70] flex gap-2"><Link href="/admin/inbox" className="relative h-12 w-12 rounded-2xl border border-[#D3DEDB] bg-white shadow-lg flex items-center justify-center text-[#52615D] hover:text-[#0D7166]" title="Caixa de pendências"><BellRing size={18}/>{inboxCount>0&&<span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 rounded-full bg-[#B84B4B] px-1 text-[10px] font-black text-white flex items-center justify-center">{inboxCount>99?"99+":inboxCount}</span>}</Link><button onClick={()=>setOpen(true)} className="h-12 rounded-2xl bg-[#0D7166] px-4 shadow-lg text-white flex items-center gap-2 text-sm font-black hover:bg-[#0A5F56]" title="Busca universal (Ctrl+K)"><Search size={18}/><span className="hidden sm:inline">Buscar</span><span className="hidden md:inline rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">Ctrl K</span></button></div>
  {open&&<div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#14211D]/35 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#CFDBD8] bg-white shadow-2xl"><div className="flex items-center gap-3 border-b border-[#E2E9E7] px-5 py-4"><Search size={20} className="text-[#0D7166]"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar paciente, protocolo, receita ou comando..." className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#1C2B27] outline-none placeholder:text-[#899590]"/><button onClick={()=>setOpen(false)} className="h-9 w-9 rounded-xl bg-[#F1F5F4] flex items-center justify-center text-[#6A7975]"><X size={17}/></button></div><div className="max-h-[62vh] overflow-y-auto p-3"><p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-[#84918D]">Ações rápidas</p>{commands.map(({title,subtitle,href,icon:Icon})=><button key={href} onClick={()=>go(href)} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#F2F8F6]"><div className="h-9 w-9 rounded-xl bg-[#EAF5F2] flex items-center justify-center text-[#0D7166]"><Icon size={17}/></div><div className="flex-1"><p className="text-sm font-black text-[#24332F]">{title}</p><p className="text-xs text-[#75827E]">{subtitle}</p></div><Command size={14} className="text-[#A3ACA9]"/></button>)}{query.trim().length>=2&&<><div className="my-3 border-t border-[#E7ECEB]"/><p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-[#84918D]">Resultados</p>{searching?<p className="px-3 py-4 text-sm text-[#687772]">Buscando...</p>:results.length?results.map(x=><button key={x.id} onClick={()=>go(x.href)} className="w-full rounded-2xl px-3 py-3 text-left hover:bg-[#F7F9F8]"><div className="flex items-center gap-2"><span className="rounded-full bg-[#EEF4F2] px-2 py-0.5 text-[10px] font-black text-[#5E716B]">{x.kind}</span><p className="text-sm font-black text-[#24332F]">{x.title}</p></div>{x.subtitle&&<p className="mt-1 text-xs text-[#7A8783]">{x.subtitle}</p>}</button>):<p className="px-3 py-4 text-sm text-[#687772]">Nenhum resultado encontrado.</p>}</>}</div></div></div>}
 </>
}
