import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Clock3, HeartPulse, History, ShieldAlert, Sparkles } from 'lucide-react'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BUCKET_ORDER: Record<string, number> = { critical: 1, today: 2, this_week: 3, automatic: 4, none: 5 }
const BUCKET_META: Record<string, { title: string; description: string; icon: any }> = {
  critical: { title: 'Crítico', description: 'Requer revisão humana prioritária.', icon: ShieldAlert },
  today: { title: 'Hoje', description: 'Vale priorizar ainda hoje.', icon: AlertTriangle },
  this_week: { title: 'Esta semana', description: 'Precisa entrar na sua agenda da semana.', icon: CalendarClock },
  automatic: { title: 'Acompanhamento leve', description: 'Elegível para retomada suave.', icon: Sparkles },
}
const REASON_LABELS: Record<string, string> = {
  inactivity: 'Sem atividade', checkin_overdue: 'Check-in atrasado', consultation_overdue: 'Consulta pendente',
  plan_expiring: 'Plano perto do vencimento', protocol_ending: 'Protocolo perto do fim',
}
const LIFECYCLE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding', awaiting_consultation: 'Aguardando consulta', return_overdue: 'Retorno atrasado',
  plan_expiring: 'Plano vencendo', plan_expired: 'Plano vencido', protocol_completed: 'Protocolo concluído',
  reactivation: 'Reativação', active_followup: 'Acompanhamento ativo', care_completed: 'Acompanhamento concluído',
}
const TASK_LABELS: Record<string, string> = {
  human_followup: 'Intervenção humana', gentle_reengagement_candidate: 'Retomada leve', weekly_checkin_feedback: 'Feedback de check-in', phase_review: 'Revisão de fase',
}

type QueueRow = {
  id: string; user_id: string; overall_risk: number | null; operational_status: string | null; attention_bucket: string | null;
  days_since_activity: number | null; adherence_7d: number | null; recommended_action: string | null; reasons: Array<Record<string, unknown>> | null;
  next_appointment_at: string | null; active_protocol_end_date: string | null; plan_expiring: boolean | null; protocol_ending: boolean | null;
  lifecycle_status: string | null; lifecycle_next_action: string | null; lifecycle_details: Record<string, unknown> | null;
}
type ActionRow = { id: string; target_user_id: string | null; title: string | null; action_type: string; scheduled_for: string | null; status: string; created_at: string | null }
type EventRow = { patient_id: string | null; event_type: string; created_at: string; to_status: string | null; metadata: Record<string, unknown> | null }

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}
function formatDateTime(value: string | null) {
  if (!value) return 'Sem prazo'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}
function statusLabel(status: string | null) {
  const map: Record<string, string> = { onboarding: 'Em adaptação', adherent: 'Aderente', oscillating: 'Oscilando', at_risk: 'Em risco', inactive: 'Inativa' }
  return status ? (map[status] || status) : 'Sem status'
}
function eventLabel(event: EventRow) {
  if (event.event_type === 'task_created') return 'Tarefa criada'
  if (event.event_type === 'task_status_changed') {
    if (event.to_status === 'completed') return 'Intervenção concluída'
    if (event.to_status === 'dismissed') return 'Intervenção dispensada'
    if (event.to_status === 'cancelled') return 'Intervenção encerrada pelo motor'
  }
  return event.event_type.replaceAll('_', ' ')
}

export default async function AttentionQueuePage() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: viewer } = await supabase.from('profiles').select('tenant_id, role').eq('user_id', user.id).maybeSingle()
  const role = String(viewer?.role || '').toLowerCase()
  if (!viewer?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(role)) redirect('/patient/home')

  const today = localDate()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let refreshError: string | null = null

  if (serviceRoleKey && supabaseUrl) {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.rpc('refresh_patient_operational_snapshot', { p_tenant_id: viewer.tenant_id, p_reference_date: today })
    if (!error) {
      await admin.rpc('refresh_patient_lifecycle_states', { p_tenant_id: viewer.tenant_id, p_reference_date: today })
    } else refreshError = error.message
  } else refreshError = 'Configuração de backend indisponível para atualizar o snapshot.'

  const { data: riskRows, error: riskError } = await supabase.from('patient_risk_scores')
    .select('id,user_id,overall_risk,operational_status,attention_bucket,days_since_activity,adherence_7d,recommended_action,reasons,next_appointment_at,active_protocol_end_date,plan_expiring,protocol_ending,lifecycle_status,lifecycle_next_action,lifecycle_details')
    .eq('tenant_id', viewer.tenant_id).eq('calculated_date', today)

  const rows = (riskRows || []) as QueueRow[]
  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  const [{ data: profileRows }, { data: actionRows }, { data: eventRows }] = await Promise.all([
    ids.length ? supabase.from('profiles').select('user_id,name,email,phone,plan_expires_at').eq('tenant_id', viewer.tenant_id).in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabase.from('agent_pending_actions').select('id,target_user_id,title,action_type,scheduled_for,status,created_at').eq('tenant_id', viewer.tenant_id).eq('agent_name', 'followup_engine').eq('status', 'pending').in('target_user_id', ids).order('scheduled_for', { ascending: true, nullsFirst: false }) : Promise.resolve({ data: [] as ActionRow[] }),
    ids.length ? supabase.from('patient_followup_events').select('patient_id,event_type,created_at,to_status,metadata').eq('tenant_id', viewer.tenant_id).in('patient_id', ids).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] as EventRow[] }),
  ])

  const profiles = new Map((profileRows || []).map(p => [p.user_id, p]))
  const tasksByPatient = new Map<string, ActionRow[]>()
  for (const action of (actionRows || []) as ActionRow[]) {
    if (!action.target_user_id) continue
    const list = tasksByPatient.get(action.target_user_id) || []
    list.push(action)
    tasksByPatient.set(action.target_user_id, list)
  }
  const lastEventByPatient = new Map<string, EventRow>()
  for (const event of (eventRows || []) as EventRow[]) {
    if (event.patient_id && !lastEventByPatient.has(event.patient_id)) lastEventByPatient.set(event.patient_id, event)
  }

  const queue = rows.filter(r => r.attention_bucket && r.attention_bucket !== 'none').sort((a, b) => {
    const bucket = (BUCKET_ORDER[a.attention_bucket || 'none'] || 99) - (BUCKET_ORDER[b.attention_bucket || 'none'] || 99)
    return bucket || Number(b.overall_risk || 0) - Number(a.overall_risk || 0)
  })
  const grouped = ['critical', 'today', 'this_week', 'automatic'].map(bucket => ({ bucket, rows: queue.filter(r => r.attention_bucket === bucket) }))
  const counts = Object.fromEntries(grouped.map(g => [g.bucket, g.rows.length])) as Record<string, number>

  return (
    <main className="min-h-screen bg-[#090B10] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Voltar ao painel</Link>
            <div className="flex items-center gap-3"><div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300"><HeartPulse size={24}/></div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Motor de acompanhamento</p><h1 className="text-2xl font-bold sm:text-3xl">Quem precisa de mim hoje?</h1><p className="mt-1 text-sm text-slate-400">Estado, prioridade, tarefa e histórico em uma única visão.</p></div></div>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/admin/followups" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black">Tarefas</Link><Link href="/admin/followups/history" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black">Histórico</Link><Link href="/admin/followups/states" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black">Editar estados</Link></div>
        </div>

        {(refreshError || riskError) && <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><strong>Atenção:</strong> {refreshError || riskError?.message}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['critical','today','this_week','automatic'].map(bucket => { const meta=BUCKET_META[bucket]; const Icon=meta.icon; return <div key={bucket} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center justify-between"><Icon size={18} className="text-amber-300"/><span className="text-2xl font-bold">{counts[bucket]||0}</span></div><p className="font-bold">{meta.title}</p><p className="mt-1 text-xs text-slate-500">{meta.description}</p></div> })}</section>

        {queue.length === 0 ? <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-8 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={30}/><h2 className="text-lg font-bold">Nenhuma paciente exige atenção agora</h2></div> : <div className="space-y-7">{grouped.filter(g=>g.rows.length).map(group => { const meta=BUCKET_META[group.bucket]; const Icon=meta.icon; return <section key={group.bucket}><div className="mb-3 flex items-center gap-2"><Icon size={18} className="text-amber-300"/><h2 className="text-lg font-bold">{meta.title}</h2><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{group.rows.length}</span></div><div className="grid gap-3">{group.rows.map(row => {
          const profile=profiles.get(row.user_id); const reasons=Array.isArray(row.reasons)?row.reasons:[]; const tasks=tasksByPatient.get(row.user_id)||[]; const lastEvent=lastEventByPatient.get(row.user_id); const primaryTask=tasks[0]
          return <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold text-white">{profile?.name||'Paciente'}</h3><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold">{statusLabel(row.operational_status)}</span><span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold text-sky-200">{LIFECYCLE_LABELS[row.lifecycle_status||'']||row.lifecycle_status||'Sem estado de jornada'}</span><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">risco {Math.round(Number(row.overall_risk||0))}/100</span></div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400"><span className="rounded-lg bg-white/5 px-2.5 py-1.5">{row.days_since_activity??0} dias sem atividade</span><span className="rounded-lg bg-white/5 px-2.5 py-1.5">adesão 7d: {Math.round(Number(row.adherence_7d||0))}%</span>{row.next_appointment_at&&<span className="rounded-lg bg-white/5 px-2.5 py-1.5">próxima consulta: {formatDate(row.next_appointment_at)}</span>}</div>
            <div className="mt-4 flex flex-wrap gap-2">{reasons.map((reason,index)=>{ const code=String(reason.code||''); return <span key={`${code}-${index}`} className="rounded-full border border-rose-400/15 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-200">{REASON_LABELS[code]||code||'Sinal'}{code==='inactivity'&&reason.days?` · ${reason.days}d`:''}</span> })}</div>
            <div className="mt-4 rounded-xl border border-sky-400/10 bg-sky-400/5 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300/70">Próximo passo da jornada</p><p className="mt-1 text-sm font-semibold text-slate-200">{row.lifecycle_next_action||row.recommended_action||'Revisar o contexto da paciente.'}</p></div></div>
            <div className="space-y-3"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Tarefas abertas · {tasks.length}</p>{primaryTask?<><p className="mt-2 text-sm font-bold text-white">{primaryTask.title||TASK_LABELS[primaryTask.action_type]||'Acompanhamento'}</p><p className="mt-1 text-xs text-slate-400">{TASK_LABELS[primaryTask.action_type]||primaryTask.action_type} · prazo {formatDateTime(primaryTask.scheduled_for)}</p>{tasks.length>1&&<div className="mt-2 space-y-1 border-t border-white/10 pt-2">{tasks.slice(1).map(task=><p key={task.id} className="text-xs text-slate-400">+ {task.title||TASK_LABELS[task.action_type]||task.action_type}</p>)}</div>}</>:<p className="mt-2 text-sm text-slate-500">Nenhuma tarefa aberta.</p>}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><History size={13}/> Última intervenção</div>{lastEvent?<><p className="mt-2 text-sm font-semibold text-slate-200">{eventLabel(lastEvent)}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(lastEvent.created_at)}</p></>:<p className="mt-2 text-sm text-slate-500">Sem intervenção registrada.</p>}</div>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">{profile?.plan_expires_at&&row.plan_expiring&&<span>Plano: {formatDate(profile.plan_expires_at)}</span>}{row.active_protocol_end_date&&row.protocol_ending&&<span>Protocolo: {formatDate(row.active_protocol_end_date)}</span>}</div></div>
          </div></article> })}</div></section> })}</div>}

        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs text-slate-500"><Clock3 size={16} className="shrink-0"/> Nenhum contato é enviado automaticamente por esta Central. A decisão humana continua explícita.</div>
      </div>
    </main>
  )
}
