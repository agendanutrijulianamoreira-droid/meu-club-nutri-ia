import { DashboardPreferencesClient } from "../DashboardPreferencesClient"

export const dynamic = 'force-dynamic'

export default function DashboardSettingsPage() {
  return <DashboardPreferencesClient section="layout" />
}
