import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Action = {
  id: string
  target_patient_name: string | null
  action_type: string
  title: string | null
  status: string
  reviewed_at: string | null
  executed_at: string | null
  updated_at: string | null
  rejection_reason: string | null
  execution_result: Record<string, unknown> | null
}

type Event = {
  id: string
  action_id: string | null
  event_type: string
  from_status: string | null
  to_status: string | null
  created_at: string
}

function fmt(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function statusLabel(status: string) {
  return ({ completed: 'Concluída', dismissed: 'Dispensada', cancelled: 'Encerrada pelo motor', expired: 'Expirada' } as Record<string,string>)[status] || status
}

export default async function FollowupHistoryPage() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id,role').eq('user_id', user.id).maybeSingle()
  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')

  const { data: rows } = await supabase
    .from('agent_pending_actions')
    .select('id,target_patient_name,action_type,title,status,reviewed_at,executed_at,updated_at,rejection_reason,execution_result')
    .eq('tenant_id', profile.tenant_id)
    .eq('agent_name', 'followup_engine')
    .neq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(200)

  const actions = (rows || []) as Action[]
  const ids = actions.map(a => a.id)
  const { data: eventRows } = ids.length
    ? await supabase.from('patient_followup_events').select('id,action_id,event_type,from_status,to_status,created_at').eq('tenant_id', profile.tenant_id).in('action_id', ids).order('created_at', { ascending: false }).limit(500)
    : { data: [] as Event[] }

  const counts = actions.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {} as Record<string,number>)

  return (
    <main className="min-h-screen bg-[#090B10] px-4 py-7 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Fase 2 · histórico</p>
            <h1 className="mt-1 text-3xl font-black">Intervenções encerradas</h1>
            <p className="mt-2 text-sm text-slate-400">Registro auditável das decisões humanas e encerramentos automáticos do motor.</p>
          </div>
          <Link href="/admin/followups" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">Voltar às tarefas</Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card label="Concluídas" value={counts.completed || 0} />
          <Card label="Dispensadas" value={counts.dismissed || 0} />
          <Card label="Encerradas pelo motor" value={(counts.cancelled || 0) + (counts.expired || 0)} />
        </section>

        {actions.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">Ainda não há intervenções encerradas.</div> : (
          <div className="space-y-3">
            {actions.map(action => {
              const eventCount = (eventRows || []).filter((e: Event) => e.action_id === action.id).length
              return <article key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{action.target_patient_name || 'Paciente'}</h2><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">{statusLabel(action.status)}</span></div>
                    <p className="mt-2 text-sm font-semibold text-slate-200">{action.title || action.action_type}</p>
                    <p className="mt-1 text-xs text-slate-500">Atualizada em {fmt(action.updated_at)} · {eventCount} evento(s)</p>
                    {action.rejection_reason && <p className="mt-2 text-xs text-slate-400">Motivo: {action.rejection_reason}</p>}
                  </div>
                  <div className="text-right text-xs text-slate-500"><div>Revisão: {fmt(action.reviewed_at)}</div><div>Execução: {fmt(action.executed_at)}</div></div>
                </div>
              </article>
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div></div>
}
