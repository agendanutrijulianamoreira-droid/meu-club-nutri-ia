import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazy-initialized Stripe client.
 * Avoids crashing at build time when STRIPE_SECRET_KEY isn't set.
 */
export function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
        }
        _stripe = new Stripe(key, {
            apiVersion: '2026-01-28.clover',
            typescript: true,
        })
    }
    return _stripe
}

/**
 * Plan IDs → labels
 */
export const PLAN_LABELS: Record<string, string> = {
    community: 'Community (Grátis)',
    tech_diet: 'Tech Diet',
    vip: 'VIP Premium',
}
