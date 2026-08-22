"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react"
import { PatientPreviewSurface, PatientPreviewModel, PatientPreviewScenario } from "@/components/patient/PatientPreviewSurface"

const demoModel: PatientPreviewModel = {
  id: "demo-patient",
  firstName: "Mariana",
  fullName: "Mariana Demo",
  methodName: "Método da Clínica",
  phaseName: "Organizando a Morada",
  phaseNumber: 1,
  weekNumber: 2,
  phaseDescription: "Organização da rotina, hidratação e estrutura das refeições para construir uma base consistente.",
  protocolTitle: "Reeducação alimentar",
  currentDay: 9,
  totalDays: 21,
  completedToday: 2,
  totalToday: 4,
  completionRate: 50,
  dailyCheckinPending: true,
  activeDays: 5,
  hydrationDays: 4,
  missionsCompleted: 11,
  unreadCount: 2,
  nextAppointment: "2026-08-27T14:30:00-03:00",
  rescueActive: false,
  inactiveFullDays: 0,
  tasks: [
    { id: "1", title: "Começar o dia com água", description: "Registre sua hidratação ao longo do dia.", done: true },
    { id: "2", title: "Incluir proteína no almoço", description: "Monte a refeição seguindo o seu plano.", done: true },
    { id: "3", title: "Fazer o check-in de sintomas", description: "Observe energia, inchaço e fome.", done: false },
    { id: "4", title: "Registrar sua vitória do dia", description: "Reconheça uma escolha positiva de hoje.", done: false },
  ],
}

export default function PatientDemoPage() {
  const [entered, setEntered] = useState(false)
  const [scenario, setScenario] = useState<PatientPreviewScenario>("active")

  if (!entered) {
    return (
      <main className="min-h-screen bg-[#F4EFE4] text-[#2B1A10] flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-[32px] bg-white border border-[#2B1A10]/10 p-7 shadow-xl shadow-[#2B1A10]/10">
          <div className="h-14 w-14 rounded-3xl bg-[#C9A435]/15 border border-[#C9A435]/20 flex items-center justify-center mb-6"><Sparkles size={24} className="text-[#9B7A16]" /></div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-black text-[#C9A435]">Acesso demonstração</p>
          <h1 className="font-serif text-3xl font-semibold mt-2">Conheça a experiência da paciente</h1>
          <p className="text-sm text-[#2B1A10]/55 leading-relaxed mt-3">Este ambiente usa uma paciente fictícia e dados sintéticos. Você pode navegar pelos principais estados visuais sem acessar ou alterar dados reais.</p>

          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex gap-3"><ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-emerald-900">Ambiente seguro</p><p className="text-xs text-emerald-800/70 mt-0.5">Nenhuma ação desta demonstração grava informações no prontuário.</p></div></div>

          <button onClick={() => setEntered(true)} className="mt-7 w-full h-13 rounded-2xl bg-[#2B1A10] text-[#F4EFE4] font-bold flex items-center justify-center gap-2 py-4">Entrar como Mariana Demo <ArrowRight size={17} /></button>
          <Link href="/login/paciente" className="mt-3 w-full h-12 rounded-2xl border border-[#2B1A10]/10 flex items-center justify-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> Voltar ao login</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#EAE4D8] py-5 px-3 md:px-6">
      <div className="max-w-[460px] mx-auto">
        <div className="mb-3 rounded-2xl bg-[#2B1A10] text-[#F4EFE4] px-4 py-3 flex items-center justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-[#C9A435]">Demo</p><p className="text-xs font-semibold">Mariana Demo · dados fictícios</p></div>
          <button onClick={() => setEntered(false)} className="text-xs font-bold underline underline-offset-4">Sair</button>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {(["active", "first-day", "high-adherence", "rescue"] as PatientPreviewScenario[]).map(value => (
            <button key={value} onClick={() => setScenario(value)} className={`rounded-xl px-2 py-2 text-[10px] font-bold border ${scenario === value ? "bg-[#2B1A10] text-white border-[#2B1A10]" : "bg-white text-[#2B1A10] border-[#2B1A10]/10"}`}>
              {value === "active" ? "Normal" : value === "first-day" ? "1º dia" : value === "high-adherence" ? "Alta adesão" : "Resgate"}
            </button>
          ))}
        </div>

        <div className="rounded-[32px] overflow-hidden border border-[#2B1A10]/15 shadow-xl shadow-[#2B1A10]/10">
          <PatientPreviewSurface model={demoModel} scenario={scenario} />
        </div>
      </div>
    </main>
  )
}
