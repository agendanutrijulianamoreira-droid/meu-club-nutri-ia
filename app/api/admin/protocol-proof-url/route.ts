import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { createSupabaseServerClient } from "@/lib/supabase-server"

const STAFF_ROLES = new Set(["admin", "nutritionist", "nutri"])

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const progressId = new URL(request.url).searchParams.get("progress_id")
  if (!progressId) return NextResponse.json({ error: "progress_id é obrigatório" }, { status: 400 })

  const { data: viewer, error: viewerError } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const role = String(viewer?.role || user.user_metadata?.user_type || user.user_metadata?.role || "").toLowerCase()
  if (viewerError || !viewer?.tenant_id || !STAFF_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: progress, error: progressError } = await supabase
    .from("protocol_progress")
    .select("photo_url, assignment_id")
    .eq("id", progressId)
    .maybeSingle()

  if (progressError || !progress?.photo_url || !progress.assignment_id) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 })
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("protocol_assignments")
    .select("user_id")
    .eq("id", progress.assignment_id)
    .maybeSingle()

  if (assignmentError || !assignment?.user_id) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 })
  }

  const { data: patient, error: patientError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", assignment.user_id)
    .maybeSingle()

  if (patientError || patient?.tenant_id !== viewer.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("protocol-photos")
    .createSignedUrl(progress.photo_url, 300)

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Não foi possível abrir a prova" }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, expires_in: 300 })
}
