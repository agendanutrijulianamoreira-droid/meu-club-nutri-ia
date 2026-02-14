import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client com service role para criar usuários
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Precisa desta env var
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, name, commission_rate, is_moderator, has_agenda, pix_key } = body

        // Validações
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, senha e nome são obrigatórios' },
                { status: 400 }
            )
        }

        // 1. Criar usuário no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirmar email
            user_metadata: {
                name,
                role: 'professional'
            }
        })

        if (authError || !authData.user) {
            console.error('Erro ao criar usuário:', authError)
            return NextResponse.json(
                { error: authError?.message || 'Erro ao criar usuário no Auth' },
                { status: 500 }
            )
        }

        // 2. Criar perfil básico em profiles
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                user_id: authData.user.id,
                tenant_id: '00000000-0000-0000-0000-000000000001', // Ajustar para o tenant correto
                name,
                email,
                current_plan: 'professional', // Plano para profissionais
                nutri_coins: 0,
                total_xp: 0,
                current_level: 1,
                current_streak: 0,
                longest_streak: 0
            })

        if (profileError) {
            console.error('Erro ao criar perfil:', profileError)
            // Tentar deletar o usuário criado
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

            return NextResponse.json(
                { error: 'Erro ao criar perfil: ' + profileError.message },
                { status: 500 }
            )
        }

        // 3. Criar perfil profissional
        const { error: professionalError } = await supabaseAdmin
            .from('professional_profiles')
            .insert({
                user_id: authData.user.id,
                commission_rate: commission_rate || 10,
                is_moderator: is_moderator || false,
                has_agenda: has_agenda || false,
                pix_key,
                status: 'active'
                // referral_code será gerado automaticamente pelo trigger
            })

        if (professionalError) {
            console.error('Erro ao criar perfil profissional:', professionalError)
            // Rollback: deletar perfil e usuário
            await supabaseAdmin.from('profiles').delete().eq('user_id', authData.user.id)
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

            return NextResponse.json(
                { error: 'Erro ao criar perfil profissional: ' + professionalError.message },
                { status: 500 }
            )
        }

        // Sucesso!
        return NextResponse.json({
            success: true,
            user_id: authData.user.id,
            message: 'Profissional cadastrado com sucesso!'
        })

    } catch (error: any) {
        console.error('Erro na API:', error)
        return NextResponse.json(
            { error: error.message || 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}
