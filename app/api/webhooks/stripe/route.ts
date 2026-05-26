import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { OnboardingService } from '@/lib/services/onboarding'
import { triggerOrchestrator } from '@/lib/services/anthropic'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/webhooks/stripe
 * Recebe eventos do Stripe para processar pagamentos.
 * 
 * FLUXO CORRETO:
 * 1. Paciente cria conta no frontend (signUp)
 * 2. Frontend chama /api/checkout com userId → Stripe Session com client_reference_id
 * 3. Webhook recebe checkout.completed → apenas UPDATE no profile/subscription
 * 
 * NENHUM user é criado aqui. O user já existe.
 */
export async function POST(request: NextRequest) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = getStripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
    } catch (err: any) {
        console.error('[Webhook] Signature verification failed:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`[Webhook] Event: ${event.type}`)

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
                break

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
                break

            default:
                console.log(`[Webhook] Unhandled event: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error: any) {
        console.error('[Webhook] Processing error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * Checkout concluído → ativa subscription (user já existe!)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const supabaseAdmin = getSupabaseAdmin()
    // O user_id vem do client_reference_id (definido no /api/checkout)
    const userId = session.client_reference_id || session.metadata?.user_id
    const tenantId = session.metadata?.tenant_id
    const plan = session.metadata?.plan

    if (!userId || !tenantId || !plan) {
        console.error('[Webhook] Missing data:', { userId, tenantId, plan })
        return
    }

    console.log(`[Webhook] Checkout completed: user=${userId} → plan=${plan} (tenant=${tenantId})`)

    // NOTA: NÃO atualizamos profiles aqui!
    // A trigger sync_subscription_to_profile() faz isso automaticamente
    // quando a subscription é inserida/atualizada abaixo.

    // 1. Recuperar dados da subscription do Stripe
    const subscriptionId = session.subscription as string
    let periodStart: string | null = null
    let periodEnd: string | null = null
    let amountCents: number | null = null
    let verifiedPlan = plan

    if (subscriptionId) {
        const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any
        periodStart = new Date(sub.current_period_start * 1000).toISOString()
        periodEnd = new Date(sub.current_period_end * 1000).toISOString()
        const paidPriceId: string = sub.items?.data?.[0]?.price?.id || ''
        amountCents = sub.items?.data?.[0]?.price?.unit_amount || null

        // Validate: resolve plan from actual price_id paid (prevents metadata tampering)
        if (paidPriceId) {
            const { data: planConfig } = await supabaseAdmin
                .from('tenant_plans')
                .select('plan')
                .eq('tenant_id', tenantId)
                .eq('stripe_price_id', paidPriceId)
                .eq('is_active', true)
                .single()

            if (planConfig?.plan) {
                if (planConfig.plan !== plan) {
                    console.warn(`[Webhook] Plan mismatch — metadata="${plan}" but price_id maps to "${planConfig.plan}". Using verified plan.`)
                }
                verifiedPlan = planConfig.plan
            } else {
                console.warn(`[Webhook] Price ID "${paidPriceId}" not found in tenant_plans for tenant ${tenantId}. Falling back to metadata plan "${plan}".`)
            }
        }
    }

    // 3. Criar record na tabela subscriptions (using verifiedPlan from price lookup)
    const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
            user_id: userId,
            tenant_id: tenantId,
            plan: verifiedPlan,
            status: 'active',
            gateway: 'stripe',
            gateway_subscription_id: subscriptionId,
            gateway_customer_id: session.customer as string,
            gateway_checkout_session_id: session.id,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            amount_cents: amountCents,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,tenant_id',
        })

    if (subError) {
        console.warn('[Webhook] Upsert failed, trying insert:', subError.message)
        await supabaseAdmin.from('subscriptions').insert({
            user_id: userId,
            tenant_id: tenantId,
            plan: plan,
            status: 'active',
            gateway: 'stripe',
            gateway_subscription_id: subscriptionId,
            gateway_customer_id: session.customer as string,
            gateway_checkout_session_id: session.id,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            amount_cents: amountCents,
        })
    }

    console.log(`[Webhook] Subscription activated: ${userId} → ${verifiedPlan}`)

    // 4. Enviar boas-vindas (Email/WhatsApp)
    await OnboardingService.sendWelcomeMessages(userId, tenantId)

    // 5. Trigger agent orchestrator → Onboarding Agent (3 mensagens personalizadas no inbox)
    triggerOrchestrator('stripe_webhook', tenantId, userId, { plan: verifiedPlan, subscription_id: subscriptionId })
}

/**
 * Subscription atualizada (upgrade/downgrade, renovação, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const supabaseAdmin = getSupabaseAdmin()
    const tenantId = subscription.metadata?.tenant_id
    const plan = subscription.metadata?.plan

    if (!tenantId) {
        console.warn('[Webhook] Subscription updated but no tenant_id in metadata')
        return
    }

    const status = mapStripeStatus(subscription.status)
    const sub = subscription as any

    await supabaseAdmin
        .from('subscriptions')
        .update({
            status,
            plan: plan || undefined,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
        })
        .eq('gateway_subscription_id', subscription.id)

    console.log(`[Webhook] Subscription updated: ${subscription.id} → ${status}`)
}

/**
 * Subscription cancelada
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'cancelled',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
        })
        .eq('gateway_subscription_id', subscription.id)

    console.log(`[Webhook] Subscription cancelled: ${subscription.id}`)
}

/**
 * Mapear status do Stripe → nosso enum
 */
function mapStripeStatus(stripeStatus: string): string {
    switch (stripeStatus) {
        case 'active': return 'active'
        case 'trialing': return 'trialing'
        case 'past_due': return 'past_due'
        case 'canceled':
        case 'unpaid':
        case 'incomplete_expired':
            return 'cancelled'
        default:
            return 'pending'
    }
}
