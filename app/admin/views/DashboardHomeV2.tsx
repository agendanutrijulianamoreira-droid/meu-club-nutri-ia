"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, FileClock, HeartPulse, MessageSquareText, Plus, RefreshCw,
  Settings2, Stethoscope, UserPlus, Users, UtensilsCrossed, Zap,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  DASHBOARD_SHORTCUTS,
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type DashboardShortcutId,
} from "@/lib/admin-dashboard"

type AppointmentRow = { id:string; patient_id:string|null; scheduled_at:string; status:string; appointment_type:string|null; is_virtual:boolean|null }
type RiskRow = { id:string; user_id:string; overall_risk:number|null; attention_bucket:string|null; days_since_activity:number|null; checkin_overdue:boolean|null; consultation_overdue:boolean|null; protocol_ending:boolean|null; lifecycle_next_action:string|null }
type PendingRow = { id:string; title:string|null; target_patient_name:string|null; action_type:string; scheduled_for:string|null }
type CrmRow = { id:string; name:string; next_action_at:string|null; recency_segment:string|null; phone:string|null }
type DashboardData = {
  appointments: Array<AppointmentRow & { patient_name:string }>
  risks: Array<RiskRow & { patient_name:string }>
  pending: PendingRow[]
  crm: CrmRow[]
  communicationFailures: number
  totalPatients: number
  activePatients: number
  todayCheckins: number
}

const EMPTY: DashboardData = { appointments:[], risks:[], pending:[], crm:[], communicationFailures:0, totalPatients:0, activePatients:0, todayCheckins:0 }

function brToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
}
function ptDate() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Sao_Paulo', weekday:'long', day:'2-digit', month:'long' }).format(new Date())
}
function time(value:string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit' }).format(new Date(value))
}
function greeting() { const h=Number(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date())); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite' }

export function DashboardHomeV2({ setView, userName='', tenantName='', tenantId='', onNewPatient }: { setView:(v:any)=>void; userName?:string; tenantName?:string; tenantId?:string; onNewPatient?:()=>void }) {
  const router = useRouter()
  const [loading,setLoading]=useState(true)
  const [refreshing,setRefreshing]=useState(false)
  const [prefs,setPrefs]=useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES)
  const [data,setData]=useState<DashboardData>(EMPTY)

  const load = async (soft=false) => {
    if (!tenantId) return
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prefRow } = await supabase.from('admin_dashboard_preferences').select('layout_mode,visible_widgets,favorite_shortcuts,attention_rules').eq('user_id',user.id).eq('tenant_id',tenantId).maybeSingle()
      const nextPrefs=normalizeDashboardPreferences(prefRow as Partial<DashboardPreferences>|null)
      setPrefs(nextPrefs)

      const today=brToday()
      const start=`${today}T00:00:00-03:00`
      const d=new Date(`${today}T12:00:00-03:00`); d.setDate(d.getDate()+1)
      const tomorrow=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
      const end=`${tomorrow}T00:00:00-03:00`

      const [appointmentsRes, risksRes, pendingRes, crmRes, failuresRes, patientsRes] = await Promise.all([
        supabase.from('appointments').select('id,patient_id,scheduled_at,status,appointment_type,is_virtual').eq('tenant_id',tenantId).gte('scheduled_at',start).lt('scheduled_at',end).not('status','in','("cancelled","no_show")').order('scheduled_at').limit(6),
        supabase.from('patient_risk_scores').select('id,user_id,overall_risk,attention_bucket,days_since_activity,checkin_overdue,consultation_overdue,protocol_ending,lifecycle_next_action').eq('tenant_id',tenantId).eq('calculated_date',today).neq('attention_bucket','none').order('overall_risk',{ascending:false}).limit(6),
        supabase.from('agent_pending_actions').select('id,title,target_patient_name,action_type,scheduled_for').eq('tenant_id',tenantId).eq('status','pending').order('scheduled_for',{ascending:true,nullsFirst:false}).limit(6),
        supabase.from('crm_contacts').select('id,name,next_action_at,recency_segment,phone').eq('tenant_id',tenantId).eq('do_not_contact',false).not('next_action_at','is',null).lte('next_action_at',end).order('next_action_at',{ascending:true}).limit(6),
        supabase.from('appointment_communication_jobs').select('id',{count:'exact',head:true}).eq('tenant_id',tenantId).eq('status','failed'),
        supabase.from('profiles').select('id,user_id,name,last_checkin_date,updated_at').eq('tenant_id',tenantId).eq('role','patient').order('updated_at',{ascending:false}),
      ])

      const patients=patientsRes.data||[]
      const profileById=new Map(patients.map((p:any)=>[p.id,p.name||'Paciente']))
      const profileByUser=new Map(patients.map((p:any)=>[p.user_id,p.name||'Paciente']))
      const patientUserIds=patients.map((p:any)=>p.user_id).filter(Boolean)
      const inactiveCutoff=new Date(); inactiveCutoff.setDate(inactiveCutoff.getDate()-nextPrefs.attention_rules.inactive_days)
      const activePatients=patients.filter((p:any)=>new Date(p.updated_at)>=inactiveCutoff).length
      const todayCheckins = patientUserIds.length ? (await supabase.from('daily_logs').select('id',{count:'exact',head:true}).eq('log_date',today).in('user_id',patientUserIds)).count||0 : 0

      setData({
        appointments:(appointmentsRes.data||[]).map((a:any)=>({...a,patient_name:profileById.get(a.patient_id)||'Paciente'})),
        risks:(risksRes.data||[]).map((r:any)=>({...r,patient_name:profileByUser.get(r.user_id)||'Paciente'})),
        pending:(pendingRes.data||[]) as PendingRow[],
        crm:(crmRes.data||[]) as CrmRow[],
        communicationFailures:failuresRes.count||0,
        totalPatients:patients.length,
        activePatients,
        todayCheckins,
      })
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(()=>{ load() },[tenantId])

  const shortcuts = useMemo(()=>prefs.favorite_shortcuts.map(id=>DASHBOARD_SHORTCUTS.find(x=>x.id===id)).filter(Boolean),[prefs.favorite_shortcuts])
  const runShortcut=(id:DashboardShortcutId)=>{
    if(id==='new_patient') return onNewPatient?.()
    if(id==='new_appointment') return setView('appointments')
    if(id==='new_meal_plan') return setView('meal-plans')
    if(id==='new_protocol') return setView('protocols')
    if(id==='attention') return router.push('/admin/attention')
    if(id==='crm') return router.push('/admin/crm')
    if(id==='communication') return setView('communication')
    if(id==='settings') return router.push('/admin/dashboard/settings')
  }
  const shortcutIcon=(id:DashboardShortcutId)=> id==='new_patient'?<UserPlus size={17}/>:id==='new_appointment'?<CalendarDays size={17}/>:id==='new_meal_plan'?<UtensilsCrossed size={17}/>:id==='new_protocol'?<Stethoscope size={17}/>:id==='attention'?<HeartPulse size={17}/>:id==='crm'?<Users size={17}/>:id==='communication'?<MessageSquareText size={17}/>:<Settings2 size={17}/>
  const show=(id:string)=>prefs.visible_widgets.includes(id as any)

  return <main className="min-h-screen bg-[#F4F7F6] text-[#1C2B27] p-4 sm:p-6 lg:p-8 xl:p-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#0D7166]">Centro operacional · {prefs.layout_mode==='today'?'Hoje':prefs.layout_mode==='clinical'?'Clínica':'Gestão'}</p><h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight">{greeting()}, {userName.split(' ')[0]}</h1><p className="mt-1 text-sm text-[#687772] capitalize">{tenantName ? `${tenantName} · ` : ''}{ptDate()}</p></div>
        <div className="flex gap-2"><button onClick={()=>load(true)} className="h-11 w-11 rounded-xl border border-[#D3DEDB] bg-white flex items-center justify-center text-[#52615D] hover:text-[#0D7166]" title="Atualizar"><RefreshCw size={17} className={refreshing?'animate-spin':''}/></button><Link href="/admin/dashboard/settings" className="inline-flex items-center gap-2 rounded-xl border border-[#D3DEDB] bg-white px-4 py-2.5 text-sm font-black text-[#52615D] hover:text-[#0D7166]"><Settings2 size={17}/> Personalizar</Link></div>
      </header>

      <section className="mb-7 flex flex-wrap gap-2">{shortcuts.map(s=>s&&<button key={s.id} onClick={()=>runShortcut(s.id)} className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#DCE6E3] px-4 py-2.5 text-sm font-black shadow-sm hover:border-[#8FC8BC] hover:bg-[#F4FBF9]">{shortcutIcon(s.id)}{s.label}</button>)}</section>

      {loading ? <div className="grid gap-4 lg:grid-cols-2"><div className="h-72 animate-pulse rounded-3xl bg-white border border-[#DCE6E3]"/><div className="h-72 animate-pulse rounded-3xl bg-white border border-[#DCE6E3]"/></div> : <div className="space-y-5">
        {show('today') && <section className="rounded-3xl border border-[#DCE6E3] bg-white shadow-sm overflow-hidden"><div className="flex items-center justify-between border-b border-[#E5ECEA] px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EAF5F2] p-2 text-[#0D7166]"><CalendarDays size={19}/></div><div><h2 className="font-black">Seu dia</h2><p className="text-xs text-[#687772]">{data.appointments.length} consulta{data.appointments.length===1?'':'s'} hoje</p></div></div><button onClick={()=>setView('appointments')} className="text-sm font-black text-[#0D7166] inline-flex items-center gap-1">Abrir agenda <ArrowRight size={15}/></button></div><div className="divide-y divide-[#EDF1F0]">{data.appointments.length?data.appointments.map(a=><div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="w-16 text-xl font-black text-[#0D7166]">{time(a.scheduled_at)}</div><div className="min-w-0 flex-1"><p className="font-black truncate">{a.patient_name}</p><p className="text-sm text-[#687772]">{a.appointment_type||'Consulta'} · {a.is_virtual?'online':'presencial'} · {a.status==='confirmed'?'confirmada':'agendada'}</p></div><button onClick={()=>setView('appointments')} className="rounded-xl bg-[#F0F8F6] px-3 py-2 text-xs font-black text-[#0D7166]">Abrir</button></div>):<div className="px-5 py-8 text-center"><CheckCircle2 className="mx-auto mb-2 text-[#4F8A79]"/><p className="font-black">Agenda livre hoje</p><p className="text-sm text-[#687772]">Use o tempo para pendências clínicas ou planejamento.</p></div>}</div></section>}

        <div className="grid gap-5 xl:grid-cols-2">
          {show('attention') && <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#FFF4E5] p-2 text-[#A76517]"><HeartPulse size={19}/></div><div><h2 className="font-black">Precisa de você</h2><p className="text-xs text-[#687772]">Prioridades do motor clínico</p></div></div><span className="rounded-full bg-[#FFF4E5] px-3 py-1 text-xs font-black text-[#A76517]">{data.risks.length}</span></div><div className="space-y-2">{data.risks.slice(0,4).map(r=><div key={r.id} className="rounded-2xl border border-[#E5ECEA] p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-sm">{r.patient_name}</p><span className="text-xs font-black text-[#A76517]">risco {Math.round(Number(r.overall_risk||0))}/100</span></div><p className="mt-1 text-xs text-[#687772]">{r.lifecycle_next_action||`${r.days_since_activity||0} dias sem atividade`}</p></div>)}{!data.risks.length&&<p className="rounded-2xl bg-[#F2F8F5] p-4 text-sm font-bold text-[#3E6F60]">Nenhuma paciente priorizada agora.</p>}</div><Link href="/admin/attention" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#0D7166]">Ver fila completa <ArrowRight size={14}/></Link></section>}

          {show('pending') && <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2FF] p-2 text-[#4F46E5]"><FileClock size={19}/></div><div><h2 className="font-black">Pendências</h2><p className="text-xs text-[#687772]">O que ainda precisa ser resolvido</p></div></div><span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-black text-[#4F46E5]">{data.pending.length+data.communicationFailures}</span></div>{data.communicationFailures>0&&<Link href="/admin/appointments/communications" className="mb-2 flex items-center justify-between rounded-2xl border border-[#F2D2D2] bg-[#FFF5F5] p-3"><div><p className="text-sm font-black text-[#9B3333]">{data.communicationFailures} comunicação(ões) com falha</p><p className="text-xs text-[#8B6666]">Revisar fila de entrega</p></div><AlertTriangle size={17} className="text-[#B64949]"/></Link>}<div className="space-y-2">{data.pending.slice(0,4).map(p=><div key={p.id} className="rounded-2xl border border-[#E5ECEA] p-3"><p className="text-sm font-black">{p.title||'Ação pendente'}</p><p className="mt-1 text-xs text-[#687772]">{p.target_patient_name||p.action_type.replaceAll('_',' ')}</p></div>)}{!data.pending.length&&!data.communicationFailures&&<p className="rounded-2xl bg-[#F2F8F5] p-4 text-sm font-bold text-[#3E6F60]">Sem pendências operacionais nesta fila.</p>}</div></section>}

          {show('commercial') && <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EDF7F3] p-2 text-[#0D7166]"><CircleDollarSign size={19}/></div><div><h2 className="font-black">Comercial</h2><p className="text-xs text-[#687772]">Próximas ações do CRM</p></div></div><span className="rounded-full bg-[#EDF7F3] px-3 py-1 text-xs font-black text-[#0D7166]">{data.crm.length}</span></div><div className="space-y-2">{data.crm.slice(0,4).map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5ECEA] p-3"><div><p className="text-sm font-black">{c.name}</p><p className="text-xs text-[#687772]">{c.recency_segment||'Ação programada'}</p></div><Clock3 size={16} className="text-[#7A8985]"/></div>)}{!data.crm.length&&<p className="rounded-2xl bg-[#F7FAF9] p-4 text-sm font-bold text-[#5F706B]">Nenhuma ação de CRM vencendo agora.</p>}</div><Link href="/admin/crm" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#0D7166]">Abrir CRM <ArrowRight size={14}/></Link></section>}

          {show('summary') && <section className="rounded-3xl border border-[#DCE6E3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-[#F1F5F4] p-2 text-[#52615D]"><Zap size={19}/></div><div><h2 className="font-black">Resumo da clínica</h2><p className="text-xs text-[#687772]">Só os números essenciais</p></div></div><div className="grid grid-cols-3 gap-3"><div className="rounded-2xl bg-[#F7FAF9] p-4"><p className="text-2xl font-black">{data.totalPatients}</p><p className="text-xs font-bold text-[#687772]">Pacientes</p></div><div className="rounded-2xl bg-[#F0F8F6] p-4"><p className="text-2xl font-black text-[#0D7166]">{data.activePatients}</p><p className="text-xs font-bold text-[#687772]">Ativas</p></div><div className="rounded-2xl bg-[#FFF8EA] p-4"><p className="text-2xl font-black text-[#9A6B18]">{data.todayCheckins}</p><p className="text-xs font-bold text-[#687772]">Check-ins hoje</p></div></div></section>}
        </div>
      </div>}
    </div>
  </main>
}
