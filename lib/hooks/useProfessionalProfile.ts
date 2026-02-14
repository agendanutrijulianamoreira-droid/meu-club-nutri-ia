'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface ProfessionalProfile {
    id: string
    user_id: string
    is_moderator: boolean
    has_agenda: boolean
    commission_rate: number
    referral_code: string
    status: 'active' | 'inactive' | 'pending'
    pix_key: string | null
    total_sales: number
    total_commission_earned: number
    created_at: string
    // Join com profiles
    name?: string
    email?: string
    avatar_url?: string
}

export function useProfessionalProfile() {
    const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // supabase importado do singleton

    useEffect(() => {
        loadProfile()
    }, [])

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setError('Usuário não autenticado')
                setLoading(false)
                return
            }

            const { data, error: fetchError } = await supabase
                .from('professional_profiles')
                .select(`
          *,
          profiles!professional_profiles_user_id_fkey (
            name,
            email,
            avatar_url
          )
        `)
                .eq('user_id', user.id)
                .single()

            if (fetchError) throw fetchError

            // Flatten nested profile data
            const formattedProfile = {
                ...data,
                name: data.profiles?.name,
                email: data.profiles?.email,
                avatar_url: data.profiles?.avatar_url
            }

            setProfile(formattedProfile)
        } catch (err: any) {
            console.error('Erro ao carregar perfil:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return { profile, loading, error, refetch: loadProfile }
}
