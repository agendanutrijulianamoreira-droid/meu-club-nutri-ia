import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { OnboardingService } from '@/lib/services/onboarding'

export async function POST(request: NextRequest) {
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
        return NextResponse.json({ error: 'Server configuration incomplete (Service Role)' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient(cookies())
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get requester's profile
    const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', currentUser.id)
        .single()

    const roleLower = (requesterProfile?.role || '').toLowerCase()
    const metadataRole = (currentUser.user_metadata?.user_type || currentUser.user_metadata?.role || '').toLowerCase()
    
    let isAuthorized = ['admin', 'nutritionist', 'nutri'].includes(roleLower) || ['admin', 'nutritionist', 'nutri'].includes(metadataRole)
    let tenantId = requesterProfile?.tenant_id

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
        const debugMsg = `Acesso negado. Role DB: "${roleLower}", Metadata: "${metadataRole}". Clínica ID: ${tenantId || 'não encontrada'}.`
        return NextResponse.json({ error: debugMsg }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { email, password, name, phone, plan = 'manual' } = body

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                role: 'patient',
                tenant_id: tenantId
            }
        })

        if (authError || !authData.user) {
            return NextResponse.json({ error: authError?.message || 'Error creating user in Auth' }, { status: 500 })
        }

        const userId = authData.user.id

        // 2. Criar ou Atualizar perfil (resiliente a triggers)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                user_id: userId,
                tenant_id: tenantId,
                name: name,
                email: email,
                phone: phone,
                role: 'patient',
                current_plan: plan,
                nutri_coins: 100,
                total_xp: 0,
                current_level: 1
            }, { onConflict: 'user_id' })

        if (profileError) {
            console.error('Profile Upsert Error:', profileError)
            // Não deletamos o usuário aqui se o erro for apenas de perfil, 
            // mas o 500 informará o admin.
            return NextResponse.json({ error: 'Erro ao configurar perfil: ' + profileError.message }, { status: 500 })
        }

        // 3. Subscription
        await supabaseAdmin.from('subscriptions').insert({
            user_id: userId,
            tenant_id: tenantId,
            plan: plan,
            status: 'active',
            gateway: 'manual',
            updated_at: new Date().toISOString(),
        })

        let emailSent = false
        try {
            const result = await OnboardingService.sendWelcomeMessages(userId, tenantId, { password })
            emailSent = result.emailSent
        } catch (err) {
            console.error('[create-patient] Onboarding error:', err)
        }

        return NextResponse.json({ success: true, user_id: userId, email_sent: emailSent, message: 'Sucesso!' })

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
