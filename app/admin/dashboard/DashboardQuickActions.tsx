"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarCheck2, CalendarDays, Check, HeartPulse, MessageCircle, RefreshCw, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Appointment={id:string;patient_id:string|null;scheduled_at:string;status:string;patient_name:string}
type Crm={id:string;name:string;phone:string|null;whatsapp:string|null;next_action_at:string|null}

const TZ='America/Sao_Paulo'
const dateKey=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
const hour=(v:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(v))
const normalizePhone=(v:string)=>{const digits=v.replace(/\D/g,'');if(!digits)return'';return digits.startsWith('55')?digits:`55${digits}`}

export function DashboardQuickActions({tenantId}:{tenantId:string}){
  const router=useRouter()
  const [appointment,setAppointment]=useState<Appointment|null>(null)
  const [crm,setCrm]=useState<Crm|null>(null)
  const [loading,setLoading]=useState(true)
  const [confirming,setConfirming]=useState(false)
  const [notice,setNotice]=useState('')

  const load=async()=>{
    if(!tenantId)return
    setLoading(true)
    try{
      const today=dateKey(new Date());const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const end=dateKey(tomorrow)
      const [aRes,cRes,pRes]=await Promise.all([
        supabase.from('appointments').select('id,patient_id,scheduled_at,status').eq('tenant_id',tenantId).gte('scheduled_at',new Date().toISOString()).lt('scheduled_at',`${end}T00:00:00-03:00`).in('status',['scheduled','confirmed']).order('scheduled_at').limit(1),
        supabase.from('crm_contacts').select('id,name,phone,whatsapp,next_action_at').eq('tenant_id',tenantId).eq('do_not_contact',false).not('next_action_at','is',null).lte('next_action_at',new Date().toISOString()).order('next_action_at').limit(1),
        supabase.from('profiles').select('id,name').eq('tenant_id',tenantId).eq('role','patient'),
      ])
      const a=(aRes.data||[])[0] as any
      const names=new Map((pRes.data||[]).map((p:any)=>[p.id,p.name||'Paciente']))
      setAppointment(a?{...a,patient_name:names.get(a.patient_id)||'Paciente'}:null)
      setCrm(((cRes.data||[])[0]||null) as Crm|null)
    }finally{setLoading(false)}
  }
  useEffect(()=>{load()},[tenantId])

  const confirm=async()=>{
    if(!appointment||appointment.status==='confirmed')return
    setConfirming(true);setNotice('')
    const {error}=await supabase.rpc('staff_transition_appointment',{p_appointment_id:appointment.id,p_to_status:'confirmed',p_reason:null})
    if(error)setNotice(error.message||'Não foi possível confirmar.')
    else{setAppointment({...appointment,status:'confirmed'});setNotice('Consulta confirmada.')}
    setConfirming(false)
  }

  const whatsapp=()=>{
    if(!crm)return
    const phone=normalizePhone(crm.whatsapp||crm.phone||'')
    if(phone)window.open(`https://wa.me/${phone}`,'_blank','noopener,noreferrer')
  }

  if(loading)return <div className="mx-auto mb-4 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="h-20 animate-pulse rounded-2xl border border-[#DCE6E3] bg-white"/></div>
  if(!appointment&&!crm)return null

  return <section className="mx-auto mb-4 max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="rounded-2xl border border-[#D6E2DF] bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#0D7166]">Ações do momento</p><p className="text-xs text-[#71807B]">Resolva o essencial sem sair da Home</p></div><button onClick={load} className="h-9 w-9 rounded-xl border border-[#DCE6E3] text-[#64736E] flex items-center justify-center" title="Atualizar"><RefreshCw size={15}/></button></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {appointment&&<div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F4F9F7] p-3"><div className="h-10 w-10 rounded-xl bg-white text-[#0D7166] flex items-center justify-center"><CalendarCheck2 size={18}/></div><div className="min-w-0 flex-1"><p className="text-sm font-black truncate">{hour(appointment.scheduled_at)} · {appointment.patient_name}</p><p className="text-[11px] text-[#70807B]">{appointment.status==='confirmed'?'Consulta confirmada':'Aguardando confirmação'}</p></div>{appointment.status!=='confirmed'&&<button onClick={confirm} disabled={confirming} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D7166] px-3 py-2 text-xs font-black text-white disabled:opacity-60">{confirming?<RefreshCw size={13} className="animate-spin"/>:<Check size={13}/>}Confirmar</button>}<button onClick={()=>router.push('/admin?view=appointments')} className="inline-flex items-center gap-1 rounded-xl border border-[#D7E3E0] bg-white px-3 py-2 text-xs font-black text-[#52615D]"><CalendarDays size={13}/>Agenda</button></div>}
        {crm&&<div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#FFF9EF] p-3"><div className="h-10 w-10 rounded-xl bg-white text-[#9A6B18] flex items-center justify-center"><HeartPulse size={18}/></div><div className="min-w-0 flex-1"><p className="text-sm font-black truncate">Contato vencido · {crm.name}</p><p className="text-[11px] text-[#7A7469]">Próxima ação do CRM já passou do prazo.</p></div>{(crm.whatsapp||crm.phone)&&<button onClick={whatsapp} className="inline-flex items-center gap-1 rounded-xl bg-[#147B68] px-3 py-2 text-xs font-black text-white"><MessageCircle size={13}/>WhatsApp</button>}<button onClick={()=>router.push(`/admin/crm?search=${encodeURIComponent(crm.name)}`)} className="inline-flex items-center gap-1 rounded-xl border border-[#E5DAC4] bg-white px-3 py-2 text-xs font-black text-[#6A6256]"><Users size={13}/>CRM</button></div>}
      </div>
      {notice&&<p className={`mt-2 text-xs font-bold ${notice.includes('confirmada')?'text-[#2C7A61]':'text-[#A03C3C]'}`}>{notice}</p>}
    </div>
  </section>
}
