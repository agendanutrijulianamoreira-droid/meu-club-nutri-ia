"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users, TrendingUp, Loader2, CheckCircle2, AlertTriangle,
  ChevronRight, Clock, Gift, Star, Zap, RefreshCw, Plus
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface PatientJourney {
  id: string
  patient_id: string
  stage: string
  previous_stage?: string
  stage_entered_at: string
  upsell_offer?: string
  upsell_offered_at?: string
  upsell_approved_by_admin?: boolean
  upsell_converted?: boolean
  upsell_converted_at?: string
  trigger_reason?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    name: string
    email: string
    current_plan: string
    primary_goal?: string
    total_xp: number
    current_streak: number
    last_checkin_date?: string
  }
}

interface JourneyData {
  journeys: PatientJourney[]
  pipeline: Record<string, PatientJourney[]>
  patients_without_journey: Array<{
    id: string; name: string; email: string; current_plan: string;
    primary_goal?: string; total_xp: number; current_streak: number; last_checkin_date?: string
  }>
  total: number
}

const STAGES = [
  { id: 'awareness', label: 'Conscientização', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' },
  { id: 'problem_aware', label: 'Ciente do Problema', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  { id: 'solution_aware', label: 'Ciente da Solução', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', dot: 'bg-sky-400' },
  { id: 'value_anchored', label: 'Valor Ancorado', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', dot: 'bg-violet-400' },
  { id: 'upsell_ready', label: 'Pronta para Upsell', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', dot: 'bg-indigo-400' },
  { id: 'converted', label: 'Convertida', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
]

const UPSELL_OFFERS = [
  { id: 'genetic_map', label: 'Mapa Genético', icon: '🧬' },
  { id: 'presential_checkup', label: 'Consulta Presencial', icon: '🩺' },
  { id: 'protocol_reprogramming', label: 'Reprogramação de Protocolo', icon: '🔄' },
  { id: 'annual_plan', label: 'Plano Anual', icon: '📅' },
]

type ViewMode = 'kanban' | 'table'

export function JourneyView({ setView, tenantId = '' }: { setView: (v: any) => void; tenantId?: string }) {
  const [data, setData] = useState<JourneyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [advancing, setAdvancing] = useState<string | null>(null)

  // Modal state for advancing stage
  const [modal, setModal] = useState<{
    patientId: string
    patientName: string
    currentStage: string
    type: 'advance' | 'upsell'
  } | null>(null)
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedUpsell, setSelectedUpsell] = useState('')
  const [triggerReason, setTriggerReason] = useState('')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/patient-journey')
      const json = await res.json()
      setData(json)
    } catch {
      showToast('error', 'Erro ao carregar jornadas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAdvanceStage = async () => {
    if (!modal || !selectedStage) return
    setAdvancing(modal.patientId)
    try {
      const res = await fetch('/api/admin/patient-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: modal.patientId,
          stage: selectedStage,
          upsell_offer: selectedUpsell || undefined,
          trigger_reason: triggerReason || 'admin_manual_advance',
        }),
      })
      if (!res.ok) throw new Error('Erro')
      showToast('success', `${modal.patientName} avançada para ${STAGES.find(s => s.id === selectedStage)?.label}`)
      setModal(null)
      setSelectedStage('')
      setSelectedUpsell('')
      setTriggerReason('')
      loadData()
    } catch {
      showToast('error', 'Erro ao avançar estágio')
    } finally {
      setAdvancing(null)
    }
  }

  const getPatientData = (journey: PatientJourney) => journey.profiles
  const getDaysInStage = (journey: PatientJourney) => {
    if (!journey.stage_entered_at) return 0
    return Math.floor((Date.now() - new Date(journey.stage_entered_at).getTime()) / 86400000)
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-white">Jornada das <span className="font-bold">Pacientes</span></h1>
          <p className="text-slate-500 text-sm mt-1">Pipeline de CRM — acompanhe cada paciente em sua jornada de transformação</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
            {(['kanban', 'table'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'kanban' ? 'Kanban' : 'Tabela'}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white text-sm font-bold transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-6 gap-3">
          {STAGES.map(stage => {
            const count = (data.pipeline[stage.id] || []).length
            return (
              <div key={stage.id} className={`bg-white/5 border rounded-2xl p-3 text-center ${stage.bg}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${stage.dot} mx-auto mb-2`} />
                <p className="text-white font-black text-xl">{count}</p>
                <p className={`text-[9px] font-black uppercase tracking-wider ${stage.color} mt-0.5 leading-tight`}>
                  {stage.label}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* Kanban view */}
      {!loading && data && viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map(stage => {
              const journeys = data.pipeline[stage.id] || []
              return (
                <div key={stage.id} className="w-72 flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${stage.bg}`}>
                    <div className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    <span className={`text-xs font-black ${stage.color}`}>{stage.label}</span>
                    <span className={`ml-auto text-xs font-black ${stage.color} opacity-60`}>{journeys.length}</span>
                  </div>

                  <div className="space-y-2">
                    {journeys.map(journey => {
                      const patient = getPatientData(journey)
                      const days = getDaysInStage(journey)
                      if (!patient) return null
                      return (
                        <div key={journey.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-indigo-500/30 transition-all">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-white font-bold text-sm">{patient.name}</p>
                              <p className="text-slate-500 text-xs capitalize">{patient.current_plan?.replace('_', ' ')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-indigo-400 font-black text-xs">{patient.total_xp} XP</p>
                              <p className="text-slate-600 text-[9px]">{days}d aqui</p>
                            </div>
                          </div>

                          {journey.upsell_offer && !journey.upsell_converted && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-2">
                              <Gift size={10} className="text-indigo-400" />
                              <span className="text-indigo-400 text-[9px] font-black">
                                {UPSELL_OFFERS.find(u => u.id === journey.upsell_offer)?.label}
                              </span>
                            </div>
                          )}

                          {journey.upsell_converted && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-2">
                              <Star size={10} className="text-emerald-400" />
                              <span className="text-emerald-400 text-[9px] font-black">Convertida!</span>
                            </div>
                          )}

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setModal({ patientId: journey.patient_id, patientName: patient.name, currentStage: journey.stage, type: 'advance' })
                                setSelectedStage('')
                              }}
                              className="flex-1 text-[9px] font-black uppercase py-1.5 px-2 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                              <ChevronRight size={10} /> Avançar
                            </button>
                            {stage.id === 'value_anchored' || stage.id === 'upsell_ready' ? (
                              <button
                                onClick={() => {
                                  setModal({ patientId: journey.patient_id, patientName: patient.name, currentStage: journey.stage, type: 'upsell' })
                                  setSelectedUpsell('')
                                }}
                                className="flex-1 text-[9px] font-black uppercase py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 rounded-lg transition-all flex items-center justify-center gap-1"
                              >
                                <Gift size={10} /> Oferta
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}

                    {journeys.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-2xl p-4 text-center">
                        <p className="text-slate-600 text-xs">Nenhuma paciente</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table view */}
      {!loading && data && viewMode === 'table' && (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Paciente</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Estágio</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Dias</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">XP</th>
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Oferta Upsell</th>
                <th className="text-right px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.journeys.map(journey => {
                const patient = getPatientData(journey)
                if (!patient) return null
                const stageMeta = STAGES.find(s => s.id === journey.stage)
                const days = getDaysInStage(journey)
                const upsellLabel = journey.upsell_offer
                  ? UPSELL_OFFERS.find(u => u.id === journey.upsell_offer)?.label
                  : null

                return (
                  <tr key={journey.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                    <td className="px-5 py-3">
                      <p className="text-white font-bold text-sm">{patient.name}</p>
                      <p className="text-slate-500 text-xs capitalize">{patient.current_plan?.replace('_', ' ')}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${stageMeta?.bg} ${stageMeta?.color}`}>
                        {stageMeta?.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-sm">{days}d</td>
                    <td className="px-5 py-3 text-indigo-400 font-bold text-sm">{patient.total_xp}</td>
                    <td className="px-5 py-3">
                      {upsellLabel ? (
                        <span className={`text-xs font-bold ${journey.upsell_converted ? 'text-emerald-400' : 'text-indigo-400'}`}>
                          {journey.upsell_converted ? '✅ ' : ''}{upsellLabel}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setModal({ patientId: journey.patient_id, patientName: patient.name, currentStage: journey.stage, type: 'advance' })
                            setSelectedStage('')
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-all px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                        >
                          Avançar
                        </button>
                        <button
                          onClick={() => {
                            setModal({ patientId: journey.patient_id, patientName: patient.name, currentStage: journey.stage, type: 'upsell' })
                            setSelectedUpsell('')
                          }}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20"
                        >
                          Oferta
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {data.journeys.length === 0 && (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto text-slate-600 mb-4" />
              <p className="text-white font-bold">Nenhuma jornada registrada</p>
              <p className="text-slate-500 text-sm mt-1">As jornadas são criadas automaticamente pela IA ou manualmente aqui.</p>
            </div>
          )}
        </div>
      )}

      {/* Patients without journey */}
      {!loading && data && data.patients_without_journey.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <p className="text-amber-400 font-bold text-sm">
              {data.patients_without_journey.length} paciente(s) sem jornada registrada
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.patients_without_journey.slice(0, 8).map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setModal({ patientId: p.id, patientName: p.name, currentStage: '', type: 'advance' })
                  setSelectedStage('awareness')
                }}
                className="text-xs font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:text-white hover:border-indigo-500/30 transition-all flex items-center gap-1.5"
              >
                <Plus size={10} /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Advance Stage / Offer Upsell */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md"
            >
              <h2 className="text-white font-bold text-lg mb-1">
                {modal.type === 'advance' ? 'Avançar Estágio' : 'Oferecer Upsell'}
              </h2>
              <p className="text-slate-400 text-sm mb-5">{modal.patientName}</p>

              {modal.type === 'advance' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Novo Estágio</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STAGES.filter(s => s.id !== modal.currentStage).map(stage => (
                        <button
                          key={stage.id}
                          onClick={() => setSelectedStage(stage.id)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            selectedStage === stage.id
                              ? `${stage.bg} ${stage.color}`
                              : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${stage.dot} mb-1.5`} />
                          <p className="text-xs font-bold leading-tight">{stage.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Motivo (opcional)</p>
                    <input
                      value={triggerReason}
                      onChange={e => setTriggerReason(e.target.value)}
                      placeholder="Ex: Alta adesão nos últimos 30 dias"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {modal.type === 'upsell' && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tipo de Oferta</p>
                  <div className="grid grid-cols-2 gap-2">
                    {UPSELL_OFFERS.map(offer => (
                      <button
                        key={offer.id}
                        onClick={() => setSelectedUpsell(offer.id)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          selectedUpsell === offer.id
                            ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <p className="text-lg mb-1">{offer.icon}</p>
                        <p className="text-xs font-bold leading-tight">{offer.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-sm font-bold hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (modal.type === 'upsell') {
                      // For upsell, use the advance endpoint with the upsell offer
                      setAdvancing(modal.patientId)
                      fetch('/api/admin/patient-journey', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          patient_id: modal.patientId,
                          stage: modal.currentStage || 'upsell_ready',
                          upsell_offer: selectedUpsell,
                          trigger_reason: 'admin_upsell_offer',
                        }),
                      }).then(res => {
                        if (!res.ok) throw new Error('Erro')
                        showToast('success', `Oferta ${UPSELL_OFFERS.find(u => u.id === selectedUpsell)?.label} criada para ${modal.patientName}`)
                        setModal(null)
                        setSelectedUpsell('')
                        loadData()
                      }).catch(() => {
                        showToast('error', 'Erro ao criar oferta')
                      }).finally(() => setAdvancing(null))
                    } else {
                      handleAdvanceStage()
                    }
                  }}
                  disabled={
                    (modal.type === 'advance' && !selectedStage) ||
                    (modal.type === 'upsell' && !selectedUpsell) ||
                    advancing === modal.patientId
                  }
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  {advancing === modal.patientId
                    ? <Loader2 size={14} className="animate-spin" />
                    : modal.type === 'advance' ? <ChevronRight size={14} /> : <Gift size={14} />
                  }
                  {modal.type === 'advance' ? 'Avançar' : 'Oferecer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
