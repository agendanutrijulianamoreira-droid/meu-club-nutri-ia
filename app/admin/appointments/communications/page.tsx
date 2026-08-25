import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STAFF_ROLES = ['admin','nutritionist','nutri']
const PARAM_KEYS = ['patient_name','appointment_date','appointment_time','appointment_type','appointment_id']

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!p?.tenant_id||!STAFF_ROLES.includes(String(p.role||'').toLowerCase()))redirect('/patient/home')
  return{supabase,tenantId:p.tenant_id,userId:user.id}
}

async function saveChannelSettings(form:FormData){'use server'
  const{supabase,tenantId,userId}=await viewer()
  const phoneId=String(form.get('phone_number_id')||'').trim()||null
  const wabaId=String(form.get('waba_id')||'').trim()||null
  const graphVersion=String(form.get('graph_version')||'v26.0').trim()
  const accessEnv=String(form.get('access_token_env')||'WHATSAPP_ACCESS_TOKEN').trim()
  const verifyEnv=String(form.get('verify_token_env')||'WHATSAPP_WEBHOOK_VERIFY_TOKEN').trim()
  const appSecretEnv=String(form.get('app_secret_env')||'WHATSAPP_APP_SECRET').trim()
  const quietStart=String(form.get('quiet_start')||'20:00')
  const quietEnd=String(form.get('quiet_end')||'08:00')
  const enabled=form.get('enabled')==='on'
  const envOk=[accessEnv,verifyEnv,appSecretEnv].every(v=>/^[A-Z][A-Z0-9_]{2,127}$/.test(v))
  if(!/^v\d+\.\d+$/.test(graphVersion)||!envOk||!/^\d{2}:\d{2}$/.test(quietStart)||!/^\d{2}:\d{2}$/.test(quietEnd)||(enabled&&!phoneId))redirect('/admin/appointments/communications?error=channel')
  const{error}=await supabase.from('appointment_communication_channel_settings').upsert({
    tenant_id:tenantId,whatsapp_enabled:enabled,whatsapp_provider:'meta_cloud',whatsapp_phone_number_id:phoneId,
    whatsapp_waba_id:wabaId,whatsapp_graph_version:graphVersion,whatsapp_access_token_env:accessEnv,
    whatsapp_verify_token_env:verifyEnv,whatsapp_app_secret_env:appSecretEnv,
    fallback_to_inbox:form.get('fallback')==='on',quiet_hours_enabled:form.get('quiet')==='on',
    quiet_hours_start:quietStart,quiet_hours_end:quietEnd,updated_by:userId,updated_at:new Date().toISOString()
  },{onConflict:'tenant_id'})
  if(error)redirect('/admin/appointments/communications?error=channel_save')
  revalidatePath('/admin/appointments/communications');redirect('/admin/appointments/communications?saved=channel')
}

async function saveTemplate(form:FormData){'use server'
  const{supabase,tenantId}=await viewer()
  const id=String(form.get('id')||'')
  const channel=String(form.get('channel')||'inbox')
  if(!id||!['inbox','whatsapp'].includes(channel))redirect('/admin/appointments/communications?error=template')
  if(channel==='inbox'){
    const title=String(form.get('title')||'').trim(),body=String(form.get('body')||'').trim()
    const ctaLabel=String(form.get('cta_label')||'').trim()||null,ctaUrl=String(form.get('cta_url')||'').trim()||null
    if(!title||!body||title.length>160||body.length>2000)redirect('/admin/appointments/communications?error=template')
    const{error}=await supabase.from('appointment_communication_templates').update({title,body,cta_label:ctaLabel,cta_url:ctaUrl,active:form.get('active')==='on',updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',tenantId).eq('channel','inbox')
    if(error)redirect('/admin/appointments/communications?error=template_save')
  }else{
    const name=String(form.get('provider_template_name')||'').trim()||null
    const language=String(form.get('provider_language')||'pt_BR').trim()
    const parameters=String(form.get('provider_parameters')||'').split(',').map(v=>v.trim()).filter(Boolean)
    if(!/^[a-z0-9_]{1,512}$/.test(name||'x')||!/^[a-z]{2}_[A-Z]{2}$/.test(language)||parameters.some(p=>!PARAM_KEYS.includes(p)))redirect('/admin/appointments/communications?error=meta_template')
    const{error}=await supabase.from('appointment_communication_templates').update({provider_template_name:name,provider_language:language,provider_parameters:parameters,active:form.get('active')==='on',updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',tenantId).eq('channel','whatsapp')
    if(error)redirect('/admin/appointments/communications?error=template_save')
  }
  revalidatePath('/admin/appointments/communications');redirect('/admin/appointments/communications?saved=template')
}

async function saveConsent(form:FormData){'use server'
  const{supabase,tenantId}=await viewer()
  const patientId=String(form.get('patient_id')||''),status=String(form.get('status')||'unknown')
  const evidence=String(form.get('evidence')||'').trim().slice(0,500)||null
  if(!patientId||!['unknown','opt_in','opt_out'].includes(status))redirect('/admin/appointments/communications?error=consent')
  const{data:patient}=await supabase.from('profiles').select('user_id').eq('tenant_id',tenantId).eq('user_id',patientId).eq('role','patient').maybeSingle()
  if(!patient)redirect('/admin/appointments/communications?error=consent')
  const now=new Date().toISOString()
  const{error}=await supabase.from('appointment_communication_consents').upsert({
    tenant_id:tenantId,patient_id:patientId,channel:'whatsapp',status,source:'staff_recorded',evidence,
    captured_at:status==='opt_in'?now:null,revoked_at:status==='opt_out'?now:null,updated_at:now
  },{onConflict:'tenant_id,patient_id,channel'})
  if(error)redirect('/admin/appointments/communications?error=consent_save')
  revalidatePath('/admin/appointments/communications');redirect('/admin/appointments/communications?saved=consent')
}

function formatDate(value:string,timezone:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function badge(status:string){return status==='sent'?'bg-emerald-100 text-emerald-800':status==='sending'?'bg-violet-100 text-violet-800':status==='ready'?'bg-amber-100 text-amber-800':status==='pending'?'bg-blue-100 text-blue-800':status==='failed'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700'}

export default async function AppointmentCommunicationsPage({searchParams}:{searchParams?:{saved?:string;error?:string;q?:string}}){
  const{supabase,tenantId}=await viewer()
  const q=String(searchParams?.q||'').trim()
  const[{data:settings},{data:channelSettings},{data:jobs,error:jobsError},{data:templates},{data:events}]=await Promise.all([
    supabase.from('tenant_appointment_settings').select('timezone,appointment_confirmation_enabled,appointment_confirmation_lead_hours,appointment_reminder_enabled,appointment_reminder_lead_hours').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_channel_settings').select('*').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_jobs').select('id,appointment_id,patient_id,kind,due_at,status,channel,provider,provider_message_id,attempt_count,max_attempts,sent_at,delivered_at,last_error,metadata,appointments!appointment_id(scheduled_at,status,appointment_types!appointment_type_id(name))').eq('tenant_id',tenantId).order('due_at',{ascending:false}).limit(200),
    supabase.from('appointment_communication_templates').select('id,kind,channel,title,body,cta_label,cta_url,active,provider_template_name,provider_language,provider_parameters').eq('tenant_id',tenantId).order('channel').order('kind'),
    supabase.from('appointment_communication_delivery_events').select('job_id,status,event_at').eq('tenant_id',tenantId).order('event_at',{ascending:false}).limit(400)
  ])
  let patientQuery=supabase.from('profiles').select('user_id,name,phone').eq('tenant_id',tenantId).eq('role','patient').order('name').limit(50)
  if(q)patientQuery=patientQuery.or(`name.ilike.%${q.replace(/[%_,]/g,'')}%,phone.ilike.%${q.replace(/[%_,]/g,'')}%`)
  const{data:patients}=await patientQuery
  const patientIds=(patients||[]).map((p:any)=>p.user_id)
  const{data:consents}=patientIds.length?await supabase.from('appointment_communication_consents').select('patient_id,status,evidence,captured_at,revoked_at').eq('tenant_id',tenantId).eq('channel','whatsapp').in('patient_id',patientIds):{data:[] as any[]}
  const consentMap=new Map((consents||[]).map((c:any)=>[c.patient_id,c]))
  const rows=(jobs||[]) as any[],allIds=[...new Set(rows.map(j=>j.patient_id).filter(Boolean))]
  const{data:profiles}=allIds.length?await supabase.from('profiles').select('user_id,name').eq('tenant_id',tenantId).in('user_id',allIds):{data:[] as any[]}
  const patientNames=new Map((profiles||[]).map((p:any)=>[p.user_id,p.name]))
  const eventMap=new Map<string,string>()
  for(const e of events||[])if(!eventMap.has((e as any).job_id))eventMap.set((e as any).job_id,(e as any).status)
  const timezone=settings?.timezone||'America/Sao_Paulo'
  const counts={pending:rows.filter(j=>j.status==='pending').length,ready:rows.filter(j=>j.status==='ready').length,sending:rows.filter(j=>j.status==='sending').length,sent:rows.filter(j=>j.status==='sent').length,failed:rows.filter(j=>j.status==='failed').length}
  const inboxTemplates=(templates||[]).filter((t:any)=>t.channel==='inbox'),waTemplates=(templates||[]).filter((t:any)=>t.channel==='whatsapp')
  const waReady=Boolean(channelSettings?.whatsapp_enabled&&channelSettings?.whatsapp_phone_number_id&&waTemplates.some((t:any)=>t.active&&t.provider_template_name))
  const errorText=searchParams?.error?({channel:'Revise a configuração do canal.',channel_save:'Não foi possível salvar o canal.',template:'Revise o template.',meta_template:'Revise nome, idioma e parâmetros do template Meta.',template_save:'Não foi possível salvar o template.',consent:'Paciente ou consentimento inválido.',consent_save:'Não foi possível registrar o consentimento.'} as Record<string,string>)[searchParams.error]||'Não foi possível concluir a alteração.':''
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Fase 4 · Bloco 5</p><h1 className="text-3xl font-black">Comunicações da agenda</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Fila única com Inbox e WhatsApp Meta Cloud API. WhatsApp só assume o job quando canal, template e opt-in estão válidos; em falha definitiva, o Inbox recebe o fallback.</p></div><div className="flex gap-2"><Link href="/admin/appointment-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Configurações</Link><Link href="/admin/appointments" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Agenda</Link></div></header>
    {searchParams?.saved&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Alteração salva.</div>}{errorText&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText}</div>}

    <section className="grid gap-3 sm:grid-cols-5">{[['Aguardando',counts.pending,'blue'],['Prontas',counts.ready,'amber'],['Enviando',counts.sending,'violet'],['Enviadas',counts.sent,'emerald'],['Falhas',counts.failed,'red']].map(([label,value,tone]:any)=><div key={label} className={`rounded-2xl border bg-white p-4 shadow-sm`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p>{tone==='violet'&&value>0&&<p className="mt-1 text-[10px] text-violet-700">Estado externo em voo</p>}</div>)}</section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-black">WhatsApp · Meta Cloud API</h2><p className="mt-1 text-sm text-slate-600">Status: <b className={waReady?'text-emerald-700':'text-slate-600'}>{waReady?'habilitado para jobs elegíveis':'não habilitado'}</b>. O token nunca é salvo nesta tela.</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><b>Webhook</b><br/>https://antszuxeairmbctwuafo.supabase.co/functions/v1/appointment-whatsapp-meta</div></div>
      <form action={saveChannelSettings} className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={channelSettings?.whatsapp_enabled}/>Ativar WhatsApp</label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Phone Number ID<input name="phone_number_id" defaultValue={channelSettings?.whatsapp_phone_number_id||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">WABA ID<input name="waba_id" defaultValue={channelSettings?.whatsapp_waba_id||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Graph API<input name="graph_version" defaultValue={channelSettings?.whatsapp_graph_version||'v26.0'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Secret do access token<input name="access_token_env" defaultValue={channelSettings?.whatsapp_access_token_env||'WHATSAPP_ACCESS_TOKEN'} className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Secret do verify token<input name="verify_token_env" defaultValue={channelSettings?.whatsapp_verify_token_env||'WHATSAPP_WEBHOOK_VERIFY_TOKEN'} className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Secret do App Secret<input name="app_secret_env" defaultValue={channelSettings?.whatsapp_app_secret_env||'WHATSAPP_APP_SECRET'} className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"/></label>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" name="fallback" defaultChecked={channelSettings?.fallback_to_inbox!==false}/>Fallback para Inbox</label>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" name="quiet" defaultChecked={channelSettings?.quiet_hours_enabled!==false}/>Respeitar horário silencioso</label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Silêncio inicia<input name="quiet_start" type="time" defaultValue={String(channelSettings?.quiet_hours_start||'20:00').slice(0,5)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">Silêncio termina<input name="quiet_end" type="time" defaultValue={String(channelSettings?.quiet_hours_end||'08:00').slice(0,5)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
        <div className="flex items-end"><button className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-black text-white">Salvar canal</button></div>
      </form>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><b>Credenciais:</b> crie os três secrets acima em Supabase → Edge Functions → Secrets. Use token permanente de System User para produção. Só depois ative o canal.</div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Templates do Inbox</h2><p className="mt-1 text-sm text-slate-600">Fallback e canal padrão quando WhatsApp não estiver elegível.</p><div className="mt-4 space-y-4">{inboxTemplates.map((t:any)=><form key={t.id} action={saveTemplate} className="rounded-2xl border border-slate-200 p-4"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="channel" value="inbox"/><div className="flex justify-between"><b className="text-sm">{t.kind==='confirmation_request'?'Confirmação':'Lembrete'}</b><label className="text-xs font-bold"><input name="active" type="checkbox" defaultChecked={t.active}/> Ativo</label></div><input name="title" required maxLength={160} defaultValue={t.title} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/><textarea name="body" required maxLength={2000} rows={3} defaultValue={t.body} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/><div className="mt-2 grid gap-2 sm:grid-cols-2"><input name="cta_label" placeholder="Texto do botão" defaultValue={t.cta_label||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><input name="cta_url" placeholder="Destino" defaultValue={t.cta_url||''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></div><button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">Salvar Inbox</button></form>)}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Templates aprovados na Meta</h2><p className="mt-1 text-sm text-slate-600">O nome deve ser exatamente o template aprovado no WhatsApp Manager. Parâmetros são enviados na ordem abaixo.</p><div className="mt-4 space-y-4">{waTemplates.map((t:any)=><form key={t.id} action={saveTemplate} className="rounded-2xl border border-slate-200 p-4"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="channel" value="whatsapp"/><div className="flex justify-between"><b className="text-sm">{t.kind==='confirmation_request'?'Confirmação':'Lembrete'}</b><label className="text-xs font-bold"><input name="active" type="checkbox" defaultChecked={t.active}/> Ativo</label></div><label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">Nome na Meta<input name="provider_template_name" defaultValue={t.provider_template_name||''} placeholder="consulta_confirmacao" className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"/></label><label className="mt-2 grid gap-1 text-xs font-bold text-slate-600">Idioma<input name="provider_language" defaultValue={t.provider_language||'pt_BR'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label><label className="mt-2 grid gap-1 text-xs font-bold text-slate-600">Parâmetros, na ordem<input name="provider_parameters" defaultValue={(t.provider_parameters||[]).join(', ')} className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"/></label><p className="mt-1 text-[10px] text-slate-500">Permitidos: {PARAM_KEYS.join(', ')}</p><button className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">Salvar Meta</button></form>)}</div></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">Consentimento WhatsApp</h2><p className="mt-1 text-sm text-slate-600">Sem opt-in explícito, o job fica no Inbox. “Não contatar” no CRM também bloqueia o roteamento externo.</p></div><form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar paciente ou telefone" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Buscar</button></form></div><div className="mt-4 grid gap-3 md:grid-cols-2">{(patients||[]).map((p:any)=>{const c:any=consentMap.get(p.user_id);return <form key={p.user_id} action={saveConsent} className="rounded-2xl border border-slate-200 p-4"><input type="hidden" name="patient_id" value={p.user_id}/><div><b>{p.name}</b><p className="text-xs text-slate-500">{p.phone||'Sem telefone cadastrado'}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select name="status" defaultValue={c?.status||'unknown'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="unknown">Não registrado</option><option value="opt_in">Opt-in</option><option value="opt_out">Opt-out</option></select><input name="evidence" defaultValue={c?.evidence||''} placeholder="Ex.: consentiu no formulário de consulta" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">Registrar</button></div></form>})}</div>{!patients?.length&&<p className="mt-4 text-sm text-slate-500">Nenhuma paciente encontrada.</p>}</section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Regras de agenda</h2><p className="mt-1 text-sm text-slate-600">Confirmação: {settings?.appointment_confirmation_enabled?'ativa':'desativada'} · {settings?.appointment_confirmation_lead_hours??72}h antes. Lembrete: {settings?.appointment_reminder_enabled?'ativo':'desativado'} · {settings?.appointment_reminder_lead_hours??24}h antes.</p></section>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Fila e delivery</h2><p className="mt-1 text-sm text-slate-600">Até 200 jobs. “sending” é estado protegido: não é reenviado automaticamente se a resposta externa ficar incerta.</p></div>{jobsError?<div className="p-8 text-center text-sm font-bold text-red-600">Não foi possível carregar a fila.</div>:rows.length===0?<div className="p-8 text-center text-sm text-slate-500">Nenhum item materializado.</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Consulta</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Delivery</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(job=>{const appt=job.appointments;const delivery=eventMap.get(job.id);return <tr key={job.id}><td className="px-4 py-3 font-bold">{patientNames.get(job.patient_id)||'Paciente'}</td><td className="px-4 py-3"><div className="font-bold">{appt?.appointment_types?.name||'Consulta'}</div><div className="text-xs text-slate-500">{appt?.scheduled_at?formatDate(appt.scheduled_at,timezone):'—'}</div></td><td className="px-4 py-3">{job.kind==='confirmation_request'?'Confirmação':'Lembrete'}</td><td className="px-4 py-3"><b>{job.provider||job.channel||'automático'}</b><div className="text-xs text-slate-500">{job.attempt_count||0}/{job.max_attempts||3} tentativas</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${badge(job.status)}`}>{job.status}</span>{job.last_error&&<div className="mt-1 max-w-xs text-xs text-red-600">{job.last_error}</div>}</td><td className="px-4 py-3"><b className="text-xs">{delivery|| (job.delivered_at?'delivered':'—')}</b>{job.metadata?.whatsapp_read_at&&<div className="text-xs text-emerald-700">Lida {formatDate(job.metadata.whatsapp_read_at,timezone)}</div>}{job.provider_message_id&&job.provider==='meta_cloud'&&<div className="max-w-[180px] truncate font-mono text-[10px] text-slate-400" title={job.provider_message_id}>{job.provider_message_id}</div>}</td></tr>})}</tbody></table></div>}</section>
  </div></main>
}
