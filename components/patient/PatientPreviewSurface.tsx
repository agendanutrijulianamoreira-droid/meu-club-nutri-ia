"use client"

import { Activity, Calendar, CheckCircle2, Droplet, HeartPulse, RotateCcw, Sparkles } from "lucide-react"

export type PatientPreviewScenario = "real" | "active" | "rescue" | "first-day" | "high-adherence"

export type PatientPreviewModel = {
  id: string
  firstName: string
  fullName?: string | null
  methodName?: string | null
  phaseName?: string | null
  phaseNumber?: number | null
  weekNumber?: number | null
  phaseDescription?: string | null
  protocolTitle?: string | null
  currentDay?: number
  totalDays?: number
  completedToday?: number
  totalToday?: number
  completionRate?: number
  dailyCheckinPending?: boolean
  activeDays?: number
  hydrationDays?: number
  missionsCompleted?: number
  unreadCount?: number
  nextAppointment?: string | null
  inactiveFullDays?: number
  rescueActive?: boolean
  tasks?: Array<{ id: string; title: string; description?: string | null; done?: boolean }>
}

function applyScenario(base: PatientPreviewModel, scenario: PatientPreviewScenario): PatientPreviewModel {
  if (scenario === "real") return base
  if (scenario === "rescue") return { ...base, rescueActive: true, inactiveFullDays: Math.max(4, base.inactiveFullDays || 0), activeDays: 2 }
  if (scenario === "first-day") return { ...base, currentDay: 1, weekNumber: 1, completedToday: 0, completionRate: 0, dailyCheckinPending: true, tasks: (base.tasks || []).map(task => ({ ...task, done: false })) }
  if (scenario === "high-adherence") return { ...base, rescueActive: false, activeDays: 7, hydrationDays: 7, completionRate: 100, completedToday: base.totalToday || base.tasks?.length || 0, missionsCompleted: Math.max(base.missionsCompleted || 0, 12), tasks: (base.tasks || []).map(task => ({ ...task, done: true })) }
  return { ...base, rescueActive: false, activeDays: Math.max(base.activeDays || 0, 5) }
}

export function PatientPreviewSurface({ model, scenario = "real" }: { model: PatientPreviewModel; scenario?: PatientPreviewScenario }) {
  const data = applyScenario(model, scenario)
  const tasks = data.tasks || []
  const totalToday = data.totalToday ?? tasks.length
  const completedToday = data.completedToday ?? tasks.filter(task => task.done).length
  const completionRate = data.completionRate ?? (totalToday ? Math.round((completedToday / totalToday) * 100) : 0)
  const consistency = Math.round(((data.activeDays || 0) / 7) * 100)

  if (data.rescueActive) {
    return (
      <div className="min-h-[760px] bg-[#F4EFE4] text-[#2B1A10] px-5 py-10 flex flex-col justify-center">
        <div className="h-14 w-14 rounded-3xl bg-[#C9A435]/15 border border-[#C9A435]/20 flex items-center justify-center mb-6"><RotateCcw size={24} className="text-[#9B7A16]" /></div>
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#C9A435]">Modo Resgate</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight mt-2">Hoje, só precisamos recomeçar.</h1>
        <p className="text-sm leading-relaxed text-[#2B1A10]/60 mt-3">Há {data.inactiveFullDays || 3} dias completos sem registros. Nada para compensar: apenas um passo simples para retomar.</p>
        <div className="mt-8 space-y-3">
          <div className="rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5"><div className="flex items-center gap-4"><div className="h-11 w-11 rounded-2xl bg-[#C9A435] flex items-center justify-center"><HeartPulse size={20} /></div><div><p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 1</p><p className="font-semibold">Me contar como estou hoje</p><p className="text-xs text-[#F4EFE4]/55 mt-1">Um check-in curto para retomar o acompanhamento.</p></div></div></div>
          <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5"><div className="flex items-center gap-4"><div className="h-11 w-11 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center"><Droplet size={20} className="text-[#C9A435]" /></div><div><p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#C9A435]">Passo 2</p><p className="font-semibold">Registrar água agora</p><p className="text-xs text-[#2B1A10]/45 mt-1">Comece pelo básico. O restante volta depois.</p></div></div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[760px] bg-[#F4EFE4] text-[#2B1A10] px-4 pt-6 pb-10">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A435] mb-1">Visualização da paciente</p><h1 className="text-3xl font-serif font-semibold">{data.firstName}</h1><p className="text-sm text-[#2B1A10]/50 mt-1">{data.phaseName ? `Fase ${data.phaseNumber || 1} · ${data.phaseName} · Semana ${data.weekNumber || 1}` : data.protocolTitle || "Seu acompanhamento, um passo de cada vez"}</p></div>
        <div className="h-10 min-w-10 px-3 rounded-2xl bg-white border border-[#2B1A10]/10 flex items-center justify-center text-xs font-bold">{data.unreadCount || 0}</div>
      </header>

      {(data.phaseName || data.protocolTitle) && <section className="mb-4 rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm"><p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A435]">Minha jornada</p>{data.methodName && <p className="text-[11px] text-[#2B1A10]/45 mt-2">{data.methodName}</p>}<h2 className="font-serif text-xl font-semibold mt-1">{data.phaseName ? `Fase ${data.phaseNumber || 1} · ${data.phaseName}` : data.protocolTitle}</h2>{data.phaseDescription && <p className="text-xs text-[#2B1A10]/55 mt-2 leading-relaxed">{data.phaseDescription}</p>}<div className="mt-4 pt-4 border-t border-[#2B1A10]/5"><div className="flex justify-between text-xs font-semibold"><span>{completedToday} de {totalToday} ações concluídas</span><span className="text-[#C9A435]">Dia {data.currentDay || 1}/{data.totalDays || 21}</span></div><div className="h-2 mt-2 bg-[#2B1A10]/5 rounded-full overflow-hidden"><div className="h-full bg-[#C9A435] rounded-full" style={{ width: `${completionRate}%` }} /></div></div></section>}

      <section className="mb-5 rounded-3xl bg-[#2B1A10] text-[#F4EFE4] p-5 shadow-lg shadow-[#2B1A10]/10"><div className="flex items-start gap-4"><div className="h-11 w-11 rounded-2xl bg-[#C9A435] flex items-center justify-center"><HeartPulse size={20} /></div><div><p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Sua prioridade agora</p><h2 className="text-lg font-semibold mt-1">{data.dailyCheckinPending ? "Como você está hoje?" : tasks.find(task => !task.done)?.title || "Continue sua jornada"}</h2><p className="text-sm text-[#F4EFE4]/65 mt-1">{data.dailyCheckinPending ? "Registre energia, humor e sintomas. Leva menos de 3 minutos." : "Uma ação de cada vez. Conclua e siga para a próxima."}</p></div></div></section>

      <section className="mb-5"><div className="mb-3"><p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Últimos 7 dias</p><h2 className="font-serif text-xl font-semibold">Sua evolução</h2></div><div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-5 shadow-sm"><div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold">Consistência da semana</p><p className="text-xs text-[#2B1A10]/45">{data.activeDays || 0} de 7 dias com algum registro</p></div><div className="h-12 w-12 rounded-2xl bg-[#C9A435]/10 flex items-center justify-center text-[#9B7A16] font-bold text-sm">{consistency}%</div></div><div className="grid grid-cols-3 gap-2"><div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center"><HeartPulse size={17} className="mx-auto text-[#C9A435] mb-1" /><p className="text-lg font-bold">{data.activeDays || 0}</p><p className="text-[10px] text-[#2B1A10]/45">registros</p></div><div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center"><Droplet size={17} className="mx-auto text-[#C9A435] mb-1" /><p className="text-lg font-bold">{data.hydrationDays || 0}/7</p><p className="text-[10px] text-[#2B1A10]/45">meta de água</p></div><div className="rounded-2xl bg-[#F4EFE4]/70 p-3 text-center"><Activity size={17} className="mx-auto text-[#C9A435] mb-1" /><p className="text-lg font-bold">{data.missionsCompleted || 0}</p><p className="text-[10px] text-[#2B1A10]/45">missões</p></div></div></div></section>

      <section><div className="flex items-center justify-between mb-3"><div><p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A435]">Hoje</p><h2 className="font-serif text-xl font-semibold">Sua jornada de hoje</h2></div><span className="text-xs font-bold text-[#2B1A10]/45">{completedToday}/{totalToday}</span></div><div className="space-y-2.5">{tasks.length ? tasks.map(task => <div key={task.id} className="rounded-2xl bg-white border border-[#2B1A10]/10 p-4 flex items-start gap-3"><div className={`h-8 w-8 rounded-xl flex items-center justify-center ${task.done ? "bg-[#C9A435]/15 text-[#9B7A16]" : "bg-[#2B1A10]/5 text-[#2B1A10]/35"}`}>{task.done ? <CheckCircle2 size={16} /> : <Sparkles size={15} />}</div><div><p className="text-sm font-semibold">{task.title}</p>{task.description && <p className="text-xs text-[#2B1A10]/45 mt-1">{task.description}</p>}</div></div>) : <div className="rounded-3xl bg-white border border-[#2B1A10]/10 p-6 text-center"><Sparkles className="mx-auto text-[#C9A435] mb-3" size={24} /><p className="font-semibold">Nenhuma missão configurada para hoje</p></div>}</div></section>

      {data.nextAppointment && <div className="mt-5 rounded-2xl bg-white border border-[#2B1A10]/10 p-4 flex items-center gap-3"><Calendar size={18} className="text-[#C9A435]" /><div><p className="text-xs font-bold">Próxima consulta</p><p className="text-xs text-[#2B1A10]/45">{new Date(data.nextAppointment).toLocaleString("pt-BR")}</p></div></div>}
    </div>
  )
}
