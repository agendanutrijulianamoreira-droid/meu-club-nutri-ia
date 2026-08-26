import { DashboardPreferencesClient } from "../DashboardPreferencesClient"

export const dynamic = 'force-dynamic'

export default function DashboardRulesPage() {
  return <DashboardPreferencesClient section="rules" />
}
