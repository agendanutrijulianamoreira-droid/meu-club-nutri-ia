import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { PatientPreviewView } from "@/app/admin/views/PatientPreviewView"

export const dynamic = "force-dynamic"

export default async function AdminPatientPreviewPage() {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const role = String(profile?.role || user.user_metadata?.user_type || user.user_metadata?.role || "").toLowerCase()
  if (!profile?.tenant_id || !["admin", "nutritionist", "nutri"].includes(role)) redirect("/patient/home")

  return <PatientPreviewView tenantId={profile.tenant_id} />
}
