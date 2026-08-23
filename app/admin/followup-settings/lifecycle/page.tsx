import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const PRIORITY_DEFAULTS = { onboarding:10, return_overdue:20, plan_expired:30, plan_expiring:40, awaiting_consultation:50, protocol_completed:60, reactivation:70 }
const DEFAULTS = { enabled:true, return_overdue_days:45, reactivation_after_days:30, protocol_completed_window_days:7, plan_expired_grace_days:0, priority:PRIORITY_DEFAULTS }
const TASK_DEFAULTS = { enabled:true, awaiting_consultation:false, return_overdue:true, plan_expiring:true, plan_expired:true, protocol_completed:true, reactivation:true, task_time:'09:30', expiry_hours:72 }
const METRIC_DEFAULTS = { window_days:30 }

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
  const priority = {
    onboarding: Number(formData.get('priority_onboarding') || 10),
    return_overdue: Number(formData.get('priority_return_overdue') || 20),
    plan_expired: Number(formData.get('priority_plan_expired') || 30),
    plan_expiring: Number(formData.get('priority_plan_expiring') || 40),
    awaiting_consultation: Number(formData.get('priority_awaiting_consultation') || 50),
    protocol_completed: Number(formData.get('priority_protocol_completed') || 60),
    reactivation: Number(formData.get('priority_reactivation') || 70),
  }
  const values = Object.values(priority)
  if (values.some(v => !Number.isFinite(v) || v < 1 || v > 999) || new Set(values).size !== values.length) redirect('/admin/followup-settings/lifecycle?error=priority')
  const lifecycle = {
    enabled: formData.get('enabled') === 'on',
    return_overdue_days: Math.max(1, Number(formData.get('return_overdue_days') || 45)),
    reactivation_after_days: Math.max(1, Number(formData.get('reactivation_after_days') || 30)),
    protocol_completed_window_days: Math.max(0, Number(formData.get('protocol_completed_window_days') || 7)),
    plan_expired_grace_days: Math.max(0, Number(formData.get('plan_expired_grace_days') || 0)),
    priority,
  }
  const lifecycle_tasks = {
    enabled: formData.get('tasks_enabled') === 'on', awaiting_consultation: formData.get('task_awaiting_consultation') === 'on',
    return_overdue: formData.get('task_return_overdue') === 'on', plan_expiring: formData.get('task_plan_expiring') === 'on',
    plan_expired: formData.get('task_plan_expired') === 'on', protocol_completed: formData.get('task_protocol_completed') === 'on',
    reactivation: formData.get('task_reactivation') === 'on', task_time: String(formData.get('task_time') || '09:30'),
    expiry_hours: Math.max(1, Number(formData.get('expiry_hours') || 72)),
  }
  const metrics = { window_days: Math.max(7, Number(formData.get('metrics_window_days') || 30)) }
  await supabase.from('tenant_followup_settings').upsert({ tenant_id:tenantId, rules:{...current,lifecycle,lifecycle_tasks,metrics}, schema_version:3, updated_by:user.id, updated_at:new Date().toISOString() }, { onConflict:'tenant_id' })
  revalidatePath('/admin/followup-settings/lifecycle')
  redirect('/admin/followup-settings/lifecycle?saved=1')
}

function Field({name,label,value,min=0,max}:{name:string;label:string;value:number;min?:number;max?:number}) {
  return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><input type="number" name={name} min={min} max={max} defaultValue={value} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
}
function Toggle({name,label,checked,description}:{name:string;label:string;checked:boolean;description?:string}) {
  return <label className="flex gap-3"><input type="checkbox" name={name} defaultChecked={checked} className="mt-1" /><span><strong>{label}</strong>{description && <span className="block text-sm text-slate-600">{description}</span>}</span></label>
}

export default async function LifecycleSettings({ searchParams }:{searchParams?:{saved?:string;error?:string}}) {
  const { supabase, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id',tenantId).maybeSingle()
  const rules = (data?.rules as any) || {}
  const rawLifecycle = rules.lifecycle || {}
  const r = {...DEFAULTS,...rawLifecycle,priority:{...PRIORITY_DEFAULTS,...(rawLifecycle.priority || {})}}
  const t = {...TASK_DEFAULTS,...(rules.lifecycle_tasks || {})}
  const m = {...METRIC_DEFAULTS,...(rules.metrics || {})}
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Motor de acompanhamento</p><h1 className="text-3xl font-black">Estados da jornada</h1><p className="mt-2 text-sm text-slate-600">Defina critérios, precedência e quais estados geram tarefas.</p></div><Link href="/admin/followup-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar</Link></div>
    {searchParams?.saved==='1' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Configurações salvas.</div>}
    {searchParams?.error==='priority' && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Cada estado precisa ter uma prioridade única entre 1 e 999.</div>}
    <form action={save} className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="text-lg font-black">Critérios dos estados</h2><div className="grid gap-4 sm:grid-cols-2">
        <Field name="return_overdue_days" label="Retorno atrasado após dias sem nova consulta" value={r.return_overdue_days} min={1}/><Field name="reactivation_after_days" label="Sugerir reativação após dias sem atividade" value={r.reactivation_after_days} min={1}/><Field name="protocol_completed_window_days" label="Manter protocolo concluído por dias" value={r.protocol_completed_window_days}/><Field name="plan_expired_grace_days" label="Carência após vencimento do plano" value={r.plan_expired_grace_days}/>
      </div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><div><h2 className="text-lg font-black">Precedência dos estados</h2><p className="text-sm text-slate-600">Número menor vence quando mais de um estado é verdadeiro. Os valores atuais reproduzem exatamente a ordem anterior.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="priority_onboarding" label="Onboarding" value={r.priority.onboarding} min={1} max={999}/><Field name="priority_return_overdue" label="Retorno atrasado" value={r.priority.return_overdue} min={1} max={999}/><Field name="priority_plan_expired" label="Plano vencido" value={r.priority.plan_expired} min={1} max={999}/><Field name="priority_plan_expiring" label="Plano vencendo" value={r.priority.plan_expiring} min={1} max={999}/><Field name="priority_awaiting_consultation" label="Aguardando consulta" value={r.priority.awaiting_consultation} min={1} max={999}/><Field name="priority_protocol_completed" label="Protocolo concluído" value={r.priority.protocol_completed} min={1} max={999}/><Field name="priority_reactivation" label="Reativação" value={r.priority.reactivation} min={1} max={999}/>
      </div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="text-lg font-black">Tarefas automáticas da jornada</h2><p className="text-sm text-slate-600">Escolha quais estados geram tarefa para a equipe. Isso não envia mensagens à paciente.</p><Toggle name="tasks_enabled" label="Ativar tarefas derivadas dos estados" checked={t.enabled}/><div className="grid gap-3 sm:grid-cols-2"><Toggle name="task_awaiting_consultation" label="Aguardando consulta" checked={t.awaiting_consultation}/><Toggle name="task_return_overdue" label="Retorno atrasado" checked={t.return_overdue}/><Toggle name="task_plan_expiring" label="Plano vencendo" checked={t.plan_expiring}/><Toggle name="task_plan_expired" label="Plano vencido" checked={t.plan_expired}/><Toggle name="task_protocol_completed" label="Protocolo concluído" checked={t.protocol_completed}/><Toggle name="task_reactivation" label="Reativação" checked={t.reactivation}/></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold text-slate-700"><span>Horário da tarefa</span><input type="time" name="task_time" defaultValue={t.task_time} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label><Field name="expiry_hours" label="Validade da tarefa (horas)" value={t.expiry_hours} min={1}/></div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Métricas</h2><div className="mt-3"><Field name="metrics_window_days" label="Janela dos indicadores (dias)" value={m.window_days} min={7}/></div></section>
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 space-y-3"><Toggle name="enabled" label="Ativar estados automáticos" checked={r.enabled} description="Desligando, o sistema limpa estados calculados pelo motor; overrides manuais continuam válidos."/><div className="rounded-xl border border-amber-300/70 bg-white/60 p-3 text-sm text-slate-700"><strong>Acompanhamento concluído permanece decisão manual.</strong></div></section>
      <div className="flex justify-end"><button className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white">Salvar estados da jornada</button></div>
    </form>
  </div></main>
}
