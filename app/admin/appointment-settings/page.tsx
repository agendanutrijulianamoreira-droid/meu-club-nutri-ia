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
  return{supabase,user,tenantId:p.tenant_id}
}

async function saveSettings(form:FormData){'use server'
  const{supabase,user,tenantId}=await viewer()
  const timezone=String(form.get('timezone')||'').trim()
  const grace=Number(form.get('no_show_grace_minutes'))
  if(!timezone||!Number.isInteger(grace)||grace<0||grace>1440)redirect('/admin/appointment-settings?error=settings')
  const{error}=await supabase.from('tenant_appointment_settings').upsert({tenant_id:tenantId,timezone,no_show_enabled:form.get('no_show_enabled')==='on',no_show_grace_minutes:grace,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'tenant_id'})
  if(error)redirect(`/admin/appointment-settings?error=${encodeURIComponent(error.message.includes('Timezone IANA')?'timezone':'save')}`)
  revalidatePath('/admin/appointment-settings');redirect('/admin/appointment-settings?saved=1')
}

async function createType(form:FormData){'use server'
  const{supabase,tenantId}=await viewer();const name=String(form.get('name')||'').trim();const duration=Number(form.get('duration_minutes'));const sort=Number(form.get('sort_order')||0)
  if(!name||name.length>100||!Number.isInteger(duration)||duration<5||duration>720||!Number.isInteger(sort))redirect('/admin/appointment-settings?error=type')
  const code=`custom_${Date.now().toString(36)}`
  const{error}=await supabase.from('appointment_types').insert({tenant_id:tenantId,code,name,duration_minutes:duration,default_is_virtual:form.get('default_is_virtual')==='on',sort_order:sort,active:true})
  if(error)redirect('/admin/appointment-settings?error=type_save');revalidatePath('/admin/appointment-settings');redirect('/admin/appointment-settings?typeSaved=1')
}

async function updateType(form:FormData){'use server'
  const{supabase,tenantId}=await viewer();const id=String(form.get('id')||'');const name=String(form.get('name')||'').trim();const duration=Number(form.get('duration_minutes'));const sort=Number(form.get('sort_order')||0)
  if(!id||!name||name.length>100||!Number.isInteger(duration)||duration<5||duration>720||!Number.isInteger(sort))redirect('/admin/appointment-settings?error=type')
  const{error}=await supabase.from('appointment_types').update({name,duration_minutes:duration,default_is_virtual:form.get('default_is_virtual')==='on',active:form.get('active')==='on',sort_order:sort,updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',tenantId)
  if(error)redirect('/admin/appointment-settings?error=type_save');revalidatePath('/admin/appointment-settings');redirect('/admin/appointment-settings?typeSaved=1')
}

export default async function AppointmentSettingsPage({searchParams}:{searchParams?:{saved?:string;typeSaved?:string;error?:string}}){
  const{supabase,tenantId}=await viewer()
  const[{data:settings},{data:types}]=await Promise.all([
    supabase.from('tenant_appointment_settings').select('timezone,no_show_enabled,no_show_grace_minutes').eq('tenant_id',tenantId).maybeSingle(),
    supabase.from('appointment_types').select('id,code,name,duration_minutes,default_is_virtual,active,sort_order').eq('tenant_id',tenantId).order('sort_order').order('name')
  ])
  const error:Record<string,string>={settings:'Revise as configurações gerais.',timezone:'Informe um timezone IANA válido, como America/Sao_Paulo.',save:'Não foi possível salvar as configurações.',type:'Revise nome, duração e ordem do tipo de consulta.',type_save:'Não foi possível salvar o tipo de consulta.'}
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-700">Fase 4 · Automação da consulta</p><h1 className="text-3xl font-black">Configurações de consulta</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Regras da clínica que podem mudar sem alterar código: fuso horário, ausência e tipos de consulta.</p></div><Link href="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar ao painel</Link></header>
    {(searchParams?.saved==='1'||searchParams?.typeSaved==='1')&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Configurações salvas.</div>}
    {searchParams?.error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error[searchParams.error]||'Revise os dados informados.'}</div>}
    <form action={saveSettings} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Agenda da clínica</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold"><span>Timezone da clínica</span><input name="timezone" required defaultValue={settings?.timezone||'America/Sao_Paulo'} placeholder="America/Sao_Paulo" className="rounded-xl border border-slate-300 px-3 py-2"/><small className="font-normal text-slate-500">Use um timezone IANA. Todos os horários da consulta usam esta referência.</small></label><label className="grid gap-1 text-sm font-bold"><span>Minutos de tolerância antes de marcar ausência</span><input name="no_show_grace_minutes" type="number" min={0} max={1440} required defaultValue={settings?.no_show_grace_minutes??15} className="rounded-xl border border-slate-300 px-3 py-2"/></label></div><label className="mt-4 flex items-center gap-2 text-sm font-bold"><input name="no_show_enabled" type="checkbox" defaultChecked={settings?.no_show_enabled??true}/>Permitir que o motor marque ausência automaticamente após a tolerância</label><button className="mt-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Salvar agenda da clínica</button></form>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Tipos de consulta</h2><p className="mt-1 text-sm text-slate-600">Nome, duração, formato padrão e ordem são editáveis. Desativar mantém o histórico, mas impede novos agendamentos com o tipo.</p><div className="mt-5 space-y-3">{(types||[]).map((t:any)=><form key={t.id} action={updateType} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_1fr_auto_auto]"><input type="hidden" name="id" value={t.id}/><label className="grid gap-1 text-xs font-bold text-slate-600">Nome<input name="name" required defaultValue={t.name} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Duração (min)<input name="duration_minutes" type="number" min={5} max={720} required defaultValue={t.duration_minutes} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Ordem<input name="sort_order" type="number" defaultValue={t.sort_order} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label><div className="flex flex-col justify-center gap-2 text-xs font-bold"><label className="flex items-center gap-2"><input name="default_is_virtual" type="checkbox" defaultChecked={t.default_is_virtual}/>Online por padrão</label><label className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={t.active}/>Ativo</label></div><button className="self-end rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black">Salvar</button></form>)}</div>
      <form action={createType} className="mt-5 grid gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 md:grid-cols-[2fr_1fr_1fr_auto_auto]"><label className="grid gap-1 text-xs font-bold text-slate-600">Novo tipo<input name="name" required placeholder="Ex.: Bioimpedância" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Duração (min)<input name="duration_minutes" type="number" min={5} max={720} required defaultValue={60} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"/></label><label className="grid gap-1 text-xs font-bold text-slate-600">Ordem<input name="sort_order" type="number" defaultValue={50} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"/></label><label className="flex items-center gap-2 self-center text-xs font-bold"><input name="default_is_virtual" type="checkbox" defaultChecked/>Online por padrão</label><button className="self-end rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white">Adicionar</button></form>
    </section>
  </div></main>
}
