'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface LinkedPatient {
    user_id: string
    name: string
    email: string
    avatar_url: string | null
    current_plan: string
    signup_date: string
    plan_type: string
    amount_paid: number
    commission_generated: number
}

export function useLinkedPatients(professionalId: string | undefined) {
    const [patients, setPatients] = useState<LinkedPatient[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // supabase importado do singleton

    useEffect(() => {
        if (professionalId) {
            loadPatients()
        }
    }, [professionalId])

    const loadPatients = async () => {
        if (!professionalId) return

        try {
            setLoading(true)

            // Buscar pacientes que fizeram compras via este profissional
            const { data, error: fetchError } = await supabase
                .from('sales')
                .select(`
          patient_id,
          plan_type,
          amount,
          commission_amount,
          created_at,
          profiles!sales_patient_id_fkey (
            user_id,
            name,
            email,
            avatar_url,
            current_plan
          )
        `)
                .eq('professional_id', professionalId)
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            // Agrupar por paciente (pode ter múltiplas compras)
            const patientsMap = new Map<string, LinkedPatient>()

            data?.forEach(sale => {
                const profile = sale.profiles
                if (!profile) return

                const existing = patientsMap.get(profile.user_id)

                if (!existing) {
                    patientsMap.set(profile.user_id, {
                        user_id: profile.user_id,
                        name: profile.name || 'Sem nome',
                        email: profile.email || '',
                        avatar_url: profile.avatar_url,
                        current_plan: profile.current_plan || 'free',
                        signup_date: sale.created_at,
                        plan_type: sale.plan_type,
                        amount_paid: Number(sale.amount || 0),
                        commission_generated: Number(sale.commission_amount || 0)
                    })
                } else {
                    // Agregar valores se tiver múltiplas compras
                    existing.amount_paid += Number(sale.amount || 0)
                    existing.commission_generated += Number(sale.commission_amount || 0)
                }
            })

            setPatients(Array.from(patientsMap.values()))

        } catch (err: any) {
            console.error('Erro ao carregar pacientes:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return { patients, loading, error, refetch: loadPatients }
}
