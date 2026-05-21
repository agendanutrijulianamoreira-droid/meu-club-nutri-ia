"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Sparkles, ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  XCircle, Edit2, Calendar, Trophy, FileText, Bell, Star,
  Target, TrendingUp, Users, MessageCircle, Gift, Zap,
  ArrowRight, RefreshCw, Check, X, Send,
  Megaphone, Lightbulb, Edit3, Save,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { StrategicPlannerView } from "./StrategicPlannerView"
import { ContentPlannerView } from "./ContentPlannerView"

type PlannerTab = 'anual' | 'calendario' | 'regua' | 'estrategico'
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

// ─── Strategic Plan types (product-gateway) ───────────────────────────────────

interface Campaign    { title: string; channel: string; week: number }
interface Challenge   { title: string; duration_days: number; xp_reward: number }
interface Protocol    { title: string; category: string }
interface ContentIdea { title: string; type: string; platform: string }

interface PlanMonth {
  id: string
  month_number: number
  theme: string
  focus_area: string | null
  campaigns: Campaign[]
  challenges: Challenge[]
  protocols: Protocol[]
  content_ideas: ContentIdea[]
  target_checkins: number | null
  target_new_members: number | null
  notes: string | null
}

interface StrategicPlan {
  id: string
  year: number
  title: string
  summary: string
  goals: Array<{ goal: string; metric: string; target: string }>
  is_ai_generated: boolean
  months: PlanMonth[]
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

const FOCUS_COLORS: Record<string, string> = {
  'hidratação':    'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'hormônios':     'text-pink-400 bg-pink-500/10 border-pink-500/20',
  'intestino':     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'emagrecimento': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'mental':        'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'imunidade':     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'detox':         'text-teal-400 bg-teal-500/10 border-teal-500/20',
  'default':       'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
}

const CHANNEL_ICONS: Record<string, string> = {
  push: '📲', email: '📧', feed: '📱', whatsapp: '💬',
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
  const [plannerTab, setPlannerTab] = useState<PlannerTab>('anual')
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
  const [pushingItem, setPushingItem] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ title: '', description: '' })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Strategic plan state (product-gateway)
  const currentYear = new Date().getFullYear()
  const [strategicPlan, setStrategicPlan] = useState<StrategicPlan | null>(null)
  const [strategicLoading, setStrategicLoading] = useState(false)
  const [strategicGenerating, setStrategicGenerating] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)
  const [editingMonthId, setEditingMonthId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [context, setContext] = useState('')
  const [showContextInput, setShowContextInput] = useState(false)
  const [strategicYear, setStrategicYear] = useState(currentYear)

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
    } finally {
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

  const handlePushToSystem = async (itemId: string) => {
    if (!activePlan) return
    setPushingItem(itemId)
    try {
      const res = await fetch(`/api/admin/annual-plan/${activePlan.id}/items/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar')
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'pushed' } : i))
      showToast('success', `Item enviado para o sistema! (${data.result?.type ?? 'ok'})`)
    } catch (e: any) {
      showToast('error', e.message ?? 'Erro ao enviar para o sistema')
    } finally {
      setPushingItem(null)
    }
  }

  // ─── Strategic plan handlers (product-gateway) ──────────────────────────────

  const fetchStrategicPlan = useCallback(async () => {
    setStrategicLoading(true)
    try {
      const res = await fetch(`/api/admin/strategic-plan?year=${strategicYear}`)
      const data = await res.json()
      setStrategicPlan(data.plan || null)
    } finally {
      setStrategicLoading(false)
    }
  }, [strategicYear])

  useEffect(() => {
    if (plannerTab === 'estrategico') fetchStrategicPlan()
  }, [plannerTab, fetchStrategicPlan])

  async function handleGenerateStrategic() {
    setStrategicGenerating(true)
    try {
      const res = await fetch('/api/admin/strategic-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', year: strategicYear, context: context.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStrategicPlan(data.plan)
      setShowContextInput(false)
      setContext('')
      showToast('success', `Plano ${strategicYear} gerado com sucesso!`)
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao gerar plano')
    } finally {
      setStrategicGenerating(false)
    }
  }

  async function handleSaveNotes(monthId: string) {
    setSavingNotes(true)
    try {
      const res = await fetch('/api/admin/strategic-plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_id: monthId, updates: { notes: editingNotes } }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setStrategicPlan(prev => prev ? {
        ...prev,
        months: prev.months.map(m => m.id === monthId ? { ...m, notes: editingNotes } : m),
      } : prev)
      setEditingMonthId(null)
      showToast('success', 'Anotação salva!')
    } catch {
      showToast('error', 'Erro ao salvar anotação')
    } finally {
      setSavingNotes(false)
    }
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
            <h1 className="text-3xl font-light text-white">Planejador <span className="font-bold">do Clube</span></h1>
            <p className="text-slate-400 text-sm mt-1">Planejamento anual, calendário de conteúdo e régua de eventos</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
          {[
            { id: 'anual' as PlannerTab, label: 'Plano Anual IA' },
            { id: 'estrategico' as PlannerTab, label: 'Plano Estratégico' },
            { id: 'calendario' as PlannerTab, label: 'Calendário de Conteúdo' },
            { id: 'regua' as PlannerTab, label: 'Régua de Eventos' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setPlannerTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${plannerTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {plannerTab === 'regua' && <StrategicPlannerView setView={setView} />}
        {plannerTab === 'calendario' && <ContentPlannerView />}

        {/* ─── ESTRATÉGICO TAB (product-gateway) ─────────────────────────── */}
        {plannerTab === 'estrategico' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-slate-400 text-sm mt-1">Planejamento estratégico por mês — temas, campanhas e metas</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <button key={y} onClick={() => setStrategicYear(y)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${strategicYear === y ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {y}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowContextInput(!showContextInput)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                  <Sparkles className="w-4 h-4" />
                  {strategicPlan ? 'Regenerar' : 'Gerar com IA'}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  {toast.msg}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showContextInput && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    Contexto adicional para a IA (opcional)
                  </p>
                  <textarea value={context} onChange={e => setContext(e.target.value)}
                    placeholder="Ex: Vamos lançar um produto novo em maio. Temos parceria com academia local..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50"
                    rows={3} />
                  <div className="flex items-center gap-2">
                    <button onClick={handleGenerateStrategic} disabled={strategicGenerating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all">
                      {strategicGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {strategicGenerating ? 'Gerando plano...' : `Gerar Plano ${strategicYear}`}
                    </button>
                    <button onClick={() => setShowContextInput(false)} className="text-slate-400 hover:text-white text-sm px-3 py-2">
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {strategicLoading && (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Carregando plano...</span>
              </div>
            )}

            {!strategicLoading && !strategicPlan && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Nenhum plano para {strategicYear}</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-sm">
                    Gere um plano estratégico anual com IA — temas mensais, campanhas, desafios e metas personalizadas.
                  </p>
                </div>
                <button onClick={() => setShowContextInput(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                  <Sparkles className="w-4 h-4" />
                  Gerar Plano {strategicYear} com IA
                </button>
              </div>
            )}

            {!strategicLoading && strategicPlan && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-indigo-500/20 rounded-3xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400">
                          {strategicPlan.is_ai_generated ? '✨ IA' : 'Manual'}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{strategicPlan.year}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white">{strategicPlan.title}</h2>
                      {strategicPlan.summary && <p className="text-slate-400 text-sm mt-2 leading-relaxed">{strategicPlan.summary}</p>}
                    </div>
                    <button onClick={handleGenerateStrategic} disabled={strategicGenerating} title="Regenerar plano"
                      className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs rounded-xl transition-all disabled:opacity-50">
                      {strategicGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Regenerar
                    </button>
                  </div>
                  {strategicPlan.goals && strategicPlan.goals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Metas Anuais</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {strategicPlan.goals.map((g, i) => (
                          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-xs text-slate-400">{g.metric}</span>
                            </div>
                            <p className="text-white text-sm font-medium">{g.goal}</p>
                            <p className="text-emerald-400 text-xs font-bold mt-1">Meta: {g.target}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {strategicPlan.months.map(month => {
                    const focusKey = month.focus_area?.toLowerCase() || ''
                    const focusColor = FOCUS_COLORS[focusKey] || FOCUS_COLORS['default']
                    const isCurrent = month.month_number === (strategicYear === currentYear ? new Date().getMonth() + 1 : null)
                    return (
                      <button key={month.month_number}
                        onClick={() => setExpandedMonth(expandedMonth === month.month_number ? null : month.month_number)}
                        className={`bg-white/5 border rounded-2xl p-3 text-left transition-all hover:border-indigo-500/30 ${isCurrent ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/10'} ${expandedMonth === month.month_number ? 'border-indigo-500/50' : ''}`}>
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">
                          {MONTH_NAMES[month.month_number].slice(0, 3)}
                          {isCurrent && <span className="ml-1 text-indigo-400">●</span>}
                        </p>
                        <p className="text-xs text-white font-medium leading-tight">{month.theme}</p>
                        {month.focus_area && (
                          <span className={`mt-1.5 inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${focusColor}`}>
                            {month.focus_area}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <AnimatePresence>
                  {expandedMonth !== null && (() => {
                    const month = strategicPlan.months.find(m => m.month_number === expandedMonth)
                    if (!month) return null
                    const focusKey = month.focus_area?.toLowerCase() || ''
                    const focusColor = FOCUS_COLORS[focusKey] || FOCUS_COLORS['default']
                    return (
                      <motion.div key={expandedMonth} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                {MONTH_NAMES[month.month_number]} {strategicPlan.year}
                              </p>
                              {month.focus_area && (
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${focusColor}`}>
                                  {month.focus_area}
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold text-white">{month.theme}</h3>
                          </div>
                          <button onClick={() => setExpandedMonth(null)} className="text-slate-500 hover:text-white p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {month.campaigns && month.campaigns.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                                <Megaphone className="w-3 h-3" /> Campanhas
                              </p>
                              <div className="space-y-2">
                                {month.campaigns.map((c, i) => (
                                  <div key={i} className="text-xs">
                                    <span className="text-slate-400">{CHANNEL_ICONS[c.channel] || '📢'}</span>
                                    <span className="text-white ml-1">{c.title}</span>
                                    <span className="text-slate-600 ml-1">· sem {c.week}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {month.challenges && month.challenges.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                                <Trophy className="w-3 h-3" /> Desafios
                              </p>
                              <div className="space-y-2">
                                {month.challenges.map((c, i) => (
                                  <div key={i} className="text-xs">
                                    <p className="text-white">{c.title}</p>
                                    <p className="text-slate-500">{c.duration_days}d · {c.xp_reward} XP</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {month.protocols && month.protocols.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Protocolos
                              </p>
                              <div className="space-y-2">
                                {month.protocols.map((p, i) => (
                                  <div key={i} className="text-xs">
                                    <p className="text-white">{p.title}</p>
                                    <p className="text-slate-500 capitalize">{p.category}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {month.content_ideas && month.content_ideas.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3" /> Conteúdo
                              </p>
                              <div className="space-y-2">
                                {month.content_ideas.map((c, i) => (
                                  <div key={i} className="text-xs">
                                    <p className="text-white">{c.title}</p>
                                    <p className="text-slate-500 capitalize">{c.type} · {c.platform}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-white/10 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Anotações</p>
                            {editingMonthId !== month.id ? (
                              <button onClick={() => { setEditingMonthId(month.id); setEditingNotes(month.notes || '') }}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                                <Edit3 className="w-3 h-3" /> Editar
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleSaveNotes(month.id)} disabled={savingNotes}
                                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  Salvar
                                </button>
                                <button onClick={() => setEditingMonthId(null)} className="text-xs text-slate-500 hover:text-white">
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                          {editingMonthId === month.id ? (
                            <textarea value={editingNotes} onChange={e => setEditingNotes(e.target.value)}
                              placeholder="Adicione observações, lembretes ou ajustes para este mês..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50"
                              rows={3} />
                          ) : (
                            <p className={`text-sm leading-relaxed ${month.notes ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                              {month.notes || 'Nenhuma anotação. Clique em Editar para adicionar.'}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })()}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {plannerTab !== 'anual' ? null : (<>

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
        </>)}
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
                              {item.status === 'pushed' ? (
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                                  No sistema
                                </span>
                              ) : item.status === 'pending_review' ? (
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
                              ) : (item.status === 'approved' || item.status === 'edited') ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                                    {item.status === 'edited' ? 'Editado' : '✓'}
                                  </span>
                                  <button onClick={() => handlePushToSystem(item.id)} disabled={pushingItem === item.id}
                                    title="Enviar para o sistema"
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-xl hover:bg-indigo-500/10 transition-all">
                                    {pushingItem === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/20 text-rose-400">✗</span>
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
