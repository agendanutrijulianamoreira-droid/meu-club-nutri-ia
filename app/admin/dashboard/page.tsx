import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { DashboardRouteClient } from './DashboardRouteClient'

export const dynamic='force-dynamic'
export const revalidate=0

export default async function DashboardPage(){
  const supabase=createSupabaseServerClient(cookies())
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) redirect('/login')
  const { data:profile }=await supabase.from('profiles').select('tenant_id,role,name').eq('user_id',user.id).maybeSingle()
  const role=String(profile?.role||'').toLowerCase()
  if(!profile?.tenant_id||!['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')
  const { data:tenant }=await supabase.from('tenants').select('brand_name').eq('id',profile.tenant_id).maybeSingle()
  return <DashboardRouteClient userName={profile.name||user.email?.split('@')[0]||'Admin'} tenantName={tenant?.brand_name||''} tenantId={profile.tenant_id}/>
}
