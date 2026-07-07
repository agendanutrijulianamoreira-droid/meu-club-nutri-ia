"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { z } from "zod"

// Service role client for bypassing RLS (safe in server actions after auth check)
function getAdminClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured")
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

const profileSchema = z.object({
    honorific: z.string().optional(),
    display_name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    phone: z.string().optional(),
    license_type: z.string().optional(),
    license_number: z.string().optional(),
    license_state: z.string().optional(),
    specialty: z.string().optional(),
    avatar_url: z.string().optional()
})

const clinicSchema = z.object({
    clinic_phone: z.string().optional(),
    clinic_whatsapp: z.string().optional(),
    clinic_address: z.string().optional(),
    clinic_instagram: z.string().optional(),
})

export async function updateProfileAction(data: z.infer<typeof profileSchema>) {
    const supabase = createSupabaseServerClient(cookies())
    const parsed = profileSchema.safeParse(data)

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        // Authenticate user via session
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Não autorizado")

        // Use admin client to bypass RLS (prevents infinite recursion)
        const adminClient = getAdminClient()

        const { error } = await adminClient
            .from('profiles')
            .update({
                honorific: data.honorific,
                name: data.display_name,
                phone: data.phone,
                license_type: data.license_type,
                license_number: data.license_number,
                license_state: data.license_state,
                specialty: data.specialty,
                avatar_url: data.avatar_url,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

        if (error) throw error
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateClinicAction(data: z.infer<typeof clinicSchema>) {
    const supabase = createSupabaseServerClient(cookies())
    const parsed = clinicSchema.safeParse(data)

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Não autorizado")

        // Update tenant directly by owner_id — RLS enforces ownership, no service role needed
        // Identidade visual (brand_name/brand_color/logo_url) é editada só em Configurações do Clube
        const { error } = await supabase
            .from('tenants')
            .update({
                clinic_phone: data.clinic_phone,
                clinic_whatsapp: data.clinic_whatsapp,
                clinic_address: data.clinic_address,
                clinic_instagram: data.clinic_instagram,
                updated_at: new Date().toISOString()
            })
            .eq('owner_id', user.id)

        if (error) throw error
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

