"use client"

import { useRouter } from "next/navigation"
import { DashboardHomeV6 } from "../views/DashboardHomeV6"
import { DashboardQuickActions } from "./DashboardQuickActions"
import "./dashboard-final.css"

export function DashboardRouteClient({ userName, tenantName, tenantId }: { userName:string; tenantName:string; tenantId:string }) {
  const router=useRouter()
  const goView=(view:any)=>router.push(`/admin?view=${encodeURIComponent(String(view))}`)
  return <div className="dashboard-final">
    <div className="dashboard-mobile-safe-actions"><DashboardQuickActions tenantId={tenantId} /></div>
    <DashboardHomeV6 setView={goView} userName={userName} tenantName={tenantName} tenantId={tenantId} onNewPatient={()=>router.push('/admin?view=patients')} />
  </div>
}
