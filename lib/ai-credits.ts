'use server'

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminClient() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// ==========================================
// TIPOS
// ==========================================

export interface AICredits {
    id: string
    tenant_id: string
    credits_remaining: number
    credits_total_used: number
    monthly_limit: number
    last_reset_at: string
    created_at: string
    updated_at: string
}

export interface AICreditsResult {
    success: boolean
    error?: string
    credits_remaining?: number
}

// ==========================================
// GET: Buscar saldo de créditos
// ==========================================

export async function getAICredits(tenantId: string): Promise<AICredits | null> {
    const supabase = getAdminClient()

    const { data, error } = await supabase
        .from('ai_credits')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error) {
        // Se não existe, criar registro padrão
        if (error.code === 'PGRST116') {
            const { data: newCredits } = await supabase
                .from('ai_credits')
                .insert({ tenant_id: tenantId, credits_remaining: 5, monthly_limit: 5 })
                .select()
                .single()
            return newCredits
        }
        console.error('[ai-credits] Erro ao buscar créditos:', error)
        return null
    }

    return data
}

// ==========================================
// CONSUME: Verificar e consumir 1 crédito
// ==========================================

export async function checkAndConsumeCredit(
    tenantId: string,
    generationType: string = 'protocol',
    description?: string
): Promise<AICreditsResult> {
    if (!tenantId) {
        return { success: false, error: 'Tenant ID não fornecido' }
    }

    const supabase = getAdminClient()

    try {
        // === BYPASS para Admin/Premium: crédito ilimitado ===
        const { data: tenant } = await supabase
            .from('tenants')
            .select('plan_tier, owner_id')
            .eq('id', tenantId)
            .single()

        if (tenant) {
            // Premium tem crédito ilimitado
            if (tenant.plan_tier === 'premium') {
                console.log('[ai-credits] Tenant premium — crédito ilimitado, bypass.')
                return { success: true, credits_remaining: 999 }
            }

            // Owner admin também tem crédito ilimitado
            if (tenant.owner_id) {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('user_id', tenant.owner_id)
                    .single()

                if (ownerProfile?.role === 'admin') {
                    console.log('[ai-credits] Owner é admin — crédito ilimitado, bypass.')
                    return { success: true, credits_remaining: 999 }
                }
            }
        }

        // === Fluxo normal: consumir crédito ===
        const { data, error } = await supabase.rpc('consume_ai_credit', {
            p_tenant_id: tenantId,
            p_generation_type: generationType,
            p_description: description || `Geração de ${generationType}`
        })

        if (error) {
            console.error('[ai-credits] Erro no RPC consume_ai_credit:', error)
            return { success: false, error: 'Erro ao verificar créditos de IA.' }
        }

        // O RPC retorna um JSON com success e credits_remaining
        const result = typeof data === 'string' ? JSON.parse(data) : data

        return {
            success: result.success,
            error: result.error || undefined,
            credits_remaining: result.credits_remaining
        }
    } catch (err: any) {
        console.error('[ai-credits] Erro inesperado:', err)
        return { success: false, error: 'Erro interno ao processar créditos.' }
    }
}

// ==========================================
// REFILL: Adicionar créditos
// ==========================================

export async function refillCredits(
    tenantId: string,
    amount: number,
    type: 'monthly_refill' | 'manual_add' | 'bonus' = 'manual_add',
    description?: string
): Promise<AICreditsResult> {
    if (!tenantId || amount <= 0) {
        return { success: false, error: 'Parâmetros inválidos' }
    }

    const supabase = getAdminClient()

    try {
        const { data, error } = await supabase.rpc('refill_ai_credits', {
            p_tenant_id: tenantId,
            p_amount: amount,
            p_type: type,
            p_description: description || `Recarga de ${amount} créditos`
        })

        if (error) {
            console.error('[ai-credits] Erro no RPC refill_ai_credits:', error)
            return { success: false, error: 'Erro ao recarregar créditos.' }
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data

        return {
            success: result.success,
            credits_remaining: result.credits_remaining
        }
    } catch (err: any) {
        console.error('[ai-credits] Erro inesperado:', err)
        return { success: false, error: 'Erro interno ao processar recarga.' }
    }
}

// ==========================================
// TRANSACTIONS: Buscar histórico
// ==========================================

export async function getAICreditTransactions(tenantId: string, limit: number = 20) {
    const supabase = getAdminClient()

    const { data, error } = await supabase
        .from('ai_credit_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[ai-credits] Erro ao buscar transações:', error)
        return []
    }

    return data || []
}
