import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  AlertTriangle, ArrowRight, BellRing, Briefcase, CalendarClock, CheckCircle2,
  Clock3, HeartPulse, MessageSquareWarning, RefreshCw, UserRoundCheck,
} from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type InboxItem = {
  id:string
  source:"attention"|"followup"|"crm"|"communication"|"appointment"
  priority:1|2|3
  title:string
  description:string
  meta?:string
  href:string
  createdAt?:string|null
}

function todaySP() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
}
function dateTime(value:string|null|undefined) {
  if (!value) return "Sem prazo"
  return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value))
}
function sourceLabel(source:InboxItem["source"]) {
  return source==="attention"?"Atenção clínica":source==="followup"?"Acompanhamento":source==="crm"?"CRM":source==="communication"?"Comunicação":"Agenda"
}
function sourceStyle(source:InboxItem["source"]) {
  if(source==="attention") return "bg-[#FFF1E8] text-[#A2571D]"
  if(source==="communication") return "bg-[#FFF0F0] text-[#A23C3C]"
  if(source==="crm") return "bg-[#F1F0FF] text-[#5D52B6]"
  if(source==="appointment") return "bg-[#EAF5F2] text-[#0D7166]"
  return "bg-[#EEF3FF] text-[#4166A6]"
}

export default async function AdminInboxPage() {
  const supabase = createSupabaseServerClient(cookies())
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data:viewer } = await supabase.from("profiles").select("tenant_id,role").eq("user_id",user.id).maybeSingle()
  const role=String(viewer?.role||"").toLowerCase()
  if(!viewer?.tenant_id || !["admin","nutritionist","nutri"].includes(role)) redirect("/patient/home")

  const tenantId=viewer.tenant_id
  const now=new Date()
  const nowIso=now.toISOString()
  const in48=new Date(now.getTime()+48*60*60*1000).toISOString()
  const today=todaySP()

  const [risksRes,actionsRes,crmRes,commRes,appointmentsRes,patientsRes] = await Promise.all([
    supabase.from("patient_risk_scores").select("id,user_id,overall_risk,attention_bucket,lifecycle_next_action,days_since_activity,calculated_at").eq("tenant_id",tenantId).eq("calculated_date",today).in("attention_bucket",["critical","today"]).order("overall_risk",{ascending:false}).limit(30),
    supabase.from("agent_pending_actions").select("id,title,target_patient_name,action_type,scheduled_for,created_at").eq("tenant_id",tenantId).eq("status","pending").order("scheduled_for",{ascending:true,nullsFirst:false}).limit(30),
    supabase.from("crm_contacts").select("id,name,next_action_at,recency_segment,phone").eq("tenant_id",tenantId).eq("do_not_contact",false).not("next_action_at","is",null).lte("next_action_at",nowIso).order("next_action_at",{ascending:true}).limit(30),
    supabase.from("appointment_communication_jobs").select("id,appointment_id,patient_id,kind,status,last_error,failed_at,updated_at,channel").eq("tenant_id",tenantId).in("status",["failed","sending"]).order("updated_at",{ascending:false}).limit(30),
    supabase.from("appointments").select("id,patient_id,scheduled_at,appointment_type,status,confirmation_sent").eq("tenant_id",tenantId).gte("scheduled_at",nowIso).lte("scheduled_at",in48).eq("status","scheduled").order("scheduled_at",{ascending:true}).limit(30),
    supabase.from("profiles").select("id,user_id,name").eq("tenant_id",tenantId).eq("role","patient"),
  ])

  const patients=patientsRes.data||[]
  const byUser=new Map(patients.map((p:any)=>[p.user_id,p.name||"Paciente"]))
  const byProfile=new Map(patients.map((p:any)=>[p.id,p.name||"Paciente"]))

  const items:InboxItem[]=[]
  for(const row of risksRes.data||[]) items.push({
    id:`risk-${row.id}`,source:"attention",priority:row.attention_bucket==="critical"?1:2,
    title:byUser.get(row.user_id)||"Paciente em atenção",
    description:row.lifecycle_next_action||`${row.days_since_activity||0} dias sem atividade`,
    meta:`Risco ${Math.round(Number(row.overall_risk||0))}/100`,href:"/admin/attention",createdAt:row.calculated_at,
  })
  for(const row of actionsRes.data||[]) items.push({
    id:`action-${row.id}`,source:"followup",priority:row.scheduled_for && new Date(row.scheduled_for)<=now?1:2,
    title:row.target_patient_name||row.title||"Ação de acompanhamento",
    description:row.title||String(row.action_type||"").replaceAll("_"," "),
    meta:row.scheduled_for?`Prazo ${dateTime(row.scheduled_for)}`:"Sem prazo definido",href:"/admin/followups",createdAt:row.created_at,
  })
  for(const row of crmRes.data||[]) items.push({
    id:`crm-${row.id}`,source:"crm",priority:2,title:row.name||"Contato do CRM",
    description:"Próxima ação comercial está vencida",meta:`Desde ${dateTime(row.next_action_at)}`,
    href:"/admin/crm",createdAt:row.next_action_at,
  })
  for(const row of commRes.data||[]) items.push({
    id:`comm-${row.id}`,source:"communication",priority:1,
    title:row.status==="sending"?"Envio em estado incerto":"Falha de comunicação",
    description:row.last_error||`${row.kind||"Mensagem"} · ${row.channel||"canal não informado"}`,
    meta:row.status==="sending"?"Revisão manual recomendada":"Entrega falhou",href:"/admin/appointments/communications",createdAt:row.failed_at||row.updated_at,
  })
  for(const row of appointmentsRes.data||[]) items.push({
    id:`appointment-${row.id}`,source:"appointment",priority:3,
    title:byProfile.get(row.patient_id)||"Consulta próxima",
    description:`${row.appointment_type||"Consulta"} ainda não confirmada`,meta:dateTime(row.scheduled_at),
    href:"/admin?view=appointments",createdAt:row.scheduled_at,
  })

  items.sort((a,b)=>a.priority-b.priority || new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime())
  const counts={
    critical:items.filter(i=>i.priority===1).length,
    today:items.filter(i=>i.priority===2).length,
    watch:items.filter(i=>i.priority===3).length,
  }

  return <main className="min-h-screen bg-[#F4F7F6] text-[#1C2B27] p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#0D7166]">Centro operacional</p><h1 className="mt-1 text-3xl font-black">Caixa de pendências</h1><p className="mt-1 max-w-2xl text-sm text-[#687772]">Uma única fila para resolver o que está aberto na clínica. O item desaparece quando a pendência é realmente resolvida no módulo de origem.</p></div>
        <div className="flex gap-2"><Link href="/admin/dashboard" className="rounded-xl border border-[#D5E0DD] bg-white px-4 py-2.5 text-sm font-black text-[#52615D]">Voltar ao painel</Link><Link href="/admin/inbox" className="h-11 w-11 rounded-xl border border-[#D5E0DD] bg-white flex items-center justify-center text-[#0D7166]" title="Atualizar"><RefreshCw size={17}/></Link></div>
      </header>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#F0D5D1] bg-white p-4"><div className="flex items-center justify-between"><MessageSquareWarning size={18} className="text-[#A23C3C]"/><span className="text-2xl font-black">{counts.critical}</span></div><p className="mt-3 text-sm font-black">Prioridade alta</p><p className="text-xs text-[#71807B]">Falhas, risco crítico e tarefas vencidas</p></div>
        <div className="rounded-2xl border border-[#E8DCCB] bg-white p-4"><div className="flex items-center justify-between"><Clock3 size={18} className="text-[#A2571D]"/><span className="text-2xl font-black">{counts.today}</span></div><p className="mt-3 text-sm font-black">Resolver hoje</p><p className="text-xs text-[#71807B]">Acompanhamento, risco e CRM</p></div>
        <div className="rounded-2xl border border-[#CFE2DE] bg-white p-4"><div className="flex items-center justify-between"><CalendarClock size={18} className="text-[#0D7166]"/><span className="text-2xl font-black">{counts.watch}</span></div><p className="mt-3 text-sm font-black">Acompanhar</p><p className="text-xs text-[#71807B]">Consultas próximas sem confirmação</p></div>
      </section>

      {items.length===0?<section className="rounded-3xl border border-[#CFE2DE] bg-white p-10 text-center shadow-sm"><CheckCircle2 size={34} className="mx-auto mb-3 text-[#43806D]"/><h2 className="text-xl font-black">Sua caixa está zerada</h2><p className="mt-1 text-sm text-[#687772]">Nenhuma pendência operacional encontrada agora.</p></section>:<section className="overflow-hidden rounded-3xl border border-[#DCE6E3] bg-white shadow-sm">
        <div className="border-b border-[#E5ECEA] px-5 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EAF5F2] p-2 text-[#0D7166]"><BellRing size={19}/></div><div><h2 className="font-black">Fila operacional</h2><p className="text-xs text-[#687772]">{items.length} item{items.length===1?"":"s"} aberto{items.length===1?"":"s"}</p></div></div><UserRoundCheck size={18} className="text-[#7B8985]"/></div>
        <div className="divide-y divide-[#EDF1F0]">{items.map(item=><article key={item.id} className="p-4 sm:p-5 hover:bg-[#FBFCFC]"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] ${sourceStyle(item.source)}`}>{sourceLabel(item.source)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-[#24332F]">{item.title}</p>{item.priority===1&&<span className="rounded-full bg-[#FFF0F0] px-2 py-0.5 text-[10px] font-black text-[#A23C3C]">alta</span>}</div><p className="mt-1 text-sm text-[#64736F]">{item.description}</p>{item.meta&&<p className="mt-1 text-xs font-bold text-[#899590]">{item.meta}</p>}</div><Link href={item.href} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-[#EEF6F4] px-3 py-2 text-xs font-black text-[#0D7166] hover:bg-[#E0F0EC]">Resolver <ArrowRight size={13}/></Link></div></article>)}</div>
      </section>}

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Link href="/admin/attention" className="rounded-2xl border border-[#DCE6E3] bg-white p-4 hover:border-[#E3BC98]"><HeartPulse size={18} className="text-[#A2571D]"/><p className="mt-2 text-sm font-black">Atenção clínica</p></Link>
        <Link href="/admin/followups" className="rounded-2xl border border-[#DCE6E3] bg-white p-4 hover:border-[#A9BCDF]"><AlertTriangle size={18} className="text-[#4166A6]"/><p className="mt-2 text-sm font-black">Acompanhamento</p></Link>
        <Link href="/admin/crm" className="rounded-2xl border border-[#DCE6E3] bg-white p-4 hover:border-[#C2BDEB]"><Briefcase size={18} className="text-[#5D52B6]"/><p className="mt-2 text-sm font-black">CRM</p></Link>
        <Link href="/admin/appointments/communications" className="rounded-2xl border border-[#DCE6E3] bg-white p-4 hover:border-[#E1BABA]"><MessageSquareWarning size={18} className="text-[#A23C3C]"/><p className="mt-2 text-sm font-black">Comunicações</p></Link>
      </div>
    </div>
  </main>
}
