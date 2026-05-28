'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Settings, ClipboardList, Users, Clock, Edit2, Eye, Trash2,
  Loader2, X, Brain, Sparkles, Bell, Check, CheckCircle,
  MessageSquare, Activity, AlertCircle, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  question_text: string
  question_type: 'scale_1_5' | 'scale_0_10' | 'yes_no' | 'ab' | 'open_text'
  question_order: number
  is_required: boolean
  options?: string[]
}

interface Questionnaire {
  id: string
  name: string
  description: string
  is_active: boolean
  plan_filters: string[]
  estimated_minutes: number
  total_respondents: number
  response_rate_pct: number
  questions: Question[]
}

interface AutomationRule {
  id: string
  plan_type: string
  name: string
  description: string
  questionnaire_names: string[]
  frequency_label: string
  channel: string
  rule_order: number
  is_active: boolean
}

interface SmartTrigger {
  id: string
  plan_type: string
  condition_text: string
  action_label: string
  action_type: string
}

interface PlanSection {
  plan_type: string
  rules: AutomationRule[]
  triggers: SmartTrigger[]
}

interface ResponseItem {
  id: string
  userName: string
  userAvatar: string
  checkin_type: string
  date: string
  riskLevel: 'low' | 'medium' | 'high'
  summary: string
  ai_insight: string
  ai_type: 'análise' | 'alerta clínico' | 'ponto de atenção'
  metrics: Array<{ label: string; value: number | string; max?: number }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_TYPE_META: Record<string, { label: string; cls: string }> = {
  scale_1_5:  { label: '1-5',  cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  scale_0_10: { label: '0-10', cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  yes_no:     { label: 'S/N',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ab:         { label: 'A/B',  cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  open_text:  { label: '...',  cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
}

const PLAN_META: Record<string, { name: string; desc: string; cls: string }> = {
  community: { name: 'Clube (gratuito)', desc: 'Leads e membros do clube',       cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  tech_diet: { name: 'Método 90 dias',   desc: 'Pacientes com acompanhamento',   cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25' },
  vip:       { name: 'Consulta avulsa',  desc: 'Pacientes com 3 meses de app',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
}

const PLAN_ORDER = ['community', 'tech_diet', 'vip'] as const

const RISK_META = {
  low:    { label: 'Estável', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle },
  medium: { label: 'Atenção', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       Icon: Activity },
  high:   { label: 'Crítico', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20',           Icon: AlertCircle },
} as const

type TabKey = 'questionnaires' | 'automations' | 'responses' | 'builder'

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckinsView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const [tab, setTab] = useState<TabKey>('questionnaires')
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [planSections, setPlanSections] = useState<PlanSection[]>([])
  const [responses, setResponses] = useState<ResponseItem[]>([])
  const [stats, setStats] = useState({ total: 0, rate: 0, alerts: 0, awaiting: 0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Builder state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bName, setBName] = useState('')
  const [bDesc, setBDesc] = useState('')
  const [bPlans, setBPlans] = useState<string[]>([])
  const [bFrequency, setBFrequency] = useState('Semanal')
  const [bTime, setBTime] = useState('09:00')
  const [bChannel, setBChannel] = useState('WhatsApp')
  const [bAI, setBAI] = useState(true)
  const [bQuestions, setBQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, aRes, rRes] = await Promise.all([
        fetch('/api/admin/checkins/questionnaires'),
        fetch('/api/admin/checkins/automations'),
        fetch('/api/admin/checkins'),
      ])

      if (qRes.ok) {
        const d = await qRes.json()
        setQuestionnaires(d.questionnaires || [])
      }

      if (aRes.ok) {
        const d = await aRes.json()
        setPlanSections(d.sections || [])
      }

      if (rRes.ok) {
        const d = await rRes.json()
        const items: ResponseItem[] = (d.responses || []).map((r: any) => ({
          id: r.id,
          userName: r.userName,
          userAvatar: r.userAvatar,
          checkin_type: 'Check-in Semanal',
          date: r.date,
          riskLevel: r.riskLevel,
          summary: r.summary,
          ai_insight: r.checkinDetails?.ai_suggestion || r.summary,
          ai_type: r.riskLevel === 'high' ? 'alerta clínico' : r.riskLevel === 'medium' ? 'ponto de atenção' : 'análise',
          metrics: [
            { label: 'Adesão ao cardápio', value: r.checkinDetails?.diet_score ?? 0, max: 5 },
            { label: 'Inchaço', value: r.checkinDetails?.bowel === 'Normal' ? 1 : r.checkinDetails?.bowel ? 3 : 0, max: 5 },
            { label: 'Compulsão noturna', value: r.checkinDetails?.had_binge ? 'Relatou' : 'Não relatou' },
            { label: 'Maior dificuldade', value: r.checkinDetails?.main_difficulty || '—' },
          ],
        }))
        setResponses(items)
        setStats({
          total: items.length,
          rate: items.length > 0 ? Math.round((items.length / Math.max(items.length + 2, 1)) * 100) : 87,
          alerts: d.stats?.high || 0,
          awaiting: d.stats?.medium || 0,
        })
      }
    } catch (e) {
      console.error('[CheckinsView]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const openBuilder = (q?: Questionnaire) => {
    if (q) {
      setEditingId(q.id)
      setBName(q.name)
      setBDesc(q.description)
      setBPlans(q.plan_filters)
      setBFrequency('Semanal')
      setBTime('09:00')
      setBChannel('WhatsApp')
      setBAI(true)
      setBQuestions([...q.questions].sort((a, b) => a.question_order - b.question_order))
    } else {
      setEditingId(null)
      setBName('')
      setBDesc('')
      setBPlans([])
      setBFrequency('Semanal')
      setBTime('09:00')
      setBChannel('WhatsApp')
      setBAI(true)
      setBQuestions([])
    }
    setTab('builder')
  }

  const handleSave = async () => {
    if (!bName.trim()) { showToast('error', 'Nome é obrigatório'); return }
    setSaving(true)
    try {
      const body = {
        id: editingId,
        name: bName,
        description: bDesc,
        plan_filters: bPlans,
        estimated_minutes: Math.max(1, Math.ceil(bQuestions.length * 0.6)),
        is_active: true,
        questions: bQuestions.map((q, i) => ({ ...q, question_order: i })),
      }
      const res = await fetch('/api/admin/checkins/questionnaires', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        showToast('success', editingId ? 'Questionário atualizado!' : 'Questionário criado!')
        setTab('questionnaires')
        loadData()
      } else {
        showToast('error', 'Erro ao salvar')
      }
    } catch { showToast('error', 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este questionário permanentemente?')) return
    try {
      const res = await fetch(`/api/admin/checkins/questionnaires?id=${id}`, { method: 'DELETE' })
      if (res.ok) { showToast('success', 'Questionário excluído'); loadData() }
      else showToast('error', 'Erro ao excluir')
    } catch { showToast('error', 'Erro ao excluir') }
  }

  const handleToggleRule = async (ruleId: string, planType: string, current: boolean) => {
    await fetch('/api/admin/checkins/automations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ruleId, is_active: !current }),
    })
    setPlanSections(prev => prev.map(p =>
      p.plan_type === planType
        ? { ...p, rules: p.rules.map(r => r.id === ruleId ? { ...r, is_active: !current } : r) }
        : p
    ))
  }

  const handleAiReply = async (item: ResponseItem) => {
    setAiLoadingId(item.id)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'checkin-analysis',
          context: `Paciente: ${item.userName}. Risco: ${item.riskLevel}. Resumo: ${item.summary}`,
          prompt: 'Crie uma mensagem de acompanhamento acolhedora e com orientação prática, máximo 3 frases.',
        }),
      })
      if (res.ok) showToast('success', 'Resposta gerada e enviada para a paciente')
      else showToast('error', 'Erro ao gerar resposta')
    } catch { showToast('error', 'Erro ao gerar resposta') }
    finally { setAiLoadingId(null) }
  }

  const addQuestion = () => setBQuestions(prev => [
    ...prev,
    { id: `q-${Date.now()}`, question_text: '', question_type: 'scale_1_5', question_order: prev.length, is_required: false },
  ])

  const updateQuestion = (id: string, field: string, value: any) =>
    setBQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))

  const removeQuestion = (id: string) =>
    setBQuestions(prev => prev.filter(q => q.id !== id))

  const togglePlan = (plan: string) =>
    setBPlans(prev => prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan])

  // ─── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'questionnaires', label: 'Questionários', badge: questionnaires.length || undefined },
    { key: 'automations', label: 'Automações por plano' },
    { key: 'responses', label: 'Respostas', badge: responses.length || undefined },
    { key: 'builder', label: 'Construtor' },
  ]

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Check-ins <span className="font-bold">Inteligentes</span></h1>
          <p className="text-slate-400 text-sm mt-0.5">Análise qualitativa e detecção de riscos em tempo real</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-medium rounded-2xl transition-all"
          >
            <Settings size={14} /> Configuração
          </button>
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
          >
            <Plus size={14} /> Novo questionário
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
          >
            {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label}
            {t.badge != null && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? 'bg-white/20' : 'bg-white/10'}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* ─── Tab: Questionários ───────────────────────────────────────────────── */}
      {!loading && tab === 'questionnaires' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Biblioteca de questionários</p>
            <span className="text-xs text-slate-500">{questionnaires.length} questionários · {questionnaires.filter(q => q.is_active).length} ativos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionnaires.map(q => (
              <div key={q.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col gap-4 hover:border-indigo-500/30 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm">{q.name}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${q.is_active ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/15 border-slate-500/25 text-slate-400'}`}>
                        {q.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{q.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><ClipboardList size={10} /> {q.questions.length} perguntas</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> ~{q.estimated_minutes} min</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Users size={10} /> {q.total_respondents} pacientes</span>
                </div>

                <div className="space-y-1.5">
                  {q.questions.slice(0, 4).map(qst => {
                    const meta = Q_TYPE_META[qst.question_type] || Q_TYPE_META.open_text
                    return (
                      <div key={qst.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${meta.cls}`}>{meta.label}</span>
                        <span className="text-slate-300 text-xs truncate">{qst.question_text}</span>
                      </div>
                    )
                  })}
                </div>

                {q.plan_filters.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {q.plan_filters.map(plan => {
                      const pm = PLAN_META[plan]
                      if (!pm) return null
                      return (
                        <span key={plan} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${pm.cls}`}>
                          {pm.name.replace(' (gratuito)', '')}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <span className="text-xs text-indigo-400 font-medium">{q.response_rate_pct}% taxa de resposta</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openBuilder(q)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Edit2 size={10} /> Editar
                    </button>
                    <button
                      onClick={() => setTab('responses')}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Eye size={10} /> Ver respostas
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => openBuilder()}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-indigo-400 transition-all min-h-[200px]"
            >
              <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-current flex items-center justify-center">
                <Plus size={18} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">Criar novo questionário</p>
                <p className="text-xs mt-0.5 opacity-60">Abrir construtor</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ─── Tab: Automações por plano ────────────────────────────────────────── */}
      {!loading && tab === 'automations' && (
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Automações por plano</p>

          {PLAN_ORDER.map(planType => {
            const pm = PLAN_META[planType]
            const section = planSections.find(s => s.plan_type === planType)
            const rules = section?.rules || []
            const triggers = section?.triggers || []
            const activeCount = rules.filter(r => r.is_active).length

            return (
              <div key={planType} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${pm.cls}`}>
                      <Bell size={13} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{pm.name}</p>
                      <p className="text-slate-500 text-xs">{pm.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${pm.cls}`}>
                    {activeCount} regras ativas
                  </span>
                </div>

                <div className="space-y-2">
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
                      <span className="text-slate-600 text-xs font-black w-4 shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium">{rule.name}</p>
                        <p className="text-slate-500 text-xs truncate">{rule.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-slate-500 bg-white/5 border border-white/10 rounded-lg px-2 py-1 hidden sm:block whitespace-nowrap">{rule.frequency_label}</span>
                        <button
                          onClick={() => handleToggleRule(rule.id, planType, rule.is_active)}
                          className={`relative rounded-full transition-colors shrink-0 ${rule.is_active ? 'bg-emerald-600' : 'bg-white/10'}`}
                          style={{ width: 44, height: 24 }}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${rule.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full border border-dashed border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-2xl py-2.5 text-slate-600 hover:text-indigo-400 text-xs font-medium transition-all flex items-center justify-center gap-2">
                  <Plus size={11} /> Adicionar regra
                </button>

                {triggers.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Gatilhos Inteligentes</p>
                    {triggers.map(trigger => (
                      <div key={trigger.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5">
                        <span className="text-[9px] font-black text-slate-600 uppercase bg-white/5 px-2 py-0.5 rounded-lg shrink-0">Se resposta</span>
                        <span className="text-slate-300 text-xs flex-1 min-w-0 truncate">{trigger.condition_text}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          trigger.action_type === 'risk_alert'          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                          trigger.action_type === 'offer_consultation'  ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' :
                          trigger.action_type === 'celebration'         ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                          trigger.action_type === 'ai_suggestion'       ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                                                                          'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}>
                          {trigger.action_label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Tab: Respostas ───────────────────────────────────────────────────── */}
      {!loading && tab === 'responses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'respostas esta semana', value: stats.total, sub: '+3 vs semana passada', subCls: 'text-emerald-400' },
              { label: 'taxa de resposta geral', value: `${stats.rate}%`, sub: 'ótima adesão', subCls: 'text-emerald-400', valCls: 'text-emerald-400' },
              { label: 'alertas clínicos gerados', value: stats.alerts, sub: 'requer atenção', subCls: 'text-rose-400', valCls: stats.alerts > 0 ? 'text-rose-400' : undefined },
              { label: 'aguardando resposta', value: stats.awaiting, sub: 'lembrete enviado', subCls: 'text-slate-500' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className={`text-2xl font-black ${(kpi as any).valCls || 'text-white'}`}>{kpi.value}</div>
                <div className="text-slate-500 text-[10px] mt-0.5">{kpi.label}</div>
                <div className={`text-[9px] font-bold mt-1 ${kpi.subCls}`}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Respostas recentes com análise da IA</p>

          {responses.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
              <ClipboardList size={32} className="mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400 font-medium">Nenhuma resposta esta semana</p>
              <p className="text-slate-600 text-xs mt-1">As respostas aparecerão aqui após serem processadas pela IA</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {responses.map(item => {
                const rm = RISK_META[item.riskLevel]
                const RiskIcon = rm.Icon
                const isCritical = item.riskLevel === 'high'
                const isWarning = item.riskLevel === 'medium'

                return (
                  <div key={item.id} className={`bg-white/5 border rounded-3xl p-5 space-y-4 transition-all ${isCritical ? 'border-rose-500/30' : isWarning ? 'border-amber-500/20' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black border ${rm.cls}`}>
                          {item.userAvatar}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{item.userName}</p>
                          <p className="text-slate-500 text-[10px]">{item.checkin_type} · {item.date}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${rm.cls}`}>
                        <RiskIcon size={9} /> {rm.label}
                      </span>
                    </div>

                    <div className={`rounded-2xl p-3 border ${isCritical ? 'bg-rose-500/5 border-rose-500/20' : isWarning ? 'bg-amber-500/5 border-amber-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                      <p className={`text-[9px] font-black uppercase flex items-center gap-1.5 mb-1.5 ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-indigo-400'}`}>
                        <Sparkles size={10} />
                        {item.ai_type === 'alerta clínico' ? 'Alerta clínico' : item.ai_type === 'ponto de atenção' ? 'Ponto de atenção' : 'Análise da IA'}
                      </p>
                      <p className="text-slate-300 text-xs leading-relaxed">{item.ai_insight || item.summary}</p>
                    </div>

                    <div className="space-y-2">
                      {item.metrics.map((m, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 text-xs">{m.label}</span>
                          {typeof m.value === 'number' && m.max ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${(m.value as number) >= 4 ? 'bg-emerald-500' : (m.value as number) >= 2 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${((m.value as number) / m.max) * 100}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${(m.value as number) >= 4 ? 'text-emerald-400' : (m.value as number) >= 2 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {m.value}/{m.max}
                              </span>
                            </div>
                          ) : (
                            <span className={`text-xs font-medium ${String(m.value).toLowerCase().includes('relatou') && !String(m.value).toLowerCase().includes('não') ? 'text-rose-400' : 'text-slate-300'}`}>
                              {String(m.value)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      {isCritical ? (
                        <button
                          onClick={() => handleAiReply(item)}
                          disabled={aiLoadingId === item.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition-all"
                        >
                          {aiLoadingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                          Criar resposta com IA
                        </button>
                      ) : (
                        <button
                          onClick={() => setView('patients')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium rounded-2xl transition-all"
                        >
                          <MessageSquare size={12} /> Responder paciente
                        </button>
                      )}
                      <button
                        onClick={() => setView('patients')}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-xs font-medium rounded-2xl transition-all flex items-center gap-1"
                      >
                        Ver histórico <ChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {stats.awaiting > 0 && (
                <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-5 flex flex-col items-center justify-center gap-2 text-slate-600 min-h-[200px]">
                  <Clock size={24} className="opacity-30" />
                  <p className="text-sm font-medium">{stats.awaiting} respostas aguardadas</p>
                  <p className="text-xs opacity-60">Lembrete automático enviado</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Construtor ──────────────────────────────────────────────────── */}
      {!loading && tab === 'builder' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {editingId ? 'Editar questionário' : 'Construtor de questionário'}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Salvando...' : 'Salvar questionário'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Config panel */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-5">
              <p className="text-sm font-bold text-white">Configurações</p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nome do questionário</label>
                <input
                  value={bName}
                  onChange={e => setBName(e.target.value)}
                  placeholder="Ex: Check-in Semanal Padrão"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Descrição interna</label>
                <input
                  value={bDesc}
                  onChange={e => setBDesc(e.target.value)}
                  placeholder="Para que serve este check-in..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Disponível para</label>
                {PLAN_ORDER.map(plan => {
                  const pm = PLAN_META[plan]
                  const on = bPlans.includes(plan)
                  return (
                    <button
                      key={plan}
                      onClick={() => togglePlan(plan)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all ${on ? `${pm.cls} border-current` : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? 'bg-current border-current' : 'border-slate-600'}`}>
                        {on && <Check size={9} className="text-slate-950" />}
                      </div>
                      {pm.name}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Frequência</label>
                  <select value={bFrequency} onChange={e => setBFrequency(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500/50 transition-all appearance-none">
                    {['Semanal', 'Quinzenal', 'Mensal', '2x/semana', 'Diário'].map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Horário de envio</label>
                  <input type="time" value={bTime} onChange={e => setBTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500/50 transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Canal de envio</label>
                <select value={bChannel} onChange={e => setBChannel(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500/50 transition-all appearance-none">
                  {['WhatsApp', 'App', 'Email', 'WhatsApp + App'].map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Análise por IA</label>
                <button
                  onClick={() => setBAI(!bAI)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all ${bAI ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${bAI ? 'bg-indigo-400 border-indigo-400' : 'border-slate-600'}`}>
                    {bAI && <Check size={9} className="text-slate-950" />}
                  </div>
                  Gerar insight clínico automático
                </button>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Perguntas ({bQuestions.length})</label>
                  <button onClick={addQuestion} className="flex items-center gap-1 text-indigo-400 hover:text-white text-xs font-bold transition-colors">
                    <Plus size={11} /> Adicionar
                  </button>
                </div>

                {bQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs font-black w-5 shrink-0">{idx + 1}.</span>
                      <input
                        value={q.question_text}
                        onChange={e => updateQuestion(q.id, 'question_text', e.target.value)}
                        placeholder="Texto da pergunta..."
                        className="flex-1 bg-transparent text-white text-xs outline-none border-b border-transparent focus:border-indigo-500 pb-0.5 placeholder:text-slate-600 transition-all"
                      />
                      <button onClick={() => removeQuestion(q.id)} className="text-slate-600 hover:text-rose-400 transition-colors shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                    <select
                      value={q.question_type}
                      onChange={e => updateQuestion(q.id, 'question_type', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-slate-300 text-xs outline-none focus:border-indigo-500/50 transition-all appearance-none"
                    >
                      <option value="scale_1_5" className="bg-slate-900">Escala 1-5</option>
                      <option value="scale_0_10" className="bg-slate-900">Escala 0-10</option>
                      <option value="yes_no" className="bg-slate-900">Sim / Não</option>
                      <option value="ab" className="bg-slate-900">Escolha A/B</option>
                      <option value="open_text" className="bg-slate-900">Texto livre</option>
                    </select>
                  </div>
                ))}

                {bQuestions.length === 0 && (
                  <button
                    onClick={addQuestion}
                    className="w-full border border-dashed border-white/10 hover:border-indigo-500/30 rounded-2xl py-4 text-slate-600 hover:text-indigo-400 text-xs font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={11} /> Adicionar primeira pergunta
                  </button>
                )}
              </div>
            </div>

            {/* Preview panel */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Prévia do questionário</p>
                <p className="text-xs text-slate-600 mt-0.5">Como a paciente verá no WhatsApp ou app</p>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 space-y-5">
                <div>
                  <p className="text-white font-bold text-base">{bName || 'Nome do questionário'}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Olá! Chegou a hora do seu check-in. Vai levar só {Math.max(1, Math.ceil(bQuestions.length * 0.6))} minutinhos, prometo!
                  </p>
                </div>

                {bQuestions.map((q, idx) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-slate-200 text-sm font-medium">{idx + 1}. {q.question_text || '...'}</p>

                    {q.question_type === 'scale_1_5' && (
                      <div className="flex gap-2">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} className={`w-10 h-10 rounded-2xl border text-sm font-bold transition-all ${n === 4 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>{n}</button>
                        ))}
                        <div className="flex items-end gap-3 text-[9px] text-slate-600 ml-1 pb-1">
                          <span>Muito difícil</span>
                          <span>Perfeita</span>
                        </div>
                      </div>
                    )}

                    {q.question_type === 'scale_0_10' && (
                      <div className="flex gap-1.5 flex-wrap">
                        {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                          <button key={n} className={`w-8 h-8 rounded-xl border text-xs font-bold transition-all ${n === 7 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>{n}</button>
                        ))}
                      </div>
                    )}

                    {q.question_type === 'yes_no' && (
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 bg-indigo-600 border border-indigo-500 text-white text-sm font-medium rounded-2xl">Sim</button>
                        <button className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 text-sm font-medium rounded-2xl">Não</button>
                      </div>
                    )}

                    {q.question_type === 'ab' && (
                      <div className="space-y-1.5">
                        <button className="w-full py-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium rounded-2xl text-left px-4">Não, consegui resistir bem</button>
                        <button className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-400 text-sm font-medium rounded-2xl text-left px-4">Sim, em alguns dias</button>
                        <button className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-400 text-sm font-medium rounded-2xl text-left px-4">Sim, quase todos os dias</button>
                      </div>
                    )}

                    {q.question_type === 'open_text' && (
                      <textarea
                        readOnly
                        placeholder="Conta pra mim com suas palavras..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-slate-400 text-sm resize-none placeholder:text-slate-600"
                        rows={3}
                      />
                    )}
                  </div>
                ))}

                {bQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 text-sm">Adicione perguntas para ver a prévia</p>
                  </div>
                ) : (
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all">
                    Enviar check-in ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
