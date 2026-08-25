import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_LABEL:Record<string,string>={scheduled:'Agendada',confirmed:'Confirmada',in_progress:'Em andamento',completed:'Realizada',cancelled:'Cancelada',no_show:'Ausência'}

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!p?.tenant_id||!['admin','nutritionist','nutri'].includes(String(p.role||'').toLowerCase()))redirect('/patient/home')
  return{supabase,user,tenantId:p.tenant_id}
}

function localInput(value:string,timezone:string){
  const date=new Date(value)
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date)
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
function displayDate(value:string,timezone:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function rpcError(message:string){
  const m=message.toLowerCase()
  if(m.includes('appointments_no_overlapping_slots')||m.includes('conflicting key'))return 'conflict'
  if(m.includes('disponibilidade')||m.includes('jornada')||m.includes('intervalo de início')||m.includes('antecedência')||m.includes('horário bloqueado')||m.includes('agenda da profissional'))return 'availability'
  if(m.includes('motivo do encaixe'))return 'override'
  return 'save'
}

async function createAppointment(form:FormData){'use server'
  const{supabase}=await viewer()
  const contact=String(form.get('crm_contact_id')||'');const nutritionist=String(form.get('nutritionist_id')||'');const type=String(form.get('appointment_type_id')||'');const start=String(form.get('local_start')||'')
  const durationText=String(form.get('duration_minutes')||'').trim();const duration=durationText?Number(durationText):null
  const format=String(form.get('format')||'default');const isVirtual=format==='default'?null:format==='virtual'
  if(!contact||!nutritionist||!type||!start||(duration!==null&&(!Number.isInteger(duration)||duration<5||duration>720)))redirect('/admin/appointments?error=fields')
  const{error}=await supabase.rpc('staff_create_appointment',{p_crm_contact_id:contact,p_nutritionist_id:nutritionist,p_appointment_type_id:type,p_local_start:start,p_duration_minutes:duration,p_is_virtual:isVirtual,p_meeting_link:String(form.get('meeting_link')||'')||null,p_location_address:String(form.get('location_address')||'')||null,p_notes:String(form.get('notes')||'')||null,p_schedule_override:form.get('schedule_override')==='on',p_override_reason:String(form.get('override_reason')||'')||null})
  if(error)redirect(`/admin/appointments?error=${rpcError(error.message)}`)
  revalidatePath('/admin/appointments');redirect('/admin/appointments?saved=created')
}
async function rescheduleAppointment(form:FormData){'use server'
  const{supabase}=await viewer();const id=String(form.get('id')||'');const start=String(form.get('local_start')||'');const duration=Number(form.get('duration_minutes'))
  if(!id||!start||!Number.isInteger(duration)||duration<5||duration>720)redirect('/admin/appointments?error=fields')
  const{error}=await supabase.rpc('staff_reschedule_appointment',{p_appointment_id:id,p_local_start:start,p_duration_minutes:duration,p_schedule_override:form.get('schedule_override')==='on',p_override_reason:String(form.get('override_reason')||'')||null})
  if(error)redirect(`/admin/appointments?error=${rpcError(error.message)}`)
  revalidatePath('/admin/appointments');redirect('/admin/appointments?saved=rescheduled')
}
async function updateDetails(form:FormData){'use server'
  const{supabase}=await viewer();const id=String(form.get('id')||'');const type=String(form.get('appointment_type_id')||'');const duration=Number(form.get('duration_minutes'));const format=String(form.get('format')||'virtual')
  if(!id||!type||!Number.isInteger(duration)||duration<5||duration>720)redirect('/admin/appointments?error=fields')
  const{error}=await supabase.rpc('staff_update_appointment_details',{p_appointment_id:id,p_appointment_type_id:type,p_duration_minutes:duration,p_is_virtual:format==='virtual',p_meeting_link:String(form.get('meeting_link')||'')||null,p_location_address:String(form.get('location_address')||'')||null,p_notes:String(form.get('notes')||'')||null})
  if(error)redirect(`/admin/appointments?error=${rpcError(error.message)}`)
  revalidatePath('/admin/appointments');redirect('/admin/appointments?saved=details')
}
async function transitionAppointment(form:FormData){'use server'
  const{supabase}=await viewer();const id=String(form.get('id')||'');const status=String(form.get('status')||'');if(!id||!status)redirect('/admin/appointments?error=fields')
  const{error}=await supabase.rpc('staff_transition_appointment',{p_appointment_id:id,p_to_status:status,p_reason:String(form.get('reason')||'')||null})
  if(error)redirect('/admin/appointments?error=transition')
  revalidatePath('/admin/appointments');redirect('/admin/appointments?saved=status')
}

export default async function AppointmentsPage({searchParams}:{searchParams?:{q?:string;status?:string;page?:string;saved?:string;error?:string}}){
  const{supabase,tenantId}=await viewer();const q=String(searchParams?.q||'').trim().slice(0,80);const status=String(searchParams?.status||'active');const page=Math.max(1,Number.parseInt(String(searchParams?.page||'1'),10)||1);const pageSize=100;const first=(page-1)*pageSize
  const now=new Date();const from=new Date(now.getTime()-90*86400000).toISOString();const to=new Date(now.getTime()+365*86400000).toISOString()
  let contactQuery=supabase.from('crm_contacts').select('id,name,email,phone,whatsapp,linked_user_id').eq('tenant_id',tenantId).order('name').limit(q?50:25)
  if(q)contactQuery=contactQuery.ilike('name',`%${q.replace(/[%_]/g,'')}%`)
  const[{data:settings},{data:types},{data:nutritionists},{data:contacts}]=await Promise.all([
    supabase.from('tenant_appointment_settings').select('timezone').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_types').select('id,name,code,duration_minutes,default_is_virtual').eq('tenant_id',tenantId).eq('active',true).order('sort_order'),
    supabase.from('nutritionists').select('id,name').eq('tenant_id',tenantId).order('name'),contactQuery
  ])
  const timezone=settings?.timezone||'America/Sao_Paulo'
  let appointmentsQuery=supabase.from('appointments').select('id,scheduled_at,ends_at,blocked_ends_at,duration_minutes,status,is_virtual,meeting_link,location_address,notes,schedule_override,override_reason,crm_contact:crm_contacts!crm_contact_id(id,name,email,phone,whatsapp),appointment_type:appointment_types!appointment_type_id(id,name,code),nutritionist:nutritionists!nutritionist_id(id,name)',{count:'exact'}).eq('tenant_id',tenantId).gte('scheduled_at',from).lte('scheduled_at',to).order('scheduled_at',{ascending:true})
  if(status==='active')appointmentsQuery=appointmentsQuery.in('status',['scheduled','confirmed','in_progress'])
  else if(status!=='all')appointmentsQuery=appointmentsQuery.eq('status',status)
  const{data:appointments,error:loadError,count}=await appointmentsQuery.range(first,first+pageSize-1);const total=count||0;const totalPages=Math.max(1,Math.ceil(total/pageSize))
  const errorText:Record<string,string>={fields:'Revise os campos obrigatórios.',conflict:'Esse horário conflita com outra consulta ou com o buffer da agenda.',availability:'O horário está fora da disponibilidade, antecedência ou bloqueios configurados.',override:'Encaixes precisam de um motivo.',transition:'Essa mudança de status não é permitida.',save:'Não foi possível salvar a consulta.'}
  const pageHref=(p:number)=>`/admin/appointments?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&page=${p}`
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Fase 4 · Agenda operacional</p><h1 className="text-3xl font-black">Consultas</h1><p className="mt-2 text-sm text-slate-600">Crie, reagende e conduza a consulta no horário da clínica ({timezone}).</p></div><div className="flex gap-2"><Link href="/admin/appointments/availability" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Disponibilidade</Link><Link href="/admin/appointment-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Tipos de consulta</Link><Link href="/admin" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Painel</Link></div></header>
    {searchParams?.saved&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Agenda atualizada com sucesso.</div>}
    {searchParams?.error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText[searchParams.error]||'Revise a operação.'}</div>}
    {loadError&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar a agenda.</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Nova consulta</h2><p className="mt-1 text-sm text-slate-600">Pesquise o contato no CRM. Ele não precisa ter login no app; “não contatar” no CRM não impede um atendimento solicitado.</p>
      <form method="get" className="mt-4 flex gap-2"><input type="hidden" name="status" value={status}/><input name="q" defaultValue={q} placeholder="Buscar contato pelo nome" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"/><button className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold">Buscar</button></form>
      <form action={createAppointment} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm font-bold">Contato<select name="crm_contact_id" required className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Selecione</option>{(contacts||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}{c.email?` · ${c.email}`:''}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">Profissional<select name="nutritionist_id" required className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Selecione</option>{(nutritionists||[]).map((n:any)=><option key={n.id} value={n.id}>{n.name||'Nutricionista'}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">Tipo<select name="appointment_type_id" required className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Selecione</option>{(types||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name} · {t.duration_minutes} min</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">Data e hora<input name="local_start" type="datetime-local" required className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-bold">Duração personalizada (opcional)<input name="duration_minutes" type="number" min={5} max={720} placeholder="Usar padrão do tipo" className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-bold">Formato<select name="format" className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="default">Padrão do tipo</option><option value="virtual">Online</option><option value="presential">Presencial</option></select></label>
        <label className="grid gap-1 text-sm font-bold">Link da consulta<input name="meeting_link" placeholder="Opcional; usa padrão da profissional" className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-bold">Local presencial<input name="location_address" placeholder="Opcional" className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-bold md:col-span-2">Observações<input name="notes" className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold"><input name="schedule_override" type="checkbox"/>Encaixe / exceção de disponibilidade</label>
        <label className="grid gap-1 text-sm font-bold">Motivo do encaixe<input name="override_reason" placeholder="Obrigatório se marcar encaixe" className="rounded-xl border border-slate-300 px-3 py-2"/></label>
        <button className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white md:col-span-2 lg:col-span-4">Agendar consulta</button>
      </form>
    </section>

    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Agenda</h2><p className="text-sm text-slate-500">{total} consulta{total===1?'':'s'} neste filtro · página {Math.min(page,totalPages)} de {totalPages}.</p></div><form method="get" className="flex gap-2"><input type="hidden" name="q" value={q}/><select name="status" defaultValue={status} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="active">Ativas</option><option value="scheduled">Agendadas</option><option value="confirmed">Confirmadas</option><option value="in_progress">Em andamento</option><option value="completed">Realizadas</option><option value="cancelled">Canceladas</option><option value="no_show">Ausências</option><option value="all">Todas</option></select><button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold">Filtrar</button></form></div>
      {(appointments||[]).length===0?<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nenhuma consulta neste filtro.</div>:(appointments||[]).map((a:any)=>{
        const contact=Array.isArray(a.crm_contact)?a.crm_contact[0]:a.crm_contact;const type=Array.isArray(a.appointment_type)?a.appointment_type[0]:a.appointment_type;const nutri=Array.isArray(a.nutritionist)?a.nutritionist[0]:a.nutritionist
        return <article key={a.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{contact?.name||'Contato'}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{STATUS_LABEL[a.status]||a.status}</span>{a.schedule_override&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">Encaixe</span>}</div><p className="mt-1 text-sm text-slate-600">{displayDate(a.scheduled_at,timezone)} · {type?.name||'Consulta'} · {a.duration_minutes} min + {a.blocked_ends_at&&a.ends_at?Math.round((new Date(a.blocked_ends_at).getTime()-new Date(a.ends_at).getTime())/60000):0} min de buffer</p><p className="text-xs text-slate-500">{nutri?.name||'Nutricionista'} · {a.is_virtual?'Online':'Presencial'}</p>{a.override_reason&&<p className="mt-1 text-xs text-amber-700">Motivo do encaixe: {a.override_reason}</p>}</div><div className="flex flex-wrap gap-2">{a.status==='scheduled'&&<form action={transitionAppointment}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="status" value="confirmed"/><button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Confirmar</button></form>}{['scheduled','confirmed'].includes(a.status)&&<form action={transitionAppointment}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="status" value="in_progress"/><button className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white">Iniciar consulta</button></form>}{a.status==='in_progress'&&<form action={transitionAppointment}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="status" value="completed"/><button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">Concluir</button></form>}</div></div>
        {['scheduled','confirmed','no_show'].includes(a.status)&&<details className="mt-4 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-black">Reagendar</summary><form action={rescheduleAppointment} className="mt-3 grid gap-3 md:grid-cols-4"><input type="hidden" name="id" value={a.id}/><label className="grid gap-1 text-xs font-bold">Nova data e hora<input name="local_start" type="datetime-local" required defaultValue={localInput(a.scheduled_at,timezone)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><label className="grid gap-1 text-xs font-bold">Duração<input name="duration_minutes" type="number" min={5} max={720} required defaultValue={a.duration_minutes} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><label className="flex items-center gap-2 self-end pb-2 text-xs font-bold"><input name="schedule_override" type="checkbox" defaultChecked={a.schedule_override}/>Encaixe</label><label className="grid gap-1 text-xs font-bold">Motivo<input name="override_reason" defaultValue={a.override_reason||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><button className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white md:col-span-4">Salvar reagendamento</button></form></details>}
        {['scheduled','confirmed'].includes(a.status)&&<details className="mt-3 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-black">Editar detalhes</summary><form action={updateDetails} className="mt-3 grid gap-3 md:grid-cols-3"><input type="hidden" name="id" value={a.id}/><label className="grid gap-1 text-xs font-bold">Tipo<select name="appointment_type_id" defaultValue={type?.id||''} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">{(types||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Duração<input name="duration_minutes" type="number" min={5} max={720} required defaultValue={a.duration_minutes} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><label className="grid gap-1 text-xs font-bold">Formato<select name="format" defaultValue={a.is_virtual?'virtual':'presential'} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="virtual">Online</option><option value="presential">Presencial</option></select></label><input name="meeting_link" defaultValue={a.meeting_link||''} placeholder="Link" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><input name="location_address" defaultValue={a.location_address||''} placeholder="Local" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><input name="notes" defaultValue={a.notes||''} placeholder="Observações" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black md:col-span-3">Salvar detalhes</button></form></details>}
        {['scheduled','confirmed','in_progress'].includes(a.status)&&<details className="mt-3 rounded-2xl border border-red-100 p-4"><summary className="cursor-pointer text-sm font-black text-red-700">Cancelar consulta</summary><form action={transitionAppointment} className="mt-3 flex gap-2"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="status" value="cancelled"/><input name="reason" required placeholder="Motivo do cancelamento" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white">Cancelar</button></form></details>}
      </article>})}
      {totalPages>1&&<nav className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold">{page>1?<Link href={pageHref(page-1)} className="rounded-lg border border-slate-300 px-3 py-2">← Anterior</Link>:<span/>}<span>{page} / {totalPages}</span>{page<totalPages?<Link href={pageHref(page+1)} className="rounded-lg border border-slate-300 px-3 py-2">Próxima →</Link>:<span/>}</nav>}
    </section>
  </div></main>
}
