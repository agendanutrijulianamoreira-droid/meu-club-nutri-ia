'use server'

import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * Server Action para "autocura" de perfil.
 * Chamada pelo CLIENT (useEffect) quando o page.tsx detecta que o perfil
 * está sem tenant_id ou com o tenant demo.
 * 
 * Isso evita fazer UPDATE durante o render do Server Component (anti-pattern Next.js).
 */
export async function repairProfile() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        return { repaired: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { repaired: false, error: 'Não autenticado' }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
    )

    // Buscar tenant que o usuário é owner
    const { data: ownedTenants } = await supabaseAdmin
        .from('tenants')
        .select('id, brand_name')
        .eq('owner_id', user.id)
        .limit(1)

    if (!ownedTenants || ownedTenants.length === 0) {
        return { repaired: false, error: 'Nenhuma clínica encontrada' }
    }

    const realTenantId = ownedTenants[0].id
    const tenantName = ownedTenants[0].brand_name || ''

    // Reparar o perfil
    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ tenant_id: realTenantId, role: 'admin' })
        .eq('user_id', user.id)

    if (updateError) {
        return { repaired: false, error: updateError.message }
    }

    console.log(`[repairProfile] Profile repaired for user ${user.id} → tenant ${realTenantId}`)

    return { repaired: true, tenantId: realTenantId, tenantName }
}
