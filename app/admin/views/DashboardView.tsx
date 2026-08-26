"use client"

import { DashboardQuickActions } from "../dashboard/DashboardQuickActions"
import { DashboardHomeV5 } from "./DashboardHomeV5"

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
    <DashboardHomeV5
      setView={setView}
      userName={userName}
      tenantName={tenantName}
      tenantId={tenantId}
      onNewPatient={onNewPatient}
    />
  </>
}
