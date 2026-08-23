import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  HeartPulse,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BUCKET_ORDER: Record<string, number> = {
  critical: 1,
  today: 2,
  this_week: 3,
  automatic: 4,
  none: 5,
}

const BUCKET_META: Record<string, { title: string; description: string; icon: any }> = {
  critical: {
    title: 'Crítico',
    description: 'Requer revisão humana prioritária.',
    icon: ShieldAlert,
  },
  today: {
    title: 'Hoje',
    description: 'Vale priorizar ainda hoje.',
    icon: AlertTriangle,
  },
  this_week: {
    title: 'Esta semana',
    description: 'Precisa entrar na sua agenda da semana.',
    icon: CalendarClock,
  },
  automatic: {
    title: 'Acompanhamento leve',
    description: 'Elegível para uma retomada automática suave.',
    icon: Sparkles,
  },
}

const REASON_LABELS: Record<string, string> = {
  inactivity: 'Sem atividade',
  checkin_overdue: 'Check-in atrasado',
  consultation_overdue: 'Consulta pendente',
  plan_expiring: 'Plano perto do vencimento',
  protocol_ending: 'Protocolo perto do fim',
}

type QueueRow = {
  id: string
  user_id: string
  overall_risk: number | null
  risk_level: string | null
  operational_status: string | null
  attention_bucket: string | null
  days_since_activity: number | null
  adherence_7d: number | null
  recommended_action: string | null
  reasons: Array<Record<string, unknown>> | null
  next_appointment_at: string | null
  active_protocol_end_date: string | null
  plan_expiring: boolean | null
  protocol_ending: boolean | null
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function statusLabel(status: string | null) {
  const map: Record<string, string> = {
    onboarding: 'Em adaptação',
    adherent: 'Aderente',
    oscillating: 'Oscilando',
    at_risk: 'Em risco',
    inactive: 'Inativa',
  }
  return status ? (map[status] || status) : 'Sem status'
}

export default async function AttentionQueuePage() {
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

  const today = localDate()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  let refreshError: string | null = null
  if (serviceRoleKey && supabaseUrl) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await admin.rpc('refresh_patient_operational_snapshot', {
      p_tenant_id: viewer.tenant_id,
      p_reference_date: today,
    })
    if (error) refreshError = error.message
  } else {
    refreshError = 'Configuração de backend indisponível para atualizar o snapshot.'
  }

  const { data: riskRows, error: riskError } = await supabase
    .from('patient_risk_scores')
    .select('id,user_id,overall_risk,risk_level,operational_status,attention_bucket,days_since_activity,adherence_7d,recommended_action,reasons,next_appointment_at,active_protocol_end_date,plan_expiring,protocol_ending')
    .eq('tenant_id', viewer.tenant_id)
    .eq('calculated_date', today)

  const rows = (riskRows || []) as QueueRow[]
  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]

  const { data: profileRows } = ids.length
    ? await supabase
        .from('profiles')
        .select('user_id,name,email,phone,plan_expires_at')
        .eq('tenant_id', viewer.tenant_id)
        .in('user_id', ids)
    : { data: [] as any[] }

  const profiles = new Map((profileRows || []).map(p => [p.user_id, p]))

  const queue = rows
    .filter(r => r.attention_bucket && r.attention_bucket !== 'none')
    .sort((a, b) => {
      const bucket = (BUCKET_ORDER[a.attention_bucket || 'none'] || 99) - (BUCKET_ORDER[b.attention_bucket || 'none'] || 99)
      if (bucket !== 0) return bucket
      return Number(b.overall_risk || 0) - Number(a.overall_risk || 0)
    })

  const grouped = ['critical', 'today', 'this_week', 'automatic'].map(bucket => ({
    bucket,
    rows: queue.filter(r => r.attention_bucket === bucket),
  }))

  const counts = Object.fromEntries(grouped.map(g => [g.bucket, g.rows.length])) as Record<string, number>

  return (
    <main className="min-h-screen bg-[#090B10] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} /> Voltar ao painel
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                <HeartPulse size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Motor de acompanhamento</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Quem precisa de mim hoje?</h1>
                <p className="mt-1 text-sm text-slate-400">Prioridade calculada com sinais objetivos e motivo visível.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Snapshot</p>
            <p className="text-sm font-semibold text-slate-200">{today.split('-').reverse().join('/')}</p>
          </div>
        </div>

        {(refreshError || riskError) && (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <strong>Atenção:</strong> {refreshError || riskError?.message}. A tela mostra o último snapshot disponível para hoje, se houver.
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['critical', 'today', 'this_week', 'automatic'].map(bucket => {
            const meta = BUCKET_META[bucket]
            const Icon = meta.icon
            return (
              <div key={bucket} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Icon size={18} className="text-amber-300" />
                  <span className="text-2xl font-bold">{counts[bucket] || 0}</span>
                </div>
                <p className="font-bold">{meta.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{meta.description}</p>
              </div>
            )
          })}
        </section>

        {queue.length === 0 ? (
          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={30} />
            <h2 className="text-lg font-bold">Nenhuma paciente exige atenção agora</h2>
            <p className="mt-2 text-sm text-slate-400">O motor não encontrou sinais que peçam intervenção neste snapshot.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.filter(group => group.rows.length > 0).map(group => {
              const meta = BUCKET_META[group.bucket]
              const Icon = meta.icon
              return (
                <section key={group.bucket}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon size={18} className="text-amber-300" />
                        <h2 className="text-lg font-bold">{meta.title}</h2>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">{group.rows.length}</span>
                  </div>

                  <div className="grid gap-3">
                    {group.rows.map(row => {
                      const profile = profiles.get(row.user_id)
                      const reasons = Array.isArray(row.reasons) ? row.reasons : []
                      return (
                        <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-white">{profile?.name || 'Paciente'}</h3>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                                  {statusLabel(row.operational_status)}
                                </span>
                                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">
                                  risco {Math.round(Number(row.overall_risk || 0))}/100
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                                <span className="rounded-lg bg-white/5 px-2.5 py-1.5">
                                  {row.days_since_activity ?? 0} dias sem atividade
                                </span>
                                <span className="rounded-lg bg-white/5 px-2.5 py-1.5">
                                  adesão 7d: {Math.round(Number(row.adherence_7d || 0))}%
                                </span>
                                {row.next_appointment_at && (
                                  <span className="rounded-lg bg-white/5 px-2.5 py-1.5">
                                    próxima consulta: {formatDate(row.next_appointment_at)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {reasons.map((reason, index) => {
                                  const code = String(reason.code || '')
                                  const label = REASON_LABELS[code] || code || 'Sinal de atenção'
                                  const suffix = code === 'inactivity' && reason.days ? ` · ${reason.days}d` : ''
                                  return (
                                    <span key={`${code}-${index}`} className="rounded-full border border-rose-400/15 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-200">
                                      {label}{suffix}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="w-full rounded-xl border border-white/10 bg-black/20 p-3 lg:max-w-sm">
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Próxima ação sugerida</p>
                              <p className="text-sm font-semibold leading-relaxed text-slate-200">{row.recommended_action || 'Revisar o contexto da paciente.'}</p>
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                {profile?.plan_expires_at && row.plan_expiring && <span>Plano: {formatDate(profile.plan_expires_at)}</span>}
                                {row.active_protocol_end_date && row.protocol_ending && <span>Protocolo: {formatDate(row.active_protocol_end_date)}</span>}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-relaxed text-slate-500">
          <Clock3 size={16} className="shrink-0" />
          Nesta etapa o motor apenas prioriza e explica. Nenhum contato é enviado automaticamente por esta tela.
        </div>
      </div>
    </main>
  )
}
