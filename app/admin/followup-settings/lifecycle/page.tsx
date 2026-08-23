import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const DEFAULTS = { enabled:true, return_overdue_days:45, reactivation_after_days:30, protocol_completed_window_days:7, plan_expired_grace_days:0, manual_completed_only:true }

async function viewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')
  return { supabase, user, tenantId: profile.tenant_id }
}

async function save(formData: FormData) {
  'use server'
  const { supabase, user, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id',tenantId).maybeSingle()
  const current = (data?.rules && typeof data.rules === 'object' ? data.rules : {}) as Record<string,unknown>
  const lifecycle = {
    enabled: formData.get('enabled') === 'on',
    return_overdue_days: Math.max(1, Number(formData.get('return_overdue_days') || 45)),
    reactivation_after_days: Math.max(1, Number(formData.get('reactivation_after_days') || 30)),
    protocol_completed_window_days: Math.max(0, Number(formData.get('protocol_completed_window_days') || 7)),
    plan_expired_grace_days: Math.max(0, Number(formData.get('plan_expired_grace_days') || 0)),
    manual_completed_only: formData.get('manual_completed_only') === 'on',
  }
  await supabase.from('tenant_followup_settings').upsert({ tenant_id:tenantId, rules:{...current,lifecycle}, schema_version:1, updated_by:user.id, updated_at:new Date().toISOString() }, { onConflict:'tenant_id' })
  revalidatePath('/admin/followup-settings/lifecycle')
  redirect('/admin/followup-settings/lifecycle?saved=1')
}

function Field({name,label,value,min=0}:{name:string;label:string;value:number;min?:number}) {
  return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><input type="number" name={name} min={min} defaultValue={value} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
}

export default async function LifecycleSettings({ searchParams }:{searchParams?:{saved?:string}}) {
  const { supabase, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id',tenantId).maybeSingle()
  const raw = (data?.rules as any)?.lifecycle || {}
  const r = {...DEFAULTS,...raw}
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Motor de acompanhamento</p><h1 className="text-3xl font-black">Estados da jornada</h1><p className="mt-2 text-sm text-slate-600">Defina quando cada estado operacional deve aparecer. Overrides individuais continuam disponíveis por paciente.</p></div><Link href="/admin/followup-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar</Link></div>
    {searchParams?.saved==='1' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Configurações salvas.</div>}
    <form action={save} className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2">
        <Field name="return_overdue_days" label="Retorno atrasado após dias sem nova consulta" value={r.return_overdue_days} min={1} />
        <Field name="reactivation_after_days" label="Sugerir reativação após dias sem atividade" value={r.reactivation_after_days} min={1} />
        <Field name="protocol_completed_window_days" label="Manter estado protocolo concluído por dias" value={r.protocol_completed_window_days} />
        <Field name="plan_expired_grace_days" label="Carência após vencimento do plano (dias)" value={r.plan_expired_grace_days} />
      </div></section>
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 space-y-3">
        <label className="flex gap-3"><input type="checkbox" name="enabled" defaultChecked={r.enabled} className="mt-1" /><span><strong>Ativar estados automáticos</strong><span className="block text-sm text-slate-600">Desligando, o sistema deixa de recalcular estes estados.</span></span></label>
        <label className="flex gap-3"><input type="checkbox" name="manual_completed_only" defaultChecked={r.manual_completed_only} className="mt-1" /><span><strong>“Acompanhamento concluído” somente por decisão manual</strong><span className="block text-sm text-slate-600">Recomendado para preservar decisão clínica.</span></span></label>
      </section>
      <div className="flex justify-end"><button className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white">Salvar estados da jornada</button></div>
    </form>
  </div></main>
}
