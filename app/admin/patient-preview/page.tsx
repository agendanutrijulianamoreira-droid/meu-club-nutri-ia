import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { PatientPreviewView } from "@/app/admin/views/PatientPreviewView"
import { createSupabaseServerClient } from "@/lib/supabase-server"

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

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-[#2B1A10]/10 bg-white px-3 py-2 text-xs font-bold text-[#2B1A10]/70 shadow-sm hover:text-[#2B1A10]"
        >
          <ArrowLeft size={14} /> Voltar ao painel
        </Link>
      </div>
      <PatientPreviewView tenantId={profile.tenant_id} />
    </main>
  )
}
