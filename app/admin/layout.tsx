import { AdminRouteShell } from "@/components/admin/AdminRouteShell"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRouteShell>{children}</AdminRouteShell>
}
