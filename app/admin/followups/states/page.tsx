import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const OPTIONS = [
  ['auto','Automático pelo motor'],
  ['active_followup','Acompanhamento ativo'],
  ['awaiting_consultation','Aguardando consulta'],
  ['return_overdue','Retorno atrasado'],
  ['protocol_completed','Protocolo concluído'],
  ['plan_expiring','Plano vencendo'],
  ['plan_expired','Plano vencido'],
  ['reactivation','Reativação'],
  ['care_completed','Acompanhamento concluído'],
] as const

async function viewer() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('tenant_id,role').eq('user_id', user.id).maybeSingle()
  const role = String(profile?.role || '').toLowerCase()
  if (!profile?.tenant_id || !['admin','nutritionist','nutri'].includes(role)) redirect('/patient/home')
  return { supabase, user, tenantId: profile.tenant_id }
}

async function saveOverride(formData: FormData) {
  'use server'
  const { supabase, user, tenantId } = await viewer()
  const userId = String(formData.get('user_id') || '')
  const status = String(formData.get('status') || 'auto')
  const nextAction = String(formData.get('next_action') || '').trim()
  const note = String(formData.get('note') || '').trim()
  if (!userId) return

  if (status === 'auto') {
    await supabase.from('patient_lifecycle_overrides').delete().eq('tenant_id', tenantId).eq('user_id', userId)
  } else {
    await supabase.from('patient_lifecycle_overrides').upsert({
      tenant_id: tenantId,
      user_id: userId,
      override_status: status,
      next_action: nextAction || null,
      note: note || null,
      active: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,user_id' })
  }
  revalidatePath('/admin/followups/states')
  revalidatePath('/admin/attention')
}

export default async function PatientStatesPage() {
  const { supabase, tenantId } = await viewer()
  const [{ data: patients }, { data: overrides }] = await Promise.all([
    supabase.from('profiles').select('user_id,name,email').eq('tenant_id', tenantId).eq('role','patient').order('name'),
    supabase.from('patient_lifecycle_overrides').select('user_id,override_status,next_action,note').eq('tenant_id', tenantId).eq('active', true),
  ])
  const map = new Map((overrides || []).map(row => [row.user_id, row]))

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Fase 2 · jornada operacional</p>
            <h1 className="text-3xl font-black">Estados das pacientes</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">O motor calcula automaticamente. Use override somente quando a decisão clínica/operacional precisar prevalecer.</p>
          </div>
          <Link href="/admin/followups" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Voltar</Link>
        </div>

        <div className="space-y-3">
          {(patients || []).map(patient => {
            const ov = map.get(patient.user_id)
            return (
              <form key={patient.user_id} action={saveOverride} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_1fr_1.2fr_1.2fr_auto] lg:items-end">
                <input type="hidden" name="user_id" value={patient.user_id} />
                <div>
                  <p className="font-black">{patient.name || 'Paciente'}</p>
                  <p className="text-xs text-slate-500">{patient.email || ''}</p>
                </div>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Estado
                  <select name="status" defaultValue={ov?.override_status || 'auto'} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                    {OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Próximo passo opcional
                  <input name="next_action" defaultValue={ov?.next_action || ''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: agendar retorno" />
                </label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Observação
                  <input name="note" defaultValue={ov?.note || ''} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Motivo do override" />
                </label>
                <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Salvar</button>
              </form>
            )
          })}
        </div>
      </div>
    </main>
  )
}
