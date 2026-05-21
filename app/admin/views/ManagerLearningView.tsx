'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, CheckCircle2, XCircle, Edit3, BarChart3,
  RefreshCw, Loader2, ChevronDown, ChevronUp, X, Sparkles,
} from 'lucide-react'

interface LearningInsight {
  id: string
  agent_name: string
  action_type: string
  total_approved: number
  total_rejected: number
  total_edited: number
  approval_rate: number
  approved_patterns: Array<{ pattern: string; count: number; example: string }>
  rejected_patterns: Array<{ pattern: string; count: number; reason: string }>
  edit_patterns: Array<{ what_changed: string; frequency: string }>
  learning_instructions: string
  last_analyzed_at: string
}

interface FeedbackStats {
  [key: string]: { approved: number; rejected: number; edited: number; total: number }
}

const AGENT_LABELS: Record<string, string> = {
  upsell: 'Agente de Upsell',
  daily_checkin: 'Engajamento Diário',
  retention: 'Retenção',
  protocol: 'Protocolos',
  onboarding: 'Onboarding',
  community: 'Comunidade',
  meals: 'Refeições',
}

const ACTION_LABELS: Record<string, string> = {
  send_offer: 'Oferta',
  send_message: 'Mensagem',
  create_post: 'Post',
  create_challenge: 'Desafio',
  assign_protocol: 'Protocolo',
}

const FREQ_COLORS: Record<string, string> = {
  alta: 'text-rose-400',
  média: 'text-amber-400',
  baixa: 'text-slate-400',
}

export function ManagerLearningView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats>({})
  const [totalFeedback, setTotalFeedback] = useState(0)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/manager-insights')
      const data = await res.json()
      setInsights(data.insights || [])
      setFeedbackStats(data.feedback_stats || {})
      setTotalFeedback(data.total_feedback || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/admin/manager-insights', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetchInsights()
      showToast('success', `${data.analyzed} padrão(ões) analisado(s) com sucesso!`)
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao analisar padrões')
    } finally {
      setAnalyzing(false)
    }
  }

  const overallApprovalRate = insights.length > 0
    ? Math.round(insights.reduce((s, i) => s + i.approval_rate, 0) / insights.length)
    : null

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">
            Gerente <span className="font-bold">Inteligente</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Padrões aprendidos com suas decisões de aprovação — alimentam os próximos ciclos dos agentes
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || totalFeedback < 3}
          title={totalFeedback < 3 ? 'Mínimo 3 feedbacks necessários' : ''}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {analyzing ? 'Analisando...' : 'Analisar Padrões'}
        </button>
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

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Feedbacks</p>
            <p className="text-2xl font-bold text-white">{totalFeedback}</p>
            <p className="text-xs text-slate-500 mt-0.5">decisões registradas</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Aprovação</p>
            <p className={`text-2xl font-bold ${
              overallApprovalRate === null ? 'text-slate-500' :
              overallApprovalRate >= 70 ? 'text-emerald-400' :
              overallApprovalRate >= 40 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {overallApprovalRate !== null ? `${overallApprovalRate}%` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">taxa média geral</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Padrões</p>
            <p className="text-2xl font-bold text-indigo-400">{insights.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">modelos analisados</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Edições</p>
            <p className="text-2xl font-bold text-amber-400">
              {insights.reduce((s, i) => s + i.total_edited, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">mensagens ajustadas</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Carregando insights...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && insights.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Nenhum padrão analisado ainda</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              {totalFeedback < 3
                ? `Você tem ${totalFeedback} feedback(s). São necessários pelo menos 3 para análise.`
                : 'Clique em "Analisar Padrões" para que o gerente aprenda com suas decisões.'
              }
            </p>
          </div>
          {totalFeedback >= 3 && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-2xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Analisar Padrões Agora
            </button>
          )}
        </div>
      )}

      {/* Insights list */}
      {!loading && insights.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Padrões por Agente</p>
          {insights.map(insight => (
            <motion.div
              key={insight.id}
              className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden"
            >
              {/* Card header */}
              <button
                onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                className="w-full p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm">
                      {AGENT_LABELS[insight.agent_name] || insight.agent_name}
                      <span className="text-slate-500 font-normal ml-2">·</span>
                      <span className="text-slate-400 font-normal ml-2 text-xs">
                        {ACTION_LABELS[insight.action_type] || insight.action_type}
                      </span>
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {insight.total_approved + insight.total_rejected + insight.total_edited} decisões analisadas
                      · última análise {new Date(insight.last_analyzed_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Approval rate bar */}
                  <div className="hidden md:flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">{insight.total_approved}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span className="text-rose-400 font-bold">{insight.total_rejected}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400 font-bold">{insight.total_edited}</span>
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    insight.approval_rate >= 70 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    insight.approval_rate >= 40 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {insight.approval_rate}%
                  </div>

                  {expandedId === insight.id
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {expandedId === insight.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Approved patterns */}
                        {insight.approved_patterns && insight.approved_patterns.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-2 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> O que funciona
                            </p>
                            <div className="space-y-2">
                              {insight.approved_patterns.map((p, i) => (
                                <div key={i} className="text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5">
                                  <p className="text-emerald-300 font-medium">{p.pattern}</p>
                                  {p.example && <p className="text-slate-500 mt-1 italic line-clamp-2">"{p.example}"</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rejected patterns */}
                        {insight.rejected_patterns && insight.rejected_patterns.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> O que não funciona
                            </p>
                            <div className="space-y-2">
                              {insight.rejected_patterns.map((p, i) => (
                                <div key={i} className="text-xs bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5">
                                  <p className="text-rose-300 font-medium">{p.pattern}</p>
                                  {p.reason && <p className="text-slate-500 mt-1">{p.reason}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Edit patterns */}
                        {insight.edit_patterns && insight.edit_patterns.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> O que você ajusta
                            </p>
                            <div className="space-y-2">
                              {insight.edit_patterns.map((p, i) => (
                                <div key={i} className="text-xs bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5">
                                  <p className="text-amber-300 font-medium">{p.what_changed}</p>
                                  <p className={`text-xs mt-0.5 font-bold uppercase ${FREQ_COLORS[p.frequency] || 'text-slate-500'}`}>
                                    {p.frequency}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Learning instructions injected into agent */}
                      {insight.learning_instructions && (
                        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Instruções injetadas no agente
                          </p>
                          <p className="text-sm text-slate-300 leading-relaxed">{insight.learning_instructions}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
