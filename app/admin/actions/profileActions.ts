"use server"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { cookies } from "next/headers"
import { z } from "zod"

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
    brand_name: z.string().min(2, "Nome da clínica deve ter no mínimo 2 caracteres"),
    clinic_phone: z.string().optional(),
    clinic_whatsapp: z.string().optional(),
    clinic_address: z.string().optional(),
    clinic_instagram: z.string().optional(),
    brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").optional(),
    logo_url: z.string().optional()
})

export async function updateProfileAction(data: z.infer<typeof profileSchema>) {
    const supabase = createSupabaseServerClient(cookies())
    const parsed = profileSchema.safeParse(data)

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Não autorizado")

        const { error } = await supabase
            .from('profiles')
            .update({
                honorific: data.honorific,
                name: data.display_name, // Sync with core name column
                display_name: data.display_name,
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

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('user_id', user.id)
            .single()

        if (!profile || profile.role !== 'admin') {
            throw new Error("Apenas administradores podem alterar configurações da clínica.")
        }

        const { error } = await supabase
            .from('tenants')
            .update({
                brand_name: data.brand_name,
                clinic_phone: data.clinic_phone,
                clinic_whatsapp: data.clinic_whatsapp,
                clinic_address: data.clinic_address,
                clinic_instagram: data.clinic_instagram,
                brand_color: data.brand_color,
                logo_url: data.logo_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.tenant_id)

        if (error) throw error
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
