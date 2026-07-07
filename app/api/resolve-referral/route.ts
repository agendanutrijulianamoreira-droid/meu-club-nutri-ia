import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code")
    if (!code) {
        return NextResponse.json({ error: "Missing referral code" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient(cookies())

    const { data: professional, error } = await supabase
        .from("professional_profiles")
        .select(`
            user_id,
            status,
            profiles!professional_profiles_user_id_fkey (
                tenant_id,
                name
            )
        `)
        .eq("referral_code", code.toUpperCase())
        .eq("status", "active")
        .single()

    if (error || !professional) {
        return NextResponse.json({ error: "Referral code not found" }, { status: 404 })
    }

    const profile = (professional.profiles as any)
    if (!profile?.tenant_id) {
        return NextResponse.json({ error: "Nutritionist has no active club" }, { status: 404 })
    }

    const { data: tenant } = await supabase
        .from("tenants")
        .select("slug, brand_name, brand_color, logo_url")
        .eq("id", profile.tenant_id)
        .single()

    if (!tenant?.slug) {
        return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    return NextResponse.json({
        tenant_slug: tenant.slug,
        tenant_name: tenant.brand_name,
        nutritionist_name: profile.name,
        referral_code: code.toUpperCase(),
    })
}
