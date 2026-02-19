import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/tenant-info?slug=minha-clinica
 * Retorna informações públicas do tenant + planos configurados.
 * Usado pela checkout page para carregar branding e preços.
 */
export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get('slug')

    if (!slug) {
        return NextResponse.json({ error: 'slug é obrigatório' }, { status: 400 })
    }

    // Buscar tenant (dados públicos apenas)
    const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, brand_name, slug, logo_url, primary_color, secondary_color')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

    if (tenantError || !tenant) {
        return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
    }

    // Buscar planos ativos
    const { data: plans } = await supabaseAdmin
        .from('tenant_plans')
        .select('plan, price_cents, description, features, stripe_price_id')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('price_cents', { ascending: true })

    return NextResponse.json({
        tenant: {
            brand_name: tenant.brand_name,
            slug: tenant.slug,
            logo_url: tenant.logo_url,
            primary_color: tenant.primary_color,
            secondary_color: tenant.secondary_color,
        },
        plans: plans || [],
    })
}
