"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone, Tablet } from "lucide-react"
import { PatientPreviewSurface, PatientPreviewScenario, PatientPreviewModel } from "@/components/patient/PatientPreviewSurface"

type PatientOption = { user_id: string; name: string | null }
type Viewport = "mobile" | "tablet" | "desktop"

const viewportWidths: Record<Viewport, string> = {
  mobile: "390px",
  tablet: "768px",
  desktop: "100%",
}

export function PatientPreviewView({ tenantId }: { setView?: (view: any) => void; tenantId: string }) {
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientId, setPatientId] = useState("")
  const [model, setModel] = useState<PatientPreviewModel | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<PatientPreviewScenario>("real")
  const [viewport, setViewport] = useState<Viewport>("mobile")

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
      const response = await fetch(`/api/admin/patient-preview?patient_id=${encodeURIComponent(id)}`, { cache: "no-store" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Não foi possível montar o preview")
      setModel(body.model)
    } catch (err: any) {
      setError(err.message || "Erro ao carregar preview")
      setModel(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  useEffect(() => {
    if (patientId) loadPreview(patientId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const selectedName = useMemo(() => patients.find(patient => patient.user_id === patientId)?.name || "Paciente", [patients, patientId])

  return (
    <div className="p-6 md:p-8 max-w-[1500px] mx-auto w-full">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#C9A435] mb-2">Experiência da paciente</p>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-[#2B1A10]">Visualizar app como paciente</h1>
          <p className="text-sm text-[#2B1A10]/55 mt-2 max-w-2xl">Preview administrativo em modo somente leitura. Ele usa dados reais da paciente sem trocar sua sessão nem permitir alterações acidentais.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800"><ShieldCheck size={16} /> Somente leitura</div>
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
          <select value={scenario} onChange={e => setScenario(e.target.value as PatientPreviewScenario)} className="w-full h-12 rounded-2xl border border-[#2B1A10]/10 bg-[#F4EFE4]/55 px-4 text-sm font-semibold text-[#2B1A10] outline-none focus:border-[#C9A435]">
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

          <button onClick={() => loadPreview()} disabled={!patientId || loadingPreview} className="mt-5 w-full h-12 rounded-2xl bg-[#2B1A10] text-[#F4EFE4] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loadingPreview ? "animate-spin" : ""} /> Atualizar preview</button>
          <a href="/demo/patient" target="_blank" rel="noreferrer" className="mt-3 w-full h-12 rounded-2xl border border-[#2B1A10]/10 bg-white font-bold text-sm flex items-center justify-center gap-2 text-[#2B1A10]"><ExternalLink size={16} /> Abrir login demo</a>

          <div className="mt-5 rounded-2xl bg-[#F4EFE4]/70 p-4 text-xs leading-relaxed text-[#2B1A10]/55"><strong className="text-[#2B1A10]">{selectedName}</strong><br />O cenário altera somente a visualização local do preview. Nenhum dado é gravado na conta da paciente.</div>
        </aside>

        <div className="rounded-3xl border border-[#2B1A10]/10 bg-[#EEE8DB] min-h-[860px] p-4 md:p-6 overflow-auto">
          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          <div className="mx-auto transition-all duration-200" style={{ width: viewportWidths[viewport], maxWidth: "100%" }}>
            <div className="rounded-[32px] overflow-hidden border border-[#2B1A10]/15 bg-[#F4EFE4] shadow-xl shadow-[#2B1A10]/10">
              <div className="h-9 bg-[#2B1A10] text-[#F4EFE4] px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em]"><span>Preview · {selectedName}</span><span>{viewport === "mobile" ? "390 px" : viewport === "tablet" ? "768 px" : "responsivo"}</span></div>
              {loadingPreview && !model ? <div className="min-h-[760px] flex items-center justify-center bg-[#F4EFE4]"><Loader2 size={26} className="animate-spin text-[#C9A435]" /></div> : model ? <PatientPreviewSurface model={model} scenario={scenario} /> : <div className="min-h-[760px] flex items-center justify-center bg-[#F4EFE4] p-8 text-center text-sm text-[#2B1A10]/50">Selecione uma paciente para montar a visualização.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
