"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Utensils, CheckCircle2, Clock, XCircle, RefreshCw, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, Star, ArrowRightLeft
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface MealPlan {
  id: string
  patient_id?: string
  plan_tier: string
  title: string
  start_date?: string
  end_date?: string
  total_calories?: number
  total_protein_g?: number
  total_carbs_g?: number
  total_fat_g?: number
  status: 'pending_approval' | 'approved' | 'active' | 'completed'
  approved_by?: string
  approved_at?: string
  created_by_agent?: string
  created_at: string
  updated_at: string
  profiles?: { name: string; primary_goal?: string; dietary_restrictions?: string[] }
  // Legacy fields
  description?: string
  goal?: string
  duration_days?: number
  target_kcal?: number
  is_ai_generated?: boolean
}

interface MealItem {
  id: string
  meal_plan_id: string
  day_number: number
  meal_type: string
  food_name: string
  quantity_g?: number
  quantity_description?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  notes?: string
  sort_order: number
}

interface SubstituteFood {
  id: string
  original_food: string
  substitute_food: string
  original_calories?: number
  substitute_calories?: number
  caloric_difference_pct?: number
  category?: string
  protein_preserved?: boolean
}

const MEAL_TYPES_PT: Record<string, string> = {
  cafe_manha: 'Café da Manhã',
  lanche_manha: 'Lanche da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending_approval: { label: 'Aguardando Aprovação', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', icon: Clock },
  approved: { label: 'Aprovado', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25', icon: CheckCircle2 },
  active: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', icon: Star },
  completed: { label: 'Concluído', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/25', icon: XCircle },
}

const TIER_META: Record<string, string> = {
  basic: 'Básico',
  premium: 'Premium',
  vip: 'VIP',
}

type StatusFilter = 'all' | 'pending_approval' | 'active' | 'completed'

export function MealPlansView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_approval')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [planDetail, setPlanDetail] = useState<{ items: MealItem[]; days: Record<string, Record<string, MealItem[]>> } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Substitution state
  const [substitutionItem, setSubstitutionItem] = useState<MealItem | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteFood[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/meal-plans')
      const json = await res.json()
      setPlans(json.plans || [])
    } catch {
      showToast('error', 'Erro ao carregar planos alimentares')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  const loadPlanDetail = async (planId: string) => {
    if (expandedId === planId) {
      setExpandedId(null)
      setPlanDetail(null)
      return
    }
    setExpandedId(planId)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/meal-plans/${planId}`)
      const json = await res.json()
      setPlanDetail({ items: json.items || [], days: json.days || {} })
    } catch {
      showToast('error', 'Erro ao carregar detalhes do plano')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleApprove = async (planId: string) => {
    setApproving(planId)
    try {
      const res = await fetch(`/api/admin/meal-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) throw new Error('Erro')
      showToast('success', 'Plano aprovado e ativado!')
      loadPlans()
    } catch {
      showToast('error', 'Erro ao aprovar plano')
    } finally {
      setApproving(null)
    }
  }

  const handleComplete = async (planId: string) => {
    setApproving(planId)
    try {
      const res = await fetch(`/api/admin/meal-plans/${planId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro')
      showToast('success', 'Plano marcado como concluído')
      loadPlans()
      if (expandedId === planId) { setExpandedId(null); setPlanDetail(null) }
    } catch {
      showToast('error', 'Erro ao concluir plano')
    } finally {
      setApproving(null)
    }
  }

  const loadSubstitutions = async (item: MealItem) => {
    setSubstitutionItem(item)
    setLoadingSubstitutes(true)
    setSubstitutes([])
    try {
      const params = new URLSearchParams()
      params.set('meal_item_id', item.id)
      if (item.calories) params.set('calories', String(item.calories))
      const res = await fetch(`/api/admin/meal-plans/${item.meal_plan_id}/substitutions?${params}`)
      const json = await res.json()
      setSubstitutes(json.substitutes || [])
    } catch {
      showToast('error', 'Erro ao buscar substitutos')
    } finally {
      setLoadingSubstitutes(false)
    }
  }

  const filteredPlans = plans.filter(p => {
    if (statusFilter === 'all') return true
    return p.status === statusFilter
  })

  const counts = {
    all: plans.length,
    pending_approval: plans.filter(p => p.status === 'pending_approval').length,
    active: plans.filter(p => p.status === 'active').length,
    completed: plans.filter(p => p.status === 'completed').length,
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-white">Planos <span className="font-bold">Alimentares</span></h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie e aprove planos premium gerados pela IA</p>
        </div>
        <button
          onClick={loadPlans}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white text-sm font-bold transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
        {([
          { id: 'pending_approval' as StatusFilter, label: `Pendentes (${counts.pending_approval})` },
          { id: 'active' as StatusFilter, label: `Ativos (${counts.active})` },
          { id: 'completed' as StatusFilter, label: `Concluídos (${counts.completed})` },
          { id: 'all' as StatusFilter, label: `Todos (${counts.all})` },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredPlans.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <Utensils size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-white font-bold">Nenhum plano encontrado</p>
          <p className="text-slate-500 text-sm mt-1">
            {statusFilter === 'pending_approval'
              ? 'Nenhum plano aguardando aprovação.'
              : 'Nenhum plano neste status.'}
          </p>
        </div>
      )}

      {/* Plans list */}
      <div className="space-y-3">
        {filteredPlans.map(plan => {
          const statusMeta = STATUS_META[plan.status]
          const StatusIcon = statusMeta.icon
          const isExpanded = expandedId === plan.id
          const isApproving = approving === plan.id

          return (
            <motion.div
              key={plan.id}
              layout
              className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-indigo-500/30 transition-all"
            >
              {/* Plan header */}
              <div className="flex items-start gap-4 p-5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Utensils size={18} className="text-indigo-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-white font-bold text-sm">{plan.title}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
                      <StatusIcon size={8} className="inline mr-1" />
                      {statusMeta.label}
                    </span>
                    {plan.plan_tier && plan.plan_tier !== 'basic' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400">
                        {TIER_META[plan.plan_tier] || plan.plan_tier}
                      </span>
                    )}
                    {(plan.created_by_agent || plan.is_ai_generated) && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        Gerado por IA
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {plan.profiles?.name && <span>Paciente: <span className="text-slate-300">{plan.profiles.name}</span></span>}
                    {(plan.total_calories || plan.target_kcal) && (
                      <span>{plan.total_calories || plan.target_kcal} kcal/dia</span>
                    )}
                    {plan.duration_days && <span>{plan.duration_days} dias</span>}
                    <span>{new Date(plan.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => loadPlanDetail(plan.id)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {plan.status === 'pending_approval' && (
                    <button
                      onClick={() => handleApprove(plan.id)}
                      disabled={isApproving}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Aprovar
                    </button>
                  )}

                  {plan.status === 'active' && (
                    <button
                      onClick={() => handleComplete(plan.id)}
                      disabled={isApproving}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {isApproving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Concluir
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: meal items by day */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5"
                  >
                    <div className="p-5">
                      {loadingDetail && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 size={24} className="animate-spin text-indigo-400" />
                        </div>
                      )}

                      {!loadingDetail && planDetail && (
                        <div className="space-y-5">
                          {Object.entries(planDetail.days).map(([dayNum, meals]) => {
                            const mealsTyped = meals as Record<string, MealItem[]>
                            return (
                            <div key={dayNum}>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
                                Dia {dayNum}
                              </p>
                              <div className="space-y-2">
                                {Object.entries(mealsTyped).map(([mealType, items]) => (
                                  <div key={mealType} className="bg-white/[0.03] rounded-2xl p-3 border border-white/5">
                                    <p className="text-slate-400 text-xs font-bold mb-2">
                                      {MEAL_TYPES_PT[mealType] || mealType}
                                    </p>
                                    <div className="space-y-1.5">
                                      {(items as MealItem[]).map(item => (
                                        <div key={item.id} className="flex items-center justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm">{item.food_name}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                              {(item.quantity_description || item.quantity_g) && (
                                                <span>{item.quantity_description || `${item.quantity_g}g`}</span>
                                              )}
                                              {item.calories && <span>{Math.round(item.calories)} kcal</span>}
                                              {item.protein_g && <span>{Math.round(item.protein_g)}g prot</span>}
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => loadSubstitutions(item)}
                                            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-[9px] font-black uppercase rounded-lg transition-all flex-shrink-0"
                                          >
                                            <ArrowRightLeft size={9} />
                                            Substituir
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            )
                          })}

                          {Object.keys(planDetail.days).length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">
                              Nenhum item detalhado neste plano.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Substitution modal */}
      <AnimatePresence>
        {substitutionItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setSubstitutionItem(null); setSubstitutes([]) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-white font-bold text-lg mb-1">Substituições</h2>
              <p className="text-slate-400 text-sm mb-5">
                Alternativas para: <span className="text-white font-bold">{substitutionItem.food_name}</span>
              </p>

              {loadingSubstitutes && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
              )}

              {!loadingSubstitutes && substitutes.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">Nenhum substituto encontrado para este alimento.</p>
                </div>
              )}

              <div className="space-y-2">
                {substitutes.map(sub => (
                  <div key={sub.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">{sub.substitute_food}</p>
                      {sub.substitute_calories && (
                        <p className="text-slate-500 text-xs">{sub.substitute_calories} kcal/100g</p>
                      )}
                    </div>
                    {sub.caloric_difference_pct !== undefined && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-xl ${
                        sub.caloric_difference_pct < 0
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {sub.caloric_difference_pct > 0 ? '+' : ''}{sub.caloric_difference_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setSubstitutionItem(null); setSubstitutes([]) }}
                className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-sm font-bold hover:text-white transition-all"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
