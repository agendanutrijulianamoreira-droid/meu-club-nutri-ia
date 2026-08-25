import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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

async function saveTemplate(form:FormData){'use server'
  const{supabase,tenantId}=await viewer()
  const id=String(form.get('id')||'')
  const title=String(form.get('title')||'').trim()
  const body=String(form.get('body')||'').trim()
  const ctaLabel=String(form.get('cta_label')||'').trim()||null
  const ctaUrl=String(form.get('cta_url')||'').trim()||null
  if(!id||!title||!body||title.length>160||body.length>2000)redirect('/admin/appointments/communications?error=template')
  const{error}=await supabase.from('appointment_communication_templates').update({title,body,cta_label:ctaLabel,cta_url:ctaUrl,active:form.get('active')==='on',updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',tenantId).eq('channel','inbox')
  if(error)redirect('/admin/appointments/communications?error=save')
  revalidatePath('/admin/appointments/communications')
  redirect('/admin/appointments/communications?saved=1')
}

function formatDate(value:string,timezone:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(value))}

export default async function AppointmentCommunicationsPage({searchParams}:{searchParams?:{saved?:string;error?:string}}){
  const{supabase,tenantId}=await viewer()
  const[{data:settings},{data:jobs,error:jobsError},{data:templates}]=await Promise.all([
    supabase.from('tenant_appointment_settings').select('timezone,appointment_confirmation_enabled,appointment_confirmation_lead_hours,appointment_reminder_enabled,appointment_reminder_lead_hours').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_jobs').select('id,appointment_id,patient_id,kind,due_at,status,channel,provider,attempt_count,max_attempts,sent_at,delivered_at,last_error,metadata,appointments!appointment_id(scheduled_at,status,appointment_types!appointment_type_id(name))').eq('tenant_id',tenantId).order('due_at',{ascending:true}).limit(200),
    supabase.from('appointment_communication_templates').select('id,kind,channel,title,body,cta_label,cta_url,active').eq('tenant_id',tenantId).eq('channel','inbox').order('kind')
  ])
  const rows=(jobs||[]) as any[]
  const patientIds=[...new Set(rows.map(j=>j.patient_id).filter(Boolean))]
  const{data:profiles}=patientIds.length?await supabase.from('profiles').select('user_id,name').eq('tenant_id',tenantId).in('user_id',patientIds):{data:[] as any[]}
  const patientNames=new Map((profiles||[]).map((p:any)=>[p.user_id,p.name]))
  const timezone=settings?.timezone||'America/Sao_Paulo'
  const ready=rows.filter(j=>j.status==='ready').length
  const pending=rows.filter(j=>j.status==='pending').length
  const sent=rows.filter(j=>j.status==='sent').length
  const failed=rows.filter(j=>j.status==='failed').length
  const errorText=searchParams?.error==='template'?'Revise título e mensagem do template.':searchParams?.error?'Não foi possível salvar o template.':''
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Fase 4 · Bloco 4</p><h1 className="text-3xl font-black">Entrega das comunicações</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Fila transacional com entrega real no Inbox do app. O ciclo roda a cada 15 minutos no Supabase; WhatsApp e e-mail permanecem desligados até existir provedor configurado.</p></div><div className="flex gap-2"><Link href="/admin/appointment-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Configurações</Link><Link href="/admin/appointments" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Agenda</Link></div></header>
    {searchParams?.saved==='1'&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Template salvo.</div>}{errorText&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText}</div>}
    <section className="grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">Prontas</p><p className="mt-1 text-2xl font-black">{ready}</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Aguardando horário</p><p className="mt-1 text-2xl font-black">{pending}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Entregues</p><p className="mt-1 text-2xl font-black">{sent}</p></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold text-red-700">Falhas</p><p className="mt-1 text-2xl font-black">{failed}</p></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Regras ativas</h2><p className="text-sm text-slate-600">Confirmação: {settings?.appointment_confirmation_enabled?'ativa':'desativada'} · {settings?.appointment_confirmation_lead_hours??72}h antes. Lembrete: {settings?.appointment_reminder_enabled?'ativo':'desativado'} · {settings?.appointment_reminder_lead_hours??24}h antes.</p></div><Link href="/admin/appointment-settings" className="text-sm font-black text-violet-700">Editar regras</Link></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="text-lg font-black">Mensagens do Inbox</h2><p className="mt-1 text-sm text-slate-600">Edite o texto que a paciente recebe dentro do app. Desativar um template faz o job entrar em retry, sem perder o histórico.</p></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{(templates||[]).map((t:any)=><form key={t.id} action={saveTemplate} className="rounded-2xl border border-slate-200 p-4"><input type="hidden" name="id" value={t.id}/><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-violet-700">{t.kind==='confirmation_request'?'Confirmação':'Lembrete'}</p><p className="text-xs text-slate-500">Canal: Inbox</p></div><label className="flex items-center gap-2 text-xs font-bold"><input name="active" type="checkbox" defaultChecked={t.active}/>Ativo</label></div><label className="mt-4 grid gap-1 text-xs font-bold text-slate-600">Título<input name="title" maxLength={160} required defaultValue={t.title} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label><label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">Mensagem<textarea name="body" maxLength={2000} required defaultValue={t.body} rows={4} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Texto do botão<input name="cta_label" defaultValue={t.cta_label||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Destino do botão<input name="cta_url" defaultValue={t.cta_url||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label></div><button className="mt-4 rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white">Salvar mensagem</button></form>)}</div></section>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Fila de comunicação</h2><p className="mt-1 text-sm text-slate-600">Até 200 itens, com canal, tentativas e erro de entrega auditáveis.</p></div>{jobsError?<div className="p-8 text-center text-sm font-bold text-red-600">Não foi possível carregar a fila.</div>:rows.length===0?<div className="p-8 text-center text-sm text-slate-500">Nenhum item foi materializado ainda.</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Consulta</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Fica pronta</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(job=>{const appt=job.appointments;return <tr key={job.id}><td className="px-4 py-3 font-bold">{patientNames.get(job.patient_id)||'Paciente'}</td><td className="px-4 py-3"><div className="font-bold">{appt?.appointment_types?.name||'Consulta'}</div><div className="text-xs text-slate-500">{appt?.scheduled_at?formatDate(appt.scheduled_at,timezone):'—'} · {appt?.status||'—'}</div></td><td className="px-4 py-3">{job.kind==='confirmation_request'?'Confirmação':'Lembrete'}</td><td className="px-4 py-3">{formatDate(job.due_at,timezone)}</td><td className="px-4 py-3"><div className="font-bold">{job.provider||job.channel||'—'}</div><div className="text-xs text-slate-500">Tentativas {job.attempt_count||0}/{job.max_attempts||3}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${job.status==='ready'?'bg-amber-100 text-amber-800':job.status==='pending'?'bg-blue-100 text-blue-800':job.status==='sent'?'bg-emerald-100 text-emerald-800':job.status==='failed'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700'}`}>{job.status}</span>{job.delivered_at&&<div className="mt-1 text-xs text-emerald-700">Entregue {formatDate(job.delivered_at,timezone)}</div>}{job.last_error&&<div className="mt-1 max-w-xs text-xs text-red-600">{job.last_error}</div>}</td></tr>})}</tbody></table></div>}</section>
  </div></main>
}
