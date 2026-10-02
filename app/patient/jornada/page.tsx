import Link from "next/link"
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, HeartPulse, Inbox, Scale, Target } from "lucide-react"

const JOURNEY_LINKS = [
  { href: "/patient/diet", label: "Meu plano alimentar", description: "Cardápio, refeições e orientações.", icon: ClipboardList, color: "text-emerald-400" },
  { href: "/patient/goals", label: "Minhas metas", description: "Objetivos definidos para sua rotina.", icon: Target, color: "text-amber-400" },
  { href: "/patient/checkin", label: "Check-in", description: "Registre como você está hoje.", icon: HeartPulse, color: "text-rose-400" },
  { href: "/patient/progresso", label: "Minha evolução", description: "Veja tendências e resultados.", icon: Scale, color: "text-violet-400" },
  { href: "/patient/recipes", label: "Receitas", description: "Ideias para colocar o plano em prática.", icon: BookOpen, color: "text-sky-400" },
  { href: "/patient/inbox", label: "Minha equipe", description: "Mensagens da nutri e acompanhamento.", icon: Inbox, color: "text-indigo-400" },
]

export default function PatientJourneyPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-32 text-white">
      <div className="mx-auto max-w-lg">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-indigo-400">Minha Jornada</p>
          <h1 className="mt-2 text-3xl font-black">Seu próximo passo, com clareza.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Tudo do seu acompanhamento reunido em um só lugar.</p>
        </header>

        <section className="mb-6 rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-950/80 to-violet-950/40 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-400/15 p-3"><CheckCircle2 className="text-indigo-300" size={22} /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Acompanhe seu processo</p>
              <h2 className="mt-1 text-lg font-bold">Pequenas ações constroem consistência.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Comece pelo check-in ou continue de onde parou no seu plano.</p>
            </div>
          </div>
          <Link href="/patient/checkin" className="mt-4 flex items-center justify-between rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold transition hover:bg-indigo-400">
            Fazer check-in <ArrowRight size={17} />
          </Link>
        </section>

        <div className="space-y-3">
          {JOURNEY_LINKS.map(({ href, label, description, icon: Icon, color }) => (
            <Link key={href} href={href} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 transition hover:border-indigo-400/30 hover:bg-white/[.07]">
              <div className="rounded-xl bg-white/[.06] p-3"><Icon className={color} size={20} /></div>
              <div className="min-w-0 flex-1"><p className="font-bold">{label}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>
              <ArrowRight className="shrink-0 text-slate-600" size={18} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
