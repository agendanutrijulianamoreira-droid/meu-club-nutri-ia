'use server';

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export async function signupUser(formData: FormData) {
    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string
    const fullName = (formData.get('fullName') as string)?.trim()
    const userType = (formData.get('userType') as string) || 'patient'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'E-mail inválido' }
    }
    if (!password || password.length < 6) {
        return { success: false, error: 'Senha deve ter no mínimo 6 caracteres' }
    }
    if (!fullName || fullName.length < 2) {
        return { success: false, error: 'Nome deve ter no mínimo 2 caracteres' }
    }

    const supabaseAdmin = getAdminClient()

    try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                user_type: userType,
            },
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Falha ao criar usuário')

        console.log('[signupUser] Usuário criado:', authData.user.id, 'tipo:', userType)

        return { success: true, message: 'Conta criada com sucesso! Você já pode fazer login.' }
    } catch (error: any) {
        console.error('[signupUser]', error)

        if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            return { success: false, error: 'Este e-mail já está cadastrado.' }
        }
        return { success: false, error: error.message || 'Erro ao criar conta. Tente novamente.' }
    }
}
