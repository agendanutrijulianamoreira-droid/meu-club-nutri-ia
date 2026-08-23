import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Rules = {
  inactivity: { gentle_days: number; oscillating_days: number; risk_days: number; critical_days: number; inactive_days: number }
  adherence: { at_risk_below: number; oscillating_below: number }
  checkin: { overdue_days: number }
  plan: { expiring_days: number; urgent_days: number }
  protocol: { ending_days: number; urgent_days: number }
  tasks: {
    critical_time: string; today_time: string; this_week_delay_days: number; this_week_time: string; gentle_time: string
    phase_review_time: string; urgent_expiry_hours: number; routine_expiry_hours: number; phase_review_expiry_days: number
  }
  automation: { automatic_contact_enabled: boolean }
}

const DEFAULTS: Rules = {
  inactivity: { gentle_days: 2, oscillating_days: 4, risk_days: 7, critical_days: 10, inactive_days: 14 },
  adherence: { at_risk_below: 40, oscillating_below: 60 },
  checkin: { overdue_days: 8 },
  plan: { expiring_days: 15, urgent_days: 7 },
  protocol: { ending_days: 7, urgent_days: 3 },
  tasks: {
    critical_time: '09:00', today_time: '12:00', this_week_delay_days: 2, this_week_time: '09:00', gentle_time: '10:00',
    phase_review_time: '15:00', urgent_expiry_hours: 24, routine_expiry_hours: 72, phase_review_expiry_days: 3,
  },
  automation: { automatic_contact_enabled: false },
}

function n(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key))
  return Number.isFinite(value) ? value : fallback
}

function s(form: FormData, key: string, fallback: string) {
  const value = String(form.get(key) || '').trim()
  return value || fallback
}

function mergeRules(value: unknown): Rules {
  const r = (value && typeof value === 'object' ? value : {}) as Partial<Rules>
  return {
    inactivity: { ...DEFAULTS.inactivity, ...(r.inactivity || {}) },
    adherence: { ...DEFAULTS.adherence, ...(r.adherence || {}) },
    checkin: { ...DEFAULTS.checkin, ...(r.checkin || {}) },
    plan: { ...DEFAULTS.plan, ...(r.plan || {}) },
    protocol: { ...DEFAULTS.protocol, ...(r.protocol || {}) },
    tasks: { ...DEFAULTS.tasks, ...(r.tasks || {}) },
    automation: { ...DEFAULTS.automation, ...(r.automation || {}) },
  }
}

async function viewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('user_id', user.id).maybeSingle()
  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !['admin', 'nutritionist', 'nutri'].includes(role)) redirect('/patient/home')
  return { supabase, user, tenantId: profile.tenant_id }
}

async function saveRules(form: FormData) {
  'use server'
  const { supabase, user, tenantId } = await viewer()

  const rules: Rules = {
    inactivity: {
      gentle_days: n(form, 'gentle_days', 2),
      oscillating_days: n(form, 'oscillating_days', 4),
      risk_days: n(form, 'risk_days', 7),
      critical_days: n(form, 'critical_days', 10),
      inactive_days: n(form, 'inactive_days', 14),
    },
    adherence: {
      at_risk_below: n(form, 'at_risk_below', 40),
      oscillating_below: n(form, 'oscillating_below', 60),
    },
    checkin: { overdue_days: n(form, 'checkin_overdue_days', 8) },
    plan: { expiring_days: n(form, 'plan_expiring_days', 15), urgent_days: n(form, 'plan_urgent_days', 7) },
    protocol: { ending_days: n(form, 'protocol_ending_days', 7), urgent_days: n(form, 'protocol_urgent_days', 3) },
    tasks: {
      critical_time: s(form, 'critical_time', '09:00'),
      today_time: s(form, 'today_time', '12:00'),
      this_week_delay_days: n(form, 'this_week_delay_days', 2),
      this_week_time: s(form, 'this_week_time', '09:00'),
      gentle_time: s(form, 'gentle_time', '10:00'),
      phase_review_time: s(form, 'phase_review_time', '15:00'),
      urgent_expiry_hours: n(form, 'urgent_expiry_hours', 24),
      routine_expiry_hours: n(form, 'routine_expiry_hours', 72),
      phase_review_expiry_days: n(form, 'phase_review_expiry_days', 3),
    },
    automation: { automatic_contact_enabled: form.get('automatic_contact_enabled') === 'on' },
  }

  const i = rules.inactivity
  if (!(i.gentle_days >= 1 && i.gentle_days < i.oscillating_days && i.oscillating_days < i.risk_days && i.risk_days < i.critical_days && i.critical_days < i.inactive_days)) {
    redirect('/admin/followup-settings?error=inactivity')
  }
  if (rules.adherence.at_risk_below < 0 || rules.adherence.oscillating_below > 100 || rules.adherence.at_risk_below >= rules.adherence.oscillating_below) {
    redirect('/admin/followup-settings?error=adherence')
  }
  if (rules.plan.urgent_days > rules.plan.expiring_days || rules.protocol.urgent_days > rules.protocol.ending_days) {
    redirect('/admin/followup-settings?error=windows')
  }

  const { error } = await supabase.from('tenant_followup_settings').upsert({
    tenant_id: tenantId,
    rules,
    schema_version: 1,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' })

  if (error) redirect('/admin/followup-settings?error=save')
  revalidatePath('/admin/followup-settings')
  redirect('/admin/followup-settings?saved=1')
}

function NumberField({ name, label, value, min = 0, max = 365 }: { name: string; label: string; value: number; min?: number; max?: number }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-700"><span>{label}</span><input name={name} type="number" min={min} max={max} defaultValue={value} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
}

function TimeField({ name, label, value }: { name: string; label: string; value: string }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-700"><span>{label}</span><input name={name} type="time" defaultValue={value} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
}

export default async function FollowupSettingsPage({ searchParams }: { searchParams?: { saved?: string; error?: string } }) {
  const { supabase, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id', tenantId).maybeSingle()
  const r = mergeRules(data?.rules)

  const errorText: Record<string, string> = {
    inactivity: 'Os dias de inatividade precisam estar em ordem crescente.',
    adherence: 'Os limites de adesão precisam estar entre 0 e 100 e em ordem crescente.',
    windows: 'A janela urgente não pode ser maior que a janela de aviso.',
    save: 'Não foi possível salvar as configurações.',
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Motor de acompanhamento</p>
            <h1 className="text-3xl font-black">Regras editáveis</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Estas regras pertencem à clínica. Alterá-las muda como o sistema classifica e prioriza pacientes, sem exigir alteração de código.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar ao painel</Link>
        </div>

        {searchParams?.saved === '1' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Configurações salvas.</div>}
        {searchParams?.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{errorText[searchParams.error] || 'Revise os valores informados.'}</div>}

        <form action={saveRules} className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Inatividade e risco</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <NumberField name="gentle_days" label="Retomada leve após" value={r.inactivity.gentle_days} min={1} />
              <NumberField name="oscillating_days" label="Oscilando após" value={r.inactivity.oscillating_days} min={2} />
              <NumberField name="risk_days" label="Em risco após" value={r.inactivity.risk_days} min={3} />
              <NumberField name="critical_days" label="Crítico após" value={r.inactivity.critical_days} min={4} />
              <NumberField name="inactive_days" label="Inativa após" value={r.inactivity.inactive_days} min={5} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Adesão e check-in</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumberField name="at_risk_below" label="Em risco se adesão abaixo de %" value={r.adherence.at_risk_below} max={100} />
              <NumberField name="oscillating_below" label="Oscilando se adesão abaixo de %" value={r.adherence.oscillating_below} max={100} />
              <NumberField name="checkin_overdue_days" label="Check-in atrasado após dias" value={r.checkin.overdue_days} min={1} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Vencimentos e encerramentos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField name="plan_expiring_days" label="Avisar plano vencendo em" value={r.plan.expiring_days} />
              <NumberField name="plan_urgent_days" label="Plano vira prioridade em" value={r.plan.urgent_days} />
              <NumberField name="protocol_ending_days" label="Avisar protocolo terminando em" value={r.protocol.ending_days} />
              <NumberField name="protocol_urgent_days" label="Protocolo vira prioridade em" value={r.protocol.urgent_days} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Agenda operacional</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TimeField name="critical_time" label="Horário das tarefas críticas" value={r.tasks.critical_time} />
              <TimeField name="today_time" label="Horário das tarefas de hoje" value={r.tasks.today_time} />
              <NumberField name="this_week_delay_days" label="Prazo para tarefas desta semana" value={r.tasks.this_week_delay_days} />
              <TimeField name="this_week_time" label="Horário das tarefas desta semana" value={r.tasks.this_week_time} />
              <TimeField name="gentle_time" label="Horário da retomada leve" value={r.tasks.gentle_time} />
              <TimeField name="phase_review_time" label="Horário da revisão de fase" value={r.tasks.phase_review_time} />
              <NumberField name="urgent_expiry_hours" label="Expiração tarefa urgente (h)" value={r.tasks.urgent_expiry_hours} min={1} max={720} />
              <NumberField name="routine_expiry_hours" label="Expiração tarefa rotina (h)" value={r.tasks.routine_expiry_hours} min={1} max={720} />
              <NumberField name="phase_review_expiry_days" label="Expiração revisão de fase (dias)" value={r.tasks.phase_review_expiry_days} min={1} max={60} />
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <label className="flex items-start gap-3">
              <input name="automatic_contact_enabled" type="checkbox" defaultChecked={r.automation.automatic_contact_enabled} className="mt-1 h-4 w-4" />
              <span><strong>Permitir contato automático</strong><span className="mt-1 block text-sm text-slate-600">Fica desligado por padrão. A Fase 2 atual continua apenas criando sinais e tarefas; ativar este campo sozinho não dispara mensagens enquanto não houver um canal de automação explicitamente configurado.</span></span>
            </label>
          </section>

          <div className="flex justify-end"><button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg">Salvar regras do motor</button></div>
        </form>
      </div>
    </main>
  )
}
