import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function fmt(value?:string|null){if(!value)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value))}

async function viewer(){
  const supabase=createSupabaseServerClient(cookies())
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  const role=String(profile?.role||'').toLowerCase();if(!profile?.tenant_id||!['admin','nutritionist','nutri'].includes(role))redirect('/patient/home')
  return{supabase,tenantId:profile.tenant_id}
}

export default async function CrmPage(){
  const{supabase,tenantId}=await viewer()
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
  if(serviceRoleKey&&supabaseUrl){const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await admin.rpc('sync_app_patients_to_crm',{p_tenant_id:tenantId,p_reference_date:localDate()});if(error)console.error('[crm] sync:',error.message)}
  const[{data:stages},{data:contacts,error}]=await Promise.all([
    supabase.from('crm_stages').select('id,code,name,sort_order,active').eq('tenant_id',tenantId).order('sort_order'),
    supabase.from('crm_contacts').select('id,name,email,phone,whatsapp,source,last_activity_at,last_consultation_at,last_contact_at,next_action_at,do_not_contact,stage_id,linked_user_id').eq('tenant_id',tenantId).order('updated_at',{ascending:false}).limit(200)
  ])
  const stageMap=new Map((stages||[]).map((s:any)=>[s.id,s]));const counts=new Map<string,number>();for(const c of contacts||[])counts.set(c.stage_id,(counts.get(c.stage_id)||0)+1)
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Fase 3</p><h1 className="text-3xl font-black">CRM e Resgate</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Uma base única para pacientes do app, pacientes antigos importados e futuros leads. Ter contato no CRM não exige login no aplicativo.</p></div><div className="flex gap-2"><Link href="/admin/crm/stages" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Configurar etapas</Link><Link href="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar</Link></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(stages||[]).filter((s:any)=>s.active).map((s:any)=><div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm font-bold text-slate-600">{s.name}</div><div className="mt-1 text-3xl font-black">{counts.get(s.id)||0}</div></div>)}</div>
    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Não foi possível carregar os contatos do CRM.</div>}
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Contatos</h2><p className="text-sm text-slate-600">Até 200 contatos mais recentemente atualizados. Importação do WebDiet entra no próximo bloco.</p></div><div className="divide-y divide-slate-100">{(contacts||[]).length===0?<div className="p-6 text-sm text-slate-500">Nenhum contato ainda.</div>:(contacts||[]).map((c:any)=>{const st=stageMap.get(c.stage_id) as any;return <div key={c.id} className="grid gap-3 p-5 md:grid-cols-[1.4fr_1fr_1fr_auto]"><div><div className="font-black">{c.name}</div><div className="text-xs text-slate-500">{c.email||c.whatsapp||c.phone||'Sem contato cadastrado'}</div></div><div><div className="text-xs font-bold uppercase text-slate-400">Etapa</div><div className="text-sm font-bold">{st?.name||'Sem etapa'}</div></div><div><div className="text-xs font-bold uppercase text-slate-400">Última atividade</div><div className="text-sm">{fmt(c.last_activity_at)}</div></div><div className="text-right"><div className="text-xs font-bold uppercase text-slate-400">Origem</div><div className="text-sm font-bold">{c.source}</div>{c.linked_user_id&&<div className="mt-1 text-[11px] text-emerald-700">Vinculada ao app</div>}{c.do_not_contact&&<div className="mt-1 text-[11px] font-bold text-red-700">Não contatar</div>}</div></div>})}</div></section>
  </div></main>
}
