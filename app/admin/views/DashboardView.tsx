"use client"

import { DashboardQuickActions } from "../dashboard/DashboardQuickActions"
import { DashboardHomeV5 } from "./DashboardHomeV5"
import "../dashboard/dashboard-final.css"

export function DashboardView({
  setView,
  userName = '',
  tenantName = '',
  tenantId = '',
  onNewPatient,
}: {
  setView: (v: any) => void
  userName?: string
  tenantName?: string
  tenantId?: string
  onNewPatient?: () => void
  onGoToVipPatients?: () => void
  onGoToTrackingPatients?: () => void
}) {
  return <div className="dashboard-final">
    <div className="dashboard-mobile-safe-actions"><DashboardQuickActions tenantId={tenantId} /></div>
    <DashboardHomeV5
      setView={setView}
      userName={userName}
      tenantName={tenantName}
      tenantId={tenantId}
      onNewPatient={onNewPatient}
    />
  </div>
}
