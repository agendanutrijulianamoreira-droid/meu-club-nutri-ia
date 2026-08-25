import Link from 'next/link'

export default function CommunicationsLayout({children}:{children:React.ReactNode}){
  return <>
    <div className="border-b border-violet-100 bg-violet-50 px-4 py-2 text-sm text-violet-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Comunicações da agenda</span>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/appointments/communications" className="rounded-lg px-3 py-1 font-bold hover:bg-white">Fila e canais</Link>
          <Link href="/admin/appointments/communications/whatsapp" className="rounded-lg bg-white px-3 py-1 font-bold shadow-sm">WhatsApp bidirecional</Link>
          <Link href="/admin/appointments/communications/whatsapp/go-live" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 font-bold text-amber-900">Go-live piloto</Link>
          <Link href="/admin/settings/vital" className="rounded-lg border border-[#C9A435]/30 bg-[#FFF9E8] px-3 py-1 font-bold text-[#6D5513]">Chaves e integrações</Link>
        </div>
      </div>
    </div>
    {children}
  </>
}
