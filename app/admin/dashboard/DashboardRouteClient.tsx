"use client"

import { useRouter } from "next/navigation"
import { DashboardHomeV2 } from "../views/DashboardHomeV2"

export function DashboardRouteClient({ userName, tenantName, tenantId }: { userName:string; tenantName:string; tenantId:string }) {
  const router=useRouter()
  const goView=(view:any)=>router.push(`/admin?view=${encodeURIComponent(String(view))}`)
  return <DashboardHomeV2 setView={goView} userName={userName} tenantName={tenantName} tenantId={tenantId} onNewPatient={()=>router.push('/admin?view=patients')} />
}
