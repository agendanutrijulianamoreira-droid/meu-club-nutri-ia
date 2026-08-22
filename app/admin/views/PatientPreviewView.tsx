"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone, Tablet } from "lucide-react"

import { PatientHomeDataProvider } from "@/components/patient/PatientHomeDataProvider"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"
import { PatientRescueMode } from "@/components/patient/PatientRescueMode"

type PatientOption = { user_id: string; name: string | null }
type Viewport = "mobile" | "tablet" | "desktop"
type PreviewScenario = "real" | "active" | "rescue" | "first-day" | "high-adherence"

const viewportWidths: Record<Viewport, string> = {
  mobile: "390px",
  tablet: "768px",
  desktop: "100%",
}

function localDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function shiftDate(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function demoProtocol(payload: any) {
  const existingItems = payload?.protocol?.items || []
  const items = existingItems.length ? existingItems : [
    { id: "preview-hydration", title: "Meta de hidratação", description: "Distribua sua água ao longo do dia." },
    { id: "preview-meal", title: "Montar o prato principal", description: "Priorize proteína, vegetais e a porção planejada." },
    { id: "preview-movement", title: "Movimento do dia", description: "Faça a atividade combinada para hoje." },
  ]

  return {
    assignmentId: payload?.protocol?.assignmentId || "preview-assignment",
    startDate: payload?.protocol?.startDate || payload.today,
    protocol: payload?.protocol?.protocol || { id: "preview-protocol", title: "Protocolo de acompanhamento", duration_days: 21 },
    currentDay: payload?.protocol?.currentDay || 1,
    items,
    progress: payload?.protocol?.progress || {},
    completionRate: payload?.protocol?.completionRate || 0,
  }
}

function applyScenario(source: any, scenario: PreviewScenario) {
  if (!source || scenario === "real") return source

  const payload = JSON.parse(JSON.stringify(source))
  const protocol = demoProtocol(payload)
  payload.protocol = protocol

  if (scenario === "active") {
    payload.protocol.currentDay = Math.max(2, protocol.currentDay || 1)
    payload.protocol.startDate = shiftDate(payload.today, -(payload.protocol.currentDay - 1))
    payload.dailyCheckinSubmitted = true
    payload.weeklyCheckinSubmitted = true
    return payload
  }

  if (scenario === "first-day") {
    payload.protocol.currentDay = 1
    payload.protocol.startDate = payload.today
    payload.protocol.progress = {}
    payload.protocol.completionRate = 0
    payload.progressHistory = []
    payload.dailyLogs = []
    payload.todayLog = null
    payload.checkins = []
    payload.dailyCheckinSubmitted = false
    payload.weeklyCheckinSubmitted = false
    if (payload.clinicalJourney) {
      payload.clinicalJourney.startedAt = payload.today
      payload.clinicalJourney.weekNumber = 1
    }
    payload.profile = { ...payload.profile, current_streak: 0, total_xp: 0 }
    return payload
  }

  if (scenario === "high-adherence") {
    const dates = Array.from({ length: 7 }, (_, index) => shiftDate(payload.today, index - 6))
    payload.dailyLogs = dates.map(date => ({
      log_date: date,
      water_check: true,
      water_ml: 2500,
      meal_plan_check: true,
      workout_check: true,
      daily_victory: "Mantive o combinado do dia.",
    }))
    payload.todayLog = payload.dailyLogs[payload.dailyLogs.length - 1]
    payload.checkins = dates.map(date => ({ data: date, nivel_energia: 8, nivel_inchaco: 2, nivel_compulsao: 2, qualidade_sono: 8, nivel_ansiedade: 2 }))
    payload.dailyCheckinSubmitted = true
    payload.weeklyCheckinSubmitted = true
    payload.protocol.progress = Object.fromEntries(payload.protocol.items.map((item: any) => [item.id, true]))
    payload.protocol.completionRate = 100
    payload.progressHistory = dates.flatMap(date => payload.protocol.items.slice(0, 2).map((item: any) => ({ protocol_item_id: item.id, checkin_date: date })))
    payload.profile = {
      ...payload.profile,
      current_streak: Math.max(7, payload.profile?.current_streak || 0),
      total_xp: Math.max(650, payload.profile?.total_xp || 0),
      nutri_coins: Math.max(120, payload.profile?.nutri_coins || 0),
    }
    return payload
  }

  if (scenario === "rescue") {
    payload.protocol.startDate = shiftDate(payload.today, -8)
    payload.protocol.currentDay = 9
    payload.protocol.progress = {}
    payload.protocol.completionRate = 0
    payload.progressHistory = []
    payload.dailyLogs = []
    payload.todayLog = null
    payload.checkins = []
    payload.dailyCheckinSubmitted = false
    payload.weeklyCheckinSubmitted = false
    return payload
  }

  return payload
}

export function PatientPreviewView({ tenantId }: { setView?: (view: any) => void; tenantId: string }) {
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientId, setPatientId] = useState("")
  const [payload, setPayload] = useState<any | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<PreviewScenario>("real")
  const [viewport, setViewport] = useState<Viewport>("mobile")
  const localDate = useMemo(() => localDateString(), [])

  useEffect(() => {
    let active = true
    fetch("/api/admin/patient-preview", { cache: "no-store" })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar as pacientes")
        if (!active) return
        setPatients(body.patients || [])
        if (body.patients?.[0]?.user_id) setPatientId(body.patients[0].user_id)
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoadingList(false))
    return () => { active = false }
  }, [tenantId])

  const loadPreview = async (id = patientId) => {
    if (!id) return
    setLoadingPreview(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/patient-preview?patient_id=${encodeURIComponent(id)}&date=${localDate}`, { cache: "no-store" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Não foi possível montar o preview")
      setPayload(body.payload)
    } catch (err: any) {
      setError(err.message || "Erro ao carregar preview")
      setPayload(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  useEffect(() => {
    if (patientId) loadPreview(patientId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const selectedName = useMemo(() => patients.find(patient => patient.user_id === patientId)?.name || "Paciente", [patients, patientId])
  const previewPayload = useMemo(() => applyScenario(payload, scenario), [payload, scenario])

  return (
    <div className="p-6 md:p-8 max-w-[1500px] mx-auto w-full">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#C9A435] mb-2">Experiência da paciente</p>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-[#2B1A10]">Visualizar app como paciente</h1>
          <p className="text-sm text-[#2B1A10]/55 mt-2 max-w-2xl">Este preview renderiza os mesmos componentes da Home da paciente com um snapshot administrativo. Nenhuma ação da paciente é executada neste modo.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800"><ShieldCheck size={16} /> Home real · somente leitura</div>
      </div>

      <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        <aside className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm xl:sticky xl:top-24">
          <label className="block text-[10px] uppercase tracking-[0.16em] font-black text-[#2B1A10]/45 mb-2">Paciente</label>
          {loadingList ? <div className="h-12 rounded-2xl bg-[#F4EFE4] flex items-center justify-center"><Loader2 size={18} className="animate-spin text-[#C9A435]" /></div> : (
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="w-full h-12 rounded-2xl border border-[#2B1A10]/10 bg-[#F4EFE4]/55 px-4 text-sm font-semibold text-[#2B1A10] outline-none focus:border-[#C9A435]">
              {patients.length === 0 && <option value="">Nenhuma paciente encontrada</option>}
              {patients.map(patient => <option key={patient.user_id} value={patient.user_id}>{patient.name || patient.user_id.slice(0, 8)}</option>)}
            </select>
          )}

          <label className="block text-[10px] uppercase tracking-[0.16em] font-black text-[#2B1A10]/45 mt-5 mb-2">Cenário</label>
          <select value={scenario} onChange={e => setScenario(e.target.value as PreviewScenario)} className="w-full h-12 rounded-2xl border border-[#2B1A10]/10 bg-[#F4EFE4]/55 px-4 text-sm font-semibold text-[#2B1A10] outline-none focus:border-[#C9A435]">
            <option value="real">Dados reais</option>
            <option value="active">Em acompanhamento</option>
            <option value="first-day">Primeiro dia</option>
            <option value="high-adherence">Alta adesão</option>
            <option value="rescue">Modo Resgate</option>
          </select>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.16em] font-black text-[#2B1A10]/45 mb-2">Viewport</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setViewport("mobile")} className={`h-11 rounded-xl border flex items-center justify-center ${viewport === "mobile" ? "bg-[#2B1A10] text-white border-[#2B1A10]" : "bg-white border-[#2B1A10]/10"}`} title="Celular"><Smartphone size={16} /></button>
              <button onClick={() => setViewport("tablet")} className={`h-11 rounded-xl border flex items-center justify-center ${viewport === "tablet" ? "bg-[#2B1A10] text-white border-[#2B1A10]" : "bg-white border-[#2B1A10]/10"}`} title="Tablet"><Tablet size={16} /></button>
              <button onClick={() => setViewport("desktop")} className={`h-11 rounded-xl border flex items-center justify-center ${viewport === "desktop" ? "bg-[#2B1A10] text-white border-[#2B1A10]" : "bg-white border-[#2B1A10]/10"}`} title="Desktop"><MonitorSmartphone size={16} /></button>
            </div>
          </div>

          <button onClick={() => loadPreview()} disabled={!patientId || loadingPreview} className="mt-5 w-full h-12 rounded-2xl bg-[#2B1A10] text-[#F4EFE4] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loadingPreview ? "animate-spin" : ""} /> Atualizar dados reais</button>
          <a href="/demo/patient" target="_blank" rel="noreferrer" className="mt-3 w-full h-12 rounded-2xl border border-[#2B1A10]/10 bg-white font-bold text-sm flex items-center justify-center gap-2 text-[#2B1A10]"><ExternalLink size={16} /> Abrir login demo</a>

          <div className="mt-5 rounded-2xl bg-[#F4EFE4]/70 p-4 text-xs leading-relaxed text-[#2B1A10]/55"><strong className="text-[#2B1A10]">{selectedName}</strong><br />Os cenários são aplicados somente ao snapshot local. O banco da paciente permanece intacto.</div>
        </aside>

        <div className="rounded-3xl border border-[#2B1A10]/10 bg-[#EEE8DB] min-h-[860px] p-4 md:p-6 overflow-auto">
          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          <div className="mx-auto transition-all duration-200" style={{ width: viewportWidths[viewport], maxWidth: "100%" }}>
            <div className="rounded-[32px] overflow-hidden border border-[#2B1A10]/15 bg-[#F4EFE4] shadow-xl shadow-[#2B1A10]/10">
              <div className="h-9 bg-[#2B1A10] text-[#F4EFE4] px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em]"><span>Preview · {selectedName}</span><span>{viewport === "mobile" ? "390 px" : viewport === "tablet" ? "768 px" : "responsivo"}</span></div>
              {loadingPreview && !previewPayload ? (
                <div className="min-h-[760px] flex items-center justify-center bg-[#F4EFE4]"><Loader2 size={26} className="animate-spin text-[#C9A435]" /></div>
              ) : previewPayload ? (
                <PatientHomeDataProvider initialPayload={previewPayload} staticPayload readOnly>
                  <div
                    className="relative"
                    onClickCapture={event => { event.preventDefault(); event.stopPropagation() }}
                    onSubmitCapture={event => { event.preventDefault(); event.stopPropagation() }}
                    onKeyDownCapture={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                    }}
                  >
                    {scenario === "rescue" ? <PatientRescueMode embedded readOnly /> : <PatientHomeV2 />}
                  </div>
                </PatientHomeDataProvider>
              ) : (
                <div className="min-h-[760px] flex items-center justify-center bg-[#F4EFE4] p-8 text-center text-sm text-[#2B1A10]/50">Selecione uma paciente para montar a visualização.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
