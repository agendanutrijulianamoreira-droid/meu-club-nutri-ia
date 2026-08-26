import { DashboardPreferencesClientV2 } from "../DashboardPreferencesClientV2"

export const dynamic = 'force-dynamic'

export default function DashboardSettingsPage() {
  return <DashboardPreferencesClientV2 section="layout" />
}
