import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!p?.tenant_id||!['admin','nutritionist','nutri'].includes(String(p.role||'').toLowerCase()))redirect('/patient/home')
  return{supabase,tenantId:p.tenant_id}
}

function formatDate(value:string,timezone:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(value))}

export default async function AppointmentCommunicationsPage(){
  const{supabase,tenantId}=await viewer()
  const[{data:settings},{data:jobs}]=await Promise.all([
    supabase.from('tenant_appointment_settings').select('timezone,appointment_confirmation_enabled,appointment_confirmation_lead_hours,appointment_reminder_enabled,appointment_reminder_lead_hours').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_jobs').select('id,appointment_id,patient_id,kind,due_at,status,channel,sent_at,last_error,metadata,appointments!appointment_id(scheduled_at,status,appointment_types!appointment_type_id(name)),profiles!patient_id(name)').eq('tenant_id',tenantId).order('due_at',{ascending:true}).limit(200)
  ])
  const timezone=settings?.timezone||'America/Sao_Paulo'
  const rows=(jobs||[]) as any[]
  const ready=rows.filter(j=>j.status==='ready').length
  const pending=rows.filter(j=>j.status==='pending').length
  const sent=rows.filter(j=>j.status==='sent').length
  const failed=rows.filter(j=>j.status==='failed').length
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Fase 4 · Bloco 3</p><h1 className="text-3xl font-black">Confirmações e lembretes</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Fila auditável das comunicações de consulta. Neste bloco, itens podem ficar prontos, mas nenhum canal externo é disparado automaticamente.</p></div><div className="flex gap-2"><Link href="/admin/appointment-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Configurações</Link><Link href="/admin/appointments" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Agenda</Link></div></header>
    <section className="grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">Prontas</p><p className="mt-1 text-2xl font-black">{ready}</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Aguardando horário</p><p className="mt-1 text-2xl font-black">{pending}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Enviadas</p><p className="mt-1 text-2xl font-black">{sent}</p></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold text-red-700">Falhas</p><p className="mt-1 text-2xl font-black">{failed}</p></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Regras ativas</h2><p className="text-sm text-slate-600">Confirmação: {settings?.appointment_confirmation_enabled?'ativa':'desativada'} · {settings?.appointment_confirmation_lead_hours??72}h antes. Lembrete: {settings?.appointment_reminder_enabled?'ativo':'desativado'} · {settings?.appointment_reminder_lead_hours??24}h antes.</p></div><Link href="/admin/appointment-settings" className="text-sm font-black text-violet-700">Editar regras</Link></div></section>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Fila de comunicação</h2><p className="mt-1 text-sm text-slate-600">Até 200 itens, ordenados pelo horário em que ficam elegíveis.</p></div>{rows.length===0?<div className="p-8 text-center text-sm text-slate-500">Nenhum item foi materializado ainda.</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Consulta</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Fica pronta</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(job=>{const appt=job.appointments;const patient=job.profiles;return <tr key={job.id}><td className="px-4 py-3 font-bold">{patient?.name||'Paciente'}</td><td className="px-4 py-3"><div className="font-bold">{appt?.appointment_types?.name||'Consulta'}</div><div className="text-xs text-slate-500">{appt?.scheduled_at?formatDate(appt.scheduled_at,timezone):'—'} · {appt?.status||'—'}</div></td><td className="px-4 py-3">{job.kind==='confirmation_request'?'Confirmação':'Lembrete'}</td><td className="px-4 py-3">{formatDate(job.due_at,timezone)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${job.status==='ready'?'bg-amber-100 text-amber-800':job.status==='pending'?'bg-blue-100 text-blue-800':job.status==='sent'?'bg-emerald-100 text-emerald-800':job.status==='failed'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700'}`}>{job.status}</span>{job.last_error&&<div className="mt-1 max-w-xs text-xs text-red-600">{job.last_error}</div>}</td></tr>})}</tbody></table></div>}</section>
  </div></main>
}
