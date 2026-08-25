import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic='force-dynamic'
export const revalidate=0
const STAFF=['admin','nutritionist','nutri']
const ACTIONS=['confirm','cancel','reschedule'] as const

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!p?.tenant_id||!STAFF.includes(String(p.role||'').toLowerCase()))redirect('/patient/home')
  return{supabase,tenantId:p.tenant_id,userId:user.id}
}

async function saveBehavior(form:FormData){'use server'
  const{supabase,tenantId,userId}=await viewer()
  const{error}=await supabase.from('appointment_communication_channel_settings').update({
    whatsapp_allow_confirm:form.get('allow_confirm')==='on',
    whatsapp_allow_cancel:form.get('allow_cancel')==='on',
    whatsapp_allow_reschedule:form.get('allow_reschedule')==='on',
    updated_by:userId,updated_at:new Date().toISOString()
  }).eq('tenant_id',tenantId)
  if(error)redirect('/admin/appointments/communications/whatsapp?error=behavior')
  revalidatePath('/admin/appointments/communications/whatsapp');redirect('/admin/appointments/communications/whatsapp?saved=behavior')
}

async function saveQuickReplies(form:FormData){'use server'
  const{supabase,tenantId}=await viewer()
  const id=String(form.get('id')||'')
  const actions=ACTIONS.filter(a=>form.get(a)==='on')
  if(!id||actions.length>3)redirect('/admin/appointments/communications/whatsapp?error=template')
  const{error}=await supabase.from('appointment_communication_templates').update({provider_quick_reply_actions:actions,updated_at:new Date().toISOString()}).eq('tenant_id',tenantId).eq('id',id).eq('channel','whatsapp')
  if(error)redirect('/admin/appointments/communications/whatsapp?error=template')
  revalidatePath('/admin/appointments/communications/whatsapp');redirect('/admin/appointments/communications/whatsapp?saved=template')
}

function fmt(value:string|undefined|null,tz:string){if(!value)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:tz,dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function actionLabel(a:string){return({confirmed:'Confirmada',cancelled:'Cancelada',ask_cancel_reason:'Aguardando motivo',show_reschedule_options:'Opções de reagendamento',rescheduled:'Reagendada',reschedule_option_unavailable:'Horário indisponível',help:'Ajuda enviada',opt_out:'Opt-out',patient_not_uniquely_resolved:'Revisão manual',appointment_unavailable:'Consulta indisponível'} as Record<string,string>)[a]||a||'—'}

export default async function Page({searchParams}:{searchParams?:{saved?:string;error?:string}}){
  const{supabase,tenantId}=await viewer()
  const[{data:channel},{data:templates},{data:inbound},{data:conversations},{data:settings}]=await Promise.all([
    supabase.from('appointment_communication_channel_settings').select('whatsapp_enabled,whatsapp_allow_confirm,whatsapp_allow_cancel,whatsapp_allow_reschedule,whatsapp_phone_number_id').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_templates').select('id,kind,active,provider_template_name,provider_quick_reply_actions').eq('tenant_id',tenantId).eq('channel','whatsapp').order('kind'),
    supabase.from('appointment_whatsapp_inbound_messages').select('id,patient_id,appointment_id,message_type,message_text,action_id,processing_status,result_action,error_message,received_at').eq('tenant_id',tenantId).order('received_at',{ascending:false}).limit(100),
    supabase.from('appointment_whatsapp_conversations').select('patient_id,appointment_id,state,expires_at,updated_at').eq('tenant_id',tenantId).neq('state','idle').order('updated_at',{ascending:false}).limit(50),
    supabase.from('tenant_appointment_settings').select('timezone,require_cancellation_reason').eq('tenant_id',tenantId).maybeSingle()
  ])
  const patientIds=[...new Set([...(inbound||[]).map((x:any)=>x.patient_id),...(conversations||[]).map((x:any)=>x.patient_id)].filter(Boolean))]
  const apptIds=[...new Set([...(inbound||[]).map((x:any)=>x.appointment_id),...(conversations||[]).map((x:any)=>x.appointment_id)].filter(Boolean))]
  const[{data:profiles},{data:appointments}]=await Promise.all([
    patientIds.length?supabase.from('profiles').select('user_id,name').eq('tenant_id',tenantId).in('user_id',patientIds):Promise.resolve({data:[] as any[]}),
    apptIds.length?supabase.from('appointments').select('id,scheduled_at,status').eq('tenant_id',tenantId).in('id',apptIds):Promise.resolve({data:[] as any[]})
  ])
  const names=new Map((profiles||[]).map((p:any)=>[p.user_id,p.name]))
  const appts=new Map((appointments||[]).map((a:any)=>[a.id,a]))
  const tz=settings?.timezone||'America/Sao_Paulo'
  const review=(inbound||[]).filter((x:any)=>x.processing_status==='needs_staff'||x.processing_status==='failed').length
  const activeConversations=(conversations||[]).length
  const processed=(inbound||[]).filter((x:any)=>x.processing_status==='processed').length
  const ready=Boolean(channel?.whatsapp_enabled&&channel?.whatsapp_phone_number_id)
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Fase 4 · Bloco 6</p><h1 className="text-3xl font-black">WhatsApp bidirecional</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Confirmação, cancelamento com motivo e reagendamento pelo próprio WhatsApp. Toda ação é vinculada à paciente, revalidada no banco e registrada para auditoria.</p></div><Link href="/admin/appointments/communications" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar à central</Link></header>
    {searchParams?.saved&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Alteração salva.</div>}
    {searchParams?.error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Não foi possível salvar a alteração.</div>}

    <section className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">Canal</p><p className={`mt-1 text-lg font-black ${ready?'text-emerald-700':'text-slate-700'}`}>{ready?'Pronto para configurar templates':'Desligado / incompleto'}</p></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">Respostas processadas</p><p className="mt-1 text-2xl font-black">{processed}</p></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">Conversas em andamento</p><p className="mt-1 text-2xl font-black">{activeConversations}</p></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">Precisam de revisão</p><p className={`mt-1 text-2xl font-black ${review?'text-red-700':''}`}>{review}</p></div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">O que a paciente pode fazer</h2><p className="mt-1 text-sm text-slate-600">O cancelamento respeita a regra atual da clínica: motivo {settings?.require_cancellation_reason?'obrigatório':'opcional'}. Reagendamento só altera o horário depois de uma opção válida ser escolhida e revalidada.</p>
      <form action={saveBehavior} className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl border p-4 font-bold"><input type="checkbox" name="allow_confirm" defaultChecked={channel?.whatsapp_allow_confirm!==false}/>Confirmar consulta</label>
        <label className="flex items-center gap-2 rounded-2xl border p-4 font-bold"><input type="checkbox" name="allow_cancel" defaultChecked={channel?.whatsapp_allow_cancel!==false}/>Cancelar consulta</label>
        <label className="flex items-center gap-2 rounded-2xl border p-4 font-bold"><input type="checkbox" name="allow_reschedule" defaultChecked={channel?.whatsapp_allow_reschedule!==false}/>Reagendar consulta</label>
        <button className="sm:col-span-3 w-fit rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white">Salvar comportamento</button>
      </form>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Quick replies dos templates Meta</h2><p className="mt-1 text-sm text-slate-600">Marque somente botões que existam no template aprovado na Meta e mantenha a mesma ordem: Confirmar, Cancelar, Reagendar.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{(templates||[]).map((t:any)=>{const selected=Array.isArray(t.provider_quick_reply_actions)?t.provider_quick_reply_actions:[];return <form action={saveQuickReplies} key={t.id} className="rounded-2xl border p-4"><input type="hidden" name="id" value={t.id}/><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-violet-700">{t.kind==='confirmation_request'?'Confirmação':'Lembrete'}</p><p className="mt-1 font-bold">{t.provider_template_name||'Template Meta ainda sem nome'}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${t.active?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{t.active?'Ativo':'Inativo'}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" defaultChecked={selected.includes('confirm')}/>Confirmar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cancel" defaultChecked={selected.includes('cancel')}/>Cancelar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reschedule" defaultChecked={selected.includes('reschedule')}/>Reagendar</label></div><button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Salvar botões</button></form>})}</div></section>

    {activeConversations>0&&<section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-black text-amber-900">Conversas aguardando resposta</h2><div className="mt-3 grid gap-2">{(conversations||[]).map((c:any)=>{const a=appts.get(c.appointment_id);return <div key={`${c.patient_id}-${c.appointment_id}`} className="rounded-2xl bg-white p-3 text-sm"><b>{names.get(c.patient_id)||'Paciente'}</b> · {c.state==='awaiting_cancel_reason'?'aguardando motivo do cancelamento':'aguardando escolha de novo horário'}<div className="mt-1 text-xs text-slate-500">Consulta {a?fmt(a.scheduled_at,tz):'—'} · expira {fmt(c.expires_at,tz)}</div></div>})}</div></section>}

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-black">Respostas recebidas</h2><p className="mt-1 text-sm text-slate-600">Últimas 100 mensagens relacionadas à agenda. O payload bruto da Meta não é armazenado.</p></div>{!(inbound||[]).length?<div className="p-8 text-center text-sm text-slate-500">Nenhuma resposta recebida ainda.</div>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Recebida</th><th className="px-4 py-3">Mensagem / botão</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y">{(inbound||[]).map((m:any)=>{const a=appts.get(m.appointment_id);return <tr key={m.id}><td className="px-4 py-3"><b>{names.get(m.patient_id)||'Não identificada'}</b>{a&&<div className="text-xs text-slate-500">Consulta {fmt(a.scheduled_at,tz)} · {a.status}</div>}</td><td className="px-4 py-3">{fmt(m.received_at,tz)}</td><td className="px-4 py-3"><div className="max-w-sm truncate">{m.message_text||m.action_id||m.message_type}</div></td><td className="px-4 py-3 font-bold">{actionLabel(m.result_action)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${m.processing_status==='processed'?'bg-emerald-100 text-emerald-800':m.processing_status==='needs_staff'?'bg-amber-100 text-amber-800':m.processing_status==='failed'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700'}`}>{m.processing_status}</span>{m.error_message&&<div className="mt-1 max-w-xs text-xs text-red-600">{m.error_message}</div>}</td></tr>})}</tbody></table></div>}</section>
  </div></main>
}
