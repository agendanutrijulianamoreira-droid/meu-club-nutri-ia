import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ActionRow = {
  id: string
  target_user_id: string | null
  target_patient_name: string | null
  title: string | null
  content: string
  reasoning: string | null
  action_type: string
  status: string
  scheduled_for: string | null
  created_at: string | null
  updated_at: string | null
  context_data: Record<string, unknown> | null
}

type EventRow = {
  id: string
  action_id: string | null
  event_type: string
  from_status: string | null
  to_status: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

async function getViewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: viewer } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = String(viewer?.role || '').toLowerCase()
  if (!viewer?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(role)) {
    redirect('/patient/home')
  }

  return { supabase, user, tenantId: viewer.tenant_id }
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sem prazo definido'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function bucketLabel(value: unknown) {
  const map: Record<string, string> = {
    critical: 'Crítico',
    today: 'Hoje',
    this_week: 'Esta semana',
    automatic: 'Acompanhamento leve',
  }
  const key = String(value || '')
  return map[key] || key || 'Sem faixa'
}

function eventLabel(event: EventRow) {
  if (event.event_type === 'task_created') return 'Tarefa criada'
  if (event.event_type === 'task_refreshed') return 'Tarefa atualizada pelo motor'
  if (event.event_type === 'task_status_changed') {
    if (event.to_status === 'completed') return 'Tarefa concluída'
    if (event.to_status === 'dismissed') return 'Tarefa dispensada'
    if (event.to_status === 'cancelled') return 'Tarefa encerrada automaticamente'
    return `Status alterado para ${event.to_status}`
  }
  return event.event_type
}

async function completeTask(formData: FormData) {
  'use server'
  const actionId = String(formData.get('action_id') || '')
  if (!actionId) return

  const { supabase, user, tenantId } = await getViewer()
  const now = new Date().toISOString()

  await supabase
    .from('agent_pending_actions')
    .update({
      status: 'completed',
      reviewed_by: user.id,
      reviewed_at: now,
      executed_at: now,
      execution_result: { outcome: 'human_followup_completed', source: 'followup_workbench' },
      updated_at: now,
    })
    .eq('id', actionId)
    .eq('tenant_id', tenantId)
    .eq('agent_name', 'followup_engine')
    .eq('status', 'pending')

  revalidatePath('/admin/followups')
  revalidatePath('/admin/attention')
}

async function dismissTask(formData: FormData) {
  'use server'
  const actionId = String(formData.get('action_id') || '')
  if (!actionId) return

  const { supabase, user, tenantId } = await getViewer()
  const now = new Date().toISOString()

  await supabase
    .from('agent_pending_actions')
    .update({
      status: 'dismissed',
      reviewed_by: user.id,
      reviewed_at: now,
      rejection_reason: 'Dispensada manualmente na central de acompanhamento.',
      execution_result: { outcome: 'dismissed_by_staff', source: 'followup_workbench' },
      updated_at: now,
    })
    .eq('id', actionId)
    .eq('tenant_id', tenantId)
    .eq('agent_name', 'followup_engine')
    .eq('status', 'pending')

  revalidatePath('/admin/followups')
  revalidatePath('/admin/attention')
}

async function snoozeTask(formData: FormData) {
  'use server'
  const actionId = String(formData.get('action_id') || '')
  const days = Math.min(7, Math.max(1, Number(formData.get('days') || 1)))
  if (!actionId) return

  const { supabase, user, tenantId } = await getViewer()
  const now = new Date()
  const scheduled = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  scheduled.setUTCHours(12, 0, 0, 0)

  await supabase
    .from('agent_pending_actions')
    .update({
      scheduled_for: scheduled.toISOString(),
      reviewed_by: user.id,
      reviewed_at: now.toISOString(),
      execution_result: { outcome: 'snoozed', days, source: 'followup_workbench' },
      updated_at: now.toISOString(),
    })
    .eq('id', actionId)
    .eq('tenant_id', tenantId)
    .eq('agent_name', 'followup_engine')
    .eq('status', 'pending')

  revalidatePath('/admin/followups')
}

export default async function FollowupWorkbenchPage() {
  const { supabase, tenantId } = await getViewer()

  const { data: openRows, error: openError } = await supabase
    .from('agent_pending_actions')
    .select('id,target_user_id,target_patient_name,title,content,reasoning,action_type,status,scheduled_for,created_at,updated_at,context_data')
    .eq('tenant_id', tenantId)
    .eq('agent_name', 'followup_engine')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true, nullsFirst: false })

  const actions = (openRows || []) as ActionRow[]
  const actionIds = actions.map(action => action.id)

  const { data: historyRows } = actionIds.length
    ? await supabase
        .from('patient_followup_events')
        .select('id,action_id,event_type,from_status,to_status,created_at,metadata')
        .eq('tenant_id', tenantId)
        .in('action_id', actionIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] as EventRow[] }

  const events = (historyRows || []) as EventRow[]
  const historyByAction = new Map<string, EventRow[]>()
  for (const event of events) {
    if (!event.action_id) continue
    const list = historyByAction.get(event.action_id) || []
    list.push(event)
    historyByAction.set(event.action_id, list)
  }

  const criticalCount = actions.filter(action => String(action.context_data?.attention_bucket || '') === 'critical').length
  const todayCount = actions.filter(action => String(action.context_data?.attention_bucket || '') === 'today').length
  const weekCount = actions.filter(action => String(action.context_data?.attention_bucket || '') === 'this_week').length
  const automaticCount = actions.filter(action => action.action_type === 'gentle_reengagement_candidate').length

  return (
    <main className="min-h-screen bg-[#090B10] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/attention" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
              <ArrowLeft size={16} /> Voltar para quem precisa de mim hoje
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                <CalendarClock size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Fase 2 · operação</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tarefas de acompanhamento</h1>
                <p className="mt-1 text-sm text-slate-400">Prioridades geradas pelo motor, com decisão humana antes de qualquer contato.</p>
              </div>
            </div>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white">
            Painel administrativo
          </Link>
        </div>

        {openError && (
          <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            Não foi possível carregar as tarefas: {openError.message}
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Crítico" value={criticalCount} icon={<ShieldAlert size={18} />} />
          <SummaryCard label="Hoje" value={todayCount} icon={<Clock3 size={18} />} />
          <SummaryCard label="Esta semana" value={weekCount} icon={<CalendarClock size={18} />} />
          <SummaryCard label="Retomada leve" value={automaticCount} icon={<RotateCcw size={18} />} />
        </section>

        {actions.length === 0 ? (
          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={30} />
            <h2 className="text-lg font-bold">Nenhuma tarefa aberta</h2>
            <p className="mt-2 text-sm text-slate-400">Quando o motor identificar uma necessidade de acompanhamento, ela aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map(action => {
              const bucket = action.context_data?.attention_bucket
              const actionHistory = historyByAction.get(action.id) || []
              return (
                <article key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-white">{action.target_patient_name || 'Paciente'}</h2>
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">
                          {bucketLabel(bucket)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                          {action.action_type === 'human_followup' ? 'Ação humana' : 'Candidata automática'}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-slate-100">{action.title || 'Acompanhamento'}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">{action.content}</p>
                      {action.reasoning && <p className="mt-2 text-xs leading-relaxed text-slate-500">{action.reasoning}</p>}

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Prazo: {formatDateTime(action.scheduled_for)}</span>
                        {action.context_data?.days_since_activity !== undefined && (
                          <span className="rounded-lg bg-white/5 px-2.5 py-1.5">{String(action.context_data.days_since_activity)} dias sem atividade</span>
                        )}
                        {action.context_data?.adherence_7d !== undefined && (
                          <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Adesão 7d: {Math.round(Number(action.context_data.adherence_7d || 0))}%</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full xl:max-w-sm">
                      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        <form action={completeTask}>
                          <input type="hidden" name="action_id" value={action.id} />
                          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/15">
                            <CheckCircle2 size={16} /> Concluir
                          </button>
                        </form>
                        <form action={snoozeTask} className="flex gap-2">
                          <input type="hidden" name="action_id" value={action.id} />
                          <input type="hidden" name="days" value="2" />
                          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2.5 text-sm font-bold text-sky-200 transition hover:bg-sky-400/15">
                            <Clock3 size={16} /> Adiar 2 dias
                          </button>
                        </form>
                        <form action={dismissTask}>
                          <input type="hidden" name="action_id" value={action.id} />
                          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white">
                            <XCircle size={16} /> Dispensar
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <details className="mt-5 border-t border-white/10 pt-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-slate-200">
                      <History size={15} /> Histórico desta tarefa ({actionHistory.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {actionHistory.length === 0 ? (
                        <p className="text-xs text-slate-600">Nenhum evento registrado.</p>
                      ) : actionHistory.map(event => (
                        <div key={event.id} className="flex flex-col gap-1 rounded-xl bg-black/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-semibold text-slate-300">{eventLabel(event)}</span>
                          <span className="text-slate-600">{formatDateTime(event.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-relaxed text-slate-500">
          Concluir, adiar ou dispensar altera apenas a tarefa operacional. Nenhuma dessas ações envia mensagem para a paciente nesta etapa.
        </div>
      </div>
    </main>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between text-amber-300">
        {icon}
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="font-bold">{label}</p>
    </div>
  )
}
