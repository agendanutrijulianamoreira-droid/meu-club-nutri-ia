import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    // Admin client com service role para criar usuários
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = serviceRoleKey
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )
        : null;

    if (!supabaseAdmin) {
        console.error('API Error: SUPABASE_SERVICE_ROLE_KEY is missing');
        return NextResponse.json({ error: 'Configuração do servidor incompleta (Service Role)' }, { status: 500 })
    }

    // 0. Autenticação do Solicitante (Admin/Nutri)
    const supabase = createSupabaseServerClient(cookies())
    const { data: { user: currentUser }, error: authUserError } = await supabase.auth.getUser()

    if (authUserError || !currentUser) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar perfil do solicitante
    const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', currentUser.id)
        .single()

    const roleLower = (requesterProfile?.role || '').toLowerCase()
    const metadataRole = (currentUser.user_metadata?.user_type || currentUser.user_metadata?.role || '').toLowerCase()
    
    // Check if authorized by DB role or metadata
    let isAuthorized = ['admin', 'nutritionist', 'nutri'].includes(roleLower) || ['admin', 'nutritionist', 'nutri'].includes(metadataRole)
    let tenantId = requesterProfile?.tenant_id

    // Fallback: If not found in profile, check if user owns a tenant
    if (!tenantId || !isAuthorized) {
        const { data: ownedTenants } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('owner_id', currentUser.id)
            .limit(1)
        
        if (ownedTenants && ownedTenants.length > 0) {
            tenantId = ownedTenants[0].id
            isAuthorized = true 
        }
    }

    if (!tenantId || !isAuthorized) {
        console.error('[API create-professional] Denied:', { 
            userId: currentUser.id, 
            dbRole: requesterProfile?.role, 
            metadataRole, 
            tenantId 
        })
        return NextResponse.json({ error: 'Acesso negado ou clínica não encontrada.' }, { status: 403 })
    }

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
            email_confirm: true,
            user_metadata: {
                name,
                role: 'professional',
                tenant_id: tenantId
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
                tenant_id: tenantId,
                name,
                email,
                role: 'nutritionist', // O profissional atua como nutri no sistema
                current_plan: 'professional',
                nutri_coins: 0,
                total_xp: 0,
                current_level: 1,
                current_streak: 0,
                longest_streak: 0
            })

        if (profileError) {
            console.error('Erro ao criar perfil:', profileError)
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
                tenant_id: tenantId,
                commission_rate: commission_rate || 10,
                is_moderator: is_moderator || false,
                has_agenda: has_agenda || false,
                pix_key,
                status: 'active'
            })

        if (professionalError) {
            console.error('Erro ao criar perfil profissional:', professionalError)
            await supabaseAdmin.from('profiles').delete().eq('user_id', authData.user.id)
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

            return NextResponse.json(
                { error: 'Erro ao criar perfil profissional: ' + professionalError.message },
                { status: 500 }
            )
        }

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
