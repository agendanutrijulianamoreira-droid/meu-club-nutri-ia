import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic='force-dynamic'
export const revalidate=0
const STAFF=['admin','nutritionist','nutri']

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:p}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  if(!p?.tenant_id||!STAFF.includes(String(p.role||'').toLowerCase()))redirect('/patient/home')
  return{supabase,tenantId:p.tenant_id,userId:user.id}
}

function normalize(v:string){const d=v.replace(/\D/g,'');if(!d)return '';if((d.length===10||d.length===11)&&!d.startsWith('55'))return `55${d}`;return d}

async function savePilot(form:FormData){'use server'
  const{supabase,tenantId,userId}=await viewer()
  const raw=String(form.get('phones')||'')
  const phones=[...new Set(raw.split(/[\n,;]+/).map(normalize).filter(v=>/^\d{12,13}$/.test(v)))].slice(0,10)
  const{data:current}=await supabase.from('appointment_communication_channel_settings').select('whatsapp_activation_state').eq('tenant_id',tenantId).maybeSingle()
  const requestedPilot=form.get('pilot_mode')==='on'
  const pilotMode=current?.whatsapp_activation_state==='live'?requestedPilot:true
  const{error}=await supabase.from('appointment_communication_channel_settings').update({
    whatsapp_pilot_mode:pilotMode,whatsapp_pilot_allowed_phones:phones,updated_by:userId,updated_at:new Date().toISOString()
  }).eq('tenant_id',tenantId)
  if(error)redirect('/admin/appointments/communications/whatsapp/go-live?error=pilot')
  revalidatePath('/admin/appointments/communications/whatsapp/go-live');redirect('/admin/appointments/communications/whatsapp/go-live?saved=pilot')
}

async function markConfigured(){'use server'
  const{supabase,tenantId,userId}=await viewer()
  const[{data:channel},{data:templates}]=await Promise.all([
    supabase.from('appointment_communication_channel_settings').select('whatsapp_phone_number_id,whatsapp_waba_id').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_templates').select('provider_template_name,active').eq('tenant_id',tenantId).eq('channel','whatsapp')
  ])
  const ok=Boolean(channel?.whatsapp_phone_number_id&&channel?.whatsapp_waba_id&&(templates||[]).some((t:any)=>t.active&&t.provider_template_name))
  if(!ok)redirect('/admin/appointments/communications/whatsapp/go-live?error=incomplete')
  await supabase.from('appointment_communication_channel_settings').update({whatsapp_activation_state:'configured',whatsapp_enabled:false,whatsapp_pilot_mode:true,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',tenantId)
  revalidatePath('/admin/appointments/communications/whatsapp/go-live');redirect('/admin/appointments/communications/whatsapp/go-live?saved=configured')
}

export default async function Page({searchParams}:{searchParams?:{saved?:string;error?:string}}){
  const{supabase,tenantId}=await viewer()
  const[{data:channel},{data:templates},{count:consents}]=await Promise.all([
    supabase.from('appointment_communication_channel_settings').select('*').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_communication_templates').select('kind,active,provider_template_name,provider_quick_reply_actions').eq('tenant_id',tenantId).eq('channel','whatsapp').order('kind'),
    supabase.from('appointment_communication_consents').select('*',{count:'exact',head:true}).eq('tenant_id',tenantId).eq('channel','whatsapp').eq('status','opt_in')
  ])
  const checks=[
    ['Phone Number ID',Boolean(channel?.whatsapp_phone_number_id)],
    ['WABA ID',Boolean(channel?.whatsapp_waba_id)],
    ['Template Meta ativo',Boolean((templates||[]).some((t:any)=>t.active&&t.provider_template_name))],
    ['Quick replies configuradas',Boolean((templates||[]).some((t:any)=>Array.isArray(t.provider_quick_reply_actions)&&t.provider_quick_reply_actions.length))],
    ['Número de piloto liberado',Boolean((channel?.whatsapp_pilot_allowed_phones||[]).length)],
    ['Opt-in disponível',Number(consents||0)>0],
  ] as const
  const configured=checks.slice(0,4).every(([,ok])=>ok)
  const state=channel?.whatsapp_activation_state||'draft'
  const errorText=searchParams?.error==='incomplete'?'Preencha Phone Number ID, WABA ID e ao menos um template Meta ativo antes de marcar como configurado.':searchParams?.error?'Não foi possível salvar o piloto.':''
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-700">Go-live controlado</p><h1 className="text-3xl font-black">Piloto do WhatsApp</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Mesmo após inserir credenciais, o sistema permanece bloqueado para a base inteira. Durante o piloto, somente números explicitamente liberados podem receber mensagens.</p></div><Link href="/admin/appointments/communications/whatsapp" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Voltar ao WhatsApp</Link></header>
    {searchParams?.saved&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Configuração salva.</div>}{errorText&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText}</div>}

    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold text-slate-500">Estado</p><p className="mt-1 text-xl font-black uppercase">{state}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold text-slate-500">Modo piloto</p><p className="mt-1 text-xl font-black">{channel?.whatsapp_pilot_mode!==false?'Ligado':'Desligado'}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold text-slate-500">Opt-ins</p><p className="mt-1 text-xl font-black">{consents||0}</p></div></section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Checklist de prontidão</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map(([label,ok])=><div key={label} className={`rounded-xl border p-3 text-sm font-bold ${ok?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-slate-200 bg-slate-50 text-slate-600'}`}>{ok?'✓':'○'} {label}</div>)}</div><p className="mt-4 text-xs text-slate-500">Os secrets da Meta não são exibidos nem armazenados no banco; este checklist confirma apenas a configuração visível. A promoção para “verified/live” só deve ocorrer depois de validar os secrets e uma chamada real à Meta.</p></section>

    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-black text-amber-950">Allowlist do piloto</h2><p className="mt-1 text-sm text-amber-900">Até 10 números. Use DDI + DDD + número. Enquanto o estado não for <b>live</b>, o modo piloto não pode ser desligado por esta tela.</p><form action={savePilot} className="mt-4 space-y-3"><textarea name="phones" rows={5} defaultValue={(channel?.whatsapp_pilot_allowed_phones||[]).join('\n')} placeholder="5531999999999" className="w-full rounded-2xl border border-amber-300 bg-white p-3 font-mono text-sm"/><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="pilot_mode" defaultChecked={channel?.whatsapp_pilot_mode!==false}/>Manter modo piloto</label><button className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-black text-white">Salvar piloto</button></form></section>

    <section className="rounded-3xl border bg-white p-5"><h2 className="text-lg font-black">Gate operacional</h2><p className="mt-1 text-sm text-slate-600">Marcar como configurado não ativa envios. Apenas registra que IDs e templates já foram preenchidos; o roteamento continua bloqueado até o estado ser verificado.</p><form action={markConfigured} className="mt-4"><button disabled={!configured} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Marcar como configurado</button></form></section>
  </div></main>
}
