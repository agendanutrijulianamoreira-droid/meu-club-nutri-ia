"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Sparkles, ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  XCircle, Edit2, Calendar, Trophy, FileText, Bell, Star,
  Target, TrendingUp, Users, MessageCircle, Gift, Zap,
  ArrowRight, RefreshCw, Check, X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Screen = 'list' | 'questionnaire' | 'review'

interface QAnswers {
  main_focus: string
  patient_goal: string
  star_product: string
  past_challenges: string
  relevant_dates: string
  target_profile: string
  financial_goal: string
  comm_style: string
  upsell_products: string
  extra_notes: string
}

interface PlanItem {
  id: string
  month?: number
  item_type: 'challenge' | 'protocol' | 'promotion' | 'push_campaign' | 'special_event'
  title: string
  description?: string
  details?: Record<string, any>
  status: 'pending_review' | 'approved' | 'edited' | 'rejected' | 'pushed'
  edited_title?: string
  edited_description?: string
  owner_notes?: string
}

interface AnnualPlan {
  id: string
  year: number
  status: string
  plan_data?: {
    summary?: string
    main_theme?: string
    quarterly_highlights?: any[]
  }
  generated_at?: string
  created_at: string
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ITEM_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  challenge:    { label: 'Desafio', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  protocol:     { label: 'Protocolo', icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  promotion:    { label: 'Promoção', icon: Gift, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  push_campaign:{ label: 'Push', icon: Bell, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  special_event:{ label: 'Upsell', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
}

const STEPS = [
  { title: 'Foco Estratégico', icon: Target, fields: ['main_focus', 'patient_goal', 'financial_goal'] },
  { title: 'Produto & Método', icon: Zap, fields: ['star_product', 'upsell_products'] },
  { title: 'Público & Estilo', icon: Users, fields: ['target_profile', 'comm_style'] },
  { title: 'Calendário & Datas', icon: Calendar, fields: ['relevant_dates', 'past_challenges'] },
  { title: 'Notas Finais', icon: MessageCircle, fields: ['extra_notes'] },
]

const FIELD_CONFIG: Record<keyof QAnswers, { label: string; placeholder: string; multiline?: boolean }> = {
  main_focus:        { label: 'Qual o foco principal do ano?', placeholder: 'Ex: Emagrecimento sustentável com foco em hormônios femininos' },
  patient_goal:      { label: 'Meta de crescimento de pacientes', placeholder: 'Ex: Chegar a 50 pacientes ativas até dezembro' },
  financial_goal:    { label: 'Meta financeira', placeholder: 'Ex: R$ 15.000/mês até o Q4' },
  star_product:      { label: 'Produto ou protocolo estrela', placeholder: 'Ex: Protocolo Bio 21 dias, meu carro-chefe' },
  upsell_products:   { label: 'Produtos de upsell que planeja oferecer', placeholder: 'Ex: Consulta 1:1, Método 90 dias, Teste genético' },
  target_profile:    { label: 'Perfil do público-alvo', placeholder: 'Ex: Mulheres 30-50 anos, mães, peri-menopausa' },
  comm_style:        { label: 'Estilo de comunicação preferido', placeholder: 'Ex: Acolhedor, motivador, com doses de humor' },
  relevant_dates:    { label: 'Datas e sazonalidades relevantes', placeholder: 'Ex: Carnaval, verão, Dia das Mães, outubro rosa, natal' },
  past_challenges:   { label: 'Principais desafios do ano passado', placeholder: 'Ex: Dificuldade em reter clientes no inverno, baixo engajamento em agosto' },
  extra_notes:       { label: 'Alguma observação adicional?', placeholder: 'Ex: Quero lançar meu primeiro infoproduto em maio...', multiline: true },
}

const EMPTY_ANSWERS: QAnswers = {
  main_focus: '', patient_goal: '', star_product: '', past_challenges: '',
  relevant_dates: '', target_profile: '', financial_goal: '',
  comm_style: '', upsell_products: '', extra_notes: '',
}

export function AnnualPlannerView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
  const [screen, setScreen] = useState<Screen>('list')
  const [plans, setPlans] = useState<AnnualPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 1)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QAnswers>(EMPTY_ANSWERS)
  const [activePlan, setActivePlan] = useState<AnnualPlan | null>(null)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [savingItem, setSavingItem] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ title: '', description: '' })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/annual-plan')
      const data = await res.json()
      setPlans(Array.isArray(data) ? data : [])
    } catch { setPlans([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  const loadItems = async (planId: string) => {
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/admin/annual-plan/${planId}/items`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    finally { setLoadingItems(false) }
  }

  const openReview = async (plan: AnnualPlan) => {
    setActivePlan(plan)
    setScreen('review')
    await loadItems(plan.id)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/annual-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, questionnaire: answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadPlans()
      const allPlans = await fetch('/api/admin/annual-plan').then(r => r.json())
      const newPlan = allPlans.find((p: AnnualPlan) => p.year === selectedYear)
      if (newPlan) openReview(newPlan)
    } catch (e: any) {
      showToast('error', e.message ?? 'Erro ao gerar plano')
      setGenerating(false)
    }
  }

  const handleItemAction = async (itemId: string, status: string, extra?: { edited_title?: string; edited_description?: string }) => {
    setSavingItem(itemId)
    try {
      const res = await fetch(`/api/admin/annual-plan/${activePlan!.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status, ...extra }),
      })
      if (!res.ok) throw new Error()
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: status as any, ...extra } : i))
      setEditingItem(null)
    } catch { showToast('error', 'Erro ao salvar') }
    finally { setSavingItem(null) }
  }

  const startEdit = (item: PlanItem) => {
    setEditDraft({ title: item.edited_title ?? item.title, description: item.edited_description ?? item.description ?? '' })
    setEditingItem(item.id)
  }

  const saveEdit = (itemId: string) => {
    handleItemAction(itemId, 'edited', { edited_title: editDraft.title, edited_description: editDraft.description })
  }

  // Group items by month
  const itemsByMonth: Record<number, PlanItem[]> = items.reduce((acc: Record<number, PlanItem[]>, item: PlanItem) => {
    const key = item.month ?? 0
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<number, PlanItem[]>)

  const reviewedCount = items.filter(i => i.status !== 'pending_review').length
  const approvedCount = items.filter(i => i.status === 'approved' || i.status === 'edited').length

  const currentStepFields = STEPS[step]?.fields ?? []
  const canProceed = currentStepFields.every(f => (answers as any)[f]?.trim().length > 0)

  // ---- SCREEN: LIST ----
  if (screen === 'list') {
    return (
      <div className="space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-white">Planejamento <span className="font-bold">Anual</span></h1>
            <p className="text-slate-400 text-sm mt-1">A IA analisa seu negócio e gera um plano completo para você revisar</p>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`px-4 py-3 rounded-2xl text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create new plan card */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border border-indigo-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Gerar novo plano anual</p>
              <p className="text-slate-400 text-xs">Responda 10 perguntas e a IA gera 48+ itens para você revisar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50">
              {[new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={() => { setStep(0); setAnswers(EMPTY_ANSWERS); setScreen('questionnaire') }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
              <Sparkles className="w-4 h-4" />
              Criar plano {selectedYear}
            </button>
          </div>
        </div>

        {/* Existing plans */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
        ) : plans.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
            <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum plano gerado ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Planos existentes</p>
            {plans.map(plan => (
              <div key={plan.id} className="bg-white/5 border border-white/10 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">Plano {plan.year}</p>
                    {plan.plan_data?.main_theme && (
                      <p className="text-slate-400 text-sm mt-0.5">"{plan.plan_data.main_theme}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${plan.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : plan.status === 'in_review' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        {plan.status === 'active' ? 'Ativo' : plan.status === 'in_review' ? 'Em revisão' : 'Rascunho'}
                      </span>
                      {plan.generated_at && (
                        <span className="text-slate-600 text-xs">
                          Gerado em {new Date(plan.generated_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openReview(plan)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-2xl border border-white/10 transition-all">
                    Revisar <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- SCREEN: QUESTIONNAIRE ----
  if (screen === 'questionnaire') {
    const stepConfig = STEPS[step]
    const StepIcon = stepConfig.icon

    return (
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('list')} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-light text-white">Planejamento <span className="font-bold">{selectedYear}</span></h1>
            <p className="text-slate-400 text-sm">Etapa {step + 1} de {STEPS.length}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white/5 border border-white/10 rounded-full h-1.5 overflow-hidden">
          <motion.div className="h-full bg-indigo-500 rounded-full"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <StepIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-white font-semibold">{stepConfig.title}</p>
            </div>

            {stepConfig.fields.map(field => {
              const fc = FIELD_CONFIG[field as keyof QAnswers]
              const value = (answers as any)[field] as string
              return (
                <div key={field}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">{fc.label}</p>
                  {fc.multiline ? (
                    <textarea value={value}
                      onChange={e => setAnswers(a => ({ ...a, [field]: e.target.value }))}
                      placeholder={fc.placeholder} rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
                  ) : (
                    <input value={value}
                      onChange={e => setAnswers(a => ({ ...a, [field]: e.target.value }))}
                      placeholder={fc.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  )}
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-medium rounded-2xl border border-white/10 transition-all">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-2xl transition-all ml-auto">
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all ml-auto">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando plano...</> : <><Sparkles className="w-4 h-4" /> Gerar Plano Anual</>}
            </button>
          )}
        </div>

        {generating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3 text-center">
            <p className="text-indigo-400 text-sm font-medium">A IA está analisando seu negócio e gerando o plano...</p>
            <p className="text-slate-500 text-xs mt-1">Isso pode levar 30-60 segundos</p>
          </motion.div>
        )}
      </div>
    )
  }

  // ---- SCREEN: REVIEW ----
  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => { setScreen('list'); setActivePlan(null); setItems([]) }}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-light text-white">Revisão do <span className="font-bold">Plano {activePlan?.year}</span></h1>
          {activePlan?.plan_data?.main_theme && (
            <p className="text-slate-400 text-sm">"{activePlan.plan_data.main_theme}"</p>
          )}
        </div>
        <button onClick={() => loadItems(activePlan!.id)}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white rounded-xl hover:bg-white/5 transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`px-4 py-3 rounded-2xl text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary from AI */}
      {activePlan?.plan_data?.summary && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3">
          <p className="text-indigo-300 text-sm leading-relaxed">{activePlan.plan_data.summary}</p>
        </div>
      )}

      {/* Progress */}
      {items.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(reviewedCount / items.length) * 100}%` }} />
          </div>
          <span className="text-slate-400 text-xs whitespace-nowrap">{reviewedCount}/{items.length} revisados · {approvedCount} aprovados</span>
        </div>
      )}

      {/* Items by month */}
      {loadingItems ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(itemsByMonth)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([monthKey, monthItems]) => (
              <div key={monthKey}>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
                  {Number(monthKey) === 0 ? 'Calendário de Upsell' : MONTH_NAMES[Number(monthKey)]}
                </p>
                <div className="space-y-2">
                  {monthItems.map(item => {
                    const meta = ITEM_META[item.item_type] ?? ITEM_META.special_event
                    const Icon = meta.icon
                    const isSaving = savingItem === item.id
                    const isEditing = editingItem === item.id
                    const displayTitle = item.edited_title ?? item.title
                    const displayDesc = item.edited_description ?? item.description

                    return (
                      <div key={item.id}
                        className={`bg-white/5 border rounded-2xl p-4 transition-all ${item.status === 'approved' || item.status === 'edited' ? 'border-emerald-500/20' : item.status === 'rejected' ? 'border-rose-500/10 opacity-50' : 'border-white/10'}`}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                            <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                              rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingItem(null)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-slate-400 text-xs rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                                <X className="w-3 h-3" /> Cancelar
                              </button>
                              <button onClick={() => saveEdit(item.id)} disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Salvar edição
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                              <Icon className={`w-4 h-4 ${meta.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-white text-sm font-medium">{displayTitle}</p>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                                  {meta.label}
                                </span>
                              </div>
                              {displayDesc && <p className="text-slate-400 text-xs leading-relaxed">{displayDesc}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.status === 'pending_review' ? (
                                <>
                                  <button onClick={() => startEdit(item)} disabled={isSaving}
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleItemAction(item.id, 'rejected')} disabled={isSaving}
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-all">
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => handleItemAction(item.id, 'approved')} disabled={isSaving}
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-white/5 transition-all">
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              ) : (
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${item.status === 'approved' || item.status === 'edited' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                  {item.status === 'edited' ? 'Editado' : item.status === 'approved' ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
