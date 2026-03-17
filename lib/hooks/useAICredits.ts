import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'

// ==========================================
// TIPOS
// ==========================================

export interface AICreditsData {
    id: string
    tenant_id: string
    credits_remaining: number
    credits_total_used: number
    monthly_limit: number
    last_reset_at: string
    created_at: string
    updated_at: string
}

export interface AITransaction {
    id: string
    tenant_id: string
    amount: number
    type: 'consumption' | 'monthly_refill' | 'manual_add' | 'bonus'
    description: string | null
    generation_type: string | null
    balance_after: number
    created_at: string
}

// ==========================================
// HOOK: useAICredits
// ==========================================

export function useAICredits(tenantId?: string) {
    const [credits, setCredits] = useState<AICreditsData | null>(null)
    const [transactions, setTransactions] = useState<AITransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCredits = useCallback(async () => {
        if (!tenantId) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            // Buscar saldo
            const { data: creditsData, error: creditsError } = await supabase
                .from('ai_credits')
                .select('*')
                .eq('tenant_id', tenantId)
                .single()

            if (creditsError && creditsError.code !== 'PGRST116') {
                throw creditsError
            }

            setCredits(creditsData || null)

            // Buscar transações recentes
            const { data: txData, error: txError } = await supabase
                .from('ai_credit_transactions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(30)

            if (txError) {
                console.warn('[useAICredits] Erro ao buscar transações:', txError)
            }

            setTransactions(txData || [])
        } catch (err: any) {
            console.error('[useAICredits] Erro:', err)
            setError(err.message || 'Erro ao buscar créditos')
        } finally {
            setLoading(false)
        }
    }, [tenantId])

    useEffect(() => {
        fetchCredits()
    }, [fetchCredits])

    const usagePercentage = credits
        ? Math.round(((credits.monthly_limit - credits.credits_remaining) / credits.monthly_limit) * 100)
        : 0

    return {
        credits,
        transactions,
        loading,
        error,
        usagePercentage,
        refresh: fetchCredits
    }
}
