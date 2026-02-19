import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/webhooks/stripe
 * Recebe eventos do Stripe para processar pagamentos.
 * 
 * Eventos tratados:
 * - checkout.session.completed → Cria/ativa subscription + cria user se necessário
 * - customer.subscription.updated → Atualiza status da subscription
 * - customer.subscription.deleted → Cancela subscription
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
 * Checkout concluído → cria/atualiza subscription + cria user se necessário
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const tenantId = session.metadata?.tenant_id
    const plan = session.metadata?.plan
    const customerEmail = session.customer_details?.email

    if (!tenantId || !plan || !customerEmail) {
        console.error('[Webhook] Missing metadata:', { tenantId, plan, customerEmail })
        return
    }

    console.log(`[Webhook] Checkout completed: ${customerEmail} → ${plan} (tenant: ${tenantId})`)

    // 1. Buscar ou criar user no Supabase Auth
    let userId: string

    // Verificar se user já existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail)

    if (existingUser) {
        userId = existingUser.id
        console.log(`[Webhook] User exists: ${userId}`)
    } else {
        // Criar novo user com senha temporária
        const tempPassword = `nutri_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: customerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name: session.customer_details?.name || customerEmail.split('@')[0],
                user_type: 'patient',
            },
        })

        if (createError || !newUser?.user) {
            console.error('[Webhook] Failed to create user:', createError)
            return
        }

        userId = newUser.user.id
        console.log(`[Webhook] User created: ${userId}`)

        // Enviar email de boas-vindas com link de reset de senha
        await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: customerEmail,
        })
    }

    // 2. Garantir que o profile existe e está no tenant correto
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single()

    if (!profile) {
        // Criar profile (caso trigger não tenha criado)
        await supabaseAdmin.from('profiles').insert({
            user_id: userId,
            tenant_id: tenantId,
            name: session.customer_details?.name || customerEmail.split('@')[0],
            email: customerEmail,
            role: 'patient',
            current_plan: plan,
        })
    } else {
        // Atualizar tenant_id se necessário
        await supabaseAdmin
            .from('profiles')
            .update({ tenant_id: tenantId })
            .eq('user_id', userId)
    }

    // 3. Recuperar dados da subscription do Stripe
    const subscriptionId = session.subscription as string
    let periodStart: string | null = null
    let periodEnd: string | null = null
    let amountCents: number | null = null

    if (subscriptionId) {
        const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any
        periodStart = new Date(sub.current_period_start * 1000).toISOString()
        periodEnd = new Date(sub.current_period_end * 1000).toISOString()
        amountCents = sub.items?.data?.[0]?.price?.unit_amount || null
    }

    // 4. Criar/atualizar record na tabela subscriptions
    const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
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
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,tenant_id',
        })

    if (subError) {
        // Se não tem unique constraint, fazer insert direto
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

    console.log(`[Webhook] Subscription activated: ${userId} → ${plan}`)
}

/**
 * Subscription atualizada (upgrade/downgrade, renovação, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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
