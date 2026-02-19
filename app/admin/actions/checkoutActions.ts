'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const checkoutSchema = z.object({
    planId: z.enum(['tech_diet', 'vip'], { error: 'Plano inválido' }),
    tenantId: z.string().uuid('ID do tenant inválido'),
})

/**
 * Server Action para buscar os planos configurados de um tenant
 */
export async function getTenantPlans(tenantId: string) {
    const supabase = createSupabaseServerClient(cookies())

    const { data, error } = await supabase
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('price_cents', { ascending: true })

    if (error) return { plans: [], error: error.message }
    return { plans: data || [], error: null }
}

/**
 * Server Action para salvar/atualizar preços dos planos
 */
export async function saveTenantPlan(data: {
    tenantId: string,
    plan: 'tech_diet' | 'vip',
    priceCents: number,
    stripePriceId?: string,
    description?: string,
    features?: string[],
}) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { error } = await supabase
        .from('tenant_plans')
        .upsert({
            tenant_id: data.tenantId,
            plan: data.plan,
            price_cents: data.priceCents,
            stripe_price_id: data.stripePriceId || null,
            description: data.description || null,
            features: JSON.stringify(data.features || []),
            is_active: true,
        }, {
            onConflict: 'tenant_id,plan'
        })

    if (error) return { error: error.message }
    return { success: true }
}
