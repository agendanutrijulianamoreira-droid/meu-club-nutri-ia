import { Suspense } from "react"
import { AdminRouteShell } from "@/components/admin/AdminRouteShell"
import { AdminProductivityLayerV2 } from "@/components/admin/AdminProductivityLayerV2"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteShell>
    <Suspense fallback={children}>
      <AdminProductivityLayerV2>{children}</AdminProductivityLayerV2>
    </Suspense>
  </AdminRouteShell>
}
