import Link from 'next/link'

export default function CommunicationsLayout({children}:{children:React.ReactNode}){
  return <>
    <div className="border-b border-violet-100 bg-violet-50 px-4 py-2 text-sm text-violet-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Comunicações da agenda</span>
        <div className="flex gap-2">
          <Link href="/admin/appointments/communications" className="rounded-lg px-3 py-1 font-bold hover:bg-white">Fila e canais</Link>
          <Link href="/admin/appointments/communications/whatsapp" className="rounded-lg bg-white px-3 py-1 font-bold shadow-sm">WhatsApp bidirecional</Link>
        </div>
      </div>
    </div>
    {children}
  </>
}
