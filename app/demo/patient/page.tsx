"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react"

import { PatientHomeDataProvider } from "@/components/patient/PatientHomeDataProvider"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"
import { PatientRescueMode } from "@/components/patient/PatientRescueMode"

type DemoScenario = "active" | "first-day" | "high-adherence" | "rescue"

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return localDate(date)
}

function buildBasePayload() {
  const today = localDate()
  const items = [
    { id: "demo-1", title: "Começar o dia com água", description: "Registre sua hidratação ao longo do dia.", time: "08:00" },
    { id: "demo-2", title: "Incluir proteína no almoço", description: "Monte a refeição seguindo o seu plano.", time: "12:30" },
    { id: "demo-3", title: "Fazer o check-in de sintomas", description: "Observe energia, inchaço e fome.", time: "18:00" },
    { id: "demo-4", title: "Registrar sua vitória do dia", description: "Reconheça uma escolha positiva de hoje.", time: "21:00" },
  ]

  return {
    userId: "demo-patient",
    today,
    weekStart: daysAgo(6),
    historyStart: daysAgo(13),
    profile: {
      name: "Mariana Demo",
      tenant_id: "demo-tenant",
      current_plan: "premium",
      created_at: `${daysAgo(45)}T12:00:00Z`,
      plan_started_at: `${daysAgo(45)}T12:00:00Z`,
      plan_expires_at: null,
      nutri_coins: 84,
      total_xp: 640,
      current_streak: 4,
    },
    unreadCount: 2,
    dailyLogs: [
      { log_date: daysAgo(6), water_check: true, water_ml: 2200, meal_plan_check: true, workout_check: false, daily_victory: "Preparei meu almoço." },
      { log_date: daysAgo(5), water_check: true, water_ml: 2500, meal_plan_check: true, workout_check: true, daily_victory: "Fiz uma caminhada." },
      { log_date: daysAgo(4), water_check: false, water_ml: 1400, meal_plan_check: true, workout_check: false, daily_victory: null },
      { log_date: daysAgo(3), water_check: true, water_ml: 2400, meal_plan_check: true, workout_check: true, daily_victory: "Comi com mais calma." },
      { log_date: daysAgo(1), water_check: true, water_ml: 2300, meal_plan_check: true, workout_check: false, daily_victory: "Não pulei refeições." },
      { log_date: today, water_check: true, water_ml: 1200, meal_plan_check: false, workout_check: false, daily_victory: "" },
    ],
    todayLog: { log_date: today, water_check: true, water_ml: 1200, meal_plan_check: false, workout_check: false, daily_victory: "" },
    checkins: [
      { data: daysAgo(13), nivel_energia: 5, nivel_inchaco: 7, nivel_compulsao: 6, qualidade_sono: 5, nivel_ansiedade: 7 },
      { data: daysAgo(11), nivel_energia: 5, nivel_inchaco: 6, nivel_compulsao: 6, qualidade_sono: 5, nivel_ansiedade: 6 },
      { data: daysAgo(9), nivel_energia: 6, nivel_inchaco: 6, nivel_compulsao: 5, qualidade_sono: 6, nivel_ansiedade: 6 },
      { data: daysAgo(6), nivel_energia: 6, nivel_inchaco: 5, nivel_compulsao: 5, qualidade_sono: 6, nivel_ansiedade: 5 },
      { data: daysAgo(4), nivel_energia: 7, nivel_inchaco: 4, nivel_compulsao: 4, qualidade_sono: 7, nivel_ansiedade: 5 },
      { data: daysAgo(2), nivel_energia: 7, nivel_inchaco: 4, nivel_compulsao: 3, qualidade_sono: 7, nivel_ansiedade: 4 },
    ],
    dailyCheckinSubmitted: false,
    weeklyCheckinSubmitted: true,
    pendingQuestionnaires: [],
    dietToday: { consumidas: 1120, meta: 1800 },
    nextReward: { name: "Guia exclusivo de receitas", cost: 120, emoji: "🎁" },
    protocol: {
      assignmentId: "demo-assignment",
      startDate: daysAgo(8),
      protocol: { id: "demo-protocol", title: "Reeducação alimentar", duration_days: 21 },
      currentDay: 9,
      items,
      progress: { "demo-1": true, "demo-2": true },
      completionRate: 50,
    },
    progressHistory: [
      { protocol_item_id: "hist-1", checkin_date: daysAgo(6), completed_at: `${daysAgo(6)}T12:00:00Z` },
      { protocol_item_id: "hist-2", checkin_date: daysAgo(5), completed_at: `${daysAgo(5)}T12:00:00Z` },
      { protocol_item_id: "hist-3", checkin_date: daysAgo(3), completed_at: `${daysAgo(3)}T12:00:00Z` },
      { protocol_item_id: "hist-4", checkin_date: daysAgo(1), completed_at: `${daysAgo(1)}T12:00:00Z` },
      { protocol_item_id: "demo-1", checkin_date: today, completed_at: `${today}T12:00:00Z` },
      { protocol_item_id: "demo-2", checkin_date: today, completed_at: `${today}T12:05:00Z` },
    ],
    clinicalJourney: {
      phaseName: "Organizando a casa",
      phaseDescription: "Organização da rotina, hidratação e estrutura das refeições para construir uma base consistente.",
      phaseNumber: 1,
      methodName: "Método da Clínica",
      startedAt: daysAgo(8),
      weekNumber: 2,
    },
    nextAppointment: {
      scheduled_at: `${daysAgo(-5)}T17:30:00-03:00`,
      is_virtual: true,
      meeting_link: "#",
      appointment_type: "Retorno",
    },
  }
}

function applyScenario(base: any, scenario: DemoScenario) {
  if (scenario === "first-day") {
    return {
      ...base,
      dailyLogs: [],
      todayLog: null,
      checkins: [],
      dailyCheckinSubmitted: false,
      weeklyCheckinSubmitted: false,
      dietToday: { consumidas: 0, meta: 1800 },
      progressHistory: [],
      protocol: {
        ...base.protocol,
        startDate: base.today,
        currentDay: 1,
        progress: {},
        completionRate: 0,
      },
      clinicalJourney: { ...base.clinicalJourney, startedAt: base.today, weekNumber: 1 },
      profile: { ...base.profile, current_streak: 0, total_xp: 0, nutri_coins: 0 },
    }
  }

  if (scenario === "high-adherence") {
    const progress = Object.fromEntries(base.protocol.items.map((item: any) => [item.id, true]))
    return {
      ...base,
      dailyCheckinSubmitted: true,
      todayLog: { ...base.todayLog, meal_plan_check: true, workout_check: true, daily_victory: "Cumpri o que combinei comigo hoje." },
      dailyLogs: Array.from({ length: 7 }, (_, index) => ({
        log_date: daysAgo(6 - index),
        water_check: true,
        water_ml: 2500,
        meal_plan_check: true,
        workout_check: index % 2 === 0,
        daily_victory: "Mantive minha rotina.",
      })),
      protocol: { ...base.protocol, progress, completionRate: 100 },
      profile: { ...base.profile, current_streak: 11, total_xp: 1320, nutri_coins: 156 },
      dietToday: { consumidas: 1710, meta: 1800 },
    }
  }

  if (scenario === "rescue") {
    const inactiveStart = daysAgo(4)
    return {
      ...base,
      dailyLogs: [{ log_date: inactiveStart, water_check: true, water_ml: 2100, meal_plan_check: true, workout_check: false, daily_victory: "Recomecei." }],
      todayLog: null,
      checkins: [{ data: inactiveStart, nivel_energia: 5, nivel_inchaco: 5, nivel_compulsao: 5, qualidade_sono: 5, nivel_ansiedade: 5 }],
      dailyCheckinSubmitted: false,
      progressHistory: [{ protocol_item_id: "hist-rescue", checkin_date: inactiveStart, completed_at: `${inactiveStart}T12:00:00Z` }],
      protocol: { ...base.protocol, startDate: daysAgo(20), currentDay: 21, progress: {}, completionRate: 0 },
      profile: { ...base.profile, current_streak: 0 },
    }
  }

  return base
}

export default function PatientDemoPage() {
  const [entered, setEntered] = useState(false)
  const [scenario, setScenario] = useState<DemoScenario>("active")

  const payload = useMemo(() => applyScenario(buildBasePayload(), scenario), [scenario])

  if (!entered) {
    return (
      <main className="min-h-screen bg-[#F4EFE4] text-[#2B1A10] flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-[32px] bg-white border border-[#2B1A10]/10 p-7 shadow-xl shadow-[#2B1A10]/10">
          <div className="h-14 w-14 rounded-3xl bg-[#C9A435]/15 border border-[#C9A435]/20 flex items-center justify-center mb-6"><Sparkles size={24} className="text-[#9B7A16]" /></div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-black text-[#C9A435]">Acesso demonstração</p>
          <h1 className="font-serif text-3xl font-semibold mt-2">Conheça a experiência da paciente</h1>
          <p className="text-sm text-[#2B1A10]/55 leading-relaxed mt-3">Este ambiente usa a mesma Home real da paciente, mas com dados fictícios. Você consegue testar os principais estados visuais sem acessar ou alterar prontuários reais.</p>

          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex gap-3"><ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-emerald-900">Ambiente seguro</p><p className="text-xs text-emerald-800/70 mt-0.5">Dados 100% sintéticos e Home bloqueada para gravações.</p></div></div>

          <button onClick={() => setEntered(true)} className="mt-7 w-full rounded-2xl bg-[#2B1A10] text-[#F4EFE4] font-bold flex items-center justify-center gap-2 py-4">Entrar como Mariana Demo <ArrowRight size={17} /></button>
          <Link href="/login/paciente" className="mt-3 w-full h-12 rounded-2xl border border-[#2B1A10]/10 flex items-center justify-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> Voltar ao login</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#EAE4D8] py-5 px-3 md:px-6">
      <div className="max-w-[460px] mx-auto">
        <div className="mb-3 rounded-2xl bg-[#2B1A10] text-[#F4EFE4] px-4 py-3 flex items-center justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-[#C9A435]">Demo</p><p className="text-xs font-semibold">Mariana Demo · Home real · dados fictícios</p></div>
          <button onClick={() => setEntered(false)} className="text-xs font-bold underline underline-offset-4">Sair</button>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {(["active", "first-day", "high-adherence", "rescue"] as DemoScenario[]).map(value => (
            <button key={value} onClick={() => setScenario(value)} className={`rounded-xl px-2 py-2 text-[10px] font-bold border ${scenario === value ? "bg-[#2B1A10] text-white border-[#2B1A10]" : "bg-white text-[#2B1A10] border-[#2B1A10]/10"}`}>
              {value === "active" ? "Normal" : value === "first-day" ? "1º dia" : value === "high-adherence" ? "Alta adesão" : "Resgate"}
            </button>
          ))}
        </div>

        <div className="rounded-[32px] overflow-hidden border border-[#2B1A10]/15 shadow-xl shadow-[#2B1A10]/10 bg-[#F4EFE4]">
          <PatientHomeDataProvider initialPayload={payload} staticPayload readOnly>
            <div onClickCapture={event => event.preventDefault()} onSubmitCapture={event => event.preventDefault()} className="[&_button]:cursor-default [&_a]:cursor-default">
              <PatientRescueMode embedded readOnly forceActive={scenario === "rescue"} forcedInactiveDays={4} />
              {scenario !== "rescue" && <PatientHomeV2 />}
            </div>
          </PatientHomeDataProvider>
        </div>
      </div>
    </main>
  )
}
