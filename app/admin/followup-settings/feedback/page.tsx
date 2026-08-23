import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Rules = Record<string, any>

async function viewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('user_id', user.id).maybeSingle()
  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')
  return { supabase, user, tenantId: profile.tenant_id }
}

async function save(formData: FormData) {
  'use server'
  const { supabase, user, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id', tenantId).maybeSingle()
  const rules: Rules = { ...(data?.rules || {}) }
  rules.feedback = {
    ...(rules.feedback || {}),
    enabled: formData.get('enabled') === 'on',
    due_hours: Math.max(0, Number(formData.get('due_hours') || 24)),
    expiry_hours: Math.max(1, Number(formData.get('expiry_hours') || 72)),
    dismiss_counts_as_resolved: formData.get('dismiss_counts_as_resolved') === 'on',
  }
  rules.exit = {
    ...(rules.exit || {}),
    completed_cooldown_days: Math.max(0, Number(formData.get('completed_cooldown_days') || 1)),
    dismissed_cooldown_days: Math.max(0, Number(formData.get('dismissed_cooldown_days') || 3)),
  }

  const { error } = await supabase.from('tenant_followup_settings').upsert({
    tenant_id: tenantId,
    rules,
    schema_version: 1,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' })

  if (error) redirect('/admin/followup-settings/feedback?error=save')
  revalidatePath('/admin/followup-settings/feedback')
  redirect('/admin/followup-settings/feedback?saved=1')
}

function NumberField({ name, label, value, min = 0, max = 720 }: { name: string; label: string; value: number; min?: number; max?: number }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-700"><span>{label}</span><input name={name} type="number" min={min} max={max} defaultValue={value} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
}

export default async function FeedbackSettingsPage({ searchParams }: { searchParams?: { saved?: string; error?: string } }) {
  const { supabase, tenantId } = await viewer()
  const { data } = await supabase.from('tenant_followup_settings').select('rules').eq('tenant_id', tenantId).maybeSingle()
  const rules: Rules = data?.rules || {}
  const feedback = { enabled: true, due_hours: 24, expiry_hours: 72, dismiss_counts_as_resolved: true, ...(rules.feedback || {}) }
  const exit = { completed_cooldown_days: 1, dismissed_cooldown_days: 3, ...(rules.exit || {}) }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Motor de acompanhamento</p>
            <h1 className="text-3xl font-black">Feedback e regras de saída</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Defina quando um check-in passa a exigir retorno e por quanto tempo uma tarefa concluída ou dispensada fica protegida de recriação.</p>
          </div>
          <Link href="/admin/followup-settings" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Regras gerais</Link>
        </div>

        {searchParams?.saved === '1' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Configurações salvas.</div>}
        {searchParams?.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Não foi possível salvar.</div>}

        <form action={save} className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Feedback de check-in semanal</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField name="due_hours" label="Criar tarefa após quantas horas" value={feedback.due_hours} max={336} />
              <NumberField name="expiry_hours" label="Validade da tarefa após vencer (h)" value={feedback.expiry_hours} min={1} max={720} />
            </div>
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3"><input name="enabled" type="checkbox" defaultChecked={feedback.enabled} className="mt-1" /><span><strong>Ativar sinal de feedback pendente</strong><span className="block text-sm text-slate-600">Se desligado, tarefas abertas desse tipo são encerradas automaticamente.</span></span></label>
              <label className="flex items-start gap-3"><input name="dismiss_counts_as_resolved" type="checkbox" defaultChecked={feedback.dismiss_counts_as_resolved} className="mt-1" /><span><strong>Dispensar conta como resolvido até o próximo check-in</strong><span className="block text-sm text-slate-600">Evita que o mesmo check-in volte à fila depois de uma decisão manual de dispensa.</span></span></label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Cooldown após decisão humana</h2>
            <p className="mt-1 text-sm text-slate-600">Protege a fila contra recriação imediata da mesma ação após uma decisão.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField name="completed_cooldown_days" label="Após concluir, não recriar por dias" value={exit.completed_cooldown_days} max={60} />
              <NumberField name="dismissed_cooldown_days" label="Após dispensar, não recriar por dias" value={exit.dismissed_cooldown_days} max={60} />
            </div>
          </section>

          <div className="flex justify-end"><button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white">Salvar feedback e saídas</button></div>
        </form>
      </div>
    </main>
  )
}
