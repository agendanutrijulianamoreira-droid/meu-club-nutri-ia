"use client"
import React, { useState, useCallback } from "react"
import {
  TrendingUp, Plus, Loader2, Sparkles, Check, X, AlertCircle,
  ChevronDown, ChevronUp, Calendar, CheckCircle2, XCircle, Edit3, Crown, Star
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useBusinessPlans, useBusinessPlanDetail, BusinessPlanItem } from "@/lib/hooks/useBusinessPlan"

function formatCentsInput(v: string) {
  const digits = v.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

function formatPrice(cents: number | null) {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const TIER_META: Record<string, { label: string; color: string; bg: string }> = {
  tech_diet: { label: 'Premium', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25' },
  vip: { label: 'VIP', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  both: { label: 'Ambos', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: 'A revisar', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  approved: { label: 'Aprovado', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  edited: { label: 'Editado', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/25' },
  rejected: { label: 'Rejeitado', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25' },
  scheduled: { label: 'Agendado', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/25' },
  pushed: { label: 'Publicado', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/25' },
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  challenge: 'Desafio', protocol: 'Protocolo', content_post: 'Post de conteúdo',
  push_campaign: 'Campanha push', email_campaign: 'Campanha e-mail',
  promotion: 'Promoção', product_launch: 'Lançamento de produto', special_event: 'Evento especial',
}

// ─── Card de item (ação sugerida) ─────────────────────────────────────────────
function ItemCard({ item, onUpdate }: { item: BusinessPlanItem; onUpdate: (updates: Partial<BusinessPlanItem>) => Promise<any> }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.edited_title || item.title)
  const [description, setDescription] = useState(item.edited_description || item.description || '')
  const [saving, setSaving] = useState(false)
  const tierMeta = TIER_META[item.club_tier]
  const statusMeta = STATUS_META[item.status]

  const act = async (updates: Partial<BusinessPlanItem>) => {
    setSaving(true)
    try { await onUpdate(updates) } finally { setSaving(false) }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
          {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
        </span>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tierMeta.bg} ${tierMeta.color}`}>
          {tierMeta.label}
        </span>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
          {statusMeta.label}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none"/>
          <div className="flex gap-2">
            <button disabled={saving} onClick={async () => {
              await act({ status: 'edited', edited_title: title, edited_description: description })
              setEditing(false)
            }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
              Salvar edição
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs rounded-xl">Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-white">{item.edited_title || item.title}</p>
          {(item.edited_description || item.description) && (
            <p className="text-xs text-slate-400">{item.edited_description || item.description}</p>
          )}
        </>
      )}

      {!editing && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {item.status === 'pending_review' && (
            <>
              <button disabled={saving} onClick={() => act({ status: 'approved' })}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                <CheckCircle2 size={12}/> Aprovar
              </button>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all">
                <Edit3 size={12}/> Editar
              </button>
              <button disabled={saving} onClick={() => act({ status: 'rejected' })}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-xl transition-all">
                <XCircle size={12}/> Rejeitar
              </button>
            </>
          )}
          {(item.status === 'approved' || item.status === 'edited') && (
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-slate-500"/>
              <input type="date" value={item.scheduled_for || ''}
                onChange={e => act({ status: 'scheduled', scheduled_for: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"/>
              <span className="text-[10px] text-slate-500">quando distribuir</span>
            </div>
          )}
          {item.status === 'scheduled' && (
            <p className="text-[11px] text-violet-400">Agendado para {item.scheduled_for} — a distribuição gradual cuida do resto.</p>
          )}
          {item.status === 'pushed' && (
            <p className="text-[11px] text-slate-500">Já distribuído automaticamente.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Questionário + geração por IA ────────────────────────────────────────────
function NewPlanForm({ onCreated, onCancel }: { onCreated: (planId: string) => void; onCancel: () => void }) {
  const { createPlan } = useBusinessPlans()
  const [year, setYear] = useState(new Date().getFullYear() + (new Date().getMonth() === 11 ? 1 : 0))
  const [revenueGoal, setRevenueGoal] = useState('')
  const [focusTheme, setFocusTheme] = useState('')
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!focusTheme.trim()) { setError('Descreva o foco do ano antes de gerar'); return }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'generate-business-plan',
          context: focusTheme,
          focusTheme,
          revenueGoalCents: revenueGoal ? formatCentsInput(revenueGoal) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar plano')
      setDraft(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar plano com IA')
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      const plan = await createPlan({
        year,
        title: `Planejamento ${year}`,
        revenue_goal_cents: revenueGoal ? formatCentsInput(revenueGoal) : null,
        questionnaire: { focusTheme, notes },
        ai_summary: draft.summary,
        months: draft.months,
      })
      onCreated(plan.id)
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Novo Planejamento Anual</p>
        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors"><X size={18}/></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Ano</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"/>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Meta de faturamento no ano</label>
          <input value={revenueGoal} onChange={e => setRevenueGoal(e.target.value)}
            placeholder="Ex: 500000 = R$5.000,00"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"/>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Foco/tema do ano</label>
        <textarea value={focusTheme} onChange={e => setFocusTheme(e.target.value)} rows={2}
          placeholder="Ex: crescer a comunidade Premium, lançar o VIP com foco em resultado e acompanhamento próximo"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"/>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Notas adicionais <span className="text-slate-600">(opcional)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none"/>
      </div>

      {error && <p className="flex items-center gap-2 text-sm text-rose-400"><AlertCircle size={14}/> {error}</p>}

      {!draft ? (
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
          {generating ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
          {generating ? 'Gerando…' : 'Gerar com IA'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
            <p className="text-xs font-bold text-indigo-300 mb-1">Resumo da estratégia sugerida</p>
            <p className="text-sm text-slate-300">{draft.summary}</p>
          </div>
          <p className="text-xs text-slate-500">{draft.months?.length || 0} meses sugeridos — revise item a item depois de salvar.</p>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
              {saving ? 'Salvando…' : 'Salvar Plano'}
            </button>
            <button onClick={() => setDraft(null)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-2xl transition-all">
              Gerar de novo
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Board de revisão (mês → semana → itens) ──────────────────────────────────
function PlanBoard({ planId }: { planId: string }) {
  const { plan, months, loading, error, updateItem } = useBusinessPlanDetail(planId)
  const [openMonth, setOpenMonth] = useState<number | null>(null)

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-slate-600"/></div>
  if (error || !plan) return <p className="text-rose-400 text-sm">{error || 'Plano não encontrado'}</p>

  return (
    <div className="space-y-3">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">{plan.title}</p>
          {plan.ai_summary && <p className="text-xs text-slate-400 mt-1 max-w-xl">{plan.ai_summary}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Meta do ano</p>
          <p className="text-lg font-black text-white">{formatPrice(plan.revenue_goal_cents)}</p>
        </div>
      </div>

      {months.map(month => {
        const isOpen = openMonth === month.month_number
        const allItems = [...month.items, ...month.weeks.flatMap(w => w.items)]
        const pendingCount = allItems.filter(i => i.status === 'pending_review').length
        return (
          <div key={month.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <button onClick={() => setOpenMonth(isOpen ? null : month.month_number)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-all">
              <div>
                <p className="text-sm font-bold text-white">Mês {month.month_number} — {month.theme}</p>
                {month.focus_area && <p className="text-xs text-slate-500">{month.focus_area}</p>}
              </div>
              <div className="flex items-center gap-3">
                {pendingCount > 0 && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">
                    {pendingCount} a revisar
                  </span>
                )}
                {isOpen ? <ChevronUp size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="p-4 pt-0 space-y-4">
                    {month.items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Itens do mês inteiro</p>
                        {month.items.map(item => (
                          <ItemCard key={item.id} item={item} onUpdate={updates => updateItem(item.id, updates)}/>
                        ))}
                      </div>
                    )}
                    {month.weeks.map(week => (
                      <div key={week.id} className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Semana {week.week_number} — {week.theme}
                        </p>
                        {week.items.length === 0 ? (
                          <p className="text-xs text-slate-600">Nenhum item nesta semana</p>
                        ) : week.items.map(item => (
                          <ItemCard key={item.id} item={item} onUpdate={updates => updateItem(item.id, updates)}/>
                        ))}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export function BusinessPlanView({ setView }: { setView: (v: any) => void }) {
  const { plans, loading } = useBusinessPlans()
  const [showForm, setShowForm] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">
            Planejamento <span className="font-bold">Anual</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Estratégia mês a mês e semana a semana para o Premium e o VIP, com a IA
          </p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setSelectedPlanId(null) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all shrink-0">
            <Plus size={15}/> Novo Plano
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <NewPlanForm
            onCreated={id => { setShowForm(false); setSelectedPlanId(id) }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {!showForm && selectedPlanId && (
        <div>
          <button onClick={() => setSelectedPlanId(null)}
            className="text-xs text-slate-400 hover:text-white mb-3 transition-colors">← Voltar para planos</button>
          <PlanBoard planId={selectedPlanId}/>
        </div>
      )}

      {!showForm && !selectedPlanId && (
        loading ? (
          <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-600"/></div>
        ) : plans.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
            <TrendingUp size={40} className="text-slate-700 mx-auto mb-3"/>
            <p className="text-slate-400 font-medium mb-1">Nenhum planejamento ainda</p>
            <p className="text-slate-600 text-sm mb-5">Crie o plano do ano junto com a IA — faturamento, estratégia e o que oferecer mês a mês</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 text-left hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-base font-bold text-white">{plan.title}</p>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    plan.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : plan.status === 'archived' ? 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  }`}>
                    {plan.status === 'active' ? 'Ativo' : plan.status === 'archived' ? 'Arquivado' : 'Rascunho'}
                  </span>
                </div>
                <p className="text-sm text-slate-400">Meta: {formatPrice(plan.revenue_goal_cents)}</p>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
