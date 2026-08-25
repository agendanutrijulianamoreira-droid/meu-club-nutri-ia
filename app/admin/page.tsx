import Link from 'next/link';
import { BarChart3, CalendarClock, ClipboardCheck, HeartPulse, Settings2, SlidersHorizontal, UsersRound } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AdminDashboardClient from './AdminClientPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardProps = { userName:string;tenantName:string;role:string;tenantId:string;needsRepair?:boolean };

function AdminDashboardWithAttention(props:DashboardProps){return <><AdminDashboardClient {...props}/>{props.tenantId&&<div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-2">
<Link href="/admin/appointment-settings" className="inline-flex items-center gap-2 rounded-2xl border border-violet-200/30 bg-violet-200 px-4 py-3 text-xs font-black text-slate-950 shadow-2xl shadow-black/30 transition hover:bg-violet-100" aria-label="Configurar agenda e tipos de consulta"><CalendarClock size={17}/>Configurações de consulta</Link>
<Link href="/admin/crm" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800" aria-label="Abrir CRM e resgate"><UsersRound size={17}/>CRM e resgate</Link>
<Link href="/admin/followups/metrics" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800" aria-label="Abrir métricas do acompanhamento"><BarChart3 size={17}/>Métricas do acompanhamento</Link>
<Link href="/admin/followup-settings" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800" aria-label="Configurar regras do motor de acompanhamento"><SlidersHorizontal size={17}/>Regras do acompanhamento</Link>
<Link href="/admin/methods/phases" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800" aria-label="Configurar critérios de avanço de fase"><Settings2 size={17}/>Critérios de avanço</Link>
<Link href="/admin/followups" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-xs font-black text-slate-100 shadow-2xl shadow-black/30 transition hover:bg-slate-800" aria-label="Abrir tarefas de acompanhamento"><ClipboardCheck size={17}/>Tarefas de acompanhamento</Link>
<Link href="/admin/attention" className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-300 px-4 py-3 text-xs font-black text-slate-950 shadow-2xl shadow-black/30 transition hover:bg-amber-200" aria-label="Abrir fila Quem precisa de mim hoje"><HeartPulse size={17}/>Quem precisa de mim hoje?</Link>
</div>}</>}

export default async function AdminPage(){
 const supabase=createSupabaseServerClient(cookies());const{data:{session}}=await supabase.auth.getSession();if(!session)redirect('/login');
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const supabaseAdmin=serviceRoleKey?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceRoleKey):null;
 const{data:profile,error:profileError}=await supabase.from('profiles').select('tenant_id, role, name').eq('user_id',session.user.id).single();
 const dbRole=profile?.role,metadataRole=session.user.user_metadata?.user_type||session.user.user_metadata?.role,role=dbRole||metadataRole,isDemoTenant=profile?.tenant_id==='00000000-0000-0000-0000-000000000001',roleLower=(role||'').toLowerCase(),isAdmin=['admin','nutritionist','nutri'].includes(roleLower);
 let tenantName='';const resolvedTenantId=profile?.tenant_id;if(resolvedTenantId&&!isDemoTenant){const{data:tenant}=await supabase.from('tenants').select('brand_name').eq('id',resolvedTenantId).single();tenantName=tenant?.brand_name||''}
 const userName=profile?.name||session.user.email?.split('@')[0]||'Admin';if(profileError)console.error('[Admin Guard] Profile Error:',profileError);const dashboardProps={userName,tenantName,role:roleLower,tenantId:resolvedTenantId||''};
 if(profile?.tenant_id&&!isDemoTenant&&isAdmin)return <AdminDashboardWithAttention {...dashboardProps}/>;
 if(isAdmin&&(!profile?.tenant_id||isDemoTenant)){if(!supabaseAdmin)redirect('/admin/clinic');const{data:ownedTenants}=await supabaseAdmin.from('tenants').select('id, brand_name').eq('owner_id',session.user.id).limit(1);if(ownedTenants&&ownedTenants.length>0)return <AdminDashboardWithAttention userName={userName} tenantName={ownedTenants[0].brand_name||''} role="admin" tenantId={ownedTenants[0].id} needsRepair={true}/>;redirect('/admin/clinic')}
 if(session&&!isAdmin)redirect('/patient/home');if(session&&isAdmin&&profile)return <AdminDashboardWithAttention {...dashboardProps}/>;redirect('/login')
}
