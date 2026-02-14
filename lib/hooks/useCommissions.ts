'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface Commission {
    id: string
    patient_id: string
    plan_type: string
    amount: number
    commission_amount: number
    commission_paid: boolean
    commission_paid_at: string | null
    created_at: string
    paid_at: string | null
    patient_name?: string
    patient_email?: string
}

interface CommissionSummary {
    total_sales: number
    total_earned: number
    paid: number
    pending: number
    current_month_sales: number
    current_month_earned: number
}

export function useCommissions(professionalId: string | undefined) {
    const [commissions, setCommissions] = useState<Commission[]>([])
    const [summary, setSummary] = useState<CommissionSummary>({
        total_sales: 0,
        total_earned: 0,
        paid: 0,
        pending: 0,
        current_month_sales: 0,
        current_month_earned: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // supabase importado do singleton

    useEffect(() => {
        if (professionalId) {
            loadCommissions()
        }
    }, [professionalId])

    const loadCommissions = async () => {
        if (!professionalId) return

        try {
            setLoading(true)

            // Buscar histórico de vendas
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select(`
          *,
          profiles!sales_patient_id_fkey (
            name,
            email
          )
        `)
                .eq('professional_id', professionalId)
                .order('created_at', { ascending: false })
                .limit(50)

            if (salesError) throw salesError

            // Formatar dados
            const formatted = salesData?.map(sale => ({
                ...sale,
                patient_name: sale.profiles?.name,
                patient_email: sale.profiles?.email
            })) || []

            setCommissions(formatted)

            // Calcular resumo
            const now = new Date()
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()

            const summary = formatted.reduce((acc, sale) => {
                const saleDate = new Date(sale.created_at)
                const isCurrentMonth = saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear

                acc.total_sales += 1
                acc.total_earned += Number(sale.commission_amount || 0)

                if (sale.commission_paid) {
                    acc.paid += Number(sale.commission_amount || 0)
                } else {
                    acc.pending += Number(sale.commission_amount || 0)
                }

                if (isCurrentMonth) {
                    acc.current_month_sales += 1
                    acc.current_month_earned += Number(sale.commission_amount || 0)
                }

                return acc
            }, {
                total_sales: 0,
                total_earned: 0,
                paid: 0,
                pending: 0,
                current_month_sales: 0,
                current_month_earned: 0
            })

            setSummary(summary)

        } catch (err: any) {
            console.error('Erro ao carregar comissões:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return { commissions, summary, loading, error, refetch: loadCommissions }
}
