import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { PLAN_LABELS } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * GET /api/admin/billing
 * Returns billing summary for the authenticated nutritionist's tenant:
 * - subscription stats (active count, MRR)
 * - plan breakdown
 * - recent subscription events
 * - Stripe connection status
 */
export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin()
        const supabase = createSupabaseServerClient(cookies())
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Find tenant owned by user
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id, name, slug')
            .eq('owner_id', user.id)
            .single()

        if (!tenant) {
            // Fallback: check profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('tenant_id, role')
                .eq('user_id', user.id)
                .single()

            if (!profile || !['admin', 'nutritionist', 'nutri'].includes(profile.role?.toLowerCase())) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            return await getBillingData(profile.tenant_id)
        }

        return await getBillingData(tenant.id)
    } catch (error: any) {
        console.error('[Billing API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro interno' },
            { status: 500 }
        )
    }
}

async function getBillingData(tenantId: string) {
    const supabaseAdmin = getSupabaseAdmin()
    // 1. Get all subscriptions for this tenant
    const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, user_id, plan, status, gateway, gateway_subscription_id, gateway_customer_id, current_period_start, current_period_end, amount_cents, cancel_at_period_end, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })

    if (subError) {
        console.error('[Billing] Subscriptions query error:', subError)
        return NextResponse.json({ error: 'Erro ao buscar assinaturas' }, { status: 500 })
    }

    const allSubs = subscriptions || []

    // 2. Count active subscriptions
    const activeSubs = allSubs.filter(s => ['active', 'trialing'].includes(s.status))
    const activeCount = activeSubs.length

    // 3. Calculate MRR (Monthly Recurring Revenue)
    const mrrCents = activeSubs.reduce((sum, s) => sum + (s.amount_cents || 0), 0)
    const mrrBrl = mrrCents / 100

    // 4. Plan breakdown
    const planBreakdown: Record<string, { count: number; revenue_cents: number }> = {}
    for (const sub of activeSubs) {
        const plan = sub.plan || 'unknown'
        if (!planBreakdown[plan]) {
            planBreakdown[plan] = { count: 0, revenue_cents: 0 }
        }
        planBreakdown[plan].count++
        planBreakdown[plan].revenue_cents += sub.amount_cents || 0
    }

    // 5. Recent events (last 20 subscription changes)
    const recentEvents = allSubs.slice(0, 20).map(s => ({
        id: s.id,
        user_id: s.user_id,
        plan: s.plan,
        plan_label: PLAN_LABELS[s.plan] || s.plan,
        status: s.status,
        gateway: s.gateway,
        amount_cents: s.amount_cents,
        cancel_at_period_end: s.cancel_at_period_end,
        current_period_end: s.current_period_end,
        updated_at: s.updated_at,
        created_at: s.created_at,
    }))

    // 6. Check Stripe connection
    let stripeConnected = false
    try {
        const stripe = getStripe()
        // Quick check - list 1 product to verify key works
        await stripe.products.list({ limit: 1 })
        stripeConnected = true
    } catch {
        stripeConnected = false
    }

    // 7. Status counts
    const statusCounts: Record<string, number> = {}
    for (const sub of allSubs) {
        statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1
    }

    return NextResponse.json({
        tenant_id: tenantId,
        stripe_connected: stripeConnected,
        summary: {
            active_subscribers: activeCount,
            total_subscriptions: allSubs.length,
            mrr_cents: mrrCents,
            mrr_brl: mrrBrl,
            status_counts: statusCounts,
        },
        plan_breakdown: Object.entries(planBreakdown).map(([plan, data]) => ({
            plan,
            label: PLAN_LABELS[plan] || plan,
            ...data,
        })),
        recent_events: recentEvents,
    })
}
