"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Bot, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw,
  Loader2, ChevronDown, ChevronUp, MessageSquare, FileText,
  Users, Bell, Zap, Filter, Inbox
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface QueueAction {
  id: string
  agent_name: string
  action_type: string
  target_type: string
  target_user_id?: string
  title?: string
  content: string
  content_preview?: string
  reasoning?: string
  context_data?: Record<string, any>
  scheduled_for?: string
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
  priority: 'high' | 'medium' | 'low' | 'urgent'
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  expires_at?: string
  profiles?: { name: string }
}

interface QueueData {
  total: number
  by_priority: { high: QueueAction[]; medium: QueueAction[]; low: QueueAction[] }
  by_agent: Record<string, QueueAction[]>
  actions: QueueAction[]
}

const AGENT_META: Record<string, { label: string; color: string; icon: string }> = {
  sabotage: { label: 'Detecção de Sabotagem', color: 'text-rose-400', icon: '🧠' },
  daily_engagement: { label: 'Engajamento Diário', color: 'text-indigo-400', icon: '💬' },
  daily_checkin: { label: 'Engajamento Diário', color: 'text-indigo-400', icon: '💬' },
  retention: { label: 'Retenção', color: 'text-amber-400', icon: '🔄' },
  protocol: { label: 'Protocolos', color: 'text-emerald-400', icon: '📋' },
  community: { label: 'Comunidade', color: 'text-violet-400', icon: '👥' },
  upsell: { label: 'Upsell IA', color: 'text-orange-400', icon: '🚀' },
  onboarding: { label: 'Onboarding', color: 'text-sky-400', icon: '🎉' },
  meals: { label: 'Refeições', color: 'text-green-400', icon: '🥗' },
}

const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgente', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25' },
  high: { label: 'Alta', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  medium: { label: 'Média', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25' },
  normal: { label: 'Normal', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/25' },
  low: { label: 'Baixa', color: 'text-slate-500', bg: 'bg-slate-500/5 border-slate-500/15' },
}

type TabType = 'all' | 'high' | 'by-agent'

export function AgentQueueView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/agent-queue?status=pending')
      const json = await res.json()
      setData(json)
    } catch {
      showToast('error', 'Erro ao carregar fila de agentes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  const handleDecision = async (actionId: string, decision: 'approved' | 'rejected', rejectionReason?: string) => {
    setProcessing(actionId)
    try {
      const body: Record<string, any> = { action_id: actionId, decision }
      if (decision === 'approved' && editingId === actionId && editContent) {
        body.edited_content = editContent
      }
      if (decision === 'rejected' && rejectionReason) {
        body.rejection_reason = rejectionReason
      }

      const res = await fetch('/api/admin/agent-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Erro na requisição')

      showToast('success', decision === 'approved' ? 'Ação aprovada e executada!' : 'Ação rejeitada')
      setEditingId(null)
      setEditContent('')
      loadQueue()
    } catch {
      showToast('error', 'Erro ao processar ação')
    } finally {
      setProcessing(null)
    }
  }

  const getFilteredActions = (): QueueAction[] => {
    if (!data) return []
    let actions = data.actions

    if (tab === 'high') {
      actions = data.by_priority.high.concat(
        data.actions.filter(a => a.priority === 'urgent')
      )
    } else if (tab === 'by-agent' && agentFilter !== 'all') {
      actions = data.by_agent[agentFilter] || []
    }

    return actions
  }

  const agentKeys = data ? Object.keys(data.by_agent) : []
  const filteredActions = getFilteredActions()

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-white">Fila de <span className="font-bold">Agentes</span></h1>
          <p className="text-slate-500 text-sm mt-1">Propostas da IA aguardando aprovação antes de serem enviadas</p>
        </div>
        <div className="flex items-center gap-3">
          {data && data.total > 0 && (
            <span className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-black">
              {data.total}
            </span>
          )}
          <button
            onClick={loadQueue}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white text-sm font-bold transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
        {([
          { id: 'all' as TabType, label: `Todas (${data?.total ?? 0})` },
          { id: 'high' as TabType, label: `Alta Prioridade (${(data?.by_priority.high.length ?? 0) + (data?.actions.filter(a => a.priority === 'urgent').length ?? 0)})` },
          { id: 'by-agent' as TabType, label: 'Por Agente' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Agent filter (shown when by-agent tab) */}
      <AnimatePresence>
        {tab === 'by-agent' && agentKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            <button
              onClick={() => setAgentFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                agentFilter === 'all' ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            {agentKeys.map(key => {
              const meta = AGENT_META[key]
              const count = data?.by_agent[key]?.length ?? 0
              return (
                <button
                  key={key}
                  onClick={() => setAgentFilter(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    agentFilter === key ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{meta?.icon ?? '🤖'}</span>
                  {meta?.label ?? key} ({count})
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredActions.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <Inbox size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-white font-bold text-lg">Fila limpa!</p>
          <p className="text-slate-500 text-sm mt-1">Nenhuma ação pendente dos agentes de IA.</p>
        </div>
      )}

      {/* Actions list */}
      <div className="space-y-3">
        {filteredActions.map(action => {
          const agentMeta = AGENT_META[action.agent_name] || { label: action.agent_name, color: 'text-slate-400', icon: '🤖' }
          const priorityMeta = PRIORITY_META[action.priority] || PRIORITY_META.normal
          const isExpanded = expandedId === action.id
          const isEditing = editingId === action.id
          const isProcessing = processing === action.id
          const patientName = action.profiles?.name

          return (
            <motion.div
              key={action.id}
              layout
              className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-indigo-500/30 transition-all"
            >
              {/* Action header */}
              <div className="flex items-start gap-4 p-5">
                {/* Agent icon */}
                <div className="text-2xl flex-shrink-0 mt-0.5">{agentMeta.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-bold ${agentMeta.color}`}>{agentMeta.label}</span>
                    <span className="text-slate-600">·</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${priorityMeta.bg} ${priorityMeta.color}`}>
                      {priorityMeta.label}
                    </span>
                    {patientName && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Users size={10} /> {patientName}
                        </span>
                      </>
                    )}
                  </div>

                  {action.title && (
                    <p className="text-white font-bold text-sm mb-1">{action.title}</p>
                  )}

                  <p className="text-slate-400 text-sm line-clamp-2">
                    {action.content_preview || action.content}
                  </p>

                  <p className="text-slate-600 text-xs mt-2">
                    {new Date(action.created_at).toLocaleString('pt-BR')}
                    {action.expires_at && (
                      <span className="ml-2 text-amber-600">
                        · expira {new Date(action.expires_at).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : action.id); setEditingId(null) }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <button
                    onClick={() => handleDecision(action.id, 'rejected', 'Rejeitado pelo admin')}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Rejeitar
                  </button>

                  <button
                    onClick={() => {
                      if (isEditing) {
                        handleDecision(action.id, 'approved')
                      } else {
                        handleDecision(action.id, 'approved')
                      }
                    }}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Aprovar
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5"
                  >
                    <div className="p-5 space-y-4">
                      {/* Full content with optional edit */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Conteúdo Proposto</p>
                          {!isEditing ? (
                            <button
                              onClick={() => { setEditingId(action.id); setEditContent(action.content) }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all"
                            >
                              Editar antes de aprovar
                            </button>
                          ) : (
                            <button
                              onClick={() => { setEditingId(null); setEditContent('') }}
                              className="text-xs text-slate-400 hover:text-white font-bold transition-all"
                            >
                              Cancelar edição
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm resize-none focus:outline-none focus:border-indigo-500/50 min-h-[120px]"
                              placeholder="Edite o conteúdo..."
                            />
                            <button
                              onClick={() => handleDecision(action.id, 'approved')}
                              disabled={isProcessing || !editContent.trim()}
                              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all"
                            >
                              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              Aprovar conteúdo editado
                            </button>
                          </div>
                        ) : (
                          <p className="text-slate-300 text-sm bg-white/[0.03] rounded-2xl p-4 border border-white/5 whitespace-pre-wrap">
                            {action.content}
                          </p>
                        )}
                      </div>

                      {/* Reasoning */}
                      {action.reasoning && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Raciocínio da IA</p>
                          <p className="text-slate-500 text-xs bg-white/[0.02] rounded-xl p-3 border border-white/5">
                            {action.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Context data */}
                      {action.context_data && Object.keys(action.context_data).length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Contexto</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(action.context_data).slice(0, 6).map(([k, v]) => (
                              <div key={k} className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                                <p className="text-slate-600 text-[9px] uppercase font-black">{k.replace(/_/g, ' ')}</p>
                                <p className="text-slate-300 text-xs mt-0.5">{String(v).substring(0, 50)}</p>
                              </div>
                            ))}
                          </div>
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
    </div>
  )
}
