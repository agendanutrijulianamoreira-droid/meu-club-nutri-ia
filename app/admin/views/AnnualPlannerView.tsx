'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Calendar, Target, Megaphone, Trophy,
  FileText, Lightbulb, Loader2, RefreshCw, CheckCircle2,
  Edit3, Save, X,
} from 'lucide-react'

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

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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

export function AnnualPlannerView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [plan, setPlan] = useState<StrategicPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)
  const [editingMonthId, setEditingMonthId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [context, setContext] = useState('')
  const [showContextInput, setShowContextInput] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/strategic-plan?year=${selectedYear}`)
      const data = await res.json()
      setPlan(data.plan || null)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/strategic-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', year: selectedYear, context: context.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlan(data.plan)
      setShowContextInput(false)
      setContext('')
      showToast('success', `Plano ${selectedYear} gerado com sucesso!`)
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao gerar plano')
    } finally {
      setGenerating(false)
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
      setPlan(prev => prev ? {
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

  const currentMonthNumber = selectedYear === currentYear ? new Date().getMonth() + 1 : null

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-light text-white">
            Plano <span className="font-bold">Anual IA</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Planejamento estratégico por mês — temas, campanhas e metas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedYear === y ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowContextInput(!showContextInput)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {plan ? 'Regenerar' : 'Gerar com IA'}
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context input */}
      <AnimatePresence>
        {showContextInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3"
          >
            <p className="text-sm font-medium text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Contexto adicional para a IA (opcional)
            </p>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Ex: Vamos lançar um produto novo em maio. Temos parceria com academia local. Foco em pacientes que trabalham em home office..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Gerando plano...' : `Gerar Plano ${selectedYear}`}
              </button>
              <button onClick={() => setShowContextInput(false)} className="text-slate-400 hover:text-white text-sm px-3 py-2">
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Carregando plano...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !plan && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Nenhum plano para {selectedYear}</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              Gere um plano estratégico anual com IA — temas mensais, campanhas, desafios e metas personalizadas para o seu clube.
            </p>
          </div>
          <button
            onClick={() => setShowContextInput(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Gerar Plano {selectedYear} com IA
          </button>
        </div>
      )}

      {/* Plan content */}
      {!loading && plan && (
        <div className="space-y-4">
          {/* Plan header card */}
          <div className="bg-white/5 border border-indigo-500/20 rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-500/15 border-indigo-500/25 text-indigo-400">
                    {plan.is_ai_generated ? '✨ IA' : 'Manual'}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{plan.year}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{plan.title}</h2>
                {plan.summary && <p className="text-slate-400 text-sm mt-2 leading-relaxed">{plan.summary}</p>}
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                title="Regenerar plano"
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Regenerar
              </button>
            </div>

            {/* Goals */}
            {plan.goals && plan.goals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Metas Anuais</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {plan.goals.map((g, i) => (
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

          {/* Year overview grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {plan.months.map(month => {
              const focusKey = month.focus_area?.toLowerCase() || ''
              const focusColor = FOCUS_COLORS[focusKey] || FOCUS_COLORS['default']
              const isCurrent = month.month_number === currentMonthNumber
              return (
                <button
                  key={month.month_number}
                  onClick={() => setExpandedMonth(expandedMonth === month.month_number ? null : month.month_number)}
                  className={`bg-white/5 border rounded-2xl p-3 text-left transition-all hover:border-indigo-500/30 ${
                    isCurrent ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/10'
                  } ${expandedMonth === month.month_number ? 'border-indigo-500/50' : ''}`}
                >
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

          {/* Expanded month detail */}
          <AnimatePresence>
            {expandedMonth !== null && (() => {
              const month = plan.months.find(m => m.month_number === expandedMonth)
              if (!month) return null
              const focusKey = month.focus_area?.toLowerCase() || ''
              const focusColor = FOCUS_COLORS[focusKey] || FOCUS_COLORS['default']

              return (
                <motion.div
                  key={expandedMonth}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5"
                >
                  {/* Month header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {MONTH_NAMES[month.month_number]} {plan.year}
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

                  {/* 4-column grid */}
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

                  {/* Notes */}
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Anotações</p>
                      {editingMonthId !== month.id ? (
                        <button
                          onClick={() => { setEditingMonthId(month.id); setEditingNotes(month.notes || '') }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveNotes(month.id)}
                            disabled={savingNotes}
                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                          >
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
                      <textarea
                        value={editingNotes}
                        onChange={e => setEditingNotes(e.target.value)}
                        placeholder="Adicione observações, lembretes ou ajustes para este mês..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50"
                        rows={3}
                      />
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
  )
}
