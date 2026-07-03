"use client"

import React, { useState, useEffect } from 'react'
import {
  Bot, Activity, AlertTriangle, CheckCircle2, XCircle, Clock, Coins,
  Zap, RefreshCw, Loader2, ChevronRight, Shield, Users, MessageSquare,
  TrendingUp, TrendingDown, SkipForward, Brain, Heart, Utensils,
  BookOpen, MessageCircle, Eye, Play
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface AgentsDashboardViewProps {
  setView: (v: any) => void
  tenantId?: string
}

interface AgentStat {
  agent_name: string
  total_runs: number
  success: number
  errors: number
  skipped: number
  total_tokens: number
  total_cost: number
  avg_duration_ms: number
  last_run: string | null
  last_error: string | null
}

interface RiskPatient {
  user_id: string
  name: string
  overall_risk: number
  risk_level: string
  signals: string[]
  recommended_action: string
  action_taken: boolean
}

interface TimelineEntry {
  id: string
  agent: string
  status: string
  trigger: string
  tokens: number
  duration: number
  time: string
  error: string | null
}

interface DashboardData {
  overview: {
    total_runs_7d: number
    total_tokens_7d: number
    total_cost_7d: number
    success_rate: number
    total_messages_7d: number
    read_rate: number
  }
  agent_stats: AgentStat[]
  risk_distribution: { critical: number; high: number; medium: number; low: number }
  risk_patients: RiskPatient[]
  inbox_by_type: Record<string, number>
  inbox_by_agent: Record<string, number>
  timeline: TimelineEntry[]
}

const AGENT_META: Record<string, { label: string; icon: typeof Bot; color: string; desc: string }> = {
  orchestrator: { label: 'Orchestrator', icon: Brain, color: 'text-purple-400', desc: 'Router central' },
  sabotage: { label: 'Sabotage Detection', icon: Shield, color: 'text-rose-400', desc: 'Risk scores' },
  daily_checkin: { label: 'Daily Engagement', icon: MessageSquare, color: 'text-teal-400', desc: 'Mensagens diárias' },
  onboarding: { label: 'Onboarding', icon: Users, color: 'text-sky-400', desc: 'Boas-vindas' },
  meals: { label: 'Meals', icon: Utensils, color: 'text-amber-400', desc: 'Feedback refeições' },
  retention: { label: 'Retention', icon: Heart, color: 'text-pink-400', desc: 'Win-back' },
  protocol: { label: 'Protocol', icon: BookOpen, color: 'text-indigo-400', desc: 'Transições fase' },
  community: { label: 'Community', icon: MessageCircle, color: 'text-emerald-400', desc: 'Posts diários' },
  community_moderation: { label: 'Moderation', icon: Eye, color: 'text-orange-400', desc: 'Auto-moderação' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: CheckCircle2 },
  error: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: XCircle },
  skipped: { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: SkipForward },
  running: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: Loader2 },
}

const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

export function AgentsDashboardView({ setView, tenantId }: AgentsDashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'risk' | 'timeline'>('overview')
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/agents')
      if (!res.ok) throw new Error('Falha ao carregar dados')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const triggerAgent = async (agentName: string) => {
    if (!tenantId) return
    setTriggeringAgent(agentName)
    try {
      const res = await fetch('/api/admin/agents/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentName }),
      })
      if (res.ok) {
        setTimeout(fetchData, 2000) // Refresh após execução
      }
    } catch (err) {
      console.error('Trigger error:', err)
    } finally {
      setTriggeringAgent(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-indigo-400" size={48} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="text-amber-400" size={48} />
        <p className="text-slate-400">{error || 'Erro ao carregar dados dos agentes'}</p>
        <p className="text-slate-500 text-sm">As tabelas agent_logs, inbox_messages e patient_risk_scores precisam existir no banco.</p>
        <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw size={16} className="mr-2" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const { overview, agent_stats, risk_distribution, risk_patients, inbox_by_type, timeline } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bot className="text-indigo-400" size={28} />
            Orquestra de Agentes IA
          </h1>
          <p className="text-slate-400 mt-1">Monitoramento dos 8 agentes especializados — últimos 7 dias</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          <RefreshCw size={16} className="mr-2" /> Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
        {(['overview', 'agents', 'risk', 'timeline'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab === 'overview' ? 'Visão Geral' : tab === 'agents' ? 'Agentes' : tab === 'risk' ? 'Risco' : 'Timeline'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <OverviewTab overview={overview} agentStats={agent_stats} riskDistribution={risk_distribution} inboxByType={inbox_by_type} />}
          {activeTab === 'agents' && <AgentsTab stats={agent_stats} onTrigger={triggerAgent} triggering={triggeringAgent} />}
          {activeTab === 'risk' && <RiskTab distribution={risk_distribution} patients={risk_patients} />}
          {activeTab === 'timeline' && <TimelineTab entries={timeline} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ overview, agentStats, riskDistribution, inboxByType }: {
  overview: DashboardData['overview']
  agentStats: AgentStat[]
  riskDistribution: DashboardData['risk_distribution']
  inboxByType: Record<string, number>
}) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard icon={Zap} label="Execuções 7d" value={overview.total_runs_7d} color="text-indigo-400" />
        <KPICard icon={CheckCircle2} label="Taxa sucesso" value={`${overview.success_rate}%`} color="text-emerald-400" />
        <KPICard icon={Brain} label="Tokens 7d" value={formatNumber(overview.total_tokens_7d)} color="text-purple-400" />
        <KPICard icon={Coins} label="Custo 7d" value={`$${overview.total_cost_7d.toFixed(4)}`} color="text-amber-400" />
        <KPICard icon={MessageSquare} label="Mensagens 7d" value={overview.total_messages_7d} color="text-teal-400" />
        <KPICard icon={Eye} label="Taxa leitura" value={`${overview.read_rate}%`} color="text-sky-400" />
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-rose-400" size={18} /> Distribuição de risco (hoje)
          </h3>
          <div className="space-y-3">
            {Object.entries(riskDistribution).map(([level, count]) => {
              const style = RISK_STYLES[level]
              const total = Object.values(riskDistribution).reduce((a, b) => a + b, 0) || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-16 ${style.text} capitalize`}>{level}</span>
                  <div className="flex-1 bg-slate-700/50 rounded-full h-6 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full ${style.bg} rounded-full flex items-center justify-end pr-2`}
                    >
                      {pct > 8 && <span className={`text-xs font-bold ${style.text}`}>{count}</span>}
                    </motion.div>
                  </div>
                  {pct <= 8 && <span className="text-xs text-slate-500">{count}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Inbox by Type */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="text-teal-400" size={18} /> Mensagens por tipo (7d)
          </h3>
          <div className="space-y-2">
            {Object.entries(inboxByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-1.5 border-b border-slate-700/30 last:border-0">
                <span className="text-sm text-slate-300 capitalize">{type.replace('_', ' ')}</span>
                <span className="text-sm font-mono text-slate-400">{count}</span>
              </div>
            ))}
            {Object.keys(inboxByType).length === 0 && (
              <p className="text-slate-500 text-sm">Nenhuma mensagem enviada</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent Performance Summary */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Activity className="text-indigo-400" size={18} /> Performance por agente (7d)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-2 text-slate-400 font-medium">Agente</th>
                <th className="text-center py-2 text-slate-400 font-medium">Runs</th>
                <th className="text-center py-2 text-slate-400 font-medium">OK</th>
                <th className="text-center py-2 text-slate-400 font-medium">Erros</th>
                <th className="text-center py-2 text-slate-400 font-medium">Skip</th>
                <th className="text-right py-2 text-slate-400 font-medium">Tokens</th>
                <th className="text-right py-2 text-slate-400 font-medium">Custo</th>
                <th className="text-right py-2 text-slate-400 font-medium">Avg ms</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.filter(a => a.total_runs > 0).map(agent => {
                const meta = AGENT_META[agent.agent_name]
                const Icon = meta?.icon || Bot
                return (
                  <tr key={agent.agent_name} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon size={15} className={meta?.color || 'text-slate-400'} />
                        <span className="text-slate-200">{meta?.label || agent.agent_name}</span>
                      </div>
                    </td>
                    <td className="text-center text-slate-300 font-mono">{agent.total_runs}</td>
                    <td className="text-center text-emerald-400 font-mono">{agent.success}</td>
                    <td className="text-center font-mono">
                      <span className={agent.errors > 0 ? 'text-rose-400' : 'text-slate-500'}>{agent.errors}</span>
                    </td>
                    <td className="text-center text-slate-500 font-mono">{agent.skipped}</td>
                    <td className="text-right text-slate-400 font-mono">{formatNumber(agent.total_tokens)}</td>
                    <td className="text-right text-amber-400 font-mono">${agent.total_cost.toFixed(4)}</td>
                    <td className="text-right text-slate-400 font-mono">{agent.avg_duration_ms}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {agentStats.every(a => a.total_runs === 0) && (
            <p className="text-slate-500 text-sm text-center py-8">Nenhuma execução registrada. Execute o orchestrator para ver dados aqui.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Agents (cards detalhados + trigger manual)
// ═══════════════════════════════════════════════════════════════════════════

function AgentsTab({ stats, onTrigger, triggering }: {
  stats: AgentStat[]
  onTrigger: (name: string) => void
  triggering: string | null
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map(agent => {
        const meta = AGENT_META[agent.agent_name]
        if (!meta) return null
        const Icon = meta.icon
        const successRate = agent.total_runs > 0
          ? Math.round((agent.success / agent.total_runs) * 100)
          : 0
        const isTriggering = triggering === agent.agent_name

        return (
          <motion.div
            key={agent.agent_name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-slate-700/50`}>
                  <Icon size={20} className={meta.color} />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">{meta.label}</h4>
                  <p className="text-slate-500 text-xs">{meta.desc}</p>
                </div>
              </div>
              {agent.agent_name !== 'orchestrator' && (
                <button
                  onClick={() => onTrigger(agent.agent_name)}
                  disabled={isTriggering}
                  className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-indigo-400 disabled:opacity-50"
                  title="Executar manualmente"
                >
                  {isTriggering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{agent.total_runs}</p>
                <p className="text-xs text-slate-500">runs</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-bold ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {successRate}%
                </p>
                <p className="text-xs text-slate-500">sucesso</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-300">{agent.avg_duration_ms}<span className="text-xs text-slate-500">ms</span></p>
                <p className="text-xs text-slate-500">avg</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-slate-700/30 pt-2">
              <span className="text-slate-500">
                {agent.last_run ? timeAgo(agent.last_run) : 'Nunca executou'}
              </span>
              <span className="text-amber-400/70">{formatNumber(agent.total_tokens)} tokens</span>
            </div>

            {agent.last_error && (
              <div className="mt-2 p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                <p className="text-xs text-rose-400 line-clamp-2">{agent.last_error}</p>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Risk
// ═══════════════════════════════════════════════════════════════════════════

function RiskTab({ distribution, patients }: {
  distribution: DashboardData['risk_distribution']
  patients: RiskPatient[]
}) {
  return (
    <div className="space-y-6">
      {/* Risk Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(distribution).map(([level, count]) => {
          const style = RISK_STYLES[level]
          return (
            <div key={level} className={`${style.bg} border ${style.border} rounded-xl p-4 text-center`}>
              <p className={`text-3xl font-bold ${style.text}`}>{count}</p>
              <p className="text-sm text-slate-400 capitalize mt-1">{level}</p>
            </div>
          )
        })}
      </div>

      {/* Patients at Risk */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="text-amber-400" size={18} /> Pacientes com risco elevado (hoje)
        </h3>

        {patients.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={32} />
            <p className="text-slate-400">Nenhuma paciente com risco elevado hoje</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.filter(p => p.risk_level !== 'low').map(patient => {
              const style = RISK_STYLES[patient.risk_level] || RISK_STYLES.medium
              return (
                <motion.div
                  key={patient.user_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-3 rounded-lg border ${style.border} ${style.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${style.bg} ${style.text}`}>
                      {patient.overall_risk}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{patient.name}</p>
                      <p className="text-slate-500 text-xs">
                        {patient.signals?.slice(0, 3).join(' · ') || 'Sem sinais específicos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${style.bg} ${style.text} font-medium capitalize`}>
                      {patient.risk_level}
                    </span>
                    <span className="text-xs text-slate-500">
                      {patient.action_taken ? '✓ Ação tomada' : patient.recommended_action?.replace('_', ' ')}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Timeline
// ═══════════════════════════════════════════════════════════════════════════

function TimelineTab({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Clock className="text-indigo-400" size={18} /> Últimas execuções
      </h3>

      {entries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nenhuma execução registrada ainda.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => {
            const meta = AGENT_META[entry.agent]
            const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.success
            const StatusIcon = statusStyle.icon
            const AgentIcon = meta?.icon || Bot

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-700/20 transition-colors group"
              >
                <div className={`p-1.5 rounded-md ${statusStyle.bg}`}>
                  <StatusIcon size={14} className={statusStyle.text} />
                </div>
                <AgentIcon size={14} className={meta?.color || 'text-slate-400'} />
                <span className="text-sm text-slate-200 w-36 truncate">{meta?.label || entry.agent}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  {entry.status}
                </span>
                <span className="text-xs text-slate-500 w-16">{entry.trigger}</span>
                <span className="text-xs text-slate-500 font-mono flex-1 text-right">{formatNumber(entry.tokens)} tok</span>
                <span className="text-xs text-slate-500 font-mono w-16 text-right">{entry.duration}ms</span>
                <span className="text-xs text-slate-500 w-20 text-right">{timeAgo(entry.time)}</span>
                {entry.error && (
                  <span className="text-xs text-rose-400 truncate max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity">
                    {entry.error}
                  </span>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════════════════

function KPICard({ icon: Icon, label, value, color }: {
  icon: typeof Zap; label: string; value: string | number; color: string
}) {
  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className={color} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
