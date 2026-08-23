import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
}
function pct(n:number,d:number) { return d > 0 ? Math.round((n/d)*100) : 0 }
function hours(ms:number) { return Math.round((ms / 3600000) * 10) / 10 }

export default async function FollowupMetricsPage() {
  const supabase = createSupabaseServerClient(cookies())
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: viewer } = await supabase.from('profiles').select('tenant_id,role').eq('user_id',user.id).maybeSingle()
  const role = String(viewer?.role || '').toLowerCase()
  if (!viewer?.tenant_id || !['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')

  const { data: settings } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id',viewer.tenant_id).maybeSingle()
  const windowDays = Math.max(7, Number((settings?.rules as any)?.metrics?.window_days || 30))
  const since = new Date(Date.now() - windowDays * 86400000).toISOString()
  const today = localDate()

  const [historyResult, pendingResult, snapshotResult] = await Promise.all([
    supabase.from('agent_pending_actions').select('id,target_user_id,action_type,status,created_at,executed_at,reviewed_at,updated_at').eq('tenant_id',viewer.tenant_id).eq('agent_name','followup_engine').gte('created_at',since),
    supabase.from('agent_pending_actions').select('id,target_user_id,action_type,status,created_at').eq('tenant_id',viewer.tenant_id).eq('agent_name','followup_engine').eq('status','pending'),
    supabase.from('patient_risk_scores').select('user_id,attention_bucket,operational_status,lifecycle_status,overall_risk').eq('tenant_id',viewer.tenant_id).eq('calculated_date',today),
  ])

  const queryError = historyResult.error || pendingResult.error || snapshotResult.error
  const all = historyResult.data || []
  const pendingNow = pendingResult.data || []
  const snapshots = snapshotResult.data || []
  const completed = all.filter((t:any) => t.status === 'completed')
  const dismissed = all.filter((t:any) => t.status === 'dismissed')
  const interventionTimes = completed.map((t:any) => t.executed_at ? new Date(t.executed_at).getTime() - new Date(t.created_at).getTime() : null).filter((v:any) => typeof v === 'number' && v >= 0) as number[]
  const avgHours = interventionTimes.length ? hours(interventionTimes.reduce((a,b)=>a+b,0)/interventionTimes.length) : null

  const handledUsers = new Set(completed.filter((t:any)=>t.action_type==='human_followup').map((t:any)=>t.target_user_id))
  const recoveredUsers = new Set(snapshots.filter((s:any)=>handledUsers.has(s.user_id) && !['inactive','at_risk'].includes(String(s.operational_status || ''))).map((s:any)=>s.user_id))
  const recoveryRate = pct(recoveredUsers.size, handledUsers.size)
  const critical = snapshots.filter((s:any)=>s.attention_bucket==='critical').length
  const todayCount = snapshots.filter((s:any)=>s.attention_bucket==='today').length
  const reactivation = snapshots.filter((s:any)=>s.lifecycle_status==='reactivation').length
  const feedback = pendingNow.filter((t:any)=>t.action_type==='weekly_checkin_feedback').length

  const cards = [
    ['Tarefas criadas', all.length, `Criadas nos últimos ${windowDays} dias`],
    ['Pendentes agora', pendingNow.length, 'Todas as tarefas abertas, independentemente da data de criação'],
    ['Concluídas', completed.length, `${pct(completed.length,all.length)}% das criadas na janela`],
    ['Dispensadas', dismissed.length, `${pct(dismissed.length,all.length)}% das criadas na janela`],
    ['Tempo médio até intervenção', avgHours === null ? '—' : `${avgHours} h`, 'Da criação até conclusão, dentro da janela'],
    ['Recuperação após intervenção', `${recoveryRate}%`, `${recoveredUsers.size}/${handledUsers.size} pacientes`],
  ]

  return <main className="min-h-screen bg-[#090B10] px-4 py-8 text-slate-100"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Fase 2</p><h1 className="text-3xl font-black">Métricas do acompanhamento</h1><p className="mt-2 text-sm text-slate-400">Indicadores operacionais da janela configurada pela clínica.</p></div><div className="flex gap-2"><Link href="/admin/followup-settings/lifecycle" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">Configurar janela</Link><Link href="/admin/attention" className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">Central</Link></div></div>
    {queryError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">Não foi possível carregar todos os indicadores: {queryError.message}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label,value,desc])=><div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{desc}</p></div>)}</section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4"><p className="text-xs text-rose-200">Críticas hoje</p><p className="mt-1 text-2xl font-black">{critical}</p></div><div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4"><p className="text-xs text-amber-200">Para hoje</p><p className="mt-1 text-2xl font-black">{todayCount}</p></div><div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-4"><p className="text-xs text-sky-200">Em reativação</p><p className="mt-1 text-2xl font-black">{reactivation}</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-4"><p className="text-xs text-violet-200">Feedbacks pendentes</p><p className="mt-1 text-2xl font-black">{feedback}</p></div></section>
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-relaxed text-slate-500">“Recuperação após intervenção” considera pacientes com tarefa <code>human_followup</code> concluída dentro da janela e cujo snapshot atual não está mais em <code>inactive</code> ou <code>at_risk</code>.</div>
  </div></main>
}
