"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, Clock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Appointment={id:string;scheduled_at:string;status:string;duration_minutes:number;appointment_type?:{name:string}|null;nutritionist?:{name:string}|null}

export default function PatientAppointmentConfirmPage(){
  const[appointments,setAppointments]=useState<Appointment[]>([])
  const[timezone,setTimezone]=useState('America/Sao_Paulo')
  const[loading,setLoading]=useState(true)
  const[confirming,setConfirming]=useState<string|null>(null)
  const[message,setMessage]=useState('')

  const load=async()=>{
    setLoading(true)
    const{data:{user}}=await supabase.auth.getUser()
    if(!user){setLoading(false);return}
    const[{data:settings},{data:rows}]=await Promise.all([
      supabase.from('tenant_appointment_settings').select('timezone').maybeSingle(),
      supabase.from('appointments').select('id,scheduled_at,status,duration_minutes,appointment_type:appointment_types!appointment_type_id(name),nutritionist:nutritionists!nutritionist_id(name)').eq('patient_id',user.id).in('status',['scheduled','confirmed']).gte('scheduled_at',new Date().toISOString()).order('scheduled_at',{ascending:true})
    ])
    setTimezone(settings?.timezone||'America/Sao_Paulo')
    setAppointments((rows as any)||[])
    setLoading(false)
  }

  useEffect(()=>{load()},[])

  const format=(value:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(value))

  const confirm=async(id:string)=>{
    setConfirming(id);setMessage('')
    try{
      const response=await fetch('/api/patient/appointments/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appointment_id:id})})
      const payload=await response.json()
      if(!response.ok){setMessage(payload.error==='invalid_state'?'Esta consulta não pode mais ser confirmada.':'Não foi possível confirmar agora.');return}
      setMessage('Presença confirmada com sucesso.')
      await load()
    }catch{setMessage('Não foi possível confirmar agora.')}finally{setConfirming(null)}
  }

  return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-[#0d1f14] px-4 pb-24 pt-10 text-white"><div className="mx-auto max-w-md space-y-5">
    <header className="flex items-center gap-3"><Link href="/patient/appointments" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5"><ChevronLeft size={18}/></Link><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sua agenda</p><h1 className="text-xl font-black">Confirmar consulta</h1></div></header>
    <p className="text-sm text-slate-400">Confirme sua presença nas consultas futuras. A confirmação fica registrada na agenda da clínica.</p>
    {message&&<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">{message}</div>}
    {loading?<div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-400"/></div>:appointments.length===0?<div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">Você não tem consultas futuras aguardando confirmação.</div>:<div className="space-y-3">{appointments.map(a=><section key={a.id} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{a.appointment_type?.name||'Consulta'}</p><p className="mt-1 text-sm capitalize text-slate-300">{format(a.scheduled_at)}</p><p className="mt-1 text-xs text-slate-500">{a.nutritionist?.name||'Nutricionista'} · {a.duration_minutes} min</p></div>{a.status==='confirmed'?<span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-300"><CheckCircle2 size={12}/>Confirmada</span>:<span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-black text-blue-300"><Clock size={12}/>Aguardando</span>}</div>{a.status==='scheduled'&&<button onClick={()=>confirm(a.id)} disabled={confirming===a.id} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-60">{confirming===a.id?<Loader2 size={16} className="animate-spin"/>:<CheckCircle2 size={16}/>}Confirmar presença</button>}</section>)}</div>}
  </div></main>
}
