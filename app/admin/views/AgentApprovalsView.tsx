"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2, XCircle, Clock, Bot, User, MessageSquare,
  FileText, Bell, AlertTriangle, Loader2, RefreshCw,
  ChevronDown, CheckSquare, Square, Inbox, Shield, Zap, ShoppingBag
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface PendingAction {
  id: string
  agent_name: string
  action_type: string
  target_type: string
  target_patient_name?: string
  title?: string
  content: string
  content_preview?: string
  reasoning?: string
  context_data?: Record<string, any>
  scheduled_for?: string
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  expires_at: string
}

const AGENT_META: Record<string, { label: string; color: string; bg: string }> = {
  'daily-engagement': { label: 'Engajamento Diário', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  'daily_checkin':    { label: 'Engajamento Diário', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  'retention':        { label: 'Retenção',           color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20'   },
  'onboarding':       { label: 'Onboarding',         color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20'},
  'protocol':         { label: 'Protocolo',          color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'     },
  'community':        { label: 'Comunidade',         color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  'sabotage':         { label: 'Detecção de Risco',  color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20'     },
  'meals':            { label: 'Alimentação',        color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  'moderation':       { label: 'Moderação',          color: 'text-slate-400',  bg: 'bg-white/5 border-white/10'            },
  'upsell':           { label: 'Upsell IA',          color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
}

const ACTION_META: Record<string, { label: string; icon: React.ElementType }> = {
  send_message:      { label: 'Mensagem para paciente', icon: MessageSquare  },
  create_post:       { label: 'Post na comunidade',     icon: FileText       },
  send_push:         { label: 'Notificação push',       icon: Bell           },
  flag_patient:      { label: 'Alerta de risco',        icon: AlertTriangle  },
  complete_protocol: { label: 'Completar protocolo',    icon: CheckCircle2   },
  show_offer:        { label: 'Oferta de upsell',       icon: ShoppingBag    },
}

type TabType = 'pending' | 'approved' | 'rejected'

export function AgentApprovalsView({ setView, tenantId }: { setView: (v: any) => void; tenantId?: string }) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<Set<string>>(new Set())
  const [bulkActing, setBulkActing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<TabType>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (status: TabType) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const res = await fetch(`/api/admin/agent-approvals?status=${status}`)
      const data = await res.json()
      setActions(Array.isArray(data) ? data : [])
    } catch {
      setActions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/admin/agent-approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      showToast('success', action === 'approve' ? 'Ação aprovada e executada!' : 'Ação rejeitada')
      setActions(prev => prev.filter(a => a.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } catch {
      showToast('error', 'Erro ao processar')
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleBulk = async (action: 'approve' | 'reject') => {
    if (selected.size === 0) return
    setBulkActing(true)
    try {
      const res = await fetch('/api/admin/agent-approvals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      const { updated } = await res.json()
      showToast('success', `${updated} ações ${action === 'approve' ? 'aprovadas' : 'rejeitadas'}`)
      setActions(prev => prev.filter(a => !selected.has(a.id)))
      setSelected(new Set())
    } catch {
      showToast('error', 'Erro na operação em massa')
    } finally {
      setBulkActing(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const selectAll = () => {
    if (selected.size === actions.length) setSelected(new Set())
    else setSelected(new Set(actions.map(a => a.id)))
  }

  const agentMeta = (name: string) =>
    AGENT_META[name] ?? { label: name, color: 'text-slate-400', bg: 'bg-white/5 border-white/10' }

  const actionMeta = (type: string) =>
    ACTION_META[type] ?? { label: type, icon: Zap }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-white">
            Aprovações <span className="font-bold">de Agentes</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Nenhum agente age sem a sua aprovação explícita</p>
        </div>
        <button
          onClick={() => load(tab)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm font-medium rounded-2xl border border-white/10 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'pending' ? 'Pendentes' : t === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
            {t === 'pending' && tab === 'pending' && actions.length > 0 && (
              <span className="ml-2 text-[10px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                {actions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {tab === 'pending' && selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3"
          >
            <span className="text-indigo-400 text-sm font-medium">{selected.size} selecionadas</span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleBulk('reject')}
                disabled={bulkActing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {bulkActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Rejeitar todas
              </button>
              <button
                onClick={() => handleBulk('approve')}
                disabled={bulkActing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {bulkActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Aprovar todas
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          {tab === 'pending' ? (
            <>
              <Shield className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">Tudo em dia</p>
              <p className="text-slate-500 text-sm">Nenhuma ação aguardando aprovação</p>
            </>
          ) : (
            <>
              <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">
                Nenhuma ação {tab === 'approved' ? 'aprovada' : 'rejeitada'} ainda
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all (pending only) */}
          {tab === 'pending' && (
            <button
              onClick={selectAll}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
            >
              {selected.size === actions.length
                ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                : <Square className="w-4 h-4" />}
              {selected.size === actions.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
          )}

          {actions.map(action => {
            const am = agentMeta(action.agent_name)
            const acm = actionMeta(action.action_type)
            const ActIcon = acm.icon
            const isExpanded = expandedId === action.id
            const isActing = acting.has(action.id)
            const previewText = action.content_preview ?? (
              action.content.length > 120
                ? action.content.slice(0, 120) + '…'
                : action.content
            )

            return (
              <motion.div
                key={action.id}
                layout
                className={`bg-white/5 border rounded-3xl transition-all ${
                  selected.has(action.id) ? 'border-indigo-500/40' : 'border-white/10'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {/* Checkbox (pending only) */}
                    {tab === 'pending' && (
                      <button onClick={() => toggleSelect(action.id)} className="mt-0.5 shrink-0">
                        {selected.has(action.id)
                          ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                          : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Agent + action type badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${am.bg} ${am.color}`}>
                          {am.label}
                        </span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-400">
                          {acm.label}
                        </span>
                        {action.target_patient_name && (
                          <span className="flex items-center gap-1 text-slate-400 text-xs">
                            <User className="w-3 h-3" />
                            {action.target_patient_name}
                          </span>
                        )}
                      </div>

                      {/* Title / preview */}
                      {action.title && (
                        <p className="text-white text-sm font-medium mb-1">{action.title}</p>
                      )}
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {isExpanded ? action.content : previewText}
                      </p>

                      {/* Reasoning */}
                      {action.reasoning && (
                        <div className="mt-2 bg-white/[0.03] border border-white/5 rounded-2xl px-3 py-2">
                          <p className="text-slate-500 text-xs">
                            <span className="text-slate-600 font-medium">Motivo: </span>
                            {action.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Context data chips */}
                      {action.context_data && Object.keys(action.context_data).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(action.context_data).slice(0, 4).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 bg-white/5 text-slate-500 rounded-lg">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer: time + expand + actions */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="text-slate-600 text-xs">
                          {new Date(action.created_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>

                        {action.content.length > 120 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : action.id)}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                          >
                            {isExpanded ? 'Menos' : 'Ver completo'}
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {/* Status badge for non-pending */}
                        {tab !== 'pending' && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            action.status === 'approved' || action.status === 'executed'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}>
                            {action.status === 'executed'
                              ? 'Executada'
                              : action.status === 'approved'
                              ? 'Aprovada'
                              : 'Rejeitada'}
                          </span>
                        )}

                        {/* Rejection reason */}
                        {action.rejection_reason && (
                          <span className="text-slate-600 text-xs italic">
                            Motivo: {action.rejection_reason}
                          </span>
                        )}

                        {/* Approve / Reject buttons */}
                        {tab === 'pending' && (
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={() => handleAction(action.id, 'reject')}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {isActing
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <XCircle className="w-3 h-3" />}
                              Rejeitar
                            </button>
                            <button
                              onClick={() => handleAction(action.id, 'approve')}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {isActing
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />}
                              Aprovar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
