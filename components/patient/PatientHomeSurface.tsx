"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"

import { usePatientHomeData } from "@/components/patient/PatientHomeDataProvider"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"
import { PatientRescueMode } from "@/components/patient/PatientRescueMode"

export function PatientHomeSurface() {
  const { payload, loading, error, refresh } = usePatientHomeData()

  if (loading && !payload) {
    return (
      <main className="min-h-screen bg-[#F4EFE4] text-[#2B1A10] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#C9A435]" size={30} />
      </main>
    )
  }

  if (error && !payload) {
    return (
      <main className="min-h-screen bg-[#F4EFE4] text-[#2B1A10] flex items-center justify-center p-5">
        <section className="w-full max-w-[420px] rounded-3xl bg-white border border-[#2B1A10]/10 p-6 text-center shadow-sm">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700">
            <AlertTriangle size={21} />
          </div>
          <h1 className="font-serif text-xl font-semibold mt-4">Não consegui carregar sua Home agora</h1>
          <p className="text-sm text-[#2B1A10]/50 mt-2 leading-relaxed">Seus dados não foram apagados. Tente carregar novamente.</p>
          <button onClick={() => refresh()} className="mt-5 w-full rounded-2xl bg-[#2B1A10] text-[#F4EFE4] py-3.5 text-sm font-bold flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  const protocolEnded = !!payload?.protocol?.ended

  return (
    <>
      {error && payload && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[95] w-[calc(100%-2rem)] max-w-[420px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg flex items-center gap-3 text-amber-900">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="text-xs font-semibold flex-1">Alguns dados podem estar desatualizados.</p>
          <button onClick={() => refresh()} className="text-xs font-bold underline underline-offset-2">Atualizar</button>
        </div>
      )}
      {protocolEnded && (
        <div className="mx-auto max-w-[460px] px-4 pt-4 -mb-1">
          <section className="rounded-2xl border border-[#C9A435]/25 bg-[#C9A435]/8 px-4 py-3 flex items-start gap-3 text-[#2B1A10]">
            <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shrink-0 text-[#9B7A16]"><CheckCircle2 size={18} /></div>
            <div>
              <p className="text-sm font-bold">Protocolo concluído</p>
              <p className="text-xs text-[#2B1A10]/55 mt-0.5 leading-relaxed">Você chegou ao final desta etapa. Suas tarefas ficam pausadas enquanto o próximo passo do acompanhamento é definido.</p>
            </div>
          </section>
        </div>
      )}
      {!protocolEnded && <PatientRescueMode />}
      <PatientHomeV2 />
    </>
  )
}
