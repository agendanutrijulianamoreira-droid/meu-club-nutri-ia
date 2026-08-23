import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ArrowLeft, CheckCircle2, Settings2 } from 'lucide-react'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AdvancementCriteria = {
  enabled?: boolean
  mode?: 'all' | 'any'
  min_days_in_phase?: number | null
  min_adherence_7d?: number | null
  require_weekly_checkin?: boolean
  require_protocol_completion?: boolean
  require_manual_approval?: boolean
  custom_note?: string
}

type MethodRow = {
  id: string
  name: string
  description: string | null
}

type PhaseRow = {
  id: string
  method_id: string
  name: string
  description: string | null
  sort_order: number
  advancement_criteria: AdvancementCriteria | null
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

  return { supabase, tenantId: viewer.tenant_id }
}

function parseOptionalNumber(value: FormDataEntryValue | null, min: number, max: number) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const number = Number(raw)
  if (!Number.isFinite(number)) return null
  return Math.min(max, Math.max(min, Math.round(number)))
}

async function savePhaseCriteria(formData: FormData) {
  'use server'

  const phaseId = String(formData.get('phase_id') || '')
  if (!phaseId) return

  const { supabase, tenantId } = await getViewer()

  const mode = String(formData.get('mode') || 'all') === 'any' ? 'any' : 'all'
  const criteria: AdvancementCriteria = {
    enabled: formData.get('enabled') === 'on',
    mode,
    min_days_in_phase: parseOptionalNumber(formData.get('min_days_in_phase'), 0, 365),
    min_adherence_7d: parseOptionalNumber(formData.get('min_adherence_7d'), 0, 100),
    require_weekly_checkin: formData.get('require_weekly_checkin') === 'on',
    require_protocol_completion: formData.get('require_protocol_completion') === 'on',
    require_manual_approval: formData.get('require_manual_approval') === 'on',
    custom_note: String(formData.get('custom_note') || '').trim().slice(0, 1000),
  }

  await supabase
    .from('method_phases')
    .update({ advancement_criteria: criteria, updated_at: new Date().toISOString() })
    .eq('id', phaseId)
    .eq('tenant_id', tenantId)

  revalidatePath('/admin/methods/phases')
}

export default async function PhaseCriteriaAdminPage() {
  const { supabase, tenantId } = await getViewer()

  const [{ data: methodsData, error: methodsError }, { data: phasesData, error: phasesError }] = await Promise.all([
    supabase
      .from('methods')
      .select('id,name,description')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('method_phases')
      .select('id,method_id,name,description,sort_order,advancement_criteria')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true }),
  ])

  const methods = (methodsData || []) as MethodRow[]
  const phases = (phasesData || []) as PhaseRow[]

  return (
    <main className="min-h-screen bg-[#090B10] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
              <ArrowLeft size={16} /> Voltar ao painel
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                <Settings2 size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Método clínico · Fase 2</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Critérios de avanço de fase</h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                  Você define o que caracteriza prontidão para avançar. O motor só avalia os critérios salvos aqui; ele não cria regras clínicas por conta própria.
                </p>
              </div>
            </div>
          </div>
        </div>

        {(methodsError || phasesError) && (
          <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            Não foi possível carregar os critérios: {methodsError?.message || phasesError?.message}
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-4 text-sm leading-relaxed text-sky-100">
          <strong>Decisão clínica preservada.</strong> Se “Aprovação manual obrigatória” estiver marcada, a paciente pode ser sinalizada como elegível, mas nunca muda de fase automaticamente.
        </div>

        {methods.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
            <h2 className="text-lg font-bold">Nenhum método cadastrado</h2>
            <p className="mt-2 text-sm text-slate-400">Cadastre o método clínico e suas fases para configurar os critérios.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {methods.map(method => {
              const methodPhases = phases.filter(phase => phase.method_id === method.id)
              return (
                <section key={method.id}>
                  <div className="mb-3">
                    <h2 className="text-xl font-bold">{method.name}</h2>
                    {method.description && <p className="mt-1 text-sm text-slate-500">{method.description}</p>}
                  </div>

                  {methodPhases.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Este método ainda não possui fases.</div>
                  ) : (
                    <div className="space-y-4">
                      {methodPhases.map((phase, index) => {
                        const c = phase.advancement_criteria || {}
                        return (
                          <form key={phase.id} action={savePhaseCriteria} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                            <input type="hidden" name="phase_id" value={phase.id} />

                            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Fase {index + 1}</p>
                                <h3 className="mt-1 text-lg font-bold text-white">{phase.name}</h3>
                                {phase.description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{phase.description}</p>}
                              </div>
                              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-200">
                                <input type="checkbox" name="enabled" defaultChecked={Boolean(c.enabled)} className="h-4 w-4" />
                                Avaliar avanço nesta fase
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-400">Tempo mínimo na fase (dias)</span>
                                <input
                                  type="number"
                                  name="min_days_in_phase"
                                  min={0}
                                  max={365}
                                  defaultValue={c.min_days_in_phase ?? ''}
                                  placeholder="Sem mínimo"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/50"
                                />
                              </label>

                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-400">Adesão mínima nos últimos 7 dias (%)</span>
                                <input
                                  type="number"
                                  name="min_adherence_7d"
                                  min={0}
                                  max={100}
                                  defaultValue={c.min_adherence_7d ?? ''}
                                  placeholder="Sem mínimo"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/50"
                                />
                              </label>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
                                <input type="checkbox" name="require_weekly_checkin" defaultChecked={Boolean(c.require_weekly_checkin)} className="mt-0.5 h-4 w-4" />
                                <span><strong>Check-in semanal em dia</strong><br /><span className="text-xs text-slate-500">Exigir registro recente antes de considerar avanço.</span></span>
                              </label>
                              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
                                <input type="checkbox" name="require_protocol_completion" defaultChecked={Boolean(c.require_protocol_completion)} className="mt-0.5 h-4 w-4" />
                                <span><strong>Protocolo concluído</strong><br /><span className="text-xs text-slate-500">Exigir encerramento do protocolo ativo ligado à etapa.</span></span>
                              </label>
                              <label className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm text-amber-100 md:col-span-2">
                                <input type="checkbox" name="require_manual_approval" defaultChecked={c.require_manual_approval !== false} className="mt-0.5 h-4 w-4" />
                                <span><strong>Aprovação manual obrigatória</strong><br /><span className="text-xs text-amber-100/60">Recomendado: o sistema sinaliza elegibilidade, mas a mudança de fase continua sendo sua decisão.</span></span>
                              </label>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-400">Como combinar critérios</span>
                                <select name="mode" defaultValue={c.mode === 'any' ? 'any' : 'all'} className="w-full rounded-xl border border-white/10 bg-[#11151d] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/50">
                                  <option value="all">Todos os critérios</option>
                                  <option value="any">Qualquer critério</option>
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-400">Observação clínica / condição personalizada</span>
                                <textarea
                                  name="custom_note"
                                  rows={3}
                                  maxLength={1000}
                                  defaultValue={c.custom_note || ''}
                                  placeholder="Ex.: avançar somente após redução de sintomas e boa adaptação à rotina atual."
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50"
                                />
                              </label>
                            </div>

                            <div className="mt-5 flex justify-end">
                              <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-amber-200/30 bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200">
                                <CheckCircle2 size={16} /> Salvar critérios desta fase
                              </button>
                            </div>
                          </form>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
