import { Suspense } from "react"
import { AdminRouteShell } from "@/components/admin/AdminRouteShell"
import { AdminProductivityLayer } from "@/components/admin/AdminProductivityLayer"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteShell>
    <Suspense fallback={children}>
      <AdminProductivityLayer>{children}</AdminProductivityLayer>
    </Suspense>
  </AdminRouteShell>
}
