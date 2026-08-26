"use client"

import { useRouter } from "next/navigation"
import { DashboardHomeV3 } from "../views/DashboardHomeV3"
import { DashboardQuickActions } from "./DashboardQuickActions"

export function DashboardRouteClient({ userName, tenantName, tenantId }: { userName:string; tenantName:string; tenantId:string }) {
  const router=useRouter()
  const goView=(view:any)=>router.push(`/admin?view=${encodeURIComponent(String(view))}`)
  return <>
    <DashboardQuickActions tenantId={tenantId} />
    <DashboardHomeV3 setView={goView} userName={userName} tenantName={tenantName} tenantId={tenantId} onNewPatient={()=>router.push('/admin?view=patients')} />
  </>
}
