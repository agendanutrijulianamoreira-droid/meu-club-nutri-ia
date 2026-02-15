"use server"

import { createClient } from "@supabase/supabase-js"
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function createTenantAndBindProfileAction(formData: {
    brandName: string,
    slug: string,
    primaryColor: string,
    secondaryColor: string,
    whatsapp?: string,
    logoUrl?: string
}) {
    // We use service role to bypass RLS constraints during onboarding setup
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        // 1. Verify Session
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Não autorizado")

        // 2. Create Tenant
        const { data: tenant, error: tError } = await supabase
            .from('tenants')
            .insert([{
                brand_name: formData.brandName,
                slug: formData.slug.toLowerCase(),
                primary_color: formData.primaryColor,
                secondary_color: formData.secondaryColor,
                whatsapp: formData.whatsapp || null,
                logo_url: formData.logoUrl || null,
                owner_id: user.id
            }])
            .select()
            .single()

        if (tError) {
            if (tError.code === '23505') throw new Error("Este endereço (slug) já está em uso. Escolha outro.")
            throw tError
        }

        // 3. Upsert Profile with Tenant ID
        const { error: pError } = await supabase
            .from('profiles')
            .upsert({
                user_id: user.id,
                tenant_id: tenant.id,
                role: 'admin', // First setup user is always admin
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
                email: user.email
            }, {
                onConflict: 'user_id'
            })

        if (pError) throw pError

        return { success: true, tenantId: tenant.id }
    } catch (error: any) {
        console.error("Error creating tenant:", error)
        return { success: false, error: error.message }
    }
}
