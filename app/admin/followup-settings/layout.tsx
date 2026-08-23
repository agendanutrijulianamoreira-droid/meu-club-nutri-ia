import Link from 'next/link'

export default function FollowupSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed bottom-5 left-5 z-[90] flex flex-wrap gap-2">
        <Link href="/admin/followup-settings" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-lg">Regras gerais</Link>
        <Link href="/admin/followup-settings/feedback" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-lg">Feedback e saídas</Link>
      </div>
    </>
  )
}
