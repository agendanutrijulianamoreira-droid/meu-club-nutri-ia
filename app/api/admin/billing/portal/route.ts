import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * POST /api/admin/billing/portal
 * Creates a Stripe Customer Portal session so a patient can manage their subscription.
 *
 * Body: { customerId?: string }
 * If customerId is not provided, looks up the current user's Stripe customer ID.
 *
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseServerClient(cookies())
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const body = await request.json().catch(() => ({}))
        let customerId: string | undefined = body.customerId

        // If no customerId provided, find it from the user's subscription
        if (!customerId) {
            // Check if the user is a tenant owner (nutri managing their billing)
            const { data: tenant } = await supabaseAdmin
                .from('tenants')
                .select('id')
                .eq('owner_id', user.id)
                .single()

            let tenantId = tenant?.id

            if (!tenantId) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('tenant_id')
                    .eq('user_id', user.id)
                    .single()
                tenantId = profile?.tenant_id
            }

            if (!tenantId) {
                return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
            }

            // Look up gateway_customer_id from subscriptions
            const { data: subscription } = await supabaseAdmin
                .from('subscriptions')
                .select('gateway_customer_id, gateway')
                .eq('user_id', user.id)
                .eq('tenant_id', tenantId)
                .eq('gateway', 'stripe')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single()

            if (!subscription?.gateway_customer_id) {
                return NextResponse.json(
                    { error: 'Nenhuma assinatura Stripe encontrada para este usuário' },
                    { status: 404 }
                )
            }

            customerId = subscription.gateway_customer_id
        }

        const stripe = getStripe()
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${origin}/admin?tab=settings`,
        })

        return NextResponse.json({ url: portalSession.url })
    } catch (error: any) {
        console.error('[Billing Portal] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao criar sessão do portal' },
            { status: 500 }
        )
    }
}
