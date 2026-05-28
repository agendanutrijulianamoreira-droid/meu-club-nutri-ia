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

export const PLAN_LABELS: Record<string, string> = {
    community: 'Clube',
    tech_diet: 'Modo Paciente',
    vip: 'Modo Paciente Premium',
}

export const PLAN_PRICES = {
    annual: { amount_cents: 4700, label: 'R$47/ano', per_month: 'R$3,92/mês' },
    monthly: { amount_cents: 9700, label: 'R$97/mês', per_month: 'R$97/mês' },
} as const
