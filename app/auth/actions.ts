'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function signupUser(formData: FormData) {
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const password = formData.get('password') as string
    const fullName = (formData.get('fullName') as string)?.trim()
    const userType = (formData.get('userType') as string) || 'patient'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'E-mail inválido' }
    }
    if (!password || password.length < 8) {
        return { success: false, error: 'Senha deve ter no mínimo 8 caracteres' }
    }
    if (!fullName || fullName.length < 2) {
        return { success: false, error: 'Nome deve ter no mínimo 2 caracteres' }
    }

    // Release v1: professional accounts are provisioned/approved through the
    // administrative flow. A public form must never create a confirmed
    // nutritionist/admin account with service-role privileges.
    if (userType === 'nutritionist' || userType === 'nutri' || userType === 'admin') {
        return {
            success: false,
            error: 'O cadastro profissional está disponível apenas por convite nesta versão.',
        }
    }

    const supabase = createSupabaseServerClient(cookies())

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
            },
        })

        if (error) throw error
        if (!data.user) throw new Error('Falha ao criar usuário')

        return {
            success: true,
            message: data.session
                ? 'Conta criada com sucesso.'
                : 'Conta criada. Confirme seu e-mail para continuar.',
        }
    } catch (error: any) {
        console.error('[signupUser]', error)
        if (error?.code === 'user_already_exists' || error?.message?.includes('already registered')) {
            return { success: false, error: 'Este e-mail já está cadastrado.' }
        }
        return { success: false, error: 'Erro ao criar conta. Tente novamente.' }
    }
}
