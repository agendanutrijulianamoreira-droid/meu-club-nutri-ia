import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'

const ALLOWED_PLANS = new Set(['community', 'tech_diet', 'vip'])

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )
}

function getTrustedOrigin(request: NextRequest) {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    if (configured) return configured

    // Safe local/preview fallback. Production should always set NEXT_PUBLIC_APP_URL.
    return request.nextUrl.origin.replace(/\/$/, '')
}

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the authenticated user.
 * Identity is always derived from the server-side Supabase session; callers
 * cannot choose another userId/email through the request body.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseServerClient(cookies())
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const body = await request.json()
        const { planId, tenantSlug, customerName, referralCode } = body ?? {}

        if (!planId || !tenantSlug) {
            return NextResponse.json(
                { error: 'planId e tenantSlug são obrigatórios' },
                { status: 400 }
            )
        }

        if (!ALLOWED_PLANS.has(planId)) {
            return NextResponse.json(
                { error: 'Plano inválido. Use community, tech_diet ou vip' },
                { status: 400 }
            )
        }

        const supabaseAdmin = getSupabaseAdmin()

        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, brand_name')
            .eq('slug', tenantSlug)
            .eq('is_active', true)
            .single()

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
        }

        const { data: existingProfile, error: profileReadError } = await supabaseAdmin
            .from('profiles')
            .select('id, tenant_id, email, name')
            .eq('user_id', user.id)
            .maybeSingle()

        if (profileReadError) {
            console.error('[Checkout] Profile read error:', profileReadError)
            return NextResponse.json({ error: 'Não foi possível validar o perfil' }, { status: 500 })
        }

        // Never silently move an existing profile between tenants during checkout.
        if (existingProfile?.tenant_id && existingProfile.tenant_id !== tenant.id) {
            return NextResponse.json(
                { error: 'Este usuário já pertence a outra clínica' },
                { status: 409 }
            )
        }

        const customerEmail = user.email || existingProfile?.email
        if (!customerEmail) {
            return NextResponse.json({ error: 'Usuário sem e-mail válido' }, { status: 400 })
        }

        if (!existingProfile) {
            const { error: insertError } = await supabaseAdmin.from('profiles').insert({
                user_id: user.id,
                tenant_id: tenant.id,
                name: String(customerName || user.user_metadata?.full_name || customerEmail.split('@')[0] || 'Paciente').slice(0, 120),
                email: customerEmail,
                role: 'patient',
                current_plan: 'community',
            })

            if (insertError) {
                console.error('[Checkout] Profile insert error:', insertError)
                return NextResponse.json({ error: 'Não foi possível preparar o perfil' }, { status: 500 })
            }
        } else if (!existingProfile.tenant_id) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ tenant_id: tenant.id })
                .eq('user_id', user.id)
                .is('tenant_id', null)

            if (updateError) {
                console.error('[Checkout] Profile tenant update error:', updateError)
                return NextResponse.json({ error: 'Não foi possível vincular o perfil à clínica' }, { status: 500 })
            }
        }

        const { data: planConfig, error: planError } = await supabaseAdmin
            .from('tenant_plans')
            .select('price_cents, stripe_price_id, description')
            .eq('tenant_id', tenant.id)
            .eq('plan', planId)
            .eq('is_active', true)
            .single()

        if (planError || !planConfig) {
            return NextResponse.json({ error: 'Plano não configurado para esta clínica' }, { status: 404 })
        }

        const origin = getTrustedOrigin(request)
        const successUrl = `${origin}/${tenantSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
        const cancelUrl = `${origin}/${tenantSlug}/checkout?plan=${encodeURIComponent(planId)}&cancelled=true`

        const safeReferralCode = typeof referralCode === 'string'
            ? referralCode.trim().slice(0, 80)
            : undefined

        const sessionConfig: any = {
            mode: 'subscription',
            client_reference_id: user.id,
            customer_email: customerEmail,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                tenant_id: tenant.id,
                tenant_slug: tenantSlug,
                plan: planId,
                user_id: user.id,
                ...(safeReferralCode ? { referral_code: safeReferralCode } : {}),
            },
            subscription_data: {
                metadata: {
                    tenant_id: tenant.id,
                    plan: planId,
                    user_id: user.id,
                    ...(safeReferralCode ? { referral_code: safeReferralCode } : {}),
                },
            },
            allow_promotion_codes: true,
        }

        if (planConfig.stripe_price_id) {
            sessionConfig.line_items = [{ price: planConfig.stripe_price_id, quantity: 1 }]
        } else {
            sessionConfig.line_items = [{
                price_data: {
                    currency: 'brl',
                    unit_amount: planConfig.price_cents,
                    recurring: { interval: 'month' },
                    product_data: {
                        name: `${tenant.brand_name} - Plano ${planId === 'tech_diet' ? 'Tech Diet' : planId === 'vip' ? 'VIP Premium' : 'Community'}`,
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
            { error: 'Erro ao criar sessão de checkout' },
            { status: 500 }
        )
    }
}
