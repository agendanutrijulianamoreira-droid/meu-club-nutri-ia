import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function getAuthenticatedTenant(supabase: any, userId: string) {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('owner_id', userId)
        .single()
    return tenant
}

/**
 * GET /api/admin/checkout-plans
 * Returns configured tenant_plans for the authenticated nutritionist.
 */
export async function GET() {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getAuthenticatedTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: plans } = await supabaseAdmin
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('price_cents', { ascending: true })

    return NextResponse.json({ plans: plans || [] })
}

/**
 * POST /api/admin/checkout-plans
 * Upserts a plan price for the authenticated nutritionist's tenant.
 *
 * Body: { plan, price_cents, stripe_price_id?, description?, features? }
 */
export async function POST(request: NextRequest) {
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getAuthenticatedTenant(supabase, user.id)
    if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { plan, price_cents, stripe_price_id, description, features } = body

    if (!['tech_diet', 'vip'].includes(plan)) {
        return NextResponse.json({ error: 'Plano inválido. Use tech_diet ou vip.' }, { status: 400 })
    }

    if (!price_cents || price_cents < 100) {
        return NextResponse.json({ error: 'Preço mínimo: 100 centavos (R$1,00).' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
        .from('tenant_plans')
        .upsert({
            tenant_id: tenant.id,
            plan,
            price_cents,
            stripe_price_id: stripe_price_id || null,
            description: description || null,
            features: features ? JSON.stringify(features) : '[]',
            is_active: true,
        }, { onConflict: 'tenant_id,plan' })

    if (error) {
        console.error('[checkout-plans] Upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
