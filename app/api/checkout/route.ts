import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/checkout
 * Cria uma Stripe Checkout Session para assinatura de um plano.
 * 
 * Body: { planId: 'tech_diet' | 'vip', tenantSlug: string, customerEmail?: string }
 * Returns: { url: string } (Stripe Checkout URL para redirect)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { planId, tenantSlug, customerEmail } = body

        if (!planId || !tenantSlug) {
            return NextResponse.json(
                { error: 'planId e tenantSlug são obrigatórios' },
                { status: 400 }
            )
        }

        if (!['tech_diet', 'vip'].includes(planId)) {
            return NextResponse.json(
                { error: 'Plano inválido. Use tech_diet ou vip' },
                { status: 400 }
            )
        }

        // Buscar tenant pelo slug
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, brand_name')
            .eq('slug', tenantSlug)
            .single()

        if (tenantError || !tenant) {
            return NextResponse.json(
                { error: 'Clínica não encontrada' },
                { status: 404 }
            )
        }

        // Buscar preço configurado para o plano desse tenant
        const { data: planConfig } = await supabaseAdmin
            .from('tenant_plans')
            .select('price_cents, stripe_price_id, description')
            .eq('tenant_id', tenant.id)
            .eq('plan', planId)
            .eq('is_active', true)
            .single()

        if (!planConfig) {
            return NextResponse.json(
                { error: 'Plano não configurado para esta clínica' },
                { status: 404 }
            )
        }

        // Construir URL base
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const successUrl = `${origin}/${tenantSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
        const cancelUrl = `${origin}/${tenantSlug}/checkout?plan=${planId}&cancelled=true`

        // Criar Checkout Session
        let sessionConfig: any = {
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                tenant_id: tenant.id,
                tenant_slug: tenantSlug,
                plan: planId,
            },
            subscription_data: {
                metadata: {
                    tenant_id: tenant.id,
                    plan: planId,
                },
            },
            allow_promotion_codes: true,
        }

        // Se tem email, pré-preencher
        if (customerEmail) {
            sessionConfig.customer_email = customerEmail
        }

        // Se tem stripe_price_id configurado, usar; senão, criar price ad-hoc
        if (planConfig.stripe_price_id) {
            sessionConfig.line_items = [{
                price: planConfig.stripe_price_id,
                quantity: 1,
            }]
        } else {
            // Preço ad-hoc (para quem não configurou no Stripe Dashboard)
            sessionConfig.line_items = [{
                price_data: {
                    currency: 'brl',
                    unit_amount: planConfig.price_cents,
                    recurring: { interval: 'month' },
                    product_data: {
                        name: `${tenant.brand_name} - Plano ${planId === 'tech_diet' ? 'Tech Diet' : 'VIP Premium'}`,
                        description: planConfig.description || `Assinatura mensal do ${tenant.brand_name}`,
                    },
                },
                quantity: 1,
            }]
        }

        const session = await getStripe().checkout.sessions.create(sessionConfig)

        return NextResponse.json({ url: session.url })
    } catch (error: any) {
        console.error('[Checkout] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao criar sessão de checkout' },
            { status: 500 }
        )
    }
}
