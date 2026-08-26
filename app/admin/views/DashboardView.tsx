"use client"

import { DashboardQuickActions } from "../dashboard/DashboardQuickActions"
import { DashboardHomeV4 } from "./DashboardHomeV4"

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
  return <>
    <DashboardQuickActions tenantId={tenantId} />
    <DashboardHomeV4
      setView={setView}
      userName={userName}
      tenantName={tenantName}
      tenantId={tenantId}
      onNewPatient={onNewPatient}
    />
  </>
}
