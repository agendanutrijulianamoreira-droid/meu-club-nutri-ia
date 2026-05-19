"use client"
import React, { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck, Clock, CheckCircle, XCircle, Edit3, Loader2, X,
  MessageSquare, Zap, Bell, Flag, Users, Trophy, Send, AlertCircle,
  Check, ChevronDown, ChevronUp, RefreshCw, Bot, Eye
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ApprovalItem {
  id: string
  agent_name: string
  event_type: string
  action_type: string
  target_user_id: string | null
  target_segment: string | null
  payload: Record<string, any>
  preview_title: string
  preview_body: string
  preview_context: string | null
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
  reviewed_at: string | null
  admin_note: string | null
  edited_payload: Record<string, any> | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  expires_at: string
  created_at: string
  target_profile?: { name: string; email: string } | null
}

const ACTION_META: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
  send_message:    { label: 'Mensagem',    icon: <MessageSquare size={13}/>, color: 'text-sky-400' },
  send_offer:      { label: 'Oferta',      icon: <Zap size={13}/>,          color: 'text-amber-400' },
  create_post:     { label: 'Post',        icon: <Edit3 size={13}/>,         color: 'text-emerald-400' },
  create_challenge:{ label: 'Desafio',     icon: <Trophy size={13}/>,        color: 'text-violet-400' },
  assign_protocol: { label: 'Protocolo',   icon: <CheckCircle size={13}/>,   color: 'text-indigo-400' },
  send_push:       { label: 'Push',        icon: <Bell size={13}/>,           color: 'text-rose-400' },
  flag_patient:    { label: 'Alerta',      icon: <Flag size={13}/>,           color: 'text-orange-400' },
  send_campaign:   { label: 'Campanha',    icon: <Send size={13}/>,           color: 'text-pink-400' },
}

const PRIORITY_META = {
  low:    { label: 'Baixa',   class: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  normal: { label: 'Normal',  class: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  high:   { label: 'Alta',    class: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  urgent: { label: 'Urgente', class: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
}

const AGENT_ICONS: Record<string, string> = {
  sabotage:           '🔍',
  daily_engagement:   '💬',
  onboarding:         '🌱',
  meals:              '🥗',
  retention:          '💛',
  protocol:           '📋',
  community:          '🌸',
  community_moderation:'🛡️',
  upsell:             '⚡',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function timeUntilExpiry(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}min`
  return `${h}h`
}

// ─── Card de aprovação ────────────────────────────────────────────────────────
function ApprovalCard({ item, onDecision }: {
  item: ApprovalItem
  onDecision: (id: string, decision: 'approved' | 'rejected', note?: string, editedPayload?: any) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(item.preview_body)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const actionMeta = ACTION_META[item.action_type] || { label: item.action_type, icon: <Bot size={13}/>, color: 'text-slate-400' }
  const priorityMeta = PRIORITY_META[item.priority]

  const handleApprove = async () => {
    setLoading('approve')
    const editedPayload = editing && editedBody !== item.preview_body
      ? { ...item.payload, message: editedBody }
      : undefined
    await onDecision(item.id, 'approved', note || undefined, editedPayload)
    setLoading(null)
  }

  const handleReject = async () => {
    setLoading('reject')
    await onDecision(item.id, 'rejected', note || undefined)
    setLoading(null)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-indigo-500/20 transition-all">
      {/* Header do card */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
            {AGENT_ICONS[item.agent_name] || '🤖'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${priorityMeta.class}`}>
                {priorityMeta.label}
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-1 ${actionMeta.color}`}>
                {actionMeta.icon} {actionMeta.label}
              </span>
              <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(item.created_at)} · expira em {timeUntilExpiry(item.expires_at)}</span>
            </div>
            <p className="text-sm font-bold text-white leading-tight">{item.preview_title}</p>
            {item.target_profile && (
              <p className="text-xs text-slate-500 mt-0.5">Para: {item.target_profile.name}</p>
            )}
            {item.target_segment && (
              <p className="text-xs text-slate-500 mt-0.5">Segmento: {item.target_segment}</p>
            )}
          </div>
        </div>

        {/* Preview da mensagem */}
        <div className="mt-3 p-3 bg-white/[0.03] border border-white/8 rounded-2xl">
          {editing ? (
            <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={3}
              className="w-full bg-transparent text-sm text-slate-300 focus:outline-none resize-none"/>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">{item.preview_body}</p>
          )}
        </div>

        {item.preview_context && (
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 mt-2 transition-colors">
            <Eye size={11}/>
            {expanded ? 'Ocultar contexto' : 'Ver contexto do agente'}
            {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
        )}

        <AnimatePresence>
          {expanded && item.preview_context && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <p className="text-[11px] text-slate-500 leading-relaxed">{item.preview_context}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nota da admin */}
        <div className="mt-3">
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Adicionar nota (opcional — aparece no histórico de aprendizado)"
            className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30"/>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={handleApprove} disabled={!!loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition-all">
            {loading === 'approve' ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
            {loading === 'approve' ? 'Aprovando…' : 'Aprovar e Enviar'}
          </button>
          <button onClick={() => setEditing(!editing)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-2xl transition-all ${
              editing ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-white/5 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 border border-white/10'
            }`}>
            <Edit3 size={12}/> {editing ? 'Editando' : 'Editar antes de enviar'}
          </button>
          <button onClick={handleReject} disabled={!!loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 disabled:opacity-50 text-xs font-bold rounded-2xl transition-all">
            {loading === 'reject' ? <Loader2 size={12} className="animate-spin"/> : <XCircle size={12}/>}
            Rejeitar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export function ApprovalsView({ setView, tenantId = '' }: {
  setView: (v: any) => void; tenantId?: string
}) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (status = activeTab) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/approvals?status=${status}`)
      const data = await res.json()
      setItems(data.items || [])
      setPendingCount(data.pending_count || 0)
    } catch {
      showToast('error', 'Erro ao carregar aprovações')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load(activeTab) }, [activeTab])

  const handleDecision = async (id: string, decision: 'approved' | 'rejected', note?: string, editedPayload?: any) => {
    const res = await fetch('/api/admin/approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision, admin_note: note, edited_payload: editedPayload }),
    })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
      setPendingCount(prev => Math.max(0, prev - 1))
      showToast('success', decision === 'approved' ? 'Aprovado e enviado!' : 'Rejeitado e registrado')
    } else {
      const data = await res.json()
      showToast('error', data.error || 'Erro ao processar decisão')
    }
  }

  const TABS = [
    { id: 'pending' as const,  label: 'Aguardando', count: pendingCount },
    { id: 'approved' as const, label: 'Aprovados' },
    { id: 'rejected' as const, label: 'Rejeitados' },
  ]

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">
            Aprovações dos <span className="font-bold">Agentes</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Nenhum agente age sem sua permissão. Revise, edite ou rejeite cada ação proposta.
          </p>
        </div>
        <button onClick={() => load(activeTab)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-medium rounded-2xl transition-all">
          <RefreshCw size={14}/> Atualizar
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium ${
              toast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/25 text-rose-400'
            }`}>
            {toast.type === 'success' ? <Check size={15}/> : <AlertCircle size={15}/>} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner de urgência se há pendentes */}
      {pendingCount > 0 && activeTab === 'pending' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
          <ShieldCheck size={18} className="text-amber-400 shrink-0"/>
          <p className="text-sm text-amber-300">
            <span className="font-bold">{pendingCount} ação{pendingCount !== 1 ? 'ões' : ''}</span> aguardando sua revisão.
            Os agentes estão pausados até sua aprovação.
          </p>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white min-w-[18px] text-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-600"/>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
          <ShieldCheck size={40} className="text-slate-700 mx-auto mb-3"/>
          {activeTab === 'pending' ? (
            <>
              <p className="text-slate-400 font-medium mb-1">Nenhuma ação pendente</p>
              <p className="text-slate-600 text-sm">Os agentes irão sugerir ações baseadas no comportamento das suas pacientes</p>
            </>
          ) : (
            <p className="text-slate-400 font-medium">Nenhum registro de {activeTab === 'approved' ? 'aprovações' : 'rejeições'}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map(item => (
              activeTab === 'pending'
                ? <ApprovalCard key={item.id} item={item} onDecision={handleDecision}/>
                : (
                  <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                    <div className="text-xl">{AGENT_ICONS[item.agent_name] || '🤖'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.preview_title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString('pt-BR') : ''} ·{' '}
                        {item.admin_note && <span className="text-slate-600">"{item.admin_note}"</span>}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      item.status === 'approved' ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                    }`}>
                      {item.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </motion.div>
                )
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
